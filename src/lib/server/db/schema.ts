import { integer, sqliteTable, sqliteView, text, unique } from 'drizzle-orm/sqlite-core';
import { defineRelations } from "drizzle-orm";
import * as dotenv from 'dotenv';
dotenv.config();

export const proxies = sqliteTable('proxies', {
	id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	tool: text().notNull(),
	remote_addr: text(),
	remote_port: integer(),
	sni: text(),
	local_addr: integer(),
	local_port: integer(),
	usable: integer({mode: 'boolean'}),
	usable_updated_at: integer({mode: 'timestamp'}),
	latency_ms: integer(),
	latency_updated_at: integer({mode: 'timestamp'}),
	outgoing_ip: text(),
	created_at: integer({ mode: 'timestamp' }),
	updated_at: integer({ mode: 'timestamp' }),
}, (t) => [
	unique('tool_and_name').on(t.tool, t.name),
]);

