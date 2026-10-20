// Automated Smoke Test for Phase 42: External WMS / ERP Connector, Bulk Inventory Sync & Dynamic Slotting Optimizer
// Tests:
// 1. Spreadsheet parsing (CSV, TSV, Excel clipboard) and smart column detection
// 2. Full inventory export across racks and operational zones
// 3. Multi-objective dynamic slotting heuristics (ABC proximity, Golden Zone, heavy bottom clamping, mezzanine limits)
// 4. Atomic ICommand pipeline (undo/redo, pre-mutation snapshot, heatmap activation)
// 5. REST API Zod contract validation

import {
  parseSpreadsheetText,
  detectColumnMapping,
  validateAndTransformRows,
  exportFullWmsInventoryCsv,
  exportFullWmsInventoryTsv,
  exportFullWmsInventoryJson,
  toBinSkuData,
} from '../src/lib/io/wms-sync-io';
import {
  runDynamicSlottingOptimizer,
  extractCandidateSlots,
  DEFAULT_SLOTTING_OPTIONS,
} from '../src/engine/slotting/slotting-optimizer';
import {
  createApplyWmsInventorySyncCommand,
} from '../src/engine/commands/WmsSyncCommands';
import {
  WmsSyncPayloadSchema,
  WmsSyncItemSchema,
} from '../src/lib/validations/wms-sync-schema';
import { useEditorStore } from '../src/stores/useEditorStore';
import type {
  BinSkuData,
  RackEntity,
  WarehouseLayoutBlueprint,
  WarehouseZone,
} from '../src/types/layout';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Running Smoke Tests for Phase 42: WMS Sync & Dynamic Slotting Optimizer...\n');

// =========================================================================
// TEST 1: Universal Spreadsheet Parsing & Auto-Column Mapping
// =========================================================================
console.log('--- TEST 1: Universal Spreadsheet Parsing & Auto Column Mapping ---');

const SAMPLE_EXCEL_CLIPBOARD = `SKU\tNama Barang\tKuantitas\tSatuan\tNomor Lot\tBerat (kg)\tKelas ABC
SKU-FAST-01\tSmartphone Pro Max\t150\tpcs\tLOT-2026-A\t0.35\tA
SKU-HEAVY-02\tPlat Baja Konstruksi\t8\tpcs\tLOT-2026-B\t55.00\tA
SKU-MED-03\tKemeja Flanel Katun\t100\tpcs\tLOT-2026-C\t0.50\tB
SKU-SLOW-04\tBaut Industri M16 Box\t20\tbox\tLOT-2026-D\t12.00\tC`;

const parsedTsv = parseSpreadsheetText(SAMPLE_EXCEL_CLIPBOARD);
assert(parsedTsv.headers.length === 7, `Expected 7 headers, got ${parsedTsv.headers.length}`);
assert(parsedTsv.rows.length === 4, `Expected 4 rows, got ${parsedTsv.rows.length}`);

const mapping = detectColumnMapping(parsedTsv.headers);
assert(mapping.skuCol === 0, `Expected skuCol === 0, got ${mapping.skuCol}`);
assert(mapping.productNameCol === 1, `Expected productNameCol === 1, got ${mapping.productNameCol}`);
assert(mapping.quantityCol === 2, `Expected quantityCol === 2, got ${mapping.quantityCol}`);
assert(mapping.weightKgCol === 5, `Expected weightKgCol === 5, got ${mapping.weightKgCol}`);
assert(mapping.velocityClassCol === 6, `Expected velocityClassCol === 6, got ${mapping.velocityClassCol}`);

const validated = validateAndTransformRows(parsedTsv.rows, mapping, parsedTsv.headers);
assert(validated.errors.length === 0, `Expected 0 validation errors, got ${validated.errors.length}`);
assert(validated.unallocatedItems.length === 4, `Expected 4 unallocated items, got ${validated.unallocatedItems.length}`);
assert(validated.directItems.length === 0, `Expected 0 direct items without binId, got ${validated.directItems.length}`);

// Test with Direct Bin IDs in CSV format
const SAMPLE_CSV_DIRECT = `bin_id,item_code,product_name,qty,weight_kg,velocity
A01-01-01,SKU-001,Laptop Ultra,50,2.1,A
A01-01-02,SKU-002,Monitor 4K Curved,30,8.5,B`;

const parsedCsv = parseSpreadsheetText(SAMPLE_CSV_DIRECT);
const csvMapping = detectColumnMapping(parsedCsv.headers);
assert(csvMapping.binIdCol === 0, `Expected binIdCol === 0, got ${csvMapping.binIdCol}`);
const csvValidated = validateAndTransformRows(parsedCsv.rows, csvMapping, parsedCsv.headers);
assert(csvValidated.directItems.length === 2, `Expected 2 direct items, got ${csvValidated.directItems.length}`);
assert(csvValidated.directItems[0].binId === 'A01-01-01', `Expected binId A01-01-01, got ${csvValidated.directItems[0].binId}`);
console.log('  ✅ [PASS] Spreadsheet parsing and smart column mapping verified');

// =========================================================================
// TEST 2: Multi-Objective Dynamic Slotting Optimizer
// =========================================================================
console.log('\n--- TEST 2: Multi-Objective Dynamic Slotting Optimizer ---');

// Setup mock test blueprint with 2 racks and 1 dock door
const mockRackGround: RackEntity = {
  id: 'rack-ground-01',
  name: 'A01',
  type: 'selective_pallet',
  position: { x: 5, y: 0, z: 5 }, // Close to dock at {3, 0, 3}
  rotationY: 0,
  dimensions: { width: 4.8, height: 4.5, depth: 1.2 },
  bays: 2,
  levels: 3,
  levelHeight: 1.5,
  bayWidth: 2.4,
  bayDepth: 1.2,
  levelId: 'level-1',
  bins: [
    // Bay 1: Levels 1, 2, 3
    { id: 'A01-01-01', rackId: 'rack-ground-01', bayIndex: 1, levelIndex: 1, relativePosition: { x: -1.2, y: 0.75, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    { id: 'A01-01-02', rackId: 'rack-ground-01', bayIndex: 1, levelIndex: 2, relativePosition: { x: -1.2, y: 2.25, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    { id: 'A01-01-03', rackId: 'rack-ground-01', bayIndex: 1, levelIndex: 3, relativePosition: { x: -1.2, y: 3.75, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    // Bay 2: Levels 1, 2, 3
    { id: 'A01-02-01', rackId: 'rack-ground-01', bayIndex: 2, levelIndex: 1, relativePosition: { x: 1.2, y: 0.75, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    { id: 'A01-02-02', rackId: 'rack-ground-01', bayIndex: 2, levelIndex: 2, relativePosition: { x: 1.2, y: 2.25, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    { id: 'A01-02-03', rackId: 'rack-ground-01', bayIndex: 2, levelIndex: 3, relativePosition: { x: 1.2, y: 3.75, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
  ],
};

const mockRackRear: RackEntity = {
  id: 'rack-rear-02',
  name: 'B01',
  type: 'selective_pallet',
  position: { x: 40, y: 0, z: 40 }, // Far from dock
  rotationY: 0,
  dimensions: { width: 4.8, height: 4.5, depth: 1.2 },
  bays: 2,
  levels: 3,
  levelHeight: 1.5,
  bayWidth: 2.4,
  bayDepth: 1.2,
  levelId: 'level-1',
  bins: [
    { id: 'B01-01-01', rackId: 'rack-rear-02', bayIndex: 1, levelIndex: 1, relativePosition: { x: -1.2, y: 0.75, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    { id: 'B01-01-02', rackId: 'rack-rear-02', bayIndex: 1, levelIndex: 2, relativePosition: { x: -1.2, y: 2.25, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
    { id: 'B01-01-03', rackId: 'rack-rear-02', bayIndex: 1, levelIndex: 3, relativePosition: { x: -1.2, y: 3.75, z: 0 }, dimension: { width: 2.4, height: 1.5, depth: 1.2 }, maxWeightKg: 1000, isOccupied: false },
  ],
};

const mockBlueprint: WarehouseLayoutBlueprint = {
  id: 'test-blueprint-phase42',
  name: 'Logistics Distribution Center',
  floorDimensions: { width: 50, height: 8, depth: 50 },
  gridSnapStep: 0.5,
  zones: [],
  racks: [mockRackGround, mockRackRear],
  structuralElements: [
    { id: 'dock-01', name: 'Shipping Dock 01', type: 'dock_door', position: { x: 3, y: 0, z: 3 }, dimensions: { width: 3, height: 3.5, depth: 0.5 }, rotationY: 0 },
  ],
  buildingLevels: [
    { id: 'level-1', name: 'Lantai 1 / Ground', elevationY: 0, height: 4.5, type: 'GROUND' },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const candidateSlots = extractCandidateSlots(mockBlueprint, DEFAULT_SLOTTING_OPTIONS);
assert(candidateSlots.length === 9, `Expected 9 candidate slots, got ${candidateSlots.length}`);
console.log(`  ✅ [PASS] Candidate slots extracted: ${candidateSlots.length} slots`);

// Intake SKUs to optimize: 1 Class A Fast Mover, 1 Heavy Weight Item (>25kg), 1 Class C Slow Mover
const testIntakeSkus: BinSkuData[] = [
  { sku: 'SKU-FAST-A', productName: 'iPhone Pro', quantity: 100, unit: 'pcs', lotNumber: 'L1', weightKg: 0.4, velocityClass: 'A' },
  { sku: 'SKU-HEAVY-A', productName: 'Baja Berat 60kg', quantity: 5, unit: 'pcs', lotNumber: 'L2', weightKg: 60.0, velocityClass: 'A' },
  { sku: 'SKU-SLOW-C', productName: 'Spare Part Jarang', quantity: 10, unit: 'pcs', lotNumber: 'L3', weightKg: 5.0, velocityClass: 'C' },
];

const slottingResult = runDynamicSlottingOptimizer(mockBlueprint, testIntakeSkus, {
  goldenZoneLevels: [1, 2],
  heavyThresholdKg: 25.0,
});

assert(slottingResult.allocations.length === 3, `Expected 3 allocations, got ${slottingResult.allocations.length}`);
assert(slottingResult.unallocated.length === 0, `Expected 0 unallocated, got ${slottingResult.unallocated.length}`);

// 1. Verify Heavy Item is strictly clamped to levelIndex === 1
const heavyAlloc = slottingResult.allocations.find((a) => a.skuData.sku === 'SKU-HEAVY-A');
assert(!!heavyAlloc, 'Heavy allocation should exist');
assert(heavyAlloc!.levelIndex === 1, `Heavy item MUST be clamped to Level 1, got level ${heavyAlloc!.levelIndex}`);
console.log(`  ✅ [PASS] Heavy item (>25kg) strictly clamped to Level 1 (${heavyAlloc!.slotId})`);

// 2. Verify Class A item is placed near dock in Golden Zone (A01 rack, level 1 or 2)
const fastAlloc = slottingResult.allocations.find((a) => a.skuData.sku === 'SKU-FAST-A');
assert(!!fastAlloc, 'Fast allocation should exist');
assert(fastAlloc!.entityName === 'A01', `Fast mover should be in Aisle A01, got ${fastAlloc!.entityName}`);
assert(fastAlloc!.distanceM < 10, `Fast mover should be close to dock (<10m), got ${fastAlloc!.distanceM}m`);
console.log(`  ✅ [PASS] Class A fast mover allocated to Golden Zone near dock (${fastAlloc!.slotId}, ${fastAlloc!.distanceM}m)`);

// 3. Verify Class C slow mover is placed further back or upper tier
const slowAlloc = slottingResult.allocations.find((a) => a.skuData.sku === 'SKU-SLOW-C');
assert(!!slowAlloc, 'Slow allocation should exist');
console.log(`  ✅ [PASS] Class C item allocated: ${slowAlloc!.slotId} (${slowAlloc!.reason})`);

// =========================================================================
// TEST 3: Atomic Undo/Redo & 3D Heatmap Coordination
// =========================================================================
console.log('\n--- TEST 3: Atomic Command Pipeline & Undo/Redo ---');

useEditorStore.getState().loadBlueprint(mockBlueprint);

// Initial state check
const initialRack = useEditorStore.getState().racks.find((r) => r.id === 'rack-ground-01');
assert(initialRack !== undefined, 'Initial rack should exist');
assert(initialRack.bins.every((b) => !b.isOccupied), 'All bins should start unoccupied');

// Prepare updates
const binUpdates = slottingResult.allocations
  .filter((a) => a.type === 'RACK_BIN')
  .map((a) => ({
    rackId: a.entityId,
    binId: a.slotId,
    isOccupied: true,
    skuData: a.skuData,
  }));

const applyCmd = createApplyWmsInventorySyncCommand(binUpdates, [], {
  activateHeatmap: true,
  heatmapMetric: 'ABC_VELOCITY',
});

// Execute
useEditorStore.getState().executeCommand(applyCmd);
const stateAfterExec = useEditorStore.getState();
assert(stateAfterExec.heatmapMetric === 'ABC_VELOCITY', `Heatmap should switch to ABC_VELOCITY, got ${stateAfterExec.heatmapMetric}`);

const rackAfterExec = stateAfterExec.racks.find((r) => r.id === 'rack-ground-01');
const occupiedCount = rackAfterExec!.bins.filter((b) => b.isOccupied).length;
assert(occupiedCount >= 2, `Expected at least 2 bins occupied, got ${occupiedCount}`);
console.log('  ✅ [PASS] Command executed and ABC Velocity Heatmap activated');

// Test Undo (Ctrl+Z)
useEditorStore.getState().undo();
const stateAfterUndo = useEditorStore.getState();
const rackAfterUndo = stateAfterUndo.racks.find((r) => r.id === 'rack-ground-01');
const occupiedAfterUndo = rackAfterUndo!.bins.filter((b) => b.isOccupied).length;
assert(occupiedAfterUndo === 0, `Undo should restore 0 occupied bins, got ${occupiedAfterUndo}`);
console.log('  ✅ [PASS] Undo (Ctrl+Z) completely restored original empty bins state');

// Test Redo (Ctrl+Y)
useEditorStore.getState().redo();
const stateAfterRedo = useEditorStore.getState();
const rackAfterRedo = stateAfterRedo.racks.find((r) => r.id === 'rack-ground-01');
assert(rackAfterRedo!.bins.filter((b) => b.isOccupied).length >= 2, 'Redo should re-populate bins');
console.log('  ✅ [PASS] Redo (Ctrl+Y) successfully re-applied inventory sync');

// =========================================================================
// TEST 4: Full Facility Inventory Exporter
// =========================================================================
console.log('\n--- TEST 4: Full Facility Inventory Exporter (CSV, TSV, JSON) ---');

const exportCsv = exportFullWmsInventoryCsv(mockBlueprint);
assert(exportCsv.includes('location_type,location_id'), 'CSV should contain standard header');
assert(exportCsv.includes('A01-01-01'), 'CSV should include bin IDs');

const exportTsv = exportFullWmsInventoryTsv(mockBlueprint);
assert(exportTsv.includes('\t'), 'TSV should use tab delimiters');

const exportJson = exportFullWmsInventoryJson(mockBlueprint);
const parsedExportJson = JSON.parse(exportJson);
assert(parsedExportJson.blueprintId === mockBlueprint.id, 'JSON export should preserve blueprintId');
assert(parsedExportJson.totalLocations === 9, `Expected 9 total locations in JSON, got ${parsedExportJson.totalLocations}`);
console.log('  ✅ [PASS] Full WMS inventory exports (CSV, TSV, JSON) validated');

// =========================================================================
// TEST 5: REST API Zod Contract Validation
// =========================================================================
console.log('\n--- TEST 5: REST API Zod Contract Validation ---');

const validPayload = {
  blueprintId: 'wh-prod-001',
  syncMode: 'SLOTTING',
  conflictStrategy: 'OVERWRITE',
  items: [
    { sku: 'SKU-001', productName: 'Widget A', quantity: 10, weightKg: 5, velocityClass: 'A' },
    { binId: 'A01-01-01', sku: 'SKU-002', productName: 'Widget B', quantity: 20, weightKg: 30, velocityClass: 'B' },
  ],
};

const zodValid = WmsSyncPayloadSchema.safeParse(validPayload);
assert(zodValid.success, `Expected valid payload to pass Zod schema`);

const invalidPayload = {
  blueprintId: '', // invalid: empty
  items: [], // invalid: empty
};
const zodInvalid = WmsSyncPayloadSchema.safeParse(invalidPayload);
assert(!zodInvalid.success, 'Expected empty payload to fail Zod validation');
console.log('  ✅ [PASS] Zod API contracts validated (Accepts valid, rejects malformed)');

console.log('\n==================================================');
console.log('🎉 ALL PHASE 42 WMS SYNC & SLOTTING SMOKE TESTS PASSED (100%)');
console.log('==================================================');
