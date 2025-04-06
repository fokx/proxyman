import type { RequestHandler } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  const { action, name } = await request.json();
  try {
    const output = execSync(`systemctl ${action} ${name}`).toString();
    return json({ output }, { status: 200 });
  } catch (error) {
    // convert error to string
    const errorString = error instanceof Error ? error.message : String(error);
    return json({ errorString }, { status: 500 });
  }
};
