import { spawn, spawnSync } from 'child_process';
import fs from 'node:fs';

import type { LayoutServerLoad } from './$types';
import { dbs } from '$lib/server/db';
import { glob } from 'glob';
import { proxies } from '$lib/server/db/schema';
import {globSync} from 'glob';
import yaml from 'yaml';
import assert from 'node:assert';
import { parse, stringify } from 'yaml'
import { get_proxygen_pid, spwan_proxygen } from '$lib/server';

export async function read_tuic_cfg(file: string) {
	const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
	const stats = fs.statSync(file);
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
export async function read_hyc_cfg(file: string) {
	const cfg = yaml.parse(fs.readFileSync(file, 'utf8'));
	const stats = fs.statSync(file);
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
export async function read_np_cfg(file: string) {
	const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
	const stats = fs.statSync(file);
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


export function get_proxygen_pid() {
	let pids = spawnSync('pgrep', ['-f', 'proxygen']).stdout.toString().trim().split(/\r?\n/);
	if (pids.length === 0 || (pids.length === 1 && pids[0] === '')) {
		return null;
	}
	console.log('pids', pids);
	let pid = null;
	for (const p of pids) {
		if (!isNaN(Number(p))) {
			pid = Number(p);
			let path = fs.readlinkSync("/proc/" + pid + "/exe");
			// console.log('path', path);
			if (path == "/usr/bin/proxygen") {
				break;
			}
		}
	}
	return pid
}

export function spwan_proxygen(from_port){
	console.log('starting spwan');
	spawn('proxygen', ['--to', '3999', '--from', from_port]).stdout.toString().trim();
	console.log('proxygen spwaned');
}

export async function run_proxygen_if_not_running() {
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
	return pid
}