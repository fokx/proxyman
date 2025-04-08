import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { TestType, URL_LATENCY_TEST, URL_USABILITY_TEST } from '$lib';
import { dbs } from '$lib/server/db';
import { proxies } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { publish } from '$app/server';

export const POST: RequestHandler = async ({ request }) => {
	const { socks5_port, type } = await request.json();
	let status_code = 200;
	let output;
	try {
		let command = '';
		if (type === TestType.USABLITY) {
			command = `curl --connect-timeout 3 --socks5 localhost:${socks5_port} -I ${URL_USABILITY_TEST}`;
		} else if (type === TestType.LATENCY) {
			command = `curl --connect-timeout 6 --socks5 localhost:${socks5_port} -w '%{time_pretransfer}' -o /dev/null ${URL_LATENCY_TEST}`;
		}
		output = execSync(command).toString();
	} catch (error) {
		output = error instanceof Error ? error.message : String(error);
		status_code = 500;
	}
	if (type === TestType.LATENCY) {
		await dbs
			.update(proxies)
			.set({ latency_ms: 1000 * parseFloat(output), latency_updated_at: new Date() })
			.where(eq(proxies.local_port, socks5_port));
	}
	await dbs
		.update(proxies)
		.set({ usable: status_code === 200, usable_updated_at: new Date() })
		.where(eq(proxies.local_port, socks5_port));
	const data = dbs.select().from(proxies).all();
	publish('all-proxies', { type: 'all-proxies', data: data });
	return json({ output: output }, { status: status_code });
};
