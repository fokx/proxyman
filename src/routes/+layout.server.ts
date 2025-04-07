import type { LayoutServerLoad } from './$types';
import { dbs } from '$lib/server/db';
import { glob } from 'glob';
import { proxies } from '$lib/server/db/schema';
import fs from 'node:fs/promises';
import {globSync} from 'glob';
import { spawnSync } from 'child_process';

import yaml from 'yaml';
import assert from 'node:assert';
import { parse, stringify } from 'yaml'
import { get_proxygen_pid, spwan_proxygen } from '$lib/server';
async function read_tuic_cfg(file: string) {
	const cfg = JSON.parse(await fs.readFile(file, 'utf8'));
	const stats = await fs.stat(file);
	const ret = {
		name: file.split('/').at(-1).split('.').at(0),
		remote_addr: cfg.relay.ip,
		remote_port: cfg.relay.server.split(':').at(1),
		sni: cfg.relay.server.split(':').at(0),
		local_addr: cfg.local.server.split(':').at(0),
		local_port: cfg.local.server.split(':').at(1),
		created_at: stats.birthtime,
		updated_at: stats.mtime,
		tool: 'tuicc',
	};
	return ret;
}
async function read_hyc_cfg(file: string) {
	const cfg = yaml.parse(await fs.readFile(file, 'utf8'));
	const stats = await fs.stat(file);
	const ret = {
		name: file.split('/').at(-1).split('.').at(0),
		remote_addr: cfg.server.split(':').at(0),
		remote_port: cfg.server.split(':').at(1),
		sni: cfg.tls.sni,
		local_addr: cfg.socks5.listen.split(':').at(0),
		local_port: cfg.socks5.listen.split(':').at(1),
		created_at: stats.birthtime,
		updated_at: stats.mtime,
		tool: 'hyc',
	};
	return ret;
}
async function read_np_cfg(file: string) {
	const cfg = JSON.parse(await fs.readFile(file, 'utf8'));
	const stats = await fs.stat(file);
	let sni1 = cfg.proxy.split('@').at(1);
	let sni2 = cfg["host-resolver-rules"].split(' ')[1];
	assert.equal(sni1, sni2);
	const ret = {
		name: file.split('/').at(-1).split('.').at(0),
		remote_addr: cfg["host-resolver-rules"].split(' ')[2],
		remote_port: 443,
		sni: sni2,
		local_addr: cfg.listen.replace("socks://", "").split(':').at(0),
		local_port: cfg.listen.replace("socks://", "").split(':').at(1),
		created_at: stats.birthtime,
		updated_at: stats.mtime,
		tool: 'np',
	};
	return ret;
}
let isLoadExecuted = false;


export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!isLoadExecuted) {

		let cfgs = [];
		cfgs.push(...await Promise.all(globSync('/etc/tuicc/*.json').map(async (file) => {
			return read_tuic_cfg(file);
		})));
		cfgs.push(...await Promise.all(globSync('/etc/hyc/*.yaml').map(async (file) => {
			return read_hyc_cfg(file);
		})));
		cfgs.push(...await Promise.all(globSync('/etc/np/*.json').map(async (file) => {
			return read_np_cfg(file);
		})));
		await dbs.transaction(async (trx) => {
			for (const cfg of cfgs) {
				await trx.insert(proxies).values(cfg).onConflictDoUpdate({
					target: [proxies.tool, proxies.name],
					set: cfg
				});
			}
		})
		isLoadExecuted = true;
	}
	const proxyList = await dbs.select().from(proxies);
	let pid = get_proxygen_pid();
	if (!pid) {
		// sort by latency
		proxyList.sort((a, b) => {
			if (a.latency_ms === null) {
				return 1;
			}
			if (b.latency_ms === null) {
				return -1;
			}
			return a.latency_ms - b.latency_ms;
		});
		let new_port = proxyList[0].local_port;
		console.log('no pid, spwan new proxygen with port: ', new_port);
		spwan_proxygen(new_port);
		pid = get_proxygen_pid();
	}
	let current_proxygen_port;
	if (pid) {
		await fs.readFile("/proc/"+pid+"/cmdline", 'utf8').then((data) => {
			const args = data.split('\0');
			const proxy_arg_index = args.indexOf('--from');
			if (proxy_arg_index !== -1) {
				current_proxygen_port = args[proxy_arg_index+1];
				current_proxygen_port = parseInt(current_proxygen_port);
			}
		})
	}
	let current_proxy;
	if (current_proxygen_port) {
		current_proxy = proxyList.find((proxy) => proxy.local_port === current_proxygen_port);
	}
	return {
		current_proxy: current_proxy,
		all_proxies: proxyList
	};
};


