import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'child_process';

// POST endpoint to restart a proxy
export const POST: RequestHandler = async ({ request }) => {
    const { tool, name } = await request.json();

    if (!tool || !name) {
        return new Response('Tool and name parameters are required', { status: 400 });
    }

    try {
        // Construct the service name
        const serviceName = `${tool}@${name}`;

        // Restart the service using systemctl
        const output = execSync(`sudo systemctl restart ${serviceName}`).toString();

        // Return success
        return json({ 
            success: true, 
            message: `Proxy ${serviceName} restarted successfully`,
            output 
        });
    } catch (error) {
        console.error(`Error restarting proxy ${tool}@${name}:`, error);
        const errorString = error instanceof Error ? error.message : String(error);
        return json({ error: errorString }, { status: 500 });
    }
};
