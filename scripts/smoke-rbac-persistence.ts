// Smoke test for RBAC permissions on warehouse layout persistence and user management
// Usage: npx tsx scripts/smoke-rbac-persistence.ts

import 'dotenv/config';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users, warehouseBlueprints } from '../src/db/schema';
import {
  persistWarehouseLayout,
  deleteWarehouseLayout,
} from '../src/app/actions/layout-actions';
import type { WarehouseLayoutBlueprint } from '../src/types/layout';
import type { SessionData } from '../src/lib/auth/types';

async function testRbacPersistence(): Promise<void> {
  console.log('--- Running Smoke Test: RBAC Persistence & Authorization Gates ---');

  // 1. Fetch test users
  console.log('1. Loading test users from database...');
  const adminRows = await db.select().from(users).where(eq(users.email, 'admin@warehouse.local')).limit(1);
  const editorRows = await db.select().from(users).where(eq(users.email, 'editor@warehouse.local')).limit(1);
  const viewerRows = await db.select().from(users).where(eq(users.email, 'viewer@warehouse.local')).limit(1);

  assert(adminRows.length > 0, 'admin@warehouse.local must exist');
  assert(editorRows.length > 0, 'editor@warehouse.local must exist');
  assert(viewerRows.length > 0, 'viewer@warehouse.local must exist');

  const admin = adminRows[0];
  const editor = editorRows[0];
  const viewer = viewerRows[0];

  const adminSession: SessionData = {
    session: { id: 'test-admin-sess', userId: admin.id, expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() },
    user: { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' },
  };

  const editorSession: SessionData = {
    session: { id: 'test-editor-sess', userId: editor.id, expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() },
    user: { id: editor.id, name: editor.name, email: editor.email, role: 'EDITOR' },
  };

  const viewerSession: SessionData = {
    session: { id: 'test-viewer-sess', userId: viewer.id, expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() },
    user: { id: viewer.id, name: viewer.name, email: viewer.email, role: 'VIEWER' },
  };

  const testBpId = 'smoke-rbac-bp-test';
  const dummyBlueprint: WarehouseLayoutBlueprint = {
    id: testBpId,
    name: 'RBAC Security Blueprint',
    gridSnapStep: 0.5,
    floorDimensions: { width: 40, height: 8, depth: 30 },
    zones: [],
    structuralElements: [],
    racks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Clean up any lingering test blueprint
  await deleteWarehouseLayout(testBpId, adminSession).catch(() => undefined);

  // 2. Test Case 1: VIEWER attempts to persist layout -> MUST FAIL
  console.log('2. Testing VIEWER persist layout rejection...');
  const viewerPersistResult = await persistWarehouseLayout(dummyBlueprint, viewerSession);
  assert.strictEqual(viewerPersistResult.success, false, 'Viewer save must fail');
  assert(
    viewerPersistResult.error?.includes('Viewer') || viewerPersistResult.error?.includes('Akses ditolak'),
    `Error should mention Viewer role rejection: ${viewerPersistResult.error}`
  );
  console.log(`✓ Viewer persist properly rejected: "${viewerPersistResult.error}"`);

  // 3. Test Case 2: VIEWER attempts to delete layout -> MUST FAIL
  console.log('3. Testing VIEWER delete layout rejection...');
  const viewerDeleteResult = await deleteWarehouseLayout(testBpId, viewerSession);
  assert.strictEqual(viewerDeleteResult.success, false, 'Viewer delete must fail');
  assert(
    viewerDeleteResult.error?.includes('Viewer') || viewerDeleteResult.error?.includes('Akses ditolak'),
    `Error should mention Viewer role rejection: ${viewerDeleteResult.error}`
  );
  console.log(`✓ Viewer delete properly rejected: "${viewerDeleteResult.error}"`);

  // 4. Test Case 3: EDITOR attempts to persist layout -> MUST SUCCEED
  console.log('4. Testing EDITOR persist layout...');
  const editorPersistResult = await persistWarehouseLayout(dummyBlueprint, editorSession);
  assert.strictEqual(editorPersistResult.success, true, `Editor save must succeed: ${editorPersistResult.error}`);

  // Verify createdBy and updatedBy in database
  const bpRows = await db.select().from(warehouseBlueprints).where(eq(warehouseBlueprints.id, testBpId)).limit(1);
  assert(bpRows.length > 0, 'Blueprint should exist in database');
  assert.strictEqual(bpRows[0].createdBy, editor.id, 'createdBy must equal editor user id');
  assert.strictEqual(bpRows[0].updatedBy, editor.id, 'updatedBy must equal editor user id');
  console.log('✓ Editor persist succeeded and audit trail (createdBy & updatedBy) recorded correctly.');

  // 5. Test Case 4: ADMIN updates the layout -> MUST SUCCEED and preserve createdBy
  console.log('5. Testing ADMIN update layout...');
  const adminPersistResult = await persistWarehouseLayout(
    { ...dummyBlueprint, name: 'RBAC Security Blueprint (Updated by Admin)' },
    adminSession
  );
  assert.strictEqual(adminPersistResult.success, true, `Admin save must succeed: ${adminPersistResult.error}`);

  const updatedRows = await db.select().from(warehouseBlueprints).where(eq(warehouseBlueprints.id, testBpId)).limit(1);
  assert.strictEqual(updatedRows[0].createdBy, editor.id, 'createdBy should remain original author (editor)');
  assert.strictEqual(updatedRows[0].updatedBy, admin.id, 'updatedBy should reflect recent modifier (admin)');
  console.log('✓ Admin update succeeded and preserved original author while updating modifiedBy.');

  // 6. Test Case 5: ADMIN deletes the layout -> MUST SUCCEED
  console.log('6. Testing ADMIN delete layout...');
  const adminDeleteResult = await deleteWarehouseLayout(testBpId, adminSession);
  assert.strictEqual(adminDeleteResult.success, true, `Admin delete must succeed: ${adminDeleteResult.error}`);

  const afterDelete = await db.select().from(warehouseBlueprints).where(eq(warehouseBlueprints.id, testBpId));
  assert.strictEqual(afterDelete.length, 0, 'Blueprint should be deleted');
  console.log('✓ Admin delete succeeded.');

  console.log('--- ALL RBAC PERSISTENCE SMOKE TESTS PASSED (0 ERRORS) ---');
}

testRbacPersistence().catch((err) => {
  console.error('RBAC smoke test failed:', err);
  process.exit(1);
});
