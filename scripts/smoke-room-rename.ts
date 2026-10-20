// Smoke test for Room/Warehouse rename persistence & command undo/redo.
// Usage: npx tsx scripts/smoke-room-rename.ts

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import { createUpdateBlueprintMetaCommand } from '../src/engine/commands/UpdateFloorDimensionsCommand';
import { buildBlueprintFromStore } from '../src/components/editor/ui/TopNavToolbar';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log('--- Testing Room / Blueprint Rename Invariants ---');

const store = useEditorStore;

// 1. Initial State
const initialName = store.getState().blueprintName;
console.log(`Initial blueprint name: "${initialName}"`);

// 2. Execute Rename Command
const newName = 'Megah Logistic Hub 42';
store.getState().executeCommand(createUpdateBlueprintMetaCommand({ name: newName }));

assert(
  store.getState().blueprintName === newName,
  `blueprintName must update to "${newName}" (got "${store.getState().blueprintName}")`
);

assert(
  store.getState().isDirty === true,
  'Store must be marked dirty after rename command'
);

// 3. Test buildBlueprintFromStore output
const payload = buildBlueprintFromStore(store.getState(), 'test-bp-id');
assert(
  payload.name === newName,
  `buildBlueprintFromStore payload name must be "${newName}" (got "${payload.name}")`
);

// 4. Test Undo
store.getState().undo();
assert(
  store.getState().blueprintName === initialName,
  `After undo, blueprintName must revert to "${initialName}" (got "${store.getState().blueprintName}")`
);

// 5. Test Redo
store.getState().redo();
assert(
  store.getState().blueprintName === newName,
  `After redo, blueprintName must restore to "${newName}"`
);

// 6. Test setBlueprintMeta with direct blueprintName property
store.getState().setBlueprintMeta({ blueprintName: 'Direct Facility Name' });
assert(
  store.getState().blueprintName === 'Direct Facility Name',
  'setBlueprintMeta with blueprintName property must update blueprintName'
);

console.log('\n🎉 ALL ROOM RENAME INVARIANTS PASSED!');
