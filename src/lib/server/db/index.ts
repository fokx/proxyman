import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { spawn, spawnSync } from 'child_process';

dotenv.config();

const client = new Database(process.env.DATABASE_URL);
export const dbs = drizzle(client);

