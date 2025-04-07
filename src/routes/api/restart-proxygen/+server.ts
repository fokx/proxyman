import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import process from 'node:process';
import { get_proxygen_pid } from '$lib/server';
import { spwan_proxygen } from '$lib/server';

export const POST: RequestHandler = async ({ request }) => {
	const { from_port } = await request.json();
	console.log(from_port);
	try {
		let pid = get_proxygen_pid();
		if (pid) {
			process.kill(pid, 'SIGINT');
			// return json({ error: 'proxygen not running' }, { status: 500 });
		} else {
			console.log('proxygen not running');
		}
		spwan_proxygen(from_port);
		return json({ output: 'spawned' }, { status: 200 });
	} catch (error) {
		// convert error to string
		const errorString = error instanceof Error ? error.message : String(error);
		return json({ errorString }, { status: 500 });
	}
};
