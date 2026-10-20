// Seeds default users for RBAC testing (ADMIN, EDITOR, VIEWER)
// Usage: npx tsx scripts/seed-admin.ts

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import type { UserRole } from '../src/db/schema';

interface SeedAccount {
  name: string;
  email: string;
  passwordPlain: string;
  role: UserRole;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    name: 'Warehouse Administrator',
    email: 'admin@warehouse.local',
    passwordPlain: 'admin12345',
    role: 'ADMIN',
  },
  {
    name: 'Warehouse Planner',
    email: 'editor@warehouse.local',
    passwordPlain: 'editor12345',
    role: 'EDITOR',
  },
  {
    name: 'Warehouse Auditor',
    email: 'viewer@warehouse.local',
    passwordPlain: 'viewer12345',
    role: 'VIEWER',
  },
];

async function seed(): Promise<void> {
  console.log('--- Seeding RBAC Users ---');

  for (const account of SEED_ACCOUNTS) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, account.email))
      .limit(1);

    const passwordHash = await bcrypt.hash(account.passwordPlain, 10);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          name: account.name,
          passwordHash,
          role: account.role,
          updatedAt: new Date(),
        })
        .where(eq(users.email, account.email));
      console.log(`[UPDATED] User ${account.email} (${account.role})`);
    } else {
      await db.insert(users).values({
        id: randomUUID(),
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
      });
      console.log(`[CREATED] User ${account.email} (${account.role})`);
    }
  }

  console.log('--- Seed Completed Successfully ---');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
