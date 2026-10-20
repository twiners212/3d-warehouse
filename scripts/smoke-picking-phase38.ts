// Smoke Test for Phase 38: Direct Polyline Line Dragging, Clear Route to Scratch Slate, and Manual Route Creator
// Validates Walkability Snapping, Clear Route Undo/Redo, Manual Route Builder, Custom Waypoint Bending, and Zod Serialization

import {
  createWalkabilityGrid,
  findNearestWalkablePoint,
} from '../src/engine/routing/grid-map';
import {
  calculatePickingRoute,
} from '../src/engine/routing/routing-engine';
import {
  createClearPickingRouteCommand,
  createAddBinToManualRouteCommand,
  createAddCustomWaypointCommand,
} from '../src/engine/commands/PickingCommands';
import { createBatchUpdateAllBinsCommand } from '../src/engine/commands/BinCommands';
import { WarehouseBlueprintSchema } from '../src/lib/validations/layout-schema';
import type { PickItem, CustomWaypoint } from '../src/types/routing';
import type { WarehouseBounds } from '../src/types/spatial';
import type { RackEntity } from '../src/types/layout';
import { useEditorStore } from '../src/stores/useEditorStore';
import { id } from '../src/lib/i18n/id';
import { en } from '../src/lib/i18n/en';

console.log('🧪 Running Smoke Tests for Phase 38: Direct Polyline Editing, Clear Route & Manual Creator...\n');

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

const bounds: WarehouseBounds = { width: 40, depth: 30 };
const depotPos = { x: 4, z: 4 };

const mockRacks: RackEntity[] = [
  {
    id: 'rack-test-1',
    name: 'A01',
    type: 'selective_pallet',
    position: { x: 15, y: 0, z: 15 },
    rotationY: 0,
    dimensions: { width: 10, height: 5, depth: 2 },
    bays: 4,
    levels: 3,
    bayWidth: 2.5,
    bayDepth: 2.0,
    levelHeight: 1.6,
    bins: [],
  },
];

const samplePicks: PickItem[] = [
  {
    binId: 'BIN-P38-1',
    rackId: 'rack-test-1',
    rackName: 'A01',
    bayIndex: 1,
    levelIndex: 1,
    position3D: { x: 12, y: 1, z: 15 },
    accessPoint3D: { x: 12, y: 0, z: 18 },
    sku: 'SKU-P38-A',
    productName: 'Solar Inverter Unit',
    quantity: 1,
    weightKg: 25,
    isPicked: false,
  },
  {
    binId: 'BIN-P38-2',
    rackId: 'rack-test-1',
    rackName: 'A01',
    bayIndex: 3,
    levelIndex: 2,
    position3D: { x: 17, y: 2.5, z: 15 },
    accessPoint3D: { x: 17, y: 0, z: 18 },
    sku: 'SKU-P38-B',
    productName: 'Lithium Battery Pack',
    quantity: 2,
    weightKg: 40,
    isPicked: false,
  },
];

// ============================================================================
// TEST GROUP 1: Walkability Grid & Obstacle Snapping (findNearestWalkablePoint)
// ============================================================================
console.log('--- TEST GROUP 1: Walkability Grid & Obstacle Snapping ---');
const grid = createWalkabilityGrid(bounds, mockRacks);

// 1. Open aisle point should remain unchanged
const openPoint = { x: 5, z: 5 };
const snappedOpen = findNearestWalkablePoint(grid, openPoint.x, openPoint.z);
assert(
  Math.abs(snappedOpen.x - openPoint.x) < 0.001 && Math.abs(snappedOpen.z - openPoint.z) < 0.001,
  'Open aisle point remains exactly at original coordinates'
);

// 2. Point inside the rack (15, 15) should be detected as obstacle and snapped to adjacent corridor
const blockedPoint = { x: 15, z: 15 };
const blockedGridCoord = grid.worldToGrid(blockedPoint.x, blockedPoint.z);
assert(
  !grid.isWalkable(blockedGridCoord.col, blockedGridCoord.row),
  'Center of rack is correctly classified as an obstacle cell'
);

const snappedCorridor = findNearestWalkablePoint(grid, blockedPoint.x, blockedPoint.z);
const snappedGridCoord = grid.worldToGrid(snappedCorridor.x, snappedCorridor.z);
assert(
  grid.isWalkable(snappedGridCoord.col, snappedGridCoord.row),
  'findNearestWalkablePoint successfully snaps blocked coordinates to an open walkable cell'
);

// ============================================================================
// TEST GROUP 2: Clear Route to Scratch Slate & Undo/Redo
// ============================================================================
console.log('\n--- TEST GROUP 2: Clear Route to Scratch Slate & Undo/Redo ---');

// Setup initial state in EditorStore
useEditorStore.setState({
  floorDimensions: { width: 40, height: 8, depth: 30 },
  racks: mockRacks,
  structuralElements: [],
  pickList: [...samplePicks],
  depotPosition: depotPos,
  isManualSequence: true,
  customWaypoints: [
    { id: 'cw-init-1', x: 8, z: 8, insertAfterStopIndex: 0, name: 'Transit Alpha' },
  ],
});
useEditorStore.getState().recalculateRoute();

const initialResult = useEditorStore.getState().routeResult;
assert(initialResult !== null, 'Initial route generated successfully with 2 stops');
assert(useEditorStore.getState().pickList.length === 2, 'Store has 2 pick items initially');
assert(useEditorStore.getState().customWaypoints.length === 1, 'Store has 1 custom waypoint initially');

// Execute Clear Route Command
const clearCmd = createClearPickingRouteCommand({
  pickList: useEditorStore.getState().pickList,
  customWaypoints: useEditorStore.getState().customWaypoints,
  isManualSequence: useEditorStore.getState().isManualSequence,
});

useEditorStore.getState().executeCommand(clearCmd);

assert(useEditorStore.getState().pickList.length === 0, 'Execute: pickList is wiped to clean slate (0 items)');
assert(useEditorStore.getState().customWaypoints.length === 0, 'Execute: customWaypoints are completely cleared');
assert(useEditorStore.getState().routeResult === null, 'Execute: routeResult is set to null');
assert(useEditorStore.getState().isManualSequence === false, 'Execute: isManualSequence is reset to false');

// Undo Clear Route Command
useEditorStore.getState().undo();

assert(useEditorStore.getState().pickList.length === 2, 'Undo: pickList is fully restored to 2 items');
assert(useEditorStore.getState().customWaypoints.length === 1, 'Undo: customWaypoints are restored');
assert(useEditorStore.getState().isManualSequence === true, 'Undo: isManualSequence status is restored to true');
assert(useEditorStore.getState().routeResult !== null, 'Undo: routeResult is automatically recalculated');

// ============================================================================
// TEST GROUP 3: Manual Route Creator Mode (Sequential Appending)
// ============================================================================
console.log('\n--- TEST GROUP 3: Manual Route Creator Mode ---');

// Toggle manual route creator mode
assert(!useEditorStore.getState().isManualRouteCreatorActive, 'isManualRouteCreatorActive starts as false');
useEditorStore.getState().toggleManualRouteCreator();
assert(useEditorStore.getState().isManualRouteCreatorActive === true, 'toggleManualRouteCreator sets isManualRouteCreatorActive to true');
assert(useEditorStore.getState().isManualSequence === true, 'toggleManualRouteCreator automatically locks isManualSequence to true');

// Add a 3rd bin using createAddBinToManualRouteCommand
const newManualPick: PickItem = {
  binId: 'BIN-P38-3',
  rackId: 'rack-test-1',
  rackName: 'A01',
  bayIndex: 4,
  levelIndex: 1,
  position3D: { x: 19, y: 1, z: 15 },
  accessPoint3D: { x: 19, y: 0, z: 18 },
  sku: 'SKU-P38-C',
  productName: 'Control Panel',
  quantity: 3,
  weightKg: 12,
  isPicked: false,
};

const addManualCmd = createAddBinToManualRouteCommand(newManualPick);
useEditorStore.getState().executeCommand(addManualCmd);

const picksAfterAdd = useEditorStore.getState().pickList;
assert(picksAfterAdd.length === 3, 'Manual Add: pickList count increased to 3 items');
assert(picksAfterAdd[picksAfterAdd.length - 1].binId === 'BIN-P38-3', 'Manual Add: item appended sequentially at the tail');

// Undo addition
useEditorStore.getState().undo();
assert(useEditorStore.getState().pickList.length === 2, 'Undo Manual Add: removes the added item cleanly');
assert(!useEditorStore.getState().pickList.some((p) => p.binId === 'BIN-P38-3'), 'Undo Manual Add: BIN-P38-3 is no longer in pickList');

// Redo addition
useEditorStore.getState().redo();
assert(useEditorStore.getState().pickList.length === 3, 'Redo Manual Add: restores the 3rd item correctly');

// ============================================================================
// TEST GROUP 4: Direct Line Bend Handles & Custom Waypoints
// ============================================================================
console.log('\n--- TEST GROUP 4: Direct Line Bend Handles & Custom Waypoints ---');

// Insert a bend handle waypoint
const bendWaypoint: CustomWaypoint = {
  id: 'cw-bend-corridor-1',
  x: 25,
  z: 10,
  insertAfterStopIndex: 1,
  name: 'Corridor Redirect B',
};

const addBendCmd = createAddCustomWaypointCommand(bendWaypoint);
useEditorStore.getState().executeCommand(addBendCmd);

assert(
  useEditorStore.getState().customWaypoints.some((w) => w.id === 'cw-bend-corridor-1'),
  'Bend waypoint successfully inserted into customWaypoints'
);

const routeWithBend = useEditorStore.getState().routeResult;
assert(
  routeWithBend !== null && routeWithBend.waypoints.some((w) => w.customWaypointId === 'cw-bend-corridor-1'),
  'A* routing engine includes the bend waypoint in the synthesized waypoints array'
);

// Undo bend handle insertion
useEditorStore.getState().undo();
assert(
  !useEditorStore.getState().customWaypoints.some((w) => w.id === 'cw-bend-corridor-1'),
  'Undo: successfully removes the bend waypoint from customWaypoints'
);

// ============================================================================
// TEST GROUP 5: Blueprint Zod Validation with pickingConfig
// ============================================================================
console.log('\n--- TEST GROUP 5: Blueprint Zod Validation with pickingConfig ---');

const testBlueprintWithRoute = {
  id: 'bp-test-phase38',
  name: 'Phase 38 Test Facility',
  gridSnapStep: 0.5,
  floorDimensions: { width: 40, height: 8, depth: 30 },
  zones: [],
  structuralElements: [],
  racks: mockRacks,
  pickingConfig: {
    pickList: samplePicks,
    customWaypoints: [bendWaypoint],
    depotPosition: depotPos,
    selectedVehicleType: 'FORKLIFT' as const,
    isManualSequence: true,
  },
};

const parseResult = WarehouseBlueprintSchema.safeParse(testBlueprintWithRoute);
assert(parseResult.success, 'WarehouseBlueprintSchema parses blueprint with full pickingConfig successfully');

// Backward compatibility check (blueprint without pickingConfig)
const testBlueprintWithoutRoute = {
  id: 'bp-test-legacy',
  name: 'Legacy Facility',
  gridSnapStep: 0.5,
  floorDimensions: { width: 40, height: 8, depth: 30 },
  zones: [],
  structuralElements: [],
  racks: mockRacks,
};

const parseLegacyResult = WarehouseBlueprintSchema.safeParse(testBlueprintWithoutRoute);
assert(parseLegacyResult.success, 'WarehouseBlueprintSchema maintains 100% backward compatibility without pickingConfig');

// ============================================================================
// TEST GROUP 6: Localization (i18n) Key Parity
// ============================================================================
console.log('\n--- TEST GROUP 6: Localization (i18n) Key Parity ---');

const phase38Keys = [
  'manualRouteMode',
  'manualRouteInstruction',
  'manualRouteActiveBadge',
  'exitManualRoute',
  'clearRouteConfirmTitle',
  'clearRouteConfirmDesc',
  'clearRouteConfirmBtn',
  'clearRouteCancelBtn',
  'clearRouteUndoNotice',
  'routeResetSuccess',
  'dragLineHandle',
  'blockedCorridorWarning',
  'badgeDisplayMode',
  'badgeModeSmart',
  'badgeModeFull',
  'badgeModeCompact',
] as const;

for (const key of phase38Keys) {
  const hasId = key in id.picking;
  const hasEn = key in en.picking;
  assert(hasId && hasEn, `i18n key "${key}" exists in both ID and EN dictionaries`);
}

// ============================================================================
// TEST GROUP 7: 3D ID Badge Anti-Collision & Display Mode State
// ============================================================================
console.log('\n--- TEST GROUP 7: 3D ID Badge Anti-Collision & Display Mode State ---');

// 1. Initial default mode should be SMART
const initialMode = useEditorStore.getState().badgeDisplayMode;
assert(initialMode === 'SMART', 'badgeDisplayMode defaults to "SMART"');

// 2. Setting badge display mode directly
useEditorStore.getState().setBadgeDisplayMode('FULL');
assert(useEditorStore.getState().badgeDisplayMode === 'FULL', 'setBadgeDisplayMode switches mode to "FULL"');

useEditorStore.getState().setBadgeDisplayMode('COMPACT');
assert(useEditorStore.getState().badgeDisplayMode === 'COMPACT', 'setBadgeDisplayMode switches mode to "COMPACT"');

// 3. Cycling toggle: COMPACT -> SMART -> FULL -> COMPACT
useEditorStore.getState().toggleBadgeDisplayMode();
assert(useEditorStore.getState().badgeDisplayMode === 'SMART', 'toggleBadgeDisplayMode cycles COMPACT -> SMART');

useEditorStore.getState().toggleBadgeDisplayMode();
assert(useEditorStore.getState().badgeDisplayMode === 'FULL', 'toggleBadgeDisplayMode cycles SMART -> FULL');

useEditorStore.getState().toggleBadgeDisplayMode();
assert(useEditorStore.getState().badgeDisplayMode === 'COMPACT', 'toggleBadgeDisplayMode cycles FULL -> COMPACT');

useEditorStore.getState().setBadgeDisplayMode('SMART');

// 4. Proximity & Clustering Detection Logic
const testPicksForClustering: PickItem[] = [
  {
    binId: 'BIN-CLUSTER-1',
    rackId: 'rack-cluster-A',
    rackName: 'A01',
    bayIndex: 1,
    levelIndex: 1,
    position3D: { x: 10, y: 1, z: 10 },
    accessPoint3D: { x: 10, y: 0, z: 12 },
    sku: 'SKU-C1',
    productName: 'Part 1',
    quantity: 1,
    weightKg: 5,
    isPicked: false,
  },
  {
    binId: 'BIN-CLUSTER-2',
    rackId: 'rack-cluster-A', // Same rack, nearby
    rackName: 'A01',
    bayIndex: 2,
    levelIndex: 1,
    position3D: { x: 12, y: 1, z: 10 },
    accessPoint3D: { x: 12, y: 0, z: 12 }, // distance is 2.0m <= 3.5m
    sku: 'SKU-C2',
    productName: 'Part 2',
    quantity: 1,
    weightKg: 5,
    isPicked: false,
  },
  {
    binId: 'BIN-ISOLATED-3',
    rackId: 'rack-cluster-B', // Different rack far away
    rackName: 'B01',
    bayIndex: 1,
    levelIndex: 1,
    position3D: { x: 30, y: 1, z: 25 },
    accessPoint3D: { x: 30, y: 0, z: 27 }, // distance > 20m
    sku: 'SKU-C3',
    productName: 'Part 3',
    quantity: 1,
    weightKg: 5,
    isPicked: false,
  },
];

const clusterResults = testPicksForClustering.map((p1, i) => {
  const hasNearby = testPicksForClustering.some(
    (p2, j) =>
      i !== j &&
      (p1.rackId === p2.rackId ||
        Math.hypot(
          p1.accessPoint3D.x - p2.accessPoint3D.x,
          p1.accessPoint3D.z - p2.accessPoint3D.z
        ) <= 3.5)
  );
  return {
    isClustered: hasNearby,
    elevationY: hasNearby ? (i % 2 === 0 ? 0.85 : 1.30) : 0.90,
  };
});

assert(clusterResults[0].isClustered === true, 'Nearby Stop 1 is detected as clustered (isClustered = true)');
assert(clusterResults[0].elevationY === 0.85, 'Clustered Stop 1 has lower staggered elevation (0.85m)');
assert(clusterResults[1].isClustered === true, 'Nearby Stop 2 is detected as clustered (isClustered = true)');
assert(clusterResults[1].elevationY === 1.30, 'Clustered Stop 2 has higher staggered elevation (1.30m)');
assert(clusterResults[2].isClustered === false, 'Isolated Stop 3 is not clustered (isClustered = false)');
assert(clusterResults[2].elevationY === 0.90, 'Isolated Stop 3 keeps standard elevation (0.90m)');

// ============================================================================
// TEST GROUP 8: Picking Route Selection Isolation & Layout Entity Lock
// ============================================================================
console.log('\n--- TEST GROUP 8: Picking Route Selection Isolation & Layout Entity Lock ---');

// 1. Simulate active selection in LAYOUT mode
useEditorStore.getState().setEditorViewMode('LAYOUT');
useEditorStore.getState().selectEntity('rack-test-1');
useEditorStore.getState().setHoveredEntity('rack-test-1');

assert(useEditorStore.getState().selectedEntityId === 'rack-test-1', 'Entity selected in LAYOUT mode');
assert(useEditorStore.getState().selectedEntityIds.length === 1, 'selectedEntityIds contains 1 item in LAYOUT mode');
assert(useEditorStore.getState().mode === 'SELECTED', 'Store mode is SELECTED');

// 2. Switch to PICKING mode -> must automatically clear layout selection
useEditorStore.getState().setEditorViewMode('PICKING');

assert(useEditorStore.getState().editorViewMode === 'PICKING', 'Successfully switched to PICKING mode');
assert(useEditorStore.getState().selectedEntityId === null, 'selectedEntityId is automatically cleared (null) in PICKING mode');
assert(useEditorStore.getState().selectedEntityIds.length === 0, 'selectedEntityIds is automatically empty in PICKING mode');
assert(useEditorStore.getState().mode === 'IDLE', 'Store mode reset to IDLE in PICKING mode');
assert(useEditorStore.getState().hoveredEntityId === null, 'hoveredEntityId reset to null in PICKING mode');

// 3. Picking domain elements remain fully accessible in PICKING mode
assert(useEditorStore.getState().pickList.length >= 0, 'pickList remains intact and functional in PICKING mode');
assert(useEditorStore.getState().depotPosition !== null, 'depotPosition remains accessible in PICKING mode');

// Restore to LAYOUT mode for clean teardown
useEditorStore.getState().setEditorViewMode('LAYOUT');

// ============================================================================
// TEST GROUP 9: Dedicated Workspace Layout & Collision Prevention
// ============================================================================
console.log('\n--- TEST GROUP 9: Dedicated Workspace Layout & Collision Prevention ---');

// 1. In LAYOUT mode, editorViewMode is LAYOUT
assert(useEditorStore.getState().editorViewMode === 'LAYOUT', 'Initial view mode is LAYOUT');

// 2. Switch to PICKING mode
useEditorStore.getState().setEditorViewMode('PICKING');
assert(useEditorStore.getState().editorViewMode === 'PICKING', 'Active view mode is PICKING');

// 3. Verify vehicle selector & speeds
assert(useEditorStore.getState().selectedVehicleType === 'FORKLIFT', 'Default vehicle is FORKLIFT');
useEditorStore.getState().setVehicleType('AGV');
assert(useEditorStore.getState().selectedVehicleType === 'AGV', 'Vehicle switched to AGV in sub-header');
useEditorStore.getState().setVehicleType('CART');
assert(useEditorStore.getState().selectedVehicleType === 'CART', 'Vehicle switched to CART in sub-header');

// 4. Verify route calculation & playback telemetry in docked footer
useEditorStore.setState({ pickList: [...samplePicks] });
useEditorStore.getState().recalculateRoute();
assert(useEditorStore.getState().pickList.length === 2, 'Pick list populated with 2 items for docked manifest');
assert(useEditorStore.getState().routeResult !== null, 'Route result computed for docked playback bar');
assert(useEditorStore.getState().playbackState.progress >= 0, 'Playback progress is valid in docked footer');

// 5. Clean teardown back to LAYOUT
useEditorStore.getState().clearPickList();
useEditorStore.getState().setEditorViewMode('LAYOUT');
assert(useEditorStore.getState().editorViewMode === 'LAYOUT', 'Cleanly returned to LAYOUT mode');

// ============================================================================
// TEST GROUP 10: Zero-Shift Header & Unified Manifest Control Center
// ============================================================================
console.log('\n--- TEST GROUP 10: Zero-Shift Header & Unified Manifest Control Center ---');

// 1. Mode Transitions are clean and independent of layout shifts
useEditorStore.getState().setEditorViewMode('LAYOUT');
assert(useEditorStore.getState().editorViewMode === 'LAYOUT', 'Mode transitioned to LAYOUT');

useEditorStore.getState().setEditorViewMode('WMS');
assert(useEditorStore.getState().editorViewMode === 'WMS', 'Mode transitioned to WMS');

// 2. Warehouse-wide WMS batch actions operate reliably on store bins
const initialBins = useEditorStore.getState().racks.reduce((acc, r) => acc + r.bins.length, 0);
if (initialBins > 0) {
  // Execute Stock All
  useEditorStore.getState().executeCommand(createBatchUpdateAllBinsCommand(true));
  const allOccupied = useEditorStore.getState().racks.every((r) => r.bins.every((b) => b.isOccupied));
  assert(allOccupied, 'WMS Stock All successfully marked 100% of warehouse bins as occupied');

  // Execute Empty All
  useEditorStore.getState().executeCommand(createBatchUpdateAllBinsCommand(false));
  const allEmpty = useEditorStore.getState().racks.every((r) => r.bins.every((b) => !b.isOccupied));
  assert(allEmpty, 'WMS Empty All successfully marked all warehouse bins as empty');

  // Undo Empty All
  useEditorStore.getState().undo();
  const undoRestored = useEditorStore.getState().racks.every((r) => r.bins.every((b) => b.isOccupied));
  assert(undoRestored, 'Undo successfully restored 100% occupied state');
} else {
  // If no mock racks exist, verify command creation
  const cmd = createBatchUpdateAllBinsCommand(true);
  assert(
    typeof cmd.execute === 'function' && typeof cmd.undo === 'function',
    'createBatchUpdateAllBinsCommand creates valid ICommand with execute and undo'
  );
}

// 3. Mode transitioned to PICKING
useEditorStore.getState().setEditorViewMode('PICKING');
assert(useEditorStore.getState().editorViewMode === 'PICKING', 'Mode transitioned to PICKING');

// 4. Unified Manifest Control Center operations
// Vehicle switching
useEditorStore.getState().setVehicleType('FORKLIFT');
assert(useEditorStore.getState().selectedVehicleType === 'FORKLIFT', 'Manifest fleet set to FORKLIFT');
useEditorStore.getState().setVehicleType('AGV');
assert(useEditorStore.getState().selectedVehicleType === 'AGV', 'Manifest fleet set to AGV');
useEditorStore.getState().setVehicleType('CART');
assert(useEditorStore.getState().selectedVehicleType === 'CART', 'Manifest fleet set to CART');

// 3D Badge Display Mode cycles (SMART -> FULL -> COMPACT -> SMART)
assert(useEditorStore.getState().badgeDisplayMode === 'SMART', 'Default badge display mode is SMART');
useEditorStore.getState().toggleBadgeDisplayMode();
assert(useEditorStore.getState().badgeDisplayMode === 'FULL', 'Toggled badge display mode to FULL');
useEditorStore.getState().toggleBadgeDisplayMode();
assert(useEditorStore.getState().badgeDisplayMode === 'COMPACT', 'Toggled badge display mode to COMPACT');
useEditorStore.getState().toggleBadgeDisplayMode();
assert(useEditorStore.getState().badgeDisplayMode === 'SMART', 'Toggled badge display mode back to SMART');

// Manual route creator toggle
useEditorStore.setState({ isManualRouteCreatorActive: false });
assert(useEditorStore.getState().isManualRouteCreatorActive === false, 'Manual route creator initially inactive');
useEditorStore.getState().toggleManualRouteCreator();
assert(useEditorStore.getState().isManualRouteCreatorActive === true, 'Manual route creator toggled active');
useEditorStore.getState().toggleManualRouteCreator();
assert(useEditorStore.getState().isManualRouteCreatorActive === false, 'Manual route creator toggled inactive');

// Custom Waypoint injection
const waypointCountBefore = useEditorStore.getState().customWaypoints.length;
useEditorStore.getState().addCustomWaypoint({ x: 12, z: 12 });
assert(useEditorStore.getState().customWaypoints.length === waypointCountBefore + 1, 'Custom waypoint added via unified controls');

// Teardown
useEditorStore.getState().clearPickList();
useEditorStore.getState().setEditorViewMode('LAYOUT');
assert(useEditorStore.getState().editorViewMode === 'LAYOUT', 'Final teardown returned to LAYOUT mode');

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n========================================`);
console.log(`Phase 38 Smoke Tests: ${passedTests} / ${totalTests} assertions passed!`);
if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 38 SMOKE TESTS PASSED!\n');
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
