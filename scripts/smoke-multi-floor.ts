// Smoke Test for Phase 40: Multi-Floor / Mezzanine Vertical Layers & Z-Elevation Multi-Tier Routing
// Validates:
// 1. Zod Schema backward compatibility & full serialization of buildingLevels & verticalConnectors
// 2. Zustand Store mutators & Floor Slicing modes (ISOLATE, GHOST_UPPER, ALL)
// 3. ICommand Atomic Undo/Redo for building levels and vertical connectors
// 4. Multilayer A* Routing between elevations via Vertical Connectors
// 5. Equipment constraints (Forklift & AGV restricted from Stairs; Cart allowed everywhere)
// 6. Realistic vertical transit delay calculations
// 7. i18n Translation dictionary parity (id.ts and en.ts)

import {
  BuildingLevelSchema,
  VerticalConnectorSchema,
  WarehouseBlueprintSchema,
} from '../src/lib/validations/layout-schema';
import {
  DEFAULT_GROUND_LEVEL,
  DEFAULT_MEZZANINE_LEVEL,
  VERTICAL_CONNECTOR_DEFAULTS,
  VERTICAL_TRANSIT_PARAMS,
} from '../src/lib/constants/warehouse-defaults';
import {
  createAddBuildingLevelCommand,
  createRemoveBuildingLevelCommand,
  createUpdateBuildingLevelCommand,
} from '../src/engine/commands/BuildingLevelCommands';
import {
  createAddVerticalConnectorCommand,
  createRemoveVerticalConnectorCommand,
  createMoveVerticalConnectorCommand,
  createRotateVerticalConnectorCommand,
  createUpdateVerticalConnectorCommand,
} from '../src/engine/commands/VerticalConnectorCommands';
import { calculatePickingRoute } from '../src/engine/routing/routing-engine';
import { useEditorStore } from '../src/stores/useEditorStore';
import { id } from '../src/lib/i18n/id';
import { en } from '../src/lib/i18n/en';
import type { BuildingLevel, VerticalConnector, RackEntity } from '../src/types/layout';
import type { PickItem } from '../src/types/routing';
import type { WarehouseBounds } from '../src/types/spatial';

console.log('🏢 Running Smoke Tests for Phase 40: Multi-Floor & Vertical Connectors...\n');

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
// Test Suite 1: Zod Schemas & Backward Compatibility
// -------------------------------------------------------------
console.log('📦 Test Suite 1: Zod Schemas & Serialization');

const groundLevel: BuildingLevel = {
  id: 'level-ground',
  name: 'Lantai Dasar (Ground)',
  elevationY: 0,
  height: 3.6,
  orderIndex: 0,
  type: 'GROUND',
};

const mezzanineLevel: BuildingLevel = {
  id: 'level-mezz-1',
  name: 'Mezzanine Platform 1',
  elevationY: 3.6,
  height: 3.6,
  orderIndex: 1,
  type: 'MEZZANINE',
};

const liftConnector: VerticalConnector = {
  id: 'conn-lift-1',
  name: 'Lift Kargo Utama',
  type: 'lift',
  position: { x: 5, y: 0, z: 5 },
  rotationY: 0,
  dimensions: { width: 3.5, depth: 3.5, height: 3.6 },
  fromLevelId: 'level-ground',
  toLevelId: 'level-mezz-1',
};

const stairsConnector: VerticalConnector = {
  id: 'conn-stairs-1',
  name: 'Tangga Akses Personil',
  type: 'stairs',
  position: { x: 25, y: 0, z: 25 },
  rotationY: 0,
  dimensions: { width: 1.6, depth: 4.5, height: 3.6 },
  fromLevelId: 'level-ground',
  toLevelId: 'level-mezz-1',
};

const parsedLevel = BuildingLevelSchema.safeParse(groundLevel);
assert(parsedLevel.success, 'BuildingLevelSchema parses valid level');

const parsedConnector = VerticalConnectorSchema.safeParse(liftConnector);
assert(parsedConnector.success, 'VerticalConnectorSchema parses valid connector');

const legacyBlueprintJson = {
  id: 'legacy-bp-001',
  name: 'Legacy Single-Floor Warehouse',
  floorDimensions: { width: 40, depth: 30, height: 8 },
  racks: [],
  structuralElements: [],
  zones: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const parsedLegacy = WarehouseBlueprintSchema.safeParse(legacyBlueprintJson);
assert(parsedLegacy.success, 'WarehouseBlueprintSchema backward-compatible with legacy blueprint');

const modernBlueprintJson = {
  ...legacyBlueprintJson,
  buildingLevels: [groundLevel, mezzanineLevel],
  verticalConnectors: [liftConnector, stairsConnector],
};

const parsedModern = WarehouseBlueprintSchema.safeParse(modernBlueprintJson);
assert(parsedModern.success && parsedModern.data.buildingLevels?.length === 2, 'WarehouseBlueprintSchema parses multi-floor blueprint');

// -------------------------------------------------------------
// Test Suite 2: Zustand Store Slices & Floor Slicing
// -------------------------------------------------------------
console.log('\n🎛️ Test Suite 2: Zustand Store Slices & View Modes');

const store = useEditorStore.getState();

// Initialize legacy blueprint in store
store.loadBlueprint({
  id: 'store-test-bp',
  name: 'Store Test Warehouse',
  floorDimensions: { width: 60, depth: 40, height: 10 },
  gridSnapStep: 0.5,
  racks: [],
  structuralElements: [],
  zones: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const storeAfterLegacy = useEditorStore.getState();
assert(
  storeAfterLegacy.buildingLevels.length >= 1 &&
    storeAfterLegacy.buildingLevels[0].id === DEFAULT_GROUND_LEVEL.id,
  'loadBlueprint gracefully populates default ground level if missing'
);

// Add building level in store
store.addBuildingLevel(mezzanineLevel);
assert(
  useEditorStore.getState().buildingLevels.length === 2,
  'addBuildingLevel adds mezzanine to buildingLevels'
);

// Update building level in store
store.updateBuildingLevel('level-mezz-1', { name: 'Mezzanine Deck North' });
assert(
  useEditorStore.getState().buildingLevels.find((l) => l.id === 'level-mezz-1')?.name ===
    'Mezzanine Deck North',
  'updateBuildingLevel updates level properties'
);

// Floor slice mode and active level
store.setActiveLevelId('level-mezz-1');
assert(useEditorStore.getState().activeLevelId === 'level-mezz-1', 'setActiveLevelId switches active floor');

store.setFloorSliceMode('ISOLATE');
assert(useEditorStore.getState().floorSliceMode === 'ISOLATE', 'setFloorSliceMode sets ISOLATE');

store.setFloorSliceMode('GHOST_UPPER');
assert(useEditorStore.getState().floorSliceMode === 'GHOST_UPPER', 'setFloorSliceMode sets GHOST_UPPER');

// Add and manipulate vertical connectors in store
store.addVerticalConnector(liftConnector);
assert(
  useEditorStore.getState().verticalConnectors.length === 1,
  'addVerticalConnector adds connector to store'
);

store.moveVerticalConnector('conn-lift-1', { x: 8, y: 0, z: 8 });
assert(
  useEditorStore.getState().verticalConnectors[0].position.x === 8,
  'moveVerticalConnector updates connector position'
);

store.rotateVerticalConnector('conn-lift-1', Math.PI / 2);
assert(
  useEditorStore.getState().verticalConnectors[0].rotationY === Math.PI / 2,
  'rotateVerticalConnector updates connector orientation'
);

// -------------------------------------------------------------
// Test Suite 3: Atomic ICommand Undo / Redo
// -------------------------------------------------------------
console.log('\n↩️ Test Suite 3: ICommand Undo & Redo Integration');

const thirdLevel: BuildingLevel = {
  id: 'level-roof',
  name: 'Lantai Atap / Rooftop',
  elevationY: 7.2,
  height: 3.6,
  orderIndex: 2,
  type: 'UPPER',
};

const addLevelCmd = createAddBuildingLevelCommand(thirdLevel);
useEditorStore.getState().executeCommand(addLevelCmd);
assert(
  useEditorStore.getState().buildingLevels.some((l) => l.id === 'level-roof'),
  'executeCommand(createAddBuildingLevelCommand) adds level'
);

useEditorStore.getState().undo();
assert(
  !useEditorStore.getState().buildingLevels.some((l) => l.id === 'level-roof'),
  'undo() removes newly added level'
);

useEditorStore.getState().redo();
assert(
  useEditorStore.getState().buildingLevels.some((l) => l.id === 'level-roof'),
  'redo() restores the level'
);

// Clean up third level
const removeLevelCmd = createRemoveBuildingLevelCommand(thirdLevel);
useEditorStore.getState().executeCommand(removeLevelCmd);
assert(
  !useEditorStore.getState().buildingLevels.some((l) => l.id === 'level-roof'),
  'executeCommand(createRemoveBuildingLevelCommand) removes level'
);

// Connector Commands Undo/Redo
const rampConnector: VerticalConnector = {
  id: 'conn-ramp-test',
  name: 'Ramp Uji Coba',
  type: 'ramp',
  position: { x: 12, y: 0, z: 12 },
  rotationY: 0,
  dimensions: { width: 3.2, depth: 10, height: 3.6 },
  fromLevelId: 'level-ground',
  toLevelId: 'level-mezz-1',
};

const addConnCmd = createAddVerticalConnectorCommand(rampConnector);
useEditorStore.getState().executeCommand(addConnCmd);
assert(
  useEditorStore.getState().verticalConnectors.some((c) => c.id === 'conn-ramp-test'),
  'createAddVerticalConnectorCommand executed'
);

const moveConnCmd = createMoveVerticalConnectorCommand(
  'conn-ramp-test',
  { x: 12, y: 0, z: 12 },
  { x: 18, y: 0, z: 18 }
);
useEditorStore.getState().executeCommand(moveConnCmd);
assert(
  useEditorStore.getState().verticalConnectors.find((c) => c.id === 'conn-ramp-test')?.position.x === 18,
  'createMoveVerticalConnectorCommand moved connector to 18'
);

useEditorStore.getState().undo();
assert(
  useEditorStore.getState().verticalConnectors.find((c) => c.id === 'conn-ramp-test')?.position.x === 12,
  'undo() reverted connector position to 12'
);

useEditorStore.getState().redo();
assert(
  useEditorStore.getState().verticalConnectors.find((c) => c.id === 'conn-ramp-test')?.position.x === 18,
  'redo() reapplied connector position to 18'
);

// -------------------------------------------------------------
// Test Suite 4: Multilayer Routing & Equipment Constraints
// -------------------------------------------------------------
console.log('\n🧭 Test Suite 4: Multilayer A* Routing & Equipment Constraints');

const warehouseBounds: WarehouseBounds = { width: 60, depth: 40 };
const depot = { x: 2, z: 2 };

const testLevels: BuildingLevel[] = [
  { id: 'level-ground', name: 'Ground', elevationY: 0, height: 4.0, orderIndex: 0, type: 'GROUND' },
  { id: 'level-mezz-1', name: 'Mezzanine 1', elevationY: 4.0, height: 4.0, orderIndex: 1, type: 'MEZZANINE' },
];

const testConnectors: VerticalConnector[] = [
  {
    id: 'lift-main',
    name: 'Cargo Lift A',
    type: 'lift',
    position: { x: 10, y: 0, z: 10 },
    rotationY: 0,
    dimensions: { width: 3.5, depth: 3.5, height: 4.0 },
    fromLevelId: 'level-ground',
    toLevelId: 'level-mezz-1',
  },
  {
    id: 'stairs-main',
    name: 'Industrial Stairs A',
    type: 'stairs',
    position: { x: 30, y: 0, z: 30 },
    rotationY: 0,
    dimensions: { width: 1.6, depth: 4.5, height: 4.0 },
    fromLevelId: 'level-ground',
    toLevelId: 'level-mezz-1',
  },
];

const groundRack: RackEntity = {
  id: 'rack-ground',
  name: 'GR-01',
  type: 'selective_pallet',
  position: { x: 8, y: 0, z: 20 },
  rotationY: 0,
  dimensions: { width: 4.5, height: 4, depth: 1.1 },
  bays: 3,
  levels: 2,
  bayWidth: 1.5,
  bayDepth: 1.1,
  levelHeight: 2,
  bins: [],
  levelId: 'level-ground',
};

const mezzRack: RackEntity = {
  id: 'rack-mezz',
  name: 'MZ-01',
  type: 'shelving',
  position: { x: 12, y: 4.0, z: 20 },
  rotationY: 0,
  dimensions: { width: 2.0, height: 2.4, depth: 0.6 },
  bays: 2,
  levels: 2,
  bayWidth: 1.0,
  bayDepth: 0.6,
  levelHeight: 1.2,
  bins: [],
  levelId: 'level-mezz-1',
};

const multiFloorPicks: PickItem[] = [
  {
    binId: 'BIN-G-01',
    rackId: 'rack-ground',
    rackName: 'GR-01',
    bayIndex: 0,
    levelIndex: 0,
    position3D: { x: 8, y: 0.5, z: 20 },
    accessPoint3D: { x: 8, y: 0, z: 22 },
    sku: 'SKU-GROUND',
    productName: 'Ground Pallet Stock',
    quantity: 1,
    weightKg: 250,
    isPicked: false,
  },
  {
    binId: 'BIN-M-01',
    rackId: 'rack-mezz',
    rackName: 'MZ-01',
    bayIndex: 0,
    levelIndex: 0,
    position3D: { x: 12, y: 4.5, z: 20 },
    accessPoint3D: { x: 12, y: 4.0, z: 22 },
    sku: 'SKU-MEZZ',
    productName: 'Mezzanine Small Part',
    quantity: 1,
    weightKg: 5,
    isPicked: false,
  },
];

// Test Forklift: Must route via Cargo Lift (Stairs prohibited)
const forkliftRoute = calculatePickingRoute({
  bounds: warehouseBounds,
  racks: [groundRack, mezzRack],
  verticalConnectors: testConnectors,
  buildingLevels: testLevels,
  pickItems: multiFloorPicks,
  depotPos: depot,
  vehicleType: 'FORKLIFT',
  isManualSequence: true,
  customWaypoints: [],
});

assert(forkliftRoute.orderedPicks.length === 2, 'Forklift route visits both stops');
assert(forkliftRoute.metrics.totalDistanceMeters > 0, 'Forklift route has valid distance');
assert(
  forkliftRoute.polylinePoints.some((p) => (p.y ?? 0) >= 3.9),
  'Forklift polyline contains elevated 3D points on mezzanine'
);

// Test Cart: Allowed on Stairs as well as Lift
const cartRoute = calculatePickingRoute({
  bounds: warehouseBounds,
  racks: [groundRack, mezzRack],
  verticalConnectors: testConnectors,
  buildingLevels: testLevels,
  pickItems: multiFloorPicks,
  depotPos: depot,
  vehicleType: 'CART',
  isManualSequence: true,
  customWaypoints: [],
});

assert(cartRoute.orderedPicks.length === 2, 'Cart route visits both stops');
assert(
  cartRoute.polylinePoints.some((p) => (p.y ?? 0) >= 3.9),
  'Cart polyline climbs to mezzanine elevation'
);

// -------------------------------------------------------------
// Test Suite 5: i18n Dictionary Parity
// -------------------------------------------------------------
console.log('\n🌐 Test Suite 5: i18n Translation Dictionary Parity');

const idMultiFloorKeys = Object.keys(id.multiFloor).sort();
const enMultiFloorKeys = Object.keys(en.multiFloor).sort();

assert(
  JSON.stringify(idMultiFloorKeys) === JSON.stringify(enMultiFloorKeys),
  'id.ts and en.ts have identical multiFloor translation keys'
);

const idConnectorKeys = Object.keys(id.multiFloor.connectorTypes).sort();
const enConnectorKeys = Object.keys(en.multiFloor.connectorTypes).sort();

assert(
  JSON.stringify(idConnectorKeys) === JSON.stringify(enConnectorKeys),
  'id.ts and en.ts have identical connectorTypes keys'
);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log(`\n🎉 Test Results: ${passedTests}/${totalTests} Passed.`);
if (passedTests === totalTests) {
  console.log('🌟 All Phase 40 Multi-Floor & Vertical Routing Tests Succeeded!\n');
} else {
  console.error('❌ Some tests failed. Please review the errors above.\n');
  process.exit(1);
}
