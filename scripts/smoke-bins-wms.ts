// Automated smoke test for Phase 21: WMS Bin Management & Cargo Instancing.
// Tests bin generation, cargo matrices, occupancy commands, batch operations,
// SKU metadata updates, and undo/redo state invariants.

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import {
  createUpdateBinOccupancyCommand,
  createBatchUpdateRackBinsCommand,
  createBatchUpdateAllBinsCommand,
  createUpdateBinSkuDataCommand,
} from '../src/engine/commands/BinCommands';
import {
  generateCargoInstances,
  generateRackInstances,
} from '../src/engine/procedural/rack-geometry';
import { generateBinsForRack } from '../src/engine/procedural/bin-generator';
import { WarehouseBlueprintSchema, BinSlotSchema } from '../src/lib/validations/layout-schema';
import type { RackEntity } from '../src/types/layout';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('--- Phase 21 Smoke Test: WMS Bins & Cargo ---');

// Use global editor store
const store = useEditorStore;

// 2. Create sample rack
const sampleRack: RackEntity = {
  id: 'rack-test-1',
  name: 'A01',
  type: 'selective_pallet',
  position: { x: 10, y: 0, z: 10 },
  rotationY: 0,
  dimensions: { width: 6, height: 6, depth: 1.2 },
  bays: 3,
  levels: 3,
  bayWidth: 2,
  bayDepth: 1.2,
  levelHeight: 2,
  bins: [],
};
sampleRack.bins = generateBinsForRack(sampleRack);

assert(sampleRack.bins.length === 18, 'Rack must generate exactly 3x3x2 = 18 bins');
assert(sampleRack.bins[0].id === 'A01-01-01-A', 'First bin ID must be A01-01-01-A');
assert(sampleRack.bins[17].id === 'A01-03-03-B', 'Last bin ID must be A01-03-03-B');
console.log('✓ 1. Bin generation verified (18 slots, canonical IDs).');

// 3. Test Cargo Instances when empty
const emptyCargo = generateCargoInstances(sampleRack);
assert(emptyCargo.pallets.length === 0, 'Empty rack must have 0 pallets');
assert(emptyCargo.cartons.length === 0, 'Empty rack must have 0 cartons');
console.log('✓ 2. Empty rack produces 0 cargo matrices.');

// Add rack to store
store.getState().addRack(sampleRack);

// 4. Test Single Bin Occupancy Command + Undo / Redo
const targetBinId = 'A01-02-02-A';
const stockCmd = createUpdateBinOccupancyCommand('rack-test-1', targetBinId, true);
store.getState().executeCommand(stockCmd);

const rackAfterStock = store.getState().racks[0];
const targetBin = rackAfterStock.bins.find((b) => b.id === targetBinId);
assert(!!targetBin?.isOccupied, 'Target bin must now be occupied');
assert(!!targetBin?.skuData?.sku, 'Occupied bin must have generated SKU code');
assert((targetBin?.skuData?.weightKg ?? 0) > 0, 'Occupied bin must have weight > 0');

// Test cargo instances with 1 occupied bin
const singleCargo = generateCargoInstances(store.getState().racks[0]);
assert(singleCargo.pallets.length === 1, 'Rack with 1 occupied bin must produce 1 pallet');
assert(singleCargo.cartons.length === 1, 'Rack with 1 occupied bin must produce 1 carton');
assert(singleCargo.occupiedBinIds[0] === targetBinId, 'Occupied bin ID must match');

// Undo
store.getState().undo();
const rackAfterUndo = store.getState().racks[0];
const targetBinUndo = rackAfterUndo.bins.find((b) => b.id === targetBinId);
assert(!targetBinUndo?.isOccupied, 'After undo, bin must be empty');

// Redo
store.getState().redo();
const rackAfterRedo = store.getState().racks[0];
const targetBinRedo = rackAfterRedo.bins.find((b) => b.id === targetBinId);
assert(!!targetBinRedo?.isOccupied, 'After redo, bin must be occupied again');
console.log('✓ 3. Single bin occupancy toggle + cargo instancing + Undo/Redo verified.');

// 5. Test Update SKU Metadata Command + Undo
const updateSkuCmd = createUpdateBinSkuDataCommand(
  'rack-test-1',
  targetBinId,
  {
    sku: 'SKU-CUSTOM-99',
    productName: 'Custom Premium Lithium Batteries',
    quantity: 45,
    unit: 'boxes',
    lotNumber: 'LOT-SPECIAL-77',
    weightKg: 520,
  },
  1200
);
store.getState().executeCommand(updateSkuCmd);

const binWithCustomSku = store.getState().racks[0].bins.find((b) => b.id === targetBinId);
assert(binWithCustomSku?.skuData?.sku === 'SKU-CUSTOM-99', 'SKU must be SKU-CUSTOM-99');
assert(binWithCustomSku?.skuData?.weightKg === 520, 'Weight must be 520kg');
assert(binWithCustomSku?.maxWeightKg === 1200, 'Max weight rating must be 1200kg');

store.getState().undo();
const binAfterSkuUndo = store.getState().racks[0].bins.find((b) => b.id === targetBinId);
assert(binAfterSkuUndo?.skuData?.sku !== 'SKU-CUSTOM-99', 'Undo must restore previous SKU');
console.log('✓ 4. SKU metadata update command + Undo verified.');

// 6. Test Batch Update Rack Bins Command (Stock All & Empty All)
const stockAllCmd = createBatchUpdateRackBinsCommand('rack-test-1', true);
store.getState().executeCommand(stockAllCmd);

const rackStocked = store.getState().racks[0];
const allOccupied = rackStocked.bins.every((b) => b.isOccupied);
assert(allOccupied, 'All 18 bins in rack must be occupied');

const fullCargo = generateCargoInstances(rackStocked);
assert(fullCargo.pallets.length === 18, 'All 18 bins must have pallet instances');
assert(fullCargo.cartons.length === 18, 'All 18 bins must have carton instances');

// Empty All
const emptyAllCmd = createBatchUpdateRackBinsCommand('rack-test-1', false);
store.getState().executeCommand(emptyAllCmd);
const rackCleared = store.getState().racks[0];
const noneOccupied = rackCleared.bins.every((b) => !b.isOccupied);
assert(noneOccupied, 'All bins must now be cleared');

// Undo Empty All
store.getState().undo();
assert(store.getState().racks[0].bins.every((b) => b.isOccupied), 'Undo must restore all occupied bins');
console.log('✓ 5. Batch rack stocking & clearing + Undo verified.');

// 7. Test Batch Update All Bins Command across multiple racks
const rack2: RackEntity = {
  id: 'rack-test-2',
  name: 'B01',
  type: 'cantilever',
  position: { x: 20, y: 0, z: 10 },
  rotationY: 0,
  dimensions: { width: 4, height: 4, depth: 1.0 },
  bays: 2,
  levels: 2,
  bayWidth: 2,
  bayDepth: 1.0,
  levelHeight: 2,
  bins: [],
};
rack2.bins = generateBinsForRack(rack2);
store.getState().addRack(rack2);

const randomizeAllCmd = createBatchUpdateAllBinsCommand('random', 0.8);
store.getState().executeCommand(randomizeAllCmd);

const totalOccupied = store.getState().racks.reduce(
  (acc, r) => acc + r.bins.filter((b) => b.isOccupied).length,
  0
);
assert(totalOccupied > 0, 'Randomize must populate at least some bins');
console.log(`✓ 6. Global warehouse batch randomize verified (${totalOccupied}/13 bins occupied).`);

// 8. Test Schema Validation with SKU Data
const blueprintPayload = {
  id: 'bp-test-sku',
  name: 'Test Blueprint with Bins',
  floorDimensions: { width: 60, height: 10, depth: 40 },
  gridSnapStep: 0.5,
  zones: [],
  structuralElements: [],
  racks: store.getState().racks,
};

const validationResult = WarehouseBlueprintSchema.safeParse(blueprintPayload);
assert(validationResult.success, `Blueprint schema validation must pass: ${validationResult.error?.message}`);
console.log('✓ 7. Zod schema validation passed with complete SKU data.');

// 9. Test ViewMode and Bin Selection Slices
assert(store.getState().editorViewMode === 'LAYOUT', 'Default editorViewMode must be LAYOUT');
store.getState().setEditorViewMode('WMS');
assert(store.getState().editorViewMode === 'WMS', 'editorViewMode must be WMS');

store.getState().selectBin('A01-01-01-A');
assert(store.getState().selectedBinId === 'A01-01-01-A', 'selectedBinId must be A01-01-01-A');
assert(store.getState().selectedEntityId === 'rack-test-1', 'Parent rack must be auto-selected');

store.getState().deselectBin();
assert(store.getState().selectedBinId === null, 'deselectBin must clear selectedBinId');
console.log('✓ 8. WMS selection slice and parent rack synchronization verified.');

console.log('\n🎉 ALL WMS BIN & CARGO SMOKE TESTS PASSED!');
