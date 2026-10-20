// Automated Verification for Save & Leave bug fix
// Verifies that saving an edited blueprint and navigating away succeeds cleanly
// without duplicate key collisions or unhandled errors.

import 'dotenv/config';
import { persistWarehouseLayout, getWarehouseLayout, deleteWarehouseLayout } from '../src/app/actions/layout-actions';
import { deriveRackDimensions, generateBinsForRack } from '../src/engine/procedural/bin-generator';
import type { BinSlot, RackEntity, WarehouseLayoutBlueprint } from '../src/types/layout';

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    process.exit(1);
  }
}

function createTestRack(name: string, id: string): RackEntity {
  const config = { bays: 3, levels: 3, bayWidth: 2.5, bayDepth: 1.1, levelHeight: 1.8 };
  const rack = {
    id,
    name,
    type: 'selective_pallet' as const,
    position: { x: 10, y: 0, z: 10 },
    rotationY: 0,
    dimensions: deriveRackDimensions(config),
    ...config,
    bins: [] as BinSlot[],
  };
  rack.bins = generateBinsForRack(rack);
  return rack as unknown as RackEntity;
}

async function run() {
  console.log('\n🧪 Testing Blueprint Save & Leave Round-Trip...');

  const BP_ID_1 = 'test-save-exit-bp-1';
  const BP_ID_2 = 'test-save-exit-bp-2';

  // Clean up
  await deleteWarehouseLayout(BP_ID_1).catch(() => undefined);
  await deleteWarehouseLayout(BP_ID_2).catch(() => undefined);

  // Blueprint 1 has rack 'A01'
  const bp1: WarehouseLayoutBlueprint = {
    id: BP_ID_1,
    name: 'Facility Alpha',
    gridSnapStep: 0.5,
    floorDimensions: { width: 50, depth: 40, height: 10 },
    zones: [],
    structuralElements: [],
    racks: [createTestRack('A01', 'rack-alpha-01')],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res1 = await persistWarehouseLayout(bp1);
  assert(res1.success === true, 'Blueprint 1 with rack A01 saved successfully');

  // Blueprint 2 ALSO has rack 'A01' (this was previously failing with duplicate key inventory_bins_pkey!)
  const bp2: WarehouseLayoutBlueprint = {
    id: BP_ID_2,
    name: 'Facility Beta',
    gridSnapStep: 0.5,
    floorDimensions: { width: 60, depth: 50, height: 12 },
    zones: [],
    structuralElements: [],
    racks: [createTestRack('A01', 'rack-beta-01')],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res2 = await persistWarehouseLayout(bp2);
  assert(res2.success === true, 'Blueprint 2 with same rack name A01 saved successfully without pkey collision');

  // Verify reload of both blueprints
  const loaded1 = await getWarehouseLayout(BP_ID_1);
  assert(loaded1 !== null, 'Blueprint 1 reloaded');
  assert(loaded1?.racks[0].name === 'A01', 'Blueprint 1 rack name is A01');
  assert(loaded1?.racks[0].bins[0].id === 'A01-01-01-A', 'Blueprint 1 bin ID is A01-01-01-A');

  const loaded2 = await getWarehouseLayout(BP_ID_2);
  assert(loaded2 !== null, 'Blueprint 2 reloaded');
  assert(loaded2?.racks[0].name === 'A01', 'Blueprint 2 rack name is A01');
  assert(loaded2?.racks[0].bins[0].id === 'A01-01-01-A', 'Blueprint 2 bin ID is A01-01-01-A');

  // Clean up
  await deleteWarehouseLayout(BP_ID_1).catch(() => undefined);
  await deleteWarehouseLayout(BP_ID_2).catch(() => undefined);

  console.log('\n🎉 ALL SAVE & LEAVE REPRODUCTION TESTS PASSED CLEANLY!\n');
}

run().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
