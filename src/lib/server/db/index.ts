import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

dotenv.config();

export const sqlite3_db = new Database(process.env.DATABASE_URL);
export const dbs = drizzle(sqlite3_db);
