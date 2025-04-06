import { spawnSync } from 'child_process';
import fs from 'node:fs';

export function get_proxygen_pid() {
	let pids = spawnSync('pgrep', ['-f', 'proxygen']).stdout.toString().trim().split(/\r?\n/);
	if (pids.length === 0) {
		return null;
	}
	let pid = null;
	for (const p of pids) {
		if (!isNaN(Number(p))) {
			pid = Number(p);
			let path = fs.readlinkSync("/proc/" + pid + "/exe");
			console.log('path', path);
			if (path == "/usr/bin/proxygen") {
				break;
			}
		}
	}
	return pid
}
