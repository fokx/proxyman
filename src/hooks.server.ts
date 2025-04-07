import { globSync } from 'glob';
import { dbs } from '$lib/server/db/index.js';
import {
	get_proxygen_pid,
	read_hyc_cfg,
	read_np_cfg,
	read_tuic_cfg,
	run_proxygen_if_not_running,
	spwan_proxygen
} from '$lib/server';
import { proxies } from '$lib/server/db/schema.js';
import type { ServerInit } from '@sveltejs/kit';
import fs from 'node:fs/promises';

export const init: ServerInit = async () => {
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
	});

	await run_proxygen_if_not_running();

};