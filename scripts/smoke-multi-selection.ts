// Smoke test for Phase 25: Multi-Object Selection & Bulk Operations
// Usage: npx tsx scripts/smoke-multi-selection.ts

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import {
  createBulkMoveCommand,
  createBulkDeleteCommand,
  createBulkDuplicateCommand,
  createBulkRotateCommand,
} from '../src/engine/commands/BulkCommands';
import type { RackEntity, StructuralElement, WarehouseZone } from '../src/types/layout';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log('--- Phase 25 Smoke Test: Multi-Object Selection & Bulk Operations ---');

const store = useEditorStore;

// Setup test fixtures
const rack1: RackEntity = {
  id: 'rack-multi-1',
  name: 'A01',
  type: 'selective_pallet',
  position: { x: 10, y: 0, z: 10 },
  rotationY: 0,
  dimensions: { width: 4.5, height: 6.0, depth: 1.1 },
  bays: 3,
  levels: 4,
  bayWidth: 1.5,
  bayDepth: 1.1,
  levelHeight: 1.5,
  bins: [],
};

const rack2: RackEntity = {
  id: 'rack-multi-2',
  name: 'A02',
  type: 'selective_pallet',
  position: { x: 20, y: 0, z: 10 },
  rotationY: 0,
  dimensions: { width: 4.5, height: 6.0, depth: 1.1 },
  bays: 3,
  levels: 4,
  bayWidth: 1.5,
  bayDepth: 1.1,
  levelHeight: 1.5,
  bins: [],
};

const col1: StructuralElement = {
  id: 'col-multi-1',
  name: 'Column C1',
  type: 'column',
  position: { x: 15, y: 0, z: 5 },
  rotationY: 0,
  dimensions: { width: 0.5, height: 6.0, depth: 0.5 },
};

const zone1: WarehouseZone = {
  id: 'zone-multi-1',
  name: 'Receiving Area',
  type: 'receiving',
  colorHex: '#10b981',
  position: { x: 5, y: 0, z: 25 },
  dimensions: { width: 10, height: 0.1, depth: 8 },
};

store.setState({
  racks: [rack1, rack2],
  structuralElements: [col1],
  zones: [zone1],
  selectedEntityId: null,
  selectedEntityIds: [],
  history: [],
  historyIndex: -1,
});

// 1. Test Selection Slice Actions
store.getState().selectEntity(rack1.id);
assert(
  store.getState().selectedEntityId === rack1.id &&
    store.getState().selectedEntityIds.length === 1 &&
    store.getState().selectedEntityIds[0] === rack1.id,
  'selectEntity must set selectedEntityId and selectedEntityIds'
);

// Toggle another entity (Shift + Click)
store.getState().toggleEntitySelection(rack2.id);
assert(
  store.getState().selectedEntityIds.length === 2 &&
    store.getState().selectedEntityIds.includes(rack1.id) &&
    store.getState().selectedEntityIds.includes(rack2.id),
  'toggleEntitySelection must add second entity to group'
);

// Toggle again to remove
store.getState().toggleEntitySelection(rack2.id);
assert(
  store.getState().selectedEntityIds.length === 1 &&
    !store.getState().selectedEntityIds.includes(rack2.id),
  'toggleEntitySelection must remove entity if already selected'
);

// Marquee / Bulk Selection
store.getState().setMultipleSelection([rack1.id, rack2.id, col1.id, zone1.id]);
assert(
  store.getState().selectedEntityIds.length === 4,
  'setMultipleSelection must set all 4 enclosed entity IDs'
);

// Clear Selection
store.getState().clearSelection();
assert(
  store.getState().selectedEntityIds.length === 0 && store.getState().selectedEntityId === null,
  'clearSelection must reset both selectedEntityId and selectedEntityIds'
);

// 2. Test Bulk Move Command & Atomic Undo/Redo
store.setState({
  racks: [{ ...rack1 }, { ...rack2 }],
  structuralElements: [{ ...col1 }],
  zones: [{ ...zone1 }],
  selectedEntityIds: [rack1.id, rack2.id, col1.id],
});

const bulkMoves = [
  { id: rack1.id, type: 'rack' as const, from: { ...rack1.position }, to: { x: 14, y: 0, z: 12 } },
  { id: rack2.id, type: 'rack' as const, from: { ...rack2.position }, to: { x: 24, y: 0, z: 12 } },
  { id: col1.id, type: 'structure' as const, from: { ...col1.position }, to: { x: 19, y: 0, z: 7 } },
];

store.getState().executeCommand(createBulkMoveCommand(bulkMoves));

assert(
  store.getState().racks[0].position.x === 14 &&
    store.getState().racks[1].position.x === 24 &&
    store.getState().structuralElements[0].position.x === 19,
  'createBulkMoveCommand must update all entities simultaneously'
);

// Single Undo must restore all entities to original positions
store.getState().undo();
assert(
  store.getState().racks[0].position.x === 10 &&
    store.getState().racks[1].position.x === 20 &&
    store.getState().structuralElements[0].position.x === 15,
  'Atomic undo of bulk move must restore all entities in one step'
);

// Redo re-applies
store.getState().redo();
assert(
  store.getState().racks[0].position.x === 14 &&
    store.getState().racks[1].position.x === 24 &&
    store.getState().structuralElements[0].position.x === 19,
  'Atomic redo must re-apply all entity positions'
);

// 3. Test Bulk In-Place Rotate 90° Command
const rotations = [
  { id: rack1.id, type: 'rack' as const, fromRotation: 0, toRotation: Math.PI / 2 },
  { id: rack2.id, type: 'rack' as const, fromRotation: 0, toRotation: Math.PI / 2 },
];

store.getState().executeCommand(createBulkRotateCommand(rotations));
assert(
  Math.abs(store.getState().racks[0].rotationY - Math.PI / 2) < 0.01 &&
    Math.abs(store.getState().racks[1].rotationY - Math.PI / 2) < 0.01,
  'Bulk rotate must rotate all selected racks by 90 degrees'
);

store.getState().undo();
assert(
  store.getState().racks[0].rotationY === 0 && store.getState().racks[1].rotationY === 0,
  'Bulk rotate undo must restore original orientation'
);

// 4. Test Bulk Duplicate Command
const duplicatePayload = {
  racks: [store.getState().racks[0], store.getState().racks[1]],
  structures: [store.getState().structuralElements[0]],
  zones: [],
};

const countBefore = store.getState().racks.length + store.getState().structuralElements.length;
store.getState().executeCommand(createBulkDuplicateCommand(duplicatePayload, { x: 5, z: 0 }));

assert(
  store.getState().racks.length === 4 && store.getState().structuralElements.length === 2,
  'Bulk duplicate must create cloned entities for the entire group'
);

assert(
  store.getState().selectedEntityIds.length === 3,
  'Bulk duplicate must select the newly cloned group'
);

// Undo duplicate
store.getState().undo();
assert(
  store.getState().racks.length === 2 && store.getState().structuralElements.length === 1,
  'Undo duplicate must remove cloned entities'
);

// 5. Test Bulk Delete Command
const deletePayload = {
  racks: [...store.getState().racks],
  structures: [...store.getState().structuralElements],
  zones: [...store.getState().zones],
};

store.getState().executeCommand(createBulkDeleteCommand(deletePayload));
assert(
  store.getState().racks.length === 0 &&
    store.getState().structuralElements.length === 0 &&
    store.getState().zones.length === 0,
  'Bulk delete must remove all selected entities'
);

// Undo delete
store.getState().undo();
assert(
  store.getState().racks.length === 2 &&
    store.getState().structuralElements.length === 1 &&
    store.getState().zones.length === 1,
  'Undo delete must restore all deleted entities'
);

console.log('\n🎉 ALL MULTI-SELECTION & BULK OPERATIONS TESTS PASSED!');
