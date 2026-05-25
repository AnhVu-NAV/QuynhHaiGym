import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL || 'postgres://dummy:dummy@dummy.neon.tech/dummy';

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL is not set. Using dummy connection string for build.');
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });

