// Smoke Test for Click-to-Split Waypoints, Segment Projection, and Waypoint Edit Overhaul
import {
  calculatePickingRoute,
  findNearestPolylineSegment,
} from '../src/engine/routing/routing-engine';
import {
  createAddCustomWaypointCommand,
  createRemoveCustomWaypointCommand,
  createMoveCustomWaypointCommand,
} from '../src/engine/commands/PickingCommands';
import type { PickItem, CustomWaypoint } from '../src/types/routing';
import type { WarehouseBounds } from '../src/types/spatial';
import type { RackEntity } from '../src/types/layout';
import { useEditorStore } from '../src/stores/useEditorStore';

console.log('🧪 Running Smoke Tests for Click-to-Split & Waypoint Overhaul...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

const bounds = { width: 60, depth: 50, height: 10 };
const depotPos = { x: 5, z: 5 };

const mockRacks: RackEntity[] = [
  {
    id: 'rack-1',
    name: 'A01',
    type: 'selective_pallet',
    position: { x: 20, y: 0, z: 20 },
    rotationY: 0,
    dimensions: { width: 12, height: 6, depth: 1.2 },
    bays: 4,
    levels: 3,
    bayWidth: 3.0,
    bayDepth: 1.2,
    levelHeight: 2.0,
    bins: [],
  },
];

const mockItems: PickItem[] = [
  {
    binId: 'BIN-101',
    rackId: 'rack-1',
    rackName: 'A01',
    bayIndex: 0,
    levelIndex: 0,
    position3D: { x: 15, y: 0.5, z: 20 },
    accessPoint3D: { x: 15, y: 0, z: 22 },
    sku: 'SKU-A',
    productName: 'Item A',
    quantity: 5,
    weightKg: 10,
    isPicked: false,
  },
  {
    binId: 'BIN-102',
    rackId: 'rack-1',
    rackName: 'A01',
    bayIndex: 2,
    levelIndex: 0,
    position3D: { x: 25, y: 0.5, z: 20 },
    accessPoint3D: { x: 25, y: 0, z: 22 },
    sku: 'SKU-B',
    productName: 'Item B',
    quantity: 2,
    weightKg: 4,
    isPicked: false,
  },
];

console.log('--- TEST GROUP 1: findNearestPolylineSegment Projection Math ---');

const testPolyline = [
  { x: 0, y: 0, z: 0, insertAfterStopIndex: 0, prevWaypointId: 'depot-start', nextWaypointId: 'stop-1' },
  { x: 10, y: 0, z: 0, insertAfterStopIndex: 0, prevWaypointId: 'depot-start', nextWaypointId: 'stop-1' },
  { x: 10, y: 0, z: 10, insertAfterStopIndex: 1, prevWaypointId: 'stop-1', nextWaypointId: 'stop-2' },
  { x: 10, y: 0, z: 20, insertAfterStopIndex: 1, prevWaypointId: 'stop-1', nextWaypointId: 'stop-2' },
  { x: 30, y: 0, z: 20, insertAfterStopIndex: 1, prevWaypointId: 'stop-1', nextWaypointId: 'stop-2' },
];

// Query 1: Exact point on second leg (10, 15)
const res1 = findNearestPolylineSegment(testPolyline, 10, 15);
assert(res1 !== null, 'Projection returns non-null for valid polyline');
assert(res1?.segmentIndex === 2, 'Correctly identifies segment 2 (10,10) -> (10,20)');
assert(res1 !== null && Math.abs(res1.projectedPoint.x - 10) < 0.001, 'Projected X is 10.0');
assert(res1 !== null && Math.abs(res1.projectedPoint.z - 15) < 0.001, 'Projected Z is 15.0');
assert(res1?.insertAfterStopIndex === 1, 'Accurately binds to insertAfterStopIndex = 1');
assert(res1?.prevWaypointId === 'stop-1', 'Correctly identifies prevWaypointId as stop-1');
assert(res1?.nextWaypointId === 'stop-2', 'Correctly identifies nextWaypointId as stop-2');

// Query 2: Point slightly offset from horizontal segment (20, 22)
const res2 = findNearestPolylineSegment(testPolyline, 20, 22);
assert(res2?.segmentIndex === 3, 'Correctly identifies segment 3 (10,20) -> (30,20)');
assert(res2 !== null && Math.abs(res2.distance - 2.0) < 0.001, 'Distance from line is exactly 2.0m');
assert(res2 !== null && Math.abs(res2.projectedPoint.x - 20) < 0.001, 'Projected X is snapped to 20.0');
assert(res2 !== null && Math.abs(res2.projectedPoint.z - 20) < 0.001, 'Projected Z is snapped to 20.0');
assert(res2?.insertAfterStopIndex === 1, 'Leg index is 1 for second stop segment');

// Query 3: Point clamped past endpoint (35, 20)
const res3 = findNearestPolylineSegment(testPolyline, 35, 20);
assert(res3 !== null && Math.abs(res3.projectedPoint.x - 30) < 0.001, 'Clamps to segment endpoint X=30');
assert(res3 !== null && Math.abs(res3.projectedPoint.z - 20) < 0.001, 'Clamps to segment endpoint Z=20');

console.log('\n--- TEST GROUP 2: calculatePickingRoute Full Polyline Tagging ---');

const routeResult = calculatePickingRoute({
  bounds,
  racks: mockRacks,
  pickItems: mockItems,
  depotPos,
  vehicleType: 'FORKLIFT',
  isManualSequence: true,
});

assert(routeResult.polylinePoints.length > 2, 'Generated polyline points array has valid size');
const taggedPoints = routeResult.polylinePoints.filter(
  (p) => p.insertAfterStopIndex !== undefined && p.prevWaypointId !== undefined
);
assert(
  taggedPoints.length === routeResult.polylinePoints.length,
  '100% of polyline points have segment and waypoint metadata'
);

console.log('\n--- TEST GROUP 3: Topological Insertion & Zero Stray Lines ---');

useEditorStore.setState({
  pickList: mockItems,
  customWaypoints: [],
  routeResult,
  depotPosition: depotPos,
  floorDimensions: bounds,
  racks: mockRacks,
  structuralElements: [],
});

// Add Waypoint 1 between Stop 1 and Stop 2
useEditorStore.getState().addCustomWaypoint({
  id: 'wp-leg1-first',
  x: 20,
  z: 22,
  insertAfterStopIndex: 1,
  insertAfterWaypointId: 'stop-1',
});

let state = useEditorStore.getState();
assert(state.customWaypoints.length === 1, 'First custom waypoint added successfully');
assert(state.customWaypoints[0].id === 'wp-leg1-first', 'Waypoint ID matches');
assert(state.customWaypoints[0].insertAfterStopIndex === 1, 'Leg index matches 1');

// Add Waypoint 2 after Waypoint 1 on the same leg
useEditorStore.getState().addCustomWaypoint({
  id: 'wp-leg1-second',
  x: 22,
  z: 22,
  insertAfterStopIndex: 1,
  insertAfterWaypointId: 'wp-leg1-first',
});

state = useEditorStore.getState();
assert(state.customWaypoints.length === 2, 'Second custom waypoint added');
assert(state.customWaypoints[0].id === 'wp-leg1-first', 'First waypoint remains first');
assert(state.customWaypoints[1].id === 'wp-leg1-second', 'Second waypoint appended after first');

// Add Waypoint 3 inserted BEFORE Waypoint 1 on the same leg (clicked between Stop 1 and Waypoint 1)
useEditorStore.getState().addCustomWaypoint({
  id: 'wp-leg1-before',
  x: 18,
  z: 22,
  insertAfterStopIndex: 1,
  insertAfterWaypointId: 'stop-1',
});

state = useEditorStore.getState();
assert(state.customWaypoints.length === 3, 'Third custom waypoint added');
assert(
  state.customWaypoints[0].id === 'wp-leg1-before',
  'Inserted before existing leg waypoints: wp-leg1-before is index 0'
);
assert(
  state.customWaypoints[1].id === 'wp-leg1-first',
  'wp-leg1-first is shifted to index 1'
);
assert(
  state.customWaypoints[2].id === 'wp-leg1-second',
  'wp-leg1-second is shifted to index 2'
);

console.log('\n--- TEST GROUP 4: Double-Click Deletion & Undo/Redo Preservation ---');

// Remove middle waypoint (wp-leg1-first)
useEditorStore.getState().removeCustomWaypoint('wp-leg1-first');
state = useEditorStore.getState();
assert(state.customWaypoints.length === 2, 'wp-leg1-first removed successfully');
assert(
  !state.customWaypoints.some((w) => w.id === 'wp-leg1-first'),
  'wp-leg1-first is gone from store'
);

// Undo removal: should restore wp-leg1-first back at its original index 1!
useEditorStore.getState().undo();
state = useEditorStore.getState();
assert(state.customWaypoints.length === 3, 'Undo restored waypoint count to 3');
assert(
  state.customWaypoints[1].id === 'wp-leg1-first',
  'Undo restored wp-leg1-first precisely back at index 1!'
);

// Redo removal
useEditorStore.getState().redo();
state = useEditorStore.getState();
assert(state.customWaypoints.length === 2, 'Redo re-removed the waypoint');

// Move remaining waypoint
const targetPos = { x: 23, z: 23 };
useEditorStore.getState().moveCustomWaypoint('wp-leg1-second', targetPos);
state = useEditorStore.getState();
const movedWp = state.customWaypoints.find((w) => w.id === 'wp-leg1-second');
assert(movedWp !== undefined, 'Moved waypoint exists');
assert(movedWp?.insertAfterStopIndex === 1, 'Waypoint leg index remains locked to 1');

// Undo move
useEditorStore.getState().undo();
state = useEditorStore.getState();
const unrolledWp = state.customWaypoints.find((w) => w.id === 'wp-leg1-second');
assert(unrolledWp?.x === 22 && unrolledWp?.z === 22, 'Undo restored original coordinates (22, 22)');

console.log('\n========================================');
console.log(`Results: ${passedTests} / ${totalTests} assertions passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL CLICK-TO-SPLIT & WAYPOINT OVERHAUL TESTS PASSED!');
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exitCode = 1;
}
