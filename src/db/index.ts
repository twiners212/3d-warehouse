// Fulfills PRD.md Section 3.1 Connection Setup
// Neon serverless client with Pool for transaction support and sub-millisecond cold starts.
// Local development falls back to node-postgres Pool so a standard Postgres URL works offline.

import { Pool as NeonPool } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool as NodePgPool } from 'pg';
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
  ? drizzleNodePg(new NodePgPool({ connectionString }), { schema })
  : drizzleNeon(new NeonPool({ connectionString }), { schema });

/**
 * Both node-postgres Pool and @neondatabase/serverless Pool support interactive db.transaction().
 */
export const supportsTransactions = true;

export type DatabaseClient = typeof db;
