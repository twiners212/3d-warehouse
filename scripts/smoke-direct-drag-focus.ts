// Smoke test for Phase 24: Direct Click-and-Drag Manipulation & Viewport-Focused Placement
// Usage: npx tsx scripts/smoke-direct-drag-focus.ts

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import { cameraBus } from '../src/lib/camera/camera-bus';
import { findAvailablePlacementPosition } from '../src/engine/spatial/snapping';
import { createMoveRackCommand } from '../src/engine/commands/MoveEntityCommand';
import { createMoveStructuralElementCommand } from '../src/engine/commands/StructuralCommands';
import { createMoveZoneCommand } from '../src/engine/commands/ZoneCommands';
import type { RackEntity, StructuralElement, WarehouseZone } from '../src/types/layout';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log('--- Phase 24 Smoke Test: Direct Drag Manipulation & Viewport-Focused Placement ---');

const store = useEditorStore;

// 1. Test Camera Focus Tracking on CameraBus
cameraBus.setCurrentFocus({ x: 30, z: 40 });
const focus = cameraBus.getCurrentFocus();
assert(
  focus !== null && focus.x === 30 && focus.z === 40,
  `cameraBus must store current focus coordinates ({ x: 30, z: 40 }, got ${JSON.stringify(focus)})`
);

// 2. Test findAvailablePlacementPosition with Focus Coordinates
const floorW = 50;
const floorD = 50;
const rackW = 4.5;
const rackD = 1.1;

// A) With preferred focus at (10, 10)
const posAtFocus = findAvailablePlacementPosition({
  width: rackW,
  depth: rackD,
  preferredX: 10,
  preferredZ: 10,
  neighbors: [],
  floorWidth: floorW,
  floorDepth: floorD,
});

assert(
  Math.abs(posAtFocus.x - 10) <= 1.0 && Math.abs(posAtFocus.z - 10) <= 1.0,
  `Placement with preferredX/Z (10, 10) should spawn near (10, 10) (got x: ${posAtFocus.x}, z: ${posAtFocus.z})`
);

// B) Default without preferredX/Z should spawn at center (25, 25)
const posAtCenter = findAvailablePlacementPosition({
  width: rackW,
  depth: rackD,
  neighbors: [],
  floorWidth: floorW,
  floorDepth: floorD,
});

assert(
  Math.abs(posAtCenter.x - 25) <= 1.0 && Math.abs(posAtCenter.z - 25) <= 1.0,
  `Default placement without preferred coordinates should spawn near center (25, 25) (got x: ${posAtCenter.x}, z: ${posAtCenter.z})`
);

// 3. Test isDirectDragging store mutation
assert(
  store.getState().isDirectDragging === false,
  'Initial isDirectDragging state must be false'
);

store.getState().setIsDirectDragging(true);
assert(
  store.getState().isDirectDragging === true,
  'setIsDirectDragging(true) must update state to true'
);

store.getState().setIsDirectDragging(false);
assert(
  store.getState().isDirectDragging === false,
  'setIsDirectDragging(false) must restore state to false'
);

// 4. Test Direct Drag Move Command for Storage Rack
const testRack: RackEntity = {
  id: 'rack-drag-1',
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

store.setState({ racks: [testRack], history: [], historyIndex: -1 });

const newRackPos = { x: 18, y: 0, z: 24 };
store.getState().executeCommand(createMoveRackCommand(testRack.id, testRack.position, newRackPos));

assert(
  store.getState().racks[0].position.x === 18 && store.getState().racks[0].position.z === 24,
  'Move rack command must update position'
);

store.getState().undo();
assert(
  store.getState().racks[0].position.x === 10 && store.getState().racks[0].position.z === 10,
  'Undo must restore rack to original position'
);

store.getState().redo();
assert(
  store.getState().racks[0].position.x === 18 && store.getState().racks[0].position.z === 24,
  'Redo must re-apply moved rack position'
);

// 5. Test Direct Drag Move Command for Structural Element
const testCol: StructuralElement = {
  id: 'struct-drag-1',
  name: 'Support Column 1',
  type: 'column',
  position: { x: 5, y: 0, z: 5 },
  rotationY: 0,
  dimensions: { width: 0.5, height: 6.0, depth: 0.5 },
};

store.setState({ structuralElements: [testCol], history: [], historyIndex: -1 });
const newColPos = { x: 12, y: 0, z: 16 };
store.getState().executeCommand(createMoveStructuralElementCommand(testCol.id, testCol.position, newColPos));

assert(
  store.getState().structuralElements[0].position.x === 12,
  'Move structure command must update position'
);

store.getState().undo();
assert(
  store.getState().structuralElements[0].position.x === 5,
  'Undo must restore structure to original position'
);

// 6. Test Direct Drag Move Command for Floor Zone
const testZone: WarehouseZone = {
  id: 'zone-drag-1',
  name: 'Storage Zone A',
  type: 'storage',
  colorHex: '#f59e0b',
  position: { x: 2, y: 0, z: 2 },
  dimensions: { width: 10, height: 0.1, depth: 10 },
};

store.setState({ zones: [testZone], history: [], historyIndex: -1 });
const newZonePos = { x: 8, y: 0, z: 14 };
store.getState().executeCommand(createMoveZoneCommand(testZone.id, testZone.position, newZonePos));

assert(
  store.getState().zones[0].position.x === 8,
  'Move zone command must update position'
);

store.getState().undo();
assert(
  store.getState().zones[0].position.x === 2,
  'Undo must restore zone to original position'
);

console.log('\n🎉 ALL DIRECT DRAG & VIEWPORT-FOCUSED PLACEMENT TESTS PASSED!');
