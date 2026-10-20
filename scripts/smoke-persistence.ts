// Phase 5 smoke test: server-action persistence layer against the local
// dummy database — Zod gate, chunked upsert, cascade replace, reload,
// list, and delete.
// Usage: npm run test:persistence

import 'dotenv/config';
import { persistWarehouseLayout, getWarehouseLayout, listWarehouseLayouts, deleteWarehouseLayout } from '../src/app/actions/layout-actions';
import { deriveRackDimensions, generateBinsForRack } from '../src/engine/procedural/bin-generator';
import { WarehouseBlueprintSchema } from '../src/lib/validations/layout-schema';
import type { BinSlot, RackEntity, WarehouseLayoutBlueprint } from '../src/types/layout';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

function makeRack(name: string): RackEntity {
  const config = { bays: 3, levels: 2, bayWidth: 1.5, bayDepth: 1.1, levelHeight: 1.8 };
  const rack = {
    id: `rack-${name}`,
    name,
    type: 'selective_pallet' as const,
    position: { x: 5, y: 0, z: 5 },
    rotationY: 0,
    dimensions: deriveRackDimensions(config),
    ...config,
    bins: [] as BinSlot[],
  };
  rack.bins = generateBinsForRack(rack);
  return rack as unknown as RackEntity;
}

const BLUEPRINT_ID = 'smoke-bp-001';

async function main(): Promise<void> {
  console.log('\n[1] Zod gate rejects invalid payload');
  const badResult = WarehouseBlueprintSchema.safeParse({ id: '', nope: true });
  assert(!badResult.success, 'invalid blueprint rejected by schema');

  console.log('\n[2] Persist blueprint (upsert + cascade replace)');
  await deleteWarehouseLayout(BLUEPRINT_ID).catch(() => undefined);

  const blueprint: WarehouseLayoutBlueprint = {
    id: BLUEPRINT_ID,
    name: 'Smoke Warehouse',
    gridSnapStep: 0.5,
    floorDimensions: { width: 60, height: 10, depth: 40 },
    zones: [],
    structuralElements: [],
    racks: [makeRack('A01'), makeRack('A02')],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const save1 = await persistWarehouseLayout(blueprint);
  assert(save1.success, `first save succeeded (${save1.error ?? 'ok'})`);

  console.log('\n[3] Reload and verify reassembly');
  const loaded = await getWarehouseLayout(BLUEPRINT_ID);
  assert(!!loaded, 'blueprint found');
  assert(loaded?.racks.length === 2, '2 racks reloaded');
  assert(loaded?.racks[0].bins.length === 12, 'rack A01 has 12 bins');
  assert(loaded?.racks[1].name === 'A02', 'rack names preserved');

  console.log('\n[4] Cascade replace on second save');
  const mutated = structuredClone(loaded!);
  mutated.racks = mutated.racks.slice(0, 1);
  mutated.racks[0].position = { x: 12, y: 0, z: 8 };
  const save2 = await persistWarehouseLayout(mutated);
  assert(save2.success, 'second save succeeded');
  const reloaded = await getWarehouseLayout(BLUEPRINT_ID);
  assert(reloaded?.racks.length === 1, 'old racks fully replaced (1 rack)');
  assert(reloaded?.racks[0].position.x === 12, 'updated position persisted');
  assert(reloaded?.racks[0].bins.length === 12, 'bins intact after replace');

  console.log('\n[5] List summary');
  const summaries = await listWarehouseLayouts();
  const entry = summaries.find((s) => s.id === BLUEPRINT_ID);
  assert(!!entry, 'blueprint listed');
  assert(entry?.rackCount === 1 && entry?.binCount === 12, `counts correct (rack=1, bin=12, got rack=${entry?.rackCount}, bin=${entry?.binCount})`);

  console.log('\n[6] Delete cascades');
  const del = await deleteWarehouseLayout(BLUEPRINT_ID);
  assert(del.success, 'delete succeeded');
  const gone = await getWarehouseLayout(BLUEPRINT_ID);
  assert(gone === null, 'blueprint removed');

  console.log(`\n${failures === 0 ? 'ALL PERSISTENCE TESTS PASSED' : `${failures} FAILURE(S)`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
  process.exit(process.exitCode);
}

main();
