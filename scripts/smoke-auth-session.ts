// Smoke test for auth password hashing and session lifecycle
// Usage: npx tsx scripts/smoke-auth-session.ts

import 'dotenv/config';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';
import {
  createSession,
  validateSessionToken,
  invalidateSession,
} from '../src/lib/auth/session';

async function testAuthAndSession(): Promise<void> {
  console.log('--- Running Smoke Test: Auth & Session Lifecycle ---');

  // 1. Test Password Hashing and Verification
  console.log('1. Testing password hashing & verification...');
  const plain = 'secretWarehousePassword#2026';
  const hashed = await hashPassword(plain);
  assert(typeof hashed === 'string' && hashed.startsWith('$2'), 'Password hash should be valid bcrypt format');
  
  const isMatchValid = await verifyPassword(plain, hashed);
  assert.strictEqual(isMatchValid, true, 'verifyPassword should return true for matching password');

  const isMatchInvalid = await verifyPassword('wrongpassword', hashed);
  assert.strictEqual(isMatchInvalid, false, 'verifyPassword should return false for incorrect password');
  console.log('✓ Password hashing and verification passed.');

  // 2. Fetch Admin User from DB
  console.log('2. Fetching test admin user from database...');
  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@warehouse.local'))
    .limit(1);

  assert(adminUsers.length > 0, 'admin@warehouse.local should exist in database (run npm run db:seed first)');
  const admin = adminUsers[0];
  assert.strictEqual(admin.role, 'ADMIN', 'Admin role must be ADMIN');

  // 3. Create Session
  console.log('3. Creating session token in database...');
  const { token, expiresAt } = await createSession(admin.id);
  assert(typeof token === 'string' && token.length >= 32, 'Session token should be at least 32 characters');
  assert(expiresAt.getTime() > Date.now(), 'Session expiresAt must be in the future');
  console.log(`✓ Session created: ${token.slice(0, 8)}... expires at ${expiresAt.toISOString()}`);

  // 4. Validate Valid Session
  console.log('4. Validating session token...');
  const sessionData = await validateSessionToken(token);
  assert(sessionData !== null, 'Session should be valid and return user data');
  assert.strictEqual(sessionData.user.id, admin.id, 'User ID in session data must match');
  assert.strictEqual(sessionData.user.email, 'admin@warehouse.local');
  assert.strictEqual(sessionData.user.role, 'ADMIN');
  console.log('✓ Session validation returned correct user & role.');

  // 5. Validate Fake / Unknown Token
  console.log('5. Validating non-existent session token...');
  const fakeSession = await validateSessionToken('non-existent-token-12345');
  assert.strictEqual(fakeSession, null, 'Non-existent session must return null');
  console.log('✓ Non-existent token handled safely.');

  // 6. Invalidate Session (Logout)
  console.log('6. Invalidating session token...');
  await invalidateSession(token);
  const revokedSession = await validateSessionToken(token);
  assert.strictEqual(revokedSession, null, 'Revoked session must return null');
  console.log('✓ Revoked session confirmed deleted.');

  console.log('--- ALL AUTH & SESSION SMOKE TESTS PASSED (0 ERRORS) ---');
}

testAuthAndSession().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
