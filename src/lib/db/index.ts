import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// App runtime uses the transaction pooler (port 6543); migrations use the
// session pooler via drizzle.config.ts. Fall back to DATABASE_URL if the
// pooled URL isn't set.
const connectionString = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL_POOLED or DATABASE_URL is not set');
}

// Reuse one client across HMR reloads in dev; otherwise each reload opens a
// fresh pool and quickly exhausts the connection limit.
const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

// `prepare: false` is required for Supabase's transaction pooler.
const client = globalForDb.__pgClient ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== 'production') globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
