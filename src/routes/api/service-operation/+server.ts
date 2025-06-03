import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';

export const POST: RequestHandler = async ({ request }) => {
	const { action, name } = await request.json();
	try {
		/*
		visudo, add:
		username ALL=(ALL) NOPASSWD: /usr/bin/systemctl * np@*
		username ALL=(ALL) NOPASSWD: /usr/bin/systemctl * hyc@*
		username ALL=(ALL) NOPASSWD: /usr/bin/systemctl * tuicc@*
		username ALL=(ALL) NOPASSWD: /usr/bin/systemctl * xr@*
		 */
		if (action.startsWith("server-")) {
			return json({"msg": "server side operations not implemented yet" }, { status: 500 });
		}
		const output = execSync(`sudo systemctl ${action} ${name}`).toString();
		return json({ output }, { status: 200 });
	} catch (error) {
		// convert error to string
		const errorString = error instanceof Error ? error.message : String(error);
		return json({ errorString }, { status: 500 });
	}
};
