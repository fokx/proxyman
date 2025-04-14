import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { TestType, URL_IPV4_TEST, URL_IPV6_TEST, URL_LATENCY_TEST, URL_USABILITY_TEST } from '$lib';
import { dbs } from '$lib/server/db';
import { proxies } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { publish } from '$app/server';

export const POST: RequestHandler = async ({ request }) => {
	const { socks5_port, type } = await request.json();
	let status_code = 200;
	let output;
	const command_proxychains = `proxychains4 -q -f /etc/pc/${socks5_port}.conf curl -sS --connect-timeout 10`;
	const command_curl = `curl -sS --connect-timeout 10 -x socks5h://localhost:${socks5_port}`;
	try {
		let command = '';
		if (type === TestType.USABLITY) {
			command = `curl -sS --connect-timeout 3 -x socks5h://localhost:${socks5_port} -I ${URL_USABILITY_TEST}`;
		} else if (type === TestType.LATENCY) {
			command = `curl -sS --connect-timeout 6 -x socks5h://localhost:${socks5_port} -w '%{time_pretransfer}' -o /dev/null ${URL_LATENCY_TEST}`;
		} else if (type === TestType.IPV4) {
			command = `${command_curl} ${URL_IPV4_TEST}`;
		} else if (type === TestType.IPV6) {
			command = `${command_curl} ${URL_IPV6_TEST}`;
		}
		console.log(command);
		output = execSync(command).toString();
	} catch (error) {
		output = error instanceof Error ? error.message : String(error);
		status_code = 500;
	}
	let outgoing_ipv4, outgoing_ipv4_location, outgoing_ipv4_country;
	if (type == TestType.IPV4 || type == TestType.IPV6) {
		let lines = output.split('\n');
		lines.forEach((line) => {
			if (line.startsWith('ip=')) {
				outgoing_ipv4 = line.split('=')[1].trim();
			} else if (line.startsWith('colo=')) {
				outgoing_ipv4_location = line.split('=')[1].trim();
			} else if (line.startsWith('loc=')) {
				outgoing_ipv4_country = line.split('=')[1].trim();
			}
		});
	}

	if (type == TestType.IPV4) {
		if (status_code != 500) {
			await dbs
				.update(proxies)
				.set({
					outgoing_ipv4: outgoing_ipv4,
					outgoing_ipv4_country: outgoing_ipv4_country,
					outgoing_ipv4_location: outgoing_ipv4_location
				})
				.where(eq(proxies.local_port, socks5_port));
		}
	} else if (type == TestType.IPV6) {
		if (status_code != 500) {
			await dbs
				.update(proxies)
				.set({
					outgoing_ipv6: outgoing_ipv4,
					outgoing_ipv6_country: outgoing_ipv4_country,
					outgoing_ipv6_location: outgoing_ipv4_location
				})
				.where(eq(proxies.local_port, socks5_port));
		}
	} else if (type === TestType.LATENCY) {
		await dbs
			.update(proxies)
			.set({ latency_ms: 1000 * parseFloat(output), latency_updated_at: new Date()})
			.where(eq(proxies.local_port, socks5_port));
	} else if (type === TestType.USABLITY) 	{
		/* empty */
	} else {
		return json({ message: `Invalid test type: ${type} not supported by API backend` }, { status: 400 });
	}
	if (type !== TestType.IPV6) {
		// won't update usability if ipv6 test failed
		await dbs
			.update(proxies)
			.set({ usable: status_code === 200, usable_updated_at: new Date() })
			.where(eq(proxies.local_port, socks5_port));
	}
	const data = dbs.select().from(proxies).all();
	publish('all-proxies', { type: 'all-proxies', data: data });
	return json({ output: output }, { status: status_code });
};
