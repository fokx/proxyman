import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import * as dotenv from 'dotenv';

dotenv.config();

export const proxies = sqliteTable(
	'proxies',
	{
		id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
		name: text().notNull(),
		tool: text().notNull(),
		config: text({mode: 'json'}),
		remote_addr: text(),
		remote_port: integer(),
		remote_addr_type: text(), // ipv4, ipv6, domain name(may be dual-stack)
		sni: text(),
		local_addr: integer(),
		local_port: integer(),
		usable: integer({ mode: 'boolean' }),
		usable_updated_at: integer({ mode: 'timestamp' }),
		latency_ms: integer(),
		latency_updated_at: integer({ mode: 'timestamp' }),
		outgoing_ipv4: text(),
		outgoing_ipv4_location: text(),
		outgoing_ipv4_country: text(),
		outgoing_ipv6: text(),
		outgoing_ipv6_location: text(),
		outgoing_ipv6_country: text(),
		created_at: integer({ mode: 'timestamp' }),
		updated_at: integer({ mode: 'timestamp' })
	},
	(t) => [unique('tool_and_name').on(t.tool, t.name)]
);
