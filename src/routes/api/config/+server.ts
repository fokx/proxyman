import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

// GET endpoint to read a configuration file
export const GET: RequestHandler = async ({ url }) => {
    const tool = url.searchParams.get('tool');
    const name = url.searchParams.get('name');

    if (!tool || !name) {
        return new Response('Tool and name parameters are required', { status: 400 });
    }

    // Determine file extension based on tool
    let fileExtension = '.json';
    if (tool === 'hyc') {
        fileExtension = '.yaml';
    }

    // Construct the file path
    const filePath = path.join('/etc', tool, name + fileExtension);

    try {
        // Read the file
        const content = await fs.readFile(filePath, 'utf8');
        
        // Return the file content
        return json({
            tool,
            name,
            content,
            filePath
        });
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return new Response(`Error reading configuration file: ${error.message}`, { status: 500 });
    }
};

// POST endpoint to save a configuration file
export const POST: RequestHandler = async ({ request }) => {
    const { tool, name, content } = await request.json();

    if (!tool || !name || !content) {
        return new Response('Tool, name, and content are required', { status: 400 });
    }

    // Determine file extension based on tool
    let fileExtension = '.json';
    if (tool === 'hyc') {
        fileExtension = '.yaml';
    }

    // Construct the file path
    const filePath = path.join('/etc', tool, name + fileExtension);

    try {
        // Write the file
        await fs.writeFile(filePath, content, 'utf8');
        
        // Return success
        return json({ success: true, message: 'Configuration file saved successfully' });
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        return new Response(`Error saving configuration file: ${error.message}`, { status: 500 });
    }
};