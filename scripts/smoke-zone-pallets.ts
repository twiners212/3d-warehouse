// Smoke Test for Phase 39: Operational Zone Pallet & Cargo Visualization
// Validates:
// 1. Procedural Grid Generation (Dimensions, Corridors, Usable Bounds)
// 2. 3D Instancing Matrix Generation (Euro-Pallets & Cartons)
// 3. Single Pallet Update & Undo/Redo Command
// 4. Batch Pallet Stock / Empty & Undo/Redo Command
// 5. Zone Staging Config Command & Undo/Redo
// 6. Zustand Store Selection & Mode Switching
// 7. Zod Blueprint Schema Serialization & Backward Compatibility

import {
  calculateZonePalletSlots,
  generateZonePalletInstances,
  generateMockZonePalletSku,
  isZoneStagingEligible,
  STANDARD_PALLET_WIDTH,
  STANDARD_PALLET_DEPTH,
  STANDARD_PALLET_HEIGHT,
} from '../src/engine/procedural/zone-pallet-generator';
import {
  createUpdateZonePalletCommand,
  createBatchUpdateZonePalletsCommand,
  createUpdateZoneStagingConfigCommand,
} from '../src/engine/commands/ZonePalletCommands';
import {
  WarehouseBlueprintSchema,
  WarehouseZoneSchema,
} from '../src/lib/validations/layout-schema';
import type { WarehouseZone, WarehouseLayoutBlueprint } from '../src/types/layout';
import { useEditorStore } from '../src/stores/useEditorStore';

console.log('🧪 Running Smoke Tests for Phase 39: Operational Zone Pallet & Cargo Visualization...\n');

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
// Test 1: Procedural Grid Calculation
// -------------------------------------------------------------
console.log('📦 Section 1: Procedural Grid Generator Math');

const receivingZone: WarehouseZone = {
  id: 'zone-rcv-1',
  name: 'Inbound Receiving A',
  colorHex: '#10b981',
  type: 'receiving',
  position: { x: 10, y: 0, z: 10 },
  dimensions: { width: 10, height: 0.1, depth: 8 },
};

assert(
  isZoneStagingEligible(receivingZone) === true,
  'Receiving zone is staging eligible by default'
);

const storageZone: WarehouseZone = {
  id: 'zone-str-1',
  name: 'Storage Zone B',
  colorHex: '#8b5cf6',
  type: 'storage',
  position: { x: 30, y: 0, z: 10 },
  dimensions: { width: 10, height: 0.1, depth: 8 },
};

assert(
  isZoneStagingEligible(storageZone) === false,
  'Storage zone is not staging eligible by default'
);

const slots = calculateZonePalletSlots(receivingZone);
assert(slots.length > 0, `Generated ${slots.length} pallet slots for 10m x 8m zone`);

// Verify slot properties
const firstSlot = slots[0];
assert(firstSlot.slotIndex === 1, 'First slot is index 1');
assert(firstSlot.gridRow === 1 && firstSlot.gridCol === 1, 'First slot is row 1, col 1');
assert(firstSlot.id.startsWith('INBOUND-RECEIVING-A-P01'), `Slot canonical ID is formatted: ${firstSlot.id}`);

// Verify all slots remain strictly within zone boundaries (perimeter margin buffer)
const halfW = receivingZone.dimensions.width / 2;
const halfD = receivingZone.dimensions.depth / 2;
const allWithinBounds = slots.every(
  (s) =>
    Math.abs(s.relativePosition.x) + STANDARD_PALLET_WIDTH / 2 <= halfW &&
    Math.abs(s.relativePosition.z) + STANDARD_PALLET_DEPTH / 2 <= halfD
);
assert(allWithinBounds, 'All pallet slots are strictly contained within zone perimeter margin');

// -------------------------------------------------------------
// Test 2: 3D Instancing Matrix Sets
// -------------------------------------------------------------
console.log('\n🎮 Section 2: 3D Instancing Sets');

const instanceSets = generateZonePalletInstances(receivingZone, slots);
assert(instanceSets.pallets.length === slots.length, `Pallet instances count matches slot count (${slots.length})`);
assert(
  instanceSets.cartons.length === instanceSets.occupiedSlots.length,
  `Carton instances count matches occupied slots count (${instanceSets.occupiedSlots.length})`
);

// -------------------------------------------------------------
// Test 3: Store Mutators & Single Pallet Command (Undo/Redo)
// -------------------------------------------------------------
console.log('\n🔄 Section 3: Single Pallet Occupancy Command & Undo/Redo');

const store = useEditorStore.getState();
store.loadBlueprint({
  id: 'bp-test-phase39',
  name: 'Phase 39 Blueprint',
  floorDimensions: { width: 50, depth: 50, height: 10 },
  gridSnapStep: 0.5,
  zones: [receivingZone],
  racks: [],
  structuralElements: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Update single pallet slot via Command
const targetSlot = slots[0];
const updateCommand = createUpdateZonePalletCommand(receivingZone.id, targetSlot.id, {
  isOccupied: true,
  skuData: {
    sku: 'SKU-SPECIAL-99',
    productName: 'Precision Hydraulic Cylinder',
    quantity: 42,
    unit: 'crates',
    lotNumber: 'LOT-SPECIAL-2026',
    weightKg: 580,
    velocityClass: 'A',
  },
});

store.executeCommand(updateCommand);
let currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
let updatedSlot = currentZone?.stagingConfig?.slots?.find((s) => s.id === targetSlot.id);
assert(updatedSlot?.isOccupied === true, 'Slot marked occupied after executeCommand');
assert(updatedSlot?.skuData?.sku === 'SKU-SPECIAL-99', 'Slot SKU updated to SKU-SPECIAL-99');

// Undo
store.undo();
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
updatedSlot = currentZone?.stagingConfig?.slots?.find((s) => s.id === targetSlot.id);
assert(
  updatedSlot?.skuData?.sku !== 'SKU-SPECIAL-99',
  'Undo restores previous slot state'
);

// Redo
store.redo();
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
updatedSlot = currentZone?.stagingConfig?.slots?.find((s) => s.id === targetSlot.id);
assert(
  updatedSlot?.skuData?.sku === 'SKU-SPECIAL-99',
  'Redo re-applies slot update'
);

// -------------------------------------------------------------
// Test 4: Batch Update Pallets Command & Undo/Redo
// -------------------------------------------------------------
console.log('\n⚡ Section 4: Batch Pallet Command & Undo/Redo');

// Batch Fill All
const batchFillCommand = createBatchUpdateZonePalletsCommand(receivingZone.id, true);
store.executeCommand(batchFillCommand);
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
let allOccupied = currentZone?.stagingConfig?.slots?.every((s) => s.isOccupied === true);
assert(allOccupied === true, 'All zone pallets filled via batch command (100% occupied)');

// Batch Empty All
const batchEmptyCommand = createBatchUpdateZonePalletsCommand(receivingZone.id, false);
store.executeCommand(batchEmptyCommand);
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
const allEmpty = currentZone?.stagingConfig?.slots?.every((s) => s.isOccupied === false);
assert(allEmpty === true, 'All zone pallets emptied via batch command (0% occupied)');

// Undo Batch Empty -> restores All Occupied
store.undo();
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
allOccupied = currentZone?.stagingConfig?.slots?.every((s) => s.isOccupied === true);
assert(allOccupied === true, 'Undo restores batch filled state');

// -------------------------------------------------------------
// Test 5: Zone Staging Config Command & Undo/Redo
// -------------------------------------------------------------
console.log('\n⚙️ Section 5: Zone Staging Config Command & Undo/Redo');

const toggleConfigCommand = createUpdateZoneStagingConfigCommand(receivingZone.id, {
  enabled: false,
});
store.executeCommand(toggleConfigCommand);
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
assert(
  currentZone?.stagingConfig?.enabled === false,
  'Zone staging successfully disabled via command'
);

store.undo();
currentZone = useEditorStore.getState().zones.find((z) => z.id === receivingZone.id);
assert(
  currentZone?.stagingConfig?.enabled === true,
  'Undo restores zone staging enabled state'
);

// -------------------------------------------------------------
// Test 6: Selection Slice & Mode Switching
// -------------------------------------------------------------
console.log('\n🎯 Section 6: Selection Slice & View Mode Coordination');

// Select a pallet slot in the zone
store.selectZonePallet(receivingZone.id, targetSlot.id);
const selState = useEditorStore.getState();
assert(
  selState.selectedZonePallet?.zoneId === receivingZone.id &&
    selState.selectedZonePallet?.palletId === targetSlot.id,
  'selectZonePallet correctly records selectedZonePallet'
);
assert(selState.editorViewMode === 'WMS', 'Selecting a zone pallet auto-switches mode to WMS');
assert(selState.selectedBinId === null, 'Rack bin selection cleared when zone pallet is selected');

// Deselect
store.deselectZonePallet();
assert(
  useEditorStore.getState().selectedZonePallet === null,
  'deselectZonePallet clears selectedZonePallet'
);

// Switching to LAYOUT mode clears selectedZonePallet
store.selectZonePallet(receivingZone.id, targetSlot.id);
store.setEditorViewMode('LAYOUT');
assert(
  useEditorStore.getState().selectedZonePallet === null,
  'Switching to LAYOUT mode automatically clears selectedZonePallet'
);

// -------------------------------------------------------------
// Test 7: Zod Schema Serialization & Backward Compatibility
// -------------------------------------------------------------
console.log('\n🛡️ Section 7: Zod Schema Validation & Backward Compatibility');

// Valid blueprint with stagingConfig
const blueprintWithStaging: WarehouseLayoutBlueprint = {
  id: 'bp-with-staging',
  name: 'Logistics Hub 2026',
  floorDimensions: { width: 80, height: 12, depth: 60 },
  gridSnapStep: 0.5,
  zones: [
    {
      ...receivingZone,
      stagingConfig: {
        enabled: true,
        palletWidth: 1.2,
        palletDepth: 1.0,
        slots: [
          {
            id: 'INBOUND-P01',
            slotIndex: 1,
            gridRow: 1,
            gridCol: 1,
            relativePosition: { x: -2, y: 0, z: -2 },
            isOccupied: true,
            skuData: {
              sku: 'SKU-001',
              productName: 'Sample Product',
              quantity: 10,
              unit: 'crates',
              lotNumber: 'LOT-001',
              weightKg: 250,
            },
          },
        ],
      },
    },
  ],
  racks: [],
  structuralElements: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const parseResult1 = WarehouseBlueprintSchema.safeParse(blueprintWithStaging);
assert(parseResult1.success, 'Blueprint with stagingConfig passes Zod validation');

// Backward compatibility: blueprint WITHOUT stagingConfig
const legacyZone: WarehouseZone = {
  id: 'zone-legacy-1',
  name: 'Legacy Staging Area',
  colorHex: '#0284c7',
  type: 'shipping',
  position: { x: 0, y: 0, z: 0 },
  dimensions: { width: 12, height: 0.1, depth: 10 },
};

const parseResult2 = WarehouseZoneSchema.safeParse(legacyZone);
assert(parseResult2.success, 'Legacy zone without stagingConfig passes Zod validation 100%');

// -------------------------------------------------------------
// Final Report
// -------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`🎉 Phase 39 Test Summary: ${passedTests}/${totalTests} tests passed.`);
console.log(`======================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
