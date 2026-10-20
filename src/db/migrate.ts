// Fulfills PRD.md Phase 1: "Execute Drizzle migrations for blueprints, racks, and inventory_bins"
// Programmatic push runner so migrations can be applied without interactive CLI prompts.
// Usage: npx tsx src/db/migrate.ts
// Driver-agnostic: neon-http migrator for remote Neon, node-postgres for local dev DB.

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeonHttp } from 'drizzle-orm/neon-http';
import { migrate as migrateNeonHttp } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Provide it via .env before migrating.');
  }

  console.log('Applying Drizzle migrations...');

  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    const db = drizzleNodePg(new Pool({ connectionString }));
    await migrateNodePg(db, { migrationsFolder: './drizzle' });
  } else {
    const db = drizzleNeonHttp(neon(connectionString));
    await migrateNeonHttp(db, { migrationsFolder: './drizzle' });
  }

  console.log('Migrations applied successfully.');
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
