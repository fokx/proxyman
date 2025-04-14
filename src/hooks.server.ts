import { globSync } from 'glob';
import { sqlite3_db, dbs } from '$lib/server/db/index.js';
import { read_hyc_cfg, read_np_cfg, read_tuic_cfg, run_proxygen_if_not_running } from '$lib/server';
import { proxies } from '$lib/server/db/schema.js';
import type { ServerInit } from '@sveltejs/kit';

export const init: ServerInit = async () => {
	const cfgs = [];
	cfgs.push(
		...(await Promise.all(
			globSync('/etc/tuicc/*.json').map(async (file) => {
				return read_tuic_cfg(file);
			})
		))
	);
	cfgs.push(
		...(await Promise.all(
			globSync('/etc/hyc/*.yaml').map(async (file) => {
				return read_hyc_cfg(file);
			})
		))
	);
	cfgs.push(
		...(await Promise.all(
			globSync('/etc/np/*.json').map(async (file) => {
				return read_np_cfg(file);
			})
		))
	);
	console.log('adding cfgs', cfgs);
	console.log('if missing some cfgs, run\nsudo chown -R tr:liu /etc/tuicc /etc/hyc /etc/np/\n');
	await dbs.transaction(async (trx) => {
		for (const cfg of cfgs) {
			await trx
				.insert(proxies)
				.values(cfg)
				.onConflictDoUpdate({
					target: [proxies.tool, proxies.name],
					set: cfg
				});
		}
	});

	await run_proxygen_if_not_running();
};

process.on('sveltekit:shutdown', async (reason) => {
	console.warn(reason);
	await sqlite3_db.close();
	console.log('sqlite3_db closed');
});

process.on('SIGINT',
	async () => {
		console.log('\nSIGINT received, shutting down...');
		await sqlite3_db.close();
		console.log('sqlite3_db closed');
		process.exit(0);
	});

process.on('SIGTERM',
	async () => {
		console.log('\nSIGTERM received, shutting down...');
		await sqlite3_db.close();
		console.log('sqlite3_db closed');
		process.exit(0);
	});

