// Phase 1 smoke test (PROGRESS.md item #4): add/move/update/remove + undo/redo
// through the Command pipeline against the composed editor store.
// Usage: npx tsx scripts/smoke-store.ts

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import { createAddRackCommand } from '../src/engine/commands/AddEntityCommand';
import { createMoveRackCommand } from '../src/engine/commands/MoveEntityCommand';
import { createUpdateRackConfigCommand } from '../src/engine/commands/UpdateRackConfigCommand';
import { createRemoveRackCommand } from '../src/engine/commands/RemoveEntityCommand';
import { deriveRackDimensions, generateBinsForRack } from '../src/engine/procedural/bin-generator';
import type { RackEntity } from '../src/types/layout';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

function makeRack(overrides: Partial<RackEntity> = {}): RackEntity {
  const config = {
    bays: 3,
    levels: 2,
    bayWidth: 1.5,
    bayDepth: 1.1,
    levelHeight: 1.8,
    ...overrides,
  };
  const base: Pick<RackEntity, 'id' | 'name'> = {
    id: overrides.id ?? 'rack-test-001',
    name: overrides.name ?? 'A01',
  };
  return {
    ...base,
    type: 'selective_pallet',
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
    dimensions: deriveRackDimensions(config),
    ...config,
    bins: [],
    ...overrides,
  } as RackEntity;
}

function main(): void {
  const s = () => useEditorStore.getState();

  console.log('\n[1] ADD rack via command');
  const rack = makeRack();
  rack.bins = generateBinsForRack(rack);
  s().executeCommand(createAddRackCommand(rack));
  assert(s().racks.length === 1, 'rack added (racks.length === 1)');
  assert(s().racks[0].bins.length === 12, 'bins generated (3 bays x 2 levels x 2 = 12)');
  assert(s().canUndo(), 'canUndo() true after add');
  assert(!s().canRedo(), 'canRedo() false at head');

  console.log('\n[2] MOVE rack via command');
  const before = s().racks[0].position;
  s().executeCommand(
    createMoveRackCommand(rack.id, before, { x: 4.5, y: 0, z: -2 })
  );
  assert(s().racks[0].position.x === 4.5 && s().racks[0].position.z === -2, 'position updated');
  assert(s().history.length === 2, 'history depth 2 after move');

  console.log('\n[3] UNDO move');
  s().undo();
  assert(s().racks[0].position.x === 0, 'position reverted to origin');
  assert(s().canRedo(), 'canRedo() true after undo');

  console.log('\n[4] REDO move');
  s().redo();
  assert(s().racks[0].position.x === 4.5, 'move re-applied');

  console.log('\n[5] UPDATE rack config regenerates bins');
  s().executeCommand(createUpdateRackConfigCommand(rack.id, { bays: 5, levels: 3 }));
  const updated = s().racks[0];
  assert(updated.bays === 5 && updated.levels === 3, 'config patched');
  assert(updated.bins.length === 30, 'bins regenerated (5 x 3 x 2 = 30)');
  assert(
    Math.abs(updated.dimensions.width - 7.5) < 1e-9,
    'dimensions derived (5 * 1.5m)'
  );

  console.log('\n[6] Redo-tail truncation on new command');
  s().undo(); // revert config update
  s().executeCommand(
    createMoveRackCommand(rack.id, s().racks[0].position, { x: 8, y: 0, z: 0 })
  );
  assert(
    s().canRedo() === false &&
      s().history[1].execute !== undefined &&
      s().history.length === 3 &&
      s().racks[0].position.x === 8,
    'redo tail truncated (undo dropped stale future, new command appended)'
  );

  console.log('\n[7] History cap (30 steps)');
  for (let i = 0; i < 35; i++) {
    s().executeCommand(
      createMoveRackCommand(rack.id, s().racks[0].position, {
        x: i + 10,
        y: 0,
        z: 0,
      })
    );
  }
  assert(s().history.length <= 30, `history capped at 30 (got ${s().history.length})`);

  console.log('\n[8] REMOVE rack via command + undo restores');
  s().executeCommand(createRemoveRackCommand(rack));
  assert(s().racks.length === 0, 'rack removed');
  s().undo();
  assert(s().racks.length === 1, 'rack restored by undo');

  console.log(`\n${failures === 0 ? 'ALL SMOKE TESTS PASSED' : `${failures} FAILURE(S)`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
