import 'dotenv/config';
import { NextRequest } from 'next/server';
import { GET as healthGet } from '../src/app/api/health/route';
import { GET as inventoryGet } from '../src/app/api/wms/inventory/route';
import { POST as syncPost } from '../src/app/api/wms/sync/route';
import { db } from '../src/db';
import { users, sessions } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { createSession, purgeExpiredSessions, validateSessionToken } from '../src/lib/auth/session';
import {
  persistWarehouseLayout,
  getWarehouseLayout,
  listWarehouseLayouts,
  deleteWarehouseLayout,
} from '../src/app/actions/layout-actions';
import { deriveRackDimensions, generateBinsForRack } from '../src/engine/procedural/bin-generator';
import type { BinSlot, WarehouseLayoutBlueprint } from '../src/types/layout';

async function main() {
  console.log('🧪 Starting Comprehensive Infrastructure & Reliability Hardening Verification...\n');

  // =========================================================================
  // Test 1: Real /api/health Endpoint Execution (HTTP 200 + Database Probe)
  // =========================================================================
  console.log('--- 1. Testing Health Check API Route (/api/health) ---');
  try {
    const healthResponse = await healthGet();
    if (healthResponse.status !== 200) {
      throw new Error(`Expected HTTP 200 from /api/health, got ${healthResponse.status}`);
    }
    const healthData = (await healthResponse.json()) as { status: string; database: string };
    if (healthData.status !== 'healthy' || healthData.database !== 'connected') {
      throw new Error(`Unexpected health payload: ${JSON.stringify(healthData)}`);
    }
    console.log('  ✅ [PASS] /api/health route returned HTTP 200 { status: "healthy", database: "connected" }.');
  } catch (err) {
    console.error('  ❌ [FAIL] Health check route execution failed:', err);
    process.exit(1);
  }

  // =========================================================================
  // Test 2: Real WMS API Route Handlers Fail-Closed Security Policy
  // =========================================================================
  console.log('\n--- 2. Testing WMS REST API Routes Fail-Closed Security Policy ---');
  const envObj = process.env as Record<string, string | undefined>;
  const originalEnv = envObj['NODE_ENV'];
  const originalKey = envObj['WMS_API_KEY'];

  try {
    // 2.1 Production without WMS_API_KEY -> Must return HTTP 500 Fail-Closed Security Error on Inventory GET
    envObj['NODE_ENV'] = 'production';
    delete envObj['WMS_API_KEY'];

    const reqMissingKey = new NextRequest('http://localhost:3000/api/wms/inventory?blueprintId=dummy', {
      headers: { authorization: 'Bearer some-token' },
    });
    const resInventory500 = await inventoryGet(reqMissingKey);
    const dataInventory500 = (await resInventory500.json()) as { success: boolean; error: string };

    if (
      resInventory500.status === 500 &&
      dataInventory500.error.includes('WMS_API_KEY environment variable is mandatory in production')
    ) {
      console.log('  ✅ [PASS] /api/wms/inventory GET returned HTTP 500 Fail-Closed when WMS_API_KEY missing in production.');
    } else {
      throw new Error(`Unexpected inventory route response: status=${resInventory500.status}, body=${JSON.stringify(dataInventory500)}`);
    }

    // 2.2 Production without WMS_API_KEY -> Must return HTTP 500 Fail-Closed Security Error on Sync POST
    const reqSyncMissingKey = new NextRequest('http://localhost:3000/api/wms/sync', {
      method: 'POST',
      body: JSON.stringify({ blueprintId: 'dummy', items: [] }),
      headers: { authorization: 'Bearer some-token' },
    });
    const resSync500 = await syncPost(reqSyncMissingKey);
    const dataSync500 = (await resSync500.json()) as { success: boolean; error: string };

    if (
      resSync500.status === 500 &&
      dataSync500.error.includes('WMS_API_KEY environment variable is mandatory in production')
    ) {
      console.log('  ✅ [PASS] /api/wms/sync POST returned HTTP 500 Fail-Closed when WMS_API_KEY missing in production.');
    } else {
      throw new Error(`Unexpected sync route response: status=${resSync500.status}, body=${JSON.stringify(dataSync500)}`);
    }

    // 2.3 Production with explicit key -> Wrong key returns HTTP 401 Unauthorized
    envObj['WMS_API_KEY'] = 'production-enterprise-secret-xyz';
    const reqUnauthorized = new NextRequest('http://localhost:3000/api/wms/inventory?blueprintId=dummy', {
      headers: { authorization: 'Bearer wrong-unauthorized-token' },
    });
    const res401 = await inventoryGet(reqUnauthorized);
    if (res401.status === 401) {
      console.log('  ✅ [PASS] /api/wms/inventory GET returned HTTP 401 on invalid token in production.');
    } else {
      throw new Error(`Expected HTTP 401, got ${res401.status}`);
    }

    // 2.4 Development mode without explicit key -> Falls back safely to dev demo token
    envObj['NODE_ENV'] = 'development';
    delete envObj['WMS_API_KEY'];
    const reqDevDemo = new NextRequest('http://localhost:3000/api/wms/inventory?blueprintId=non-existent-blueprint', {
      headers: { authorization: 'Bearer wms-demo-secret-key' },
    });
    const resDev = await inventoryGet(reqDevDemo);
    // Should pass auth and proceed to query blueprint (returning 404 since blueprint doesn't exist, NOT 401 or 500)
    if (resDev.status === 404) {
      console.log('  ✅ [PASS] Development mode safely accepts wms-demo-secret-key fallback.');
    } else {
      throw new Error(`Expected HTTP 404 (authorized but blueprint missing), got ${resDev.status}`);
    }
  } finally {
    envObj['NODE_ENV'] = originalEnv;
    if (originalKey !== undefined) {
      envObj['WMS_API_KEY'] = originalKey;
    } else {
      delete envObj['WMS_API_KEY'];
    }
  }

  // =========================================================================
  // Test 3: Transactional Atomicity & Rollback Gate in persistWarehouseLayout
  // =========================================================================
  console.log('\n--- 3. Testing Atomic Transaction Rollback on Save Failure ---');
  const ROLLBACK_TEST_BP = 'bp-reliability-rollback-test';
  await deleteWarehouseLayout(ROLLBACK_TEST_BP).catch(() => {});

  const rackConfig = { bays: 2, levels: 2, bayWidth: 1.5, bayDepth: 1.1, levelHeight: 1.8 };
  const initialRack = {
    id: 'rack-atomic-1',
    name: 'R1',
    type: 'selective_pallet' as const,
    position: { x: 5, y: 0, z: 5 },
    rotationY: 0,
    dimensions: deriveRackDimensions(rackConfig),
    ...rackConfig,
    bins: [] as BinSlot[],
  };
  initialRack.bins = generateBinsForRack(initialRack);

  const initialBlueprint: WarehouseLayoutBlueprint = {
    id: ROLLBACK_TEST_BP,
    name: 'Transactional Atomicity Test Facility',
    gridSnapStep: 0.5,
    floorDimensions: { width: 40, height: 10, depth: 40 },
    zones: [],
    structuralElements: [],
    racks: [initialRack],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 3.1 Initial Save Succeeded
  const initialSaveRes = await persistWarehouseLayout(initialBlueprint);
  if (!initialSaveRes.success) {
    throw new Error(`Initial save failed: ${initialSaveRes.error}`);
  }
  const loadedInitial = await getWarehouseLayout(ROLLBACK_TEST_BP);
  if (!loadedInitial || loadedInitial.racks.length !== 1 || loadedInitial.racks[0].bins.length !== 8) {
    throw new Error('Initial layout persistence verification failed.');
  }
  console.log('  ✅ [PASS] Initial layout saved with 1 rack and 8 bins.');

  // 3.2 Attempt Save with Duplicate Rack Primary Keys (violating DB constraint inside transaction)
  // In non-transactional execution, existing racks/bins would be deleted before this insert fails (layout wipeout).
  // In atomic transaction, the entire transaction rolls back, leaving initial layout 100% intact.
  const faultyBlueprint: WarehouseLayoutBlueprint = {
    ...initialBlueprint,
    racks: [
      initialRack,
      { ...initialRack }, // Duplicate primary key id: 'rack-atomic-1'
    ],
  };

  const faultySaveRes = await persistWarehouseLayout(faultyBlueprint);
  if (faultySaveRes.success) {
    throw new Error('Faulty save with duplicate rack primary keys was expected to fail, but succeeded!');
  }
  console.log('  ✅ [PASS] Faulty save was rejected by database constraint as expected.');

  // 3.3 Verify Layout was NOT wiped out by the failed save
  const reloadedAfterFailure = await getWarehouseLayout(ROLLBACK_TEST_BP);
  if (!reloadedAfterFailure) {
    throw new Error('CRITICAL BUG: Blueprint was deleted during failed save (Data Loss)!');
  }
  if (reloadedAfterFailure.racks.length !== 1 || reloadedAfterFailure.racks[0].bins.length !== 8) {
    throw new Error(
      `CRITICAL BUG: Racks or bins were corrupted during failed save! Racks: ${reloadedAfterFailure.racks.length}, Bins: ${reloadedAfterFailure.racks[0]?.bins.length}`
    );
  }
  console.log('  ✅ [PASS] Atomic transaction rollback verified: original racks (1) and bins (8) remain completely intact.');

  // Clean up test blueprint
  await deleteWarehouseLayout(ROLLBACK_TEST_BP);

  // =========================================================================
  // Test 4: Session Lifecycle & Opportunistic Expired Session Purging
  // =========================================================================
  console.log('\n--- 4. Testing Session Creation & Expired Purge ---');
  const [testUser] = await db.select().from(users).limit(1);
  if (!testUser) {
    console.log('  ⚠️ Skipping user session test: No seeded users found in DB.');
  } else {
    // Create an expired session directly in DB
    const expiredToken = `expired-test-token-${Date.now()}`;
    await db.insert(sessions).values({
      id: expiredToken,
      userId: testUser.id,
      expiresAt: new Date(Date.now() - 10000), // 10s in the past
    });

    // Create a valid session
    const { token: validToken } = await createSession(testUser.id);

    // Verify expired session is in DB before purge
    const beforePurge = await db.select().from(sessions).where(eq(sessions.id, expiredToken));
    if (beforePurge.length !== 1) {
      throw new Error('Expired test session failed to insert.');
    }

    // Run purge
    await purgeExpiredSessions();

    // Verify expired session is gone
    const afterPurge = await db.select().from(sessions).where(eq(sessions.id, expiredToken));
    if (afterPurge.length === 0) {
      console.log('  ✅ [PASS] purgeExpiredSessions() successfully deleted expired session.');
    } else {
      throw new Error('Expired session was not purged!');
    }

    // Verify valid session still exists
    const validSession = await validateSessionToken(validToken);
    if (validSession && validSession.user.id === testUser.id) {
      console.log('  ✅ [PASS] Active session remained intact after purge.');
    } else {
      throw new Error('Active session was unexpectedly invalidated.');
    }

    // Clean up valid test session
    await db.delete(sessions).where(eq(sessions.id, validToken));
  }

  // =========================================================================
  // Test 5: listWarehouseLayouts SQL GROUP BY Aggregation Optimization
  // =========================================================================
  console.log('\n--- 5. Testing listWarehouseLayouts SQL GROUP BY Aggregation ---');
  const layouts = await listWarehouseLayouts();
  console.log(`  ✅ [PASS] listWarehouseLayouts returned ${layouts.length} facility layout(s) with aggregated counts.`);
  for (const l of layouts) {
    if (typeof l.rackCount !== 'number' || typeof l.binCount !== 'number') {
      throw new Error(`Invalid layout count data for ${l.id}`);
    }
  }
  console.log('  ✅ [PASS] All rackCount and binCount fields are valid non-null numbers.');

  console.log('\n🎉 ALL RELIABILITY HARDENING VERIFICATION TESTS PASSED (100%)!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
