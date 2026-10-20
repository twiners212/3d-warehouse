// Automated smoke test for Phase 22: Visual Heatmap & WMS Analytics Layer.
// Tests color resolvers, velocity classifications, Zod validation, store view slice,
// and command pipeline updates.

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import {
  HEATMAP_COLORS,
  resolveAbcVelocityColor,
  resolveOccupancyColor,
  resolveWeightStressColor,
  generateMockSkuData,
} from '../src/lib/constants/warehouse-defaults';
import {
  createUpdateBinOccupancyCommand,
  createUpdateBinSkuDataCommand,
} from '../src/engine/commands/BinCommands';
import { generateBinsForRack } from '../src/engine/procedural/bin-generator';
import { BinSkuDataSchema, WarehouseBlueprintSchema } from '../src/lib/validations/layout-schema';
import type { RackEntity } from '../src/types/layout';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('--- Phase 22 Smoke Test: Visual Heatmap & WMS Analytics ---');

// 1. Test Weight Stress Color Resolver
assert(
  resolveWeightStressColor(200, 1000) === HEATMAP_COLORS.WEIGHT.SAFE,
  '20% load must resolve to SAFE (Green)'
);
assert(
  resolveWeightStressColor(600, 1000) === HEATMAP_COLORS.WEIGHT.MODERATE,
  '60% load must resolve to MODERATE (Yellow)'
);
assert(
  resolveWeightStressColor(800, 1000) === HEATMAP_COLORS.WEIGHT.WARNING,
  '80% load must resolve to WARNING (Orange)'
);
assert(
  resolveWeightStressColor(950, 1000) === HEATMAP_COLORS.WEIGHT.CRITICAL,
  '95% load must resolve to CRITICAL (Red)'
);
assert(
  resolveWeightStressColor(1200, 1000) === HEATMAP_COLORS.WEIGHT.OVERLOAD,
  '120% load must resolve to OVERLOAD (Purple)'
);
console.log('✓ 1. Weight Stress color thresholds verified.');

// 2. Test ABC Velocity Color Resolver
assert(
  resolveAbcVelocityColor('A') === HEATMAP_COLORS.ABC.A,
  'Class A must resolve to Emerald Green'
);
assert(
  resolveAbcVelocityColor('B') === HEATMAP_COLORS.ABC.B,
  'Class B must resolve to Amber'
);
assert(
  resolveAbcVelocityColor('C') === HEATMAP_COLORS.ABC.C,
  'Class C must resolve to Slate'
);
console.log('✓ 2. ABC Velocity color mapping verified.');

// 3. Test Occupancy Color Resolver
assert(
  resolveOccupancyColor(0.2) === HEATMAP_COLORS.OCCUPANCY.LOW,
  '20% rack occupancy must resolve to LOW'
);
assert(
  resolveOccupancyColor(0.5) === HEATMAP_COLORS.OCCUPANCY.MEDIUM,
  '50% rack occupancy must resolve to MEDIUM'
);
assert(
  resolveOccupancyColor(0.9) === HEATMAP_COLORS.OCCUPANCY.HIGH,
  '90% rack occupancy must resolve to HIGH'
);
console.log('✓ 3. Occupancy density color mapping verified.');

// 4. Test Mock Generator includes Velocity
const mockSku1 = generateMockSkuData('A01-01-01');
assert(
  ['A', 'B', 'C'].includes(mockSku1.velocityClass),
  `Mock SKU velocityClass must be A, B, or C (got ${mockSku1.velocityClass})`
);
console.log(`✓ 4. Mock SKU generator outputs valid velocityClass (${mockSku1.velocityClass}).`);

// 5. Test Zod Schema with Velocity Class
const validSku = {
  sku: 'TEST-SKU-01',
  productName: 'High Speed Microcontrollers',
  quantity: 50,
  unit: 'boxes',
  lotNumber: 'LOT-999',
  weightKg: 240,
  velocityClass: 'A',
};
assert(BinSkuDataSchema.safeParse(validSku).success, 'Zod must accept valid velocityClass');

const invalidSku = {
  ...validSku,
  velocityClass: 'X', // Invalid
};
assert(!BinSkuDataSchema.safeParse(invalidSku).success, 'Zod must reject invalid velocityClass');
console.log('✓ 5. Zod schema validation for velocityClass verified.');

// 6. Test Store Heatmap Metric Switching
const store = useEditorStore;
assert(store.getState().heatmapMetric === 'NONE', 'Default heatmapMetric must be NONE');
store.getState().setHeatmapMetric('WEIGHT_STRESS');
assert(store.getState().heatmapMetric === 'WEIGHT_STRESS', 'heatmapMetric must update to WEIGHT_STRESS');
store.getState().setHeatmapMetric('ABC_VELOCITY');
assert(store.getState().heatmapMetric === 'ABC_VELOCITY', 'heatmapMetric must update to ABC_VELOCITY');
store.getState().setHeatmapMetric('OCCUPANCY');
assert(store.getState().heatmapMetric === 'OCCUPANCY', 'heatmapMetric must update to OCCUPANCY');
store.getState().setHeatmapMetric('NONE');
assert(store.getState().heatmapMetric === 'NONE', 'heatmapMetric must reset to NONE');
console.log('✓ 6. Store heatmapMetric actions verified.');

// 7. Test Updating Bin Velocity Class via Command + Undo / Redo
const sampleRack: RackEntity = {
  id: 'rack-heatmap-test',
  name: 'H01',
  type: 'selective_pallet',
  position: { x: 5, y: 0, z: 5 },
  rotationY: 0,
  dimensions: { width: 4, height: 4, depth: 1.2 },
  bays: 2,
  levels: 2,
  bayWidth: 2,
  bayDepth: 1.2,
  levelHeight: 2,
  bins: [],
};
sampleRack.bins = generateBinsForRack(sampleRack);
store.getState().addRack(sampleRack);

// Stock first bin
const targetBinId = sampleRack.bins[0].id;
store.getState().executeCommand(
  createUpdateBinOccupancyCommand(sampleRack.id, targetBinId, true)
);

// Update SKU with velocityClass 'B' (mutating away from mock default 'A')
store.getState().executeCommand(
  createUpdateBinSkuDataCommand(
    sampleRack.id,
    targetBinId,
    {
      sku: 'SKU-FAST-01',
      productName: 'Fast Moving Medical Gloves',
      quantity: 100,
      unit: 'packs',
      lotNumber: 'LOT-MED-1',
      weightKg: 150,
      velocityClass: 'B',
    },
    1000
  )
);

const updatedBin = store.getState().racks.find((r) => r.id === sampleRack.id)?.bins.find((b) => b.id === targetBinId);
assert(updatedBin?.skuData?.velocityClass === 'B', 'velocityClass must be B');

// Undo
store.getState().undo();
const binAfterUndo = store.getState().racks.find((r) => r.id === sampleRack.id)?.bins.find((b) => b.id === targetBinId);
assert(binAfterUndo?.skuData?.velocityClass !== 'B', 'Undo must revert custom velocityClass');

// Redo
store.getState().redo();
const binAfterRedo = store.getState().racks.find((r) => r.id === sampleRack.id)?.bins.find((b) => b.id === targetBinId);
assert(binAfterRedo?.skuData?.velocityClass === 'B', 'Redo must restore velocityClass B');
console.log('✓ 7. VelocityClass mutation + Command Undo/Redo verified.');

console.log('\n🎉 ALL VISUAL HEATMAP & WMS ANALYTICS TESTS PASSED!');
