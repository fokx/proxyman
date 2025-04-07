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
import { get_proxygen_pid, run_proxygen_if_not_running, spwan_proxygen } from '$lib/server';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const proxyList = await dbs.select().from(proxies);
	let pid = await run_proxygen_if_not_running();
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


