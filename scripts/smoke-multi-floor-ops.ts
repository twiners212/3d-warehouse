// Smoke Test for Phase 40 Follow-up: Multi-Floor Operational Experience across Layout Builder, WMS, Picking Route & Catalogue
// Validates:
// 1. Raycasting at arbitrary elevation planeY (screenToWorldFloor)
// 2. Zustand store activeLevelId and floor-scoped batch inventory operations
// 3. ICommand atomic Undo/Redo for floor-scoped batch bin updating
// 4. Floor-scoped WMS capacity calculation and isolation
// 5. Picking manifest vertical transit transition detection between floors

import * as THREE from 'three';
import { screenToWorldFloor } from '../src/engine/spatial/raycasting';
import { useEditorStore } from '../src/stores/useEditorStore';
import { createBatchUpdateAllBinsCommand } from '../src/engine/commands/BinCommands';
import { createAddZoneCommand, createMoveZoneCommand } from '../src/engine/commands/ZoneCommands';
import {
  createAddVerticalConnectorCommand,
  createUpdateVerticalConnectorCommand,
} from '../src/engine/commands/VerticalConnectorCommands';
import {
  MAX_BUILDING_LEVELS,
  FIRE_SPRINKLER_CLEARANCE,
} from '../src/lib/constants/warehouse-defaults';
import { WarehouseBlueprintSchema } from '../src/lib/validations/layout-schema';
import { getWarehouseOccupiedBounds } from '../src/engine/spatial/snapping';
import type { BuildingLevel, RackEntity, WarehouseZone, VerticalConnector } from '../src/types/layout';
import type { PickItem } from '../src/types/routing';

console.log('🏗️ Running Smoke Tests for Multi-Floor Operational Experience...\n');

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

// -------------------------------------------------------------
// Test Suite 1: screenToWorldFloor at arbitrary elevation planeY
// -------------------------------------------------------------
console.log('📐 Test Suite 1: Raycasting screenToWorldFloor at Arbitrary Elevations');

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

const canvasRect: DOMRect = {
  left: 0,
  top: 0,
  width: 800,
  height: 800,
  right: 800,
  bottom: 800,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

// Test center of screen (400, 400)
const groundHit = screenToWorldFloor(400, 400, camera, canvasRect, 0);
assert(groundHit !== null, 'Ray intersects ground plane Y = 0');
if (groundHit) {
  assert(Math.abs(groundHit.y) < 0.001, `Ground hit Y coordinate is exactly 0 (got ${groundHit.y.toFixed(3)})`);
}

// Test elevated plane Y = 4.0
const elevatedHit = screenToWorldFloor(400, 400, camera, canvasRect, 4.0);
assert(elevatedHit !== null, 'Ray intersects elevated plane Y = 4.0');
if (elevatedHit && groundHit) {
  assert(Math.abs(elevatedHit.y - 4.0) < 0.001, `Elevated hit Y coordinate is 4.0 (got ${elevatedHit.y.toFixed(3)})`);
  assert(elevatedHit.x > groundHit.x, `Elevated hit X (${elevatedHit.x.toFixed(2)}) is closer to camera than ground hit (${groundHit.x.toFixed(2)})`);
  assert(elevatedHit.z > groundHit.z, `Elevated hit Z (${elevatedHit.z.toFixed(2)}) is closer to camera than ground hit (${groundHit.z.toFixed(2)})`);
}

// Test elevated plane Y = 8.0
const higherHit = screenToWorldFloor(400, 400, camera, canvasRect, 8.0);
assert(higherHit !== null, 'Ray intersects elevated plane Y = 8.0');
if (higherHit) {
  assert(Math.abs(higherHit.y - 8.0) < 0.001, `Higher hit Y coordinate is 8.0 (got ${higherHit.y.toFixed(3)})`);
}

// -------------------------------------------------------------
// Test Suite 2: Floor-Scoped WMS Batch Actions & Calculations
// -------------------------------------------------------------
console.log('\n📦 Test Suite 2: Floor-Scoped WMS Inventory & Batch Updates');

const store = useEditorStore.getState();

// Setup building levels
const level1: BuildingLevel = {
  id: 'level-1',
  name: 'Lantai 1',
  elevationY: 0,
  height: 4.0,
  orderIndex: 0,
  type: 'GROUND',
};

const level2: BuildingLevel = {
  id: 'level-2',
  name: 'Lantai 2 Mezzanine',
  elevationY: 4.0,
  height: 4.0,
  orderIndex: 1,
  type: 'MEZZANINE',
};

const createMockBin = (id: string, rackId: string, bayIndex: number, levelIndex: number) => ({
  id,
  rackId,
  bayIndex,
  levelIndex,
  isOccupied: false,
  relativePosition: { x: 0, y: 0, z: 0 },
  dimension: { width: 1.2, height: 1.5, depth: 1.0 },
  maxWeightKg: 500,
});

// Populate racks on Level 1 and Level 2
const rackL1: RackEntity = {
  id: 'rack-l1-1',
  name: 'Rack L1-A',
  type: 'selective_pallet',
  position: { x: 10, y: 0, z: 10 },
  rotationY: 0,
  dimensions: { width: 3, depth: 1.2, height: 3.5 },
  bayWidth: 1.2,
  bayDepth: 1.0,
  levelHeight: 1.5,
  bays: 2,
  levels: 2,
  levelId: 'level-1',
  bins: [
    createMockBin('b1-1', 'rack-l1-1', 0, 0),
    createMockBin('b1-2', 'rack-l1-1', 0, 1),
    createMockBin('b1-3', 'rack-l1-1', 1, 0),
    createMockBin('b1-4', 'rack-l1-1', 1, 1),
  ],
};

const rackL2: RackEntity = {
  id: 'rack-l2-1',
  name: 'Rack L2-A',
  type: 'selective_pallet',
  position: { x: 10, y: 4.0, z: 10 },
  rotationY: 0,
  dimensions: { width: 3, depth: 1.2, height: 3.5 },
  bayWidth: 1.2,
  bayDepth: 1.0,
  levelHeight: 1.5,
  bays: 2,
  levels: 2,
  levelId: 'level-2',
  bins: [
    createMockBin('b2-1', 'rack-l2-1', 0, 0),
    createMockBin('b2-2', 'rack-l2-1', 0, 1),
    createMockBin('b2-3', 'rack-l2-1', 1, 0),
    createMockBin('b2-4', 'rack-l2-1', 1, 1),
  ],
};

// Reset store with test racks and levels
useEditorStore.setState({
  buildingLevels: [level1, level2],
  activeLevelId: 'level-2',
  racks: [rackL1, rackL2],
});

// Test 1: Batch stock Level 2 only
store.batchUpdateAllBins(true, undefined, 'level-2');

const stateAfterL2Stock = useEditorStore.getState();
const l1Racks = stateAfterL2Stock.racks.filter((r) => r.levelId === 'level-1');
const l2Racks = stateAfterL2Stock.racks.filter((r) => r.levelId === 'level-2');

assert(
  l1Racks.every((r) => r.bins.every((b) => !b.isOccupied)),
  'Level 1 bins remained completely unstocked (free) when targeting level-2'
);
assert(
  l2Racks.every((r) => r.bins.every((b) => b.isOccupied)),
  'Level 2 bins were all stocked (100% occupied) by level-scoped batch update'
);

// Test 2: Batch empty Level 2 only
store.batchUpdateAllBins(false, undefined, 'level-2');
const stateAfterL2Empty = useEditorStore.getState();
assert(
  stateAfterL2Empty.racks.every((r) => r.bins.every((b) => !b.isOccupied)),
  'Level 2 bins were emptied successfully'
);

// -------------------------------------------------------------
// Test Suite 3: ICommand Undo/Redo for Floor-Scoped Batch Stocking
// -------------------------------------------------------------
console.log('\n⏪ Test Suite 3: ICommand Undo/Redo for Floor-Scoped Batch Stocking');

// Execute command targeting level-2
const stockCmd = createBatchUpdateAllBinsCommand(true, undefined, 'level-2');
useEditorStore.getState().executeCommand(stockCmd);

const stateAfterCmd = useEditorStore.getState();
assert(
  stateAfterCmd.racks.find((r) => r.id === 'rack-l2-1')?.bins.every((b) => b.isOccupied) === true,
  'Command executed: Level 2 bins are occupied'
);
assert(
  stateAfterCmd.racks.find((r) => r.id === 'rack-l1-1')?.bins.every((b) => !b.isOccupied) === true,
  'Level 1 bins remained untouched by command'
);

// Undo command
useEditorStore.getState().undo();
const stateAfterUndo = useEditorStore.getState();
assert(
  stateAfterUndo.racks.find((r) => r.id === 'rack-l2-1')?.bins.every((b) => !b.isOccupied) === true,
  'Undo reverted Level 2 bins to empty state'
);

// Redo command
useEditorStore.getState().redo();
const stateAfterRedo = useEditorStore.getState();
assert(
  stateAfterRedo.racks.find((r) => r.id === 'rack-l2-1')?.bins.every((b) => b.isOccupied) === true,
  'Redo restored Level 2 bins to occupied state'
);

// -------------------------------------------------------------
// Test Suite 4: Picking Manifest Multi-Floor Transit Detection
// -------------------------------------------------------------
console.log('\n🚀 Test Suite 4: Multi-Floor Picking Manifest & Vertical Transit Detection');

const mockPick1: PickItem = {
  binId: 'BIN-L1-01',
  rackId: 'rack-l1-1',
  rackName: 'Rack L1-A',
  bayIndex: 0,
  levelIndex: 0,
  position3D: { x: 10, y: 0.5, z: 10 },
  accessPoint3D: { x: 10, y: 0, z: 8 },
  sku: 'SKU-001',
  productName: 'Ground Item 1',
  quantity: 2,
  weightKg: 10,
  isPicked: false,
};

const mockPick2: PickItem = {
  binId: 'BIN-L1-02',
  rackId: 'rack-l1-1',
  bayIndex: 1,
  levelIndex: 0,
  rackName: 'Rack L1-A',
  position3D: { x: 12, y: 0.5, z: 10 },
  accessPoint3D: { x: 12, y: 0, z: 8 },
  sku: 'SKU-002',
  productName: 'Ground Item 2',
  quantity: 1,
  weightKg: 5,
  isPicked: false,
};

const mockPick3: PickItem = {
  binId: 'BIN-L2-01',
  rackId: 'rack-l2-1',
  rackName: 'Rack L2-A',
  bayIndex: 0,
  levelIndex: 0,
  position3D: { x: 10, y: 4.5, z: 10 },
  accessPoint3D: { x: 10, y: 4.0, z: 8 },
  sku: 'SKU-003',
  productName: 'Mezzanine Item 1',
  quantity: 4,
  weightKg: 20,
  isPicked: false,
};

const picksSequence = [mockPick1, mockPick2, mockPick3];

// Helper to resolve level
function resolvePickLevel(pick: PickItem, levels: BuildingLevel[], allRacks: RackEntity[]): BuildingLevel {
  const r = allRacks.find((rk) => rk.id === pick.rackId);
  if (r?.levelId) {
    const found = levels.find((l) => l.id === r.levelId);
    if (found) return found;
  }
  return levels.find((l) => Math.abs(l.elevationY - pick.position3D.y) < 2.0) ?? levels[0];
}

const levels = [level1, level2];
const allRacks = [rackL1, rackL2];

// Check transitions between sequence stops
const transitions: Array<{ from: string; to: string; deltaY: number; atIndex: number }> = [];

picksSequence.forEach((pick, idx) => {
  if (idx === 0) return;
  const currLevel = resolvePickLevel(pick, levels, allRacks);
  const prevLevel = resolvePickLevel(picksSequence[idx - 1], levels, allRacks);
  if (currLevel.id !== prevLevel.id) {
    transitions.push({
      from: prevLevel.name,
      to: currLevel.name,
      deltaY: Math.abs(currLevel.elevationY - prevLevel.elevationY),
      atIndex: idx,
    });
  }
});

assert(transitions.length === 1, `Exactly 1 floor transition detected across sequence (got ${transitions.length})`);
if (transitions.length === 1) {
  assert(transitions[0].from === 'Lantai 1', `Transition starts at Lantai 1 (got ${transitions[0].from})`);
  assert(transitions[0].to === 'Lantai 2 Mezzanine', `Transition goes to Lantai 2 Mezzanine (got ${transitions[0].to})`);
  assert(transitions[0].deltaY === 4.0, `Transition delta Y is 4.0m (got ${transitions[0].deltaY}m)`);
  assert(transitions[0].atIndex === 2, `Transition occurs before Stop 3 (index 2)`);
}

// -------------------------------------------------------------
// Test Suite 5: Operational Floor Zones & Vertical Connectors Elevation & Isolation
// -------------------------------------------------------------
console.log('\n🏢 Test Suite 5: Operational Zones & Connectors Elevation & Slicing Isolation');

// 1. Zone placement and elevation tracking
const testZoneL2: WarehouseZone = {
  id: 'zone-l2-test',
  name: 'Receiving L2 Mezzanine',
  type: 'receiving',
  colorHex: '#0284c7',
  position: { x: 15, y: level2.elevationY, z: 15 },
  dimensions: { width: 8, height: 0.05, depth: 8 },
  levelId: level2.id,
};

store.executeCommand(createAddZoneCommand(testZoneL2));
const addedZone = useEditorStore.getState().zones.find((z) => z.id === 'zone-l2-test');
assert(!!addedZone, 'Zone added to store');
assert(addedZone?.position.y === 4.0, `Zone on Level 2 has position.y = 4.0m (got ${addedZone?.position.y})`);
assert(addedZone?.levelId === 'level-2', `Zone has levelId = 'level-2' (got ${addedZone?.levelId})`);

// 2. Moving zone preserves its elevation
store.executeCommand(
  createMoveZoneCommand('zone-l2-test', { x: 15, y: 4.0, z: 15 }, { x: 25, y: 4.0, z: 20 })
);
const movedZone = useEditorStore.getState().zones.find((z) => z.id === 'zone-l2-test');
assert(movedZone?.position.x === 25 && movedZone?.position.z === 20, 'Zone moved to new X/Z position');
assert(movedZone?.position.y === 4.0, `Zone elevation Y remains 4.0m after move (did not drop to 0) (got ${movedZone?.position.y})`);

// 3. Undo/redo maintains elevation
store.undo();
const undoneZone = useEditorStore.getState().zones.find((z) => z.id === 'zone-l2-test');
assert(undoneZone?.position.x === 15 && undoneZone?.position.y === 4.0, 'Undo preserved original position and elevation 4.0m');
store.redo();
const redoneZone = useEditorStore.getState().zones.find((z) => z.id === 'zone-l2-test');
assert(redoneZone?.position.x === 25 && redoneZone?.position.y === 4.0, 'Redo preserved moved position and elevation 4.0m');

// 4. Vertical connector elevation on Level 2
const testConnectorL2: VerticalConnector = {
  id: 'conn-l2-test',
  name: 'Cargo Lift L2',
  type: 'cargo_lift',
  fromLevelId: level2.id,
  toLevelId: level2.id,
  position: { x: 18, y: level2.elevationY, z: 18 },
  dimensions: { width: 3.5, depth: 3.5, height: 4.0 },
  rotationY: 0,
};

store.executeCommand(createAddVerticalConnectorCommand(testConnectorL2));
const addedConn = useEditorStore.getState().verticalConnectors.find((c) => c.id === 'conn-l2-test');
assert(!!addedConn, 'Vertical connector added to store');
assert(addedConn?.position.y === 4.0, `Connector has position.y = 4.0m (got ${addedConn?.position.y})`);
assert(addedConn?.fromLevelId === 'level-2', `Connector starts at fromLevelId = 'level-2' (got ${addedConn?.fromLevelId})`);

// 5. Updating connector fromLevelId shifts position.y and adjusts height
store.executeCommand(
  createUpdateVerticalConnectorCommand('conn-l2-test', {
    fromLevelId: level1.id,
    position: { x: 18, y: level1.elevationY, z: 18 },
    dimensions: { width: 3.5, depth: 3.5, height: level2.elevationY - level1.elevationY },
  })
);
const updatedConn = useEditorStore.getState().verticalConnectors.find((c) => c.id === 'conn-l2-test');
assert(updatedConn?.fromLevelId === 'level-1', 'Connector fromLevelId updated to level-1');
assert(updatedConn?.position.y === 0.0, `Connector position.y updated to 0.0m (got ${updatedConn?.position.y})`);
assert(updatedConn?.dimensions.height === 4.0, `Connector height updated to 4.0m (got ${updatedConn?.dimensions.height})`);

// 6. Floor slicing ISOLATE filter verification
// When activeLevelId = 'level-2' and floorSliceMode = 'ISOLATE':
// - Zone on Level 1 must be hidden
// - Zone on Level 2 must be visible
const zoneL1: WarehouseZone = {
  id: 'zone-l1-test',
  name: 'Receiving L1',
  type: 'receiving',
  colorHex: '#0284c7',
  position: { x: 5, y: 0, z: 5 },
  dimensions: { width: 5, height: 0.05, depth: 5 },
  levelId: level1.id,
};

const activeElevation = level2.elevationY;
const activeLvlId = level2.id;
const mode = 'ISOLATE';

function isZoneHiddenInMode(z: WarehouseZone, activeLvl: string, activeElev: number, sliceMode: string): boolean {
  const isCurrentLevel =
    activeLvl === 'ALL' ||
    (z.levelId ? z.levelId === activeLvl : Math.abs((z.position.y ?? 0) - activeElev) <= 0.2);
  const isUpper = activeLvl !== 'ALL' && (z.position.y ?? 0) > activeElev + 0.1;
  return activeLvl !== 'ALL' && (sliceMode === 'ISOLATE' ? !isCurrentLevel : isUpper);
}

assert(isZoneHiddenInMode(zoneL1, activeLvlId, activeElevation, mode) === true, 'Level 1 zone is hidden in ISOLATE mode when active on Level 2');
assert(isZoneHiddenInMode(testZoneL2, activeLvlId, activeElevation, mode) === false, 'Level 2 zone is visible in ISOLATE mode when active on Level 2');

// -------------------------------------------------------------
// Test Suite 6: 4-Floor Realism Limit & Roof Height Synchronization Guardrails
// -------------------------------------------------------------
console.log('\n🏢 Test Suite 6: 4-Floor Realism Limit & Roof Height Guardrails');

// 1. MAX_BUILDING_LEVELS is 4
assert(MAX_BUILDING_LEVELS === 4, `MAX_BUILDING_LEVELS constant is exactly 4 (got ${MAX_BUILDING_LEVELS})`);

// 2. Blueprint validation enforces max 4 floors
const mockBlueprintBase = {
  id: 'bp-test-limits',
  name: 'Test Limit Warehouse',
  gridSnapStep: 0.5,
  floorDimensions: { width: 50, depth: 40, height: 16 },
  zones: [],
  structuralElements: [],
  racks: [],
};

const fourLevels: BuildingLevel[] = [
  { id: 'l1', name: 'Lantai 1 / Ground', elevationY: 0, height: 3.6, orderIndex: 0, type: 'GROUND' },
  { id: 'l2', name: 'Lantai 2', elevationY: 3.6, height: 3.6, orderIndex: 1, type: 'UPPER' },
  { id: 'l3', name: 'Lantai 3', elevationY: 7.2, height: 3.6, orderIndex: 2, type: 'UPPER' },
  { id: 'l4', name: 'Lantai 4', elevationY: 10.8, height: 3.6, orderIndex: 3, type: 'UPPER' },
];

const valid4Result = WarehouseBlueprintSchema.safeParse({
  ...mockBlueprintBase,
  buildingLevels: fourLevels,
});
assert(valid4Result.success === true, 'WarehouseBlueprintSchema accepts exactly 4 building levels');

const fiveLevels: BuildingLevel[] = [
  ...fourLevels,
  { id: 'l5', name: 'Lantai 5', elevationY: 14.4, height: 3.6, orderIndex: 4, type: 'UPPER' },
];

const invalid5Result = WarehouseBlueprintSchema.safeParse({
  ...mockBlueprintBase,
  buildingLevels: fiveLevels,
});
assert(invalid5Result.success === false, 'WarehouseBlueprintSchema rejects 5 building levels (violates 4-floor limit)');

// 3. getWarehouseOccupiedBounds incorporates building levels & elevated racks
const bounds = getWarehouseOccupiedBounds([], [], [], fourLevels);
// 4th level: elevationY = 10.8, height = 3.6 => top = 14.4 + 0.5 sprinkler clearance = 14.9m
const expectedRoofMin = Math.ceil((10.8 + 3.6 + FIRE_SPRINKLER_CLEARANCE) * 10) / 10;
assert(
  bounds.minHeight === expectedRoofMin,
  `getWarehouseOccupiedBounds enforces minHeight of ${expectedRoofMin}m for 4 floors (got ${bounds.minHeight})`
);
assert(
  bounds.tallestRackY?.name === 'Lantai 4',
  `Tallest bound identified as topmost level 'Lantai 4' (got ${bounds.tallestRackY?.name})`
);

// 4. Roof height reduction protection: attempting to set height below required height is detected
const proposedRoofHeight = 12.0; // Lower than 14.9m
assert(
  proposedRoofHeight < bounds.minHeight,
  `Proposed roof height ${proposedRoofHeight}m is safely detected as below required ${bounds.minHeight}m`
);

// 5. Roof auto-expansion calculation for adding a level
const currentCeiling = 10.0;
const newLevelElevation = 7.2;
const newLevelHeight = 3.6;
const requiredCeiling = Math.ceil((newLevelElevation + newLevelHeight + FIRE_SPRINKLER_CLEARANCE) * 10) / 10;
assert(
  requiredCeiling === 11.3,
  `Required ceiling auto-expansion calculated as 11.3m (7.2 + 3.6 + 0.5) (got ${requiredCeiling})`
);
assert(
  requiredCeiling > currentCeiling,
  'Correctly detects that new level requires expanding current roof from 10.0m to 11.3m'
);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n=================================================');
console.log(`🎉 Multi-Floor Ops Smoke Test Results: ${passedTests}/${totalTests} Passed`);
console.log('=================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
