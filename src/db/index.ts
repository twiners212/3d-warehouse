// Fulfills PRD.md Section 3.1 Connection Setup
// Neon serverless client over the HTTP driver for sub-millisecond cold starts.
// Local development falls back to node-postgres so a dummy Postgres container
// (or any standard postgres:// URL) works without a Neon account.

import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeonHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and provide your database connection string.'
  );
}

function isLocalDatabase(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export const db = isLocalDatabase(connectionString)
  ? drizzleNodePg(new Pool({ connectionString }), { schema })
  : drizzleNeonHttp(neon(connectionString), { schema });

/**
 * Whether the active driver supports interactive db.transaction().
 * neon-http does NOT — persistence falls back to batched statements
 * (PROGRESS.md Phase 1 note; PRD.md Section 5 batch semantics).
 */
export const supportsTransactions = isLocalDatabase(connectionString);

export type DatabaseClient = typeof db;
