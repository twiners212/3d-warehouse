// Smoke Test for Phase 37: Interactive Picking Route Editing & Waypoint Manipulation
// Tests Stop Reordering, TSP Bypass, Custom Transit Waypoints, Access Point Dragging, Depot Moving, and Command Undo/Redo

import {
  calculatePickingRoute,
  detectDefaultDepot,
} from '../src/engine/routing/routing-engine';
import {
  createReorderPickStopsCommand,
  createMovePickAccessPointCommand,
  createMoveDepotPositionCommand,
  createAddCustomWaypointCommand,
  createRemoveCustomWaypointCommand,
  createMoveCustomWaypointCommand,
  createAutoOptimizeRouteCommand,
} from '../src/engine/commands/PickingCommands';
import type { PickItem, CustomWaypoint } from '../src/types/routing';
import type { WarehouseBounds } from '../src/types/spatial';
import type { RackEntity } from '../src/types/layout';
import { useEditorStore } from '../src/stores/useEditorStore';
import { id } from '../src/lib/i18n/id';
import { en } from '../src/lib/i18n/en';

console.log('🧪 Running Smoke Tests for Phase 37: Interactive Route Editing...\n');

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

const bounds: WarehouseBounds = { width: 50, depth: 40 };
const depotPos = { x: 5, z: 5 };

const mockRacks: RackEntity[] = [
  {
    id: 'rack-1',
    name: 'A01',
    type: 'selective_pallet',
    position: { x: 15, y: 0, z: 20 },
    rotationY: 0,
    dimensions: { width: 10, height: 6, depth: 1.2 },
    bays: 4,
    levels: 3,
    bayWidth: 2.5,
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
    bayIndex: 1,
    levelIndex: 1,
    position3D: { x: 10, y: 1, z: 20 },
    accessPoint3D: { x: 10, y: 0, z: 22 },
    sku: 'SKU-001',
    productName: 'Heavy Cargo Pallet',
    quantity: 2,
    weightKg: 20,
    isPicked: false,
  },
  {
    binId: 'BIN-102',
    rackId: 'rack-1',
    rackName: 'A01',
    bayIndex: 2,
    levelIndex: 1,
    position3D: { x: 25, y: 1, z: 30 },
    accessPoint3D: { x: 25, y: 0, z: 32 },
    sku: 'SKU-002',
    productName: 'Standard Tote',
    quantity: 5,
    weightKg: 10,
    isPicked: false,
  },
  {
    binId: 'BIN-103',
    rackId: 'rack-1',
    rackName: 'A01',
    bayIndex: 3,
    levelIndex: 1,
    position3D: { x: 40, y: 1, z: 15 },
    accessPoint3D: { x: 40, y: 0, z: 17 },
    sku: 'SKU-003',
    productName: 'Electronic Pack',
    quantity: 1,
    weightKg: 5,
    isPicked: false,
  },
];

// -------------------------------------------------------------
// Test 1: Manual Sequence Lock & TSP Bypass
// -------------------------------------------------------------
console.log('1. Testing Manual Sequence vs TSP 2-Opt Mode:');
// Normal TSP
const tspRoute = calculatePickingRoute({
  bounds,
  racks: mockRacks,
  pickItems: mockItems,
  depotPos,
  vehicleType: 'FORKLIFT',
  isManualSequence: false,
});
assert(tspRoute.orderedPicks.length === 3, 'TSP calculates route for all 3 items');
assert(!tspRoute.isManualSequence, 'TSP route has isManualSequence === false');

// Force reverse order with manual sequence
const manualItems = [mockItems[2], mockItems[0], mockItems[1]];
const manualRoute = calculatePickingRoute({
  bounds,
  racks: mockRacks,
  pickItems: manualItems,
  depotPos,
  vehicleType: 'FORKLIFT',
  isManualSequence: true,
});
assert(manualRoute.isManualSequence === true, 'Manual sequence route preserves isManualSequence flag');
assert(
  manualRoute.orderedPicks[0].binId === 'BIN-103' &&
  manualRoute.orderedPicks[1].binId === 'BIN-101' &&
  manualRoute.orderedPicks[2].binId === 'BIN-102',
  'Manual sequence strictly preserves the user-defined stop order without TSP reordering'
);

// -------------------------------------------------------------
// Test 2: Custom Transit Waypoints Insertion
// -------------------------------------------------------------
console.log('\n2. Testing Custom Transit Waypoints:');
const customWp1: CustomWaypoint = {
  id: 'cw-1',
  x: 20,
  z: 10,
  name: 'Corridor Turn 1',
  insertAfterStopIndex: 1, // after Stop 1 (BIN-103)
};

const routeWithWaypoints = calculatePickingRoute({
  bounds,
  racks: mockRacks,
  pickItems: manualItems,
  depotPos,
  vehicleType: 'FORKLIFT',
  isManualSequence: true,
  customWaypoints: [customWp1],
});

const transitWaypoint = routeWithWaypoints.waypoints.find(
  (w) => w.type === 'TRANSIT' && w.customWaypointId === 'cw-1'
);
assert(!!transitWaypoint, 'Custom transit waypoint cw-1 is present in the route waypoints array');
assert(transitWaypoint?.x === 20 && transitWaypoint?.z === 10, 'Waypoint coordinates match (20, 10)');

// -------------------------------------------------------------
// Test 3: Command Pattern & Undo/Redo Integration
// -------------------------------------------------------------
console.log('\n3. Testing Store Command Pattern & Undo/Redo:');

// Setup store state
useEditorStore.setState({
  floorDimensions: { width: 50, depth: 40, height: 8 },
  racks: mockRacks,
  pickList: [...mockItems],
  depotPosition: { ...depotPos },
  customWaypoints: [],
  isManualSequence: false,
});

// 3A: Reorder command
const initialList = useEditorStore.getState().pickList;
const reordered = [initialList[1], initialList[0], initialList[2]];
const reorderCmd = createReorderPickStopsCommand(initialList, reordered);

reorderCmd.execute();
assert(
  useEditorStore.getState().pickList[0].binId === 'BIN-102' &&
  useEditorStore.getState().isManualSequence === true,
  'createReorderPickStopsCommand.execute() updates list and sets isManualSequence = true'
);

reorderCmd.undo();
assert(
  useEditorStore.getState().pickList[0].binId === 'BIN-101',
  'createReorderPickStopsCommand.undo() restores original list order'
);

// 3B: Move Pick Access Point command
const moveAccessCmd = createMovePickAccessPointCommand('BIN-101', { x: 10, z: 22 }, { x: 12, z: 24 });
moveAccessCmd.execute();
const updatedItem = useEditorStore.getState().pickList.find((p) => p.binId === 'BIN-101');
assert(
  updatedItem?.accessPoint3D.x === 12 && updatedItem?.accessPoint3D.z === 24,
  'createMovePickAccessPointCommand.execute() moves access point to (12, 24)'
);

moveAccessCmd.undo();
const restoredItem = useEditorStore.getState().pickList.find((p) => p.binId === 'BIN-101');
assert(
  restoredItem?.accessPoint3D.x === 10 && restoredItem?.accessPoint3D.z === 22,
  'createMovePickAccessPointCommand.undo() restores original access point (10, 22)'
);

// 3C: Move Depot Position command
const moveDepotCmd = createMoveDepotPositionCommand({ x: 5, z: 5 }, { x: 8, z: 8 });
moveDepotCmd.execute();
assert(
  useEditorStore.getState().depotPosition.x === 8 && useEditorStore.getState().depotPosition.z === 8,
  'createMoveDepotPositionCommand.execute() moves depot to (8, 8)'
);

moveDepotCmd.undo();
assert(
  useEditorStore.getState().depotPosition.x === 5 && useEditorStore.getState().depotPosition.z === 5,
  'createMoveDepotPositionCommand.undo() restores original depot (5, 5)'
);

// 3D: Add & Remove Custom Waypoint command
const addWpCmd = createAddCustomWaypointCommand(customWp1);
addWpCmd.execute();
assert(
  useEditorStore.getState().customWaypoints.some((w) => w.id === 'cw-1'),
  'createAddCustomWaypointCommand.execute() appends custom waypoint'
);

addWpCmd.undo();
assert(
  !useEditorStore.getState().customWaypoints.some((w) => w.id === 'cw-1'),
  'createAddCustomWaypointCommand.undo() removes added waypoint'
);

// 3E: Auto Optimize Route command (unlocking manual sequence)
useEditorStore.setState({ isManualSequence: true });
const autoOptCmd = createAutoOptimizeRouteCommand(useEditorStore.getState().pickList, true);
autoOptCmd.execute();
assert(
  useEditorStore.getState().isManualSequence === false,
  'createAutoOptimizeRouteCommand.execute() clears manual sequence lock'
);

autoOptCmd.undo();
assert(
  useEditorStore.getState().isManualSequence === true,
  'createAutoOptimizeRouteCommand.undo() re-engages manual sequence lock'
);

// -------------------------------------------------------------
// Test 4: i18n Dictionary Integrity
// -------------------------------------------------------------
console.log('\n4. Testing i18n Bilingual Dictionary:');
assert(!!id.picking.manualSequence, 'id.picking.manualSequence defined');
assert(!!en.picking.manualSequence, 'en.picking.manualSequence defined');
assert(!!id.picking.reorderUp, 'id.picking.reorderUp defined');
assert(!!en.picking.reorderUp, 'en.picking.reorderUp defined');
assert(!!id.picking.reOptimizeBtn, 'id.picking.reOptimizeBtn defined');
assert(!!en.picking.reOptimizeBtn, 'en.picking.reOptimizeBtn defined');
assert(!!id.picking.addWaypoint, 'id.picking.addWaypoint defined');
assert(!!en.picking.addWaypoint, 'en.picking.addWaypoint defined');
assert(!!id.picking.dragDepotHint, 'id.picking.dragDepotHint defined');
assert(!!en.picking.dragDepotHint, 'en.picking.dragDepotHint defined');

console.log(`\n🎉 Results: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
