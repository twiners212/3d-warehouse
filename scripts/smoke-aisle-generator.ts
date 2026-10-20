// Automated Smoke Test for Phase 29: Aisle Auto-Spanning & Array Generator Engine
// Verifies:
// 1. Single Rows vs Back-to-Back spacing and row offsets
// 2. Longitudinal multi-bay collinear run positioning
// 3. Equipment clearance presets
// 4. Strict Bin ID regex compliance (^[A-Z0-9]+-\d{2}-\d{2}$) and Zod validation
// 5. Collision detection (obstacles and floor boundaries) and skip-colliding filtering
// 6. Atomic Command execution, multi-selection activation, and full Undo/Redo

import {
  planAisleArray,
  EQUIPMENT_PRESETS,
  type AisleArrayConfig,
} from '../src/engine/procedural/aisle-generator';
import { createGenerateAisleArrayCommand } from '../src/engine/commands/GenerateAisleArrayCommand';
import { useEditorStore } from '../src/stores/useEditorStore';
import { BinSlotSchema } from '../src/lib/validations/layout-schema';
import type { RackEntity } from '../src/types/layout';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Starting Aisle Auto-Spanning & Array Generator Smoke Tests...\n');

// 1. Equipment Presets Validation
console.log('1. Validating Industrial Equipment Clearance Presets...');
assert(EQUIPMENT_PRESETS.length === 4, `Expected 4 presets, got ${EQUIPMENT_PRESETS.length}`);
const cbPreset = EQUIPMENT_PRESETS.find((p) => p.id === 'counterbalance');
assert(!!cbPreset && cbPreset.aisleWidth === 3.5, 'Counterbalance forklift should have 3.5m clearance');
const reachPreset = EQUIPMENT_PRESETS.find((p) => p.id === 'reach_truck');
assert(!!reachPreset && reachPreset.aisleWidth === 2.8, 'Reach truck should have 2.8m clearance');
const vnaPreset = EQUIPMENT_PRESETS.find((p) => p.id === 'vna');
assert(!!vnaPreset && vnaPreset.aisleWidth === 1.8, 'VNA truck should have 1.8m clearance');
const pickerPreset = EQUIPMENT_PRESETS.find((p) => p.id === 'order_picker');
assert(!!pickerPreset && pickerPreset.aisleWidth === 1.4, 'Order picker should have 1.4m clearance');
console.log('✅ Equipment presets verified.');

// 2. Single Rows Array Layout Math
console.log('\n2. Testing Single Rows Topology Math...');
const singleConfig: AisleArrayConfig = {
  topology: 'single',
  orientation: 'along_x',
  aisleCount: 3,
  racksPerRun: 2,
  aisleWidth: 3.0,
  flueSpace: 0.2,
  anchorMode: 'custom',
  customOrigin: { x: 10, z: 10 },
  rackTemplate: {
    type: 'selective_pallet',
    bays: 3,
    levels: 4,
    bayWidth: 2.7,
    levelHeight: 1.8,
    depth: 1.1,
  },
  namingPrefix: 'A',
};

const singlePlan = planAisleArray(singleConfig, {
  floorDimensions: { width: 100, depth: 100, height: 12 },
  existingRacks: [],
});

assert(singlePlan.totalCandidates === 6, `Expected 3 aisles * 2 runs = 6 racks, got ${singlePlan.totalCandidates}`);
assert(singlePlan.validCandidates === 6, `All 6 candidates should be valid, got ${singlePlan.validCandidates}`);

// Check run spacing along X (each rack length = 3 * 2.7 = 8.1m)
const r1 = singlePlan.candidateRacks[0].entity;
const r2 = singlePlan.candidateRacks[1].entity;
assert(Math.abs(r2.position.x - r1.position.x - 8.1) < 0.01, `Collinear run spacing along X should be 8.1m, got ${r2.position.x - r1.position.x}`);

// Check aisle spacing along Z (depth 1.1m + aisleWidth 3.0m = 4.1m)
const r3 = singlePlan.candidateRacks[2].entity; // row 2, run 1
assert(Math.abs(r3.position.z - r1.position.z - 4.1) < 0.01, `Single row spacing along Z should be 4.1m, got ${r3.position.z - r1.position.z}`);
console.log('✅ Single rows spacing and collinear runs verified.');

// 3. Back-to-Back Pairs Layout Math
console.log('\n3. Testing Back-to-Back Pairs with Flue Space Math...');
const b2bConfig: AisleArrayConfig = {
  ...singleConfig,
  topology: 'back_to_back',
  aisleCount: 2, // 2 pairs = 4 rows
  racksPerRun: 1,
  flueSpace: 0.3,
  aisleWidth: 3.2,
};

const b2bPlan = planAisleArray(b2bConfig, {
  floorDimensions: { width: 100, depth: 100, height: 12 },
  existingRacks: [],
});

assert(b2bPlan.totalCandidates === 4, `Expected 2 pairs * 1 run = 4 racks, got ${b2bPlan.totalCandidates}`);
const pair1Row1 = b2bPlan.candidateRacks[0].entity;
const pair1Row2 = b2bPlan.candidateRacks[1].entity;
const pair2Row1 = b2bPlan.candidateRacks[2].entity;

// Distance between Row 1 and Row 2 of Pair 1 should be depth 1.1m + flueSpace 0.3m = 1.4m
const pair1Spacing = pair1Row2.position.z - pair1Row1.position.z;
assert(Math.abs(pair1Spacing - 1.4) < 0.01, `Pair internal spacing should be 1.4m, got ${pair1Spacing}`);

// Distance between Pair 1 Row 2 and Pair 2 Row 1 should be depth 1.1m + aisleWidth 3.2m = 4.3m
const aisleSpacing = pair2Row1.position.z - pair1Row2.position.z;
assert(Math.abs(aisleSpacing - 4.3) < 0.01, `Aisle clearance between pairs should be 4.3m, got ${aisleSpacing}`);
console.log('✅ Back-to-back pair flue space and aisle spacing verified.');

// 4. Deterministic Bin Naming and Zod Regex Compliance
console.log('\n4. Validating Bin Naming & Schema Regex Compliance...');
for (const cand of b2bPlan.candidateRacks) {
  const rack = cand.entity;
  // Rack name must be strictly alphanumeric (no hyphens) so bin ID has exactly two hyphens
  assert(/^[A-Z0-9]+$/.test(rack.name), `Rack name "${rack.name}" must be alphanumeric`);

  assert(rack.bins.length === 24, `Expected 3 bays * 4 levels * 2 slots = 24 bins, got ${rack.bins.length}`);
  for (const bin of rack.bins) {
    const parseResult = BinSlotSchema.safeParse(bin);
    assert(
      parseResult.success,
      `Bin ID "${bin.id}" failed Zod validation: ${parseResult.error?.message}`
    );
  }
}
console.log('✅ All candidate rack names and bin IDs strictly comply with Zod runtime schema.');

// 5. Collision Detection and Skip-Colliding Filter
console.log('\n5. Testing Collision Detection & Skip-Colliding Filter...');
// Place an obstacle right at (10, 0, 10)
const mockExistingRack: RackEntity = {
  id: 'obs-01',
  name: 'OBS01',
  type: 'selective_pallet',
  position: { x: 10, y: 0, z: 10 },
  rotationY: 0,
  dimensions: { width: 8.1, height: 7.2, depth: 1.1 },
  bays: 3,
  levels: 4,
  bayWidth: 2.7,
  bayDepth: 1.1,
  levelHeight: 1.8,
  bins: [],
};

const collisionPlan = planAisleArray(singleConfig, {
  floorDimensions: { width: 100, depth: 100, height: 12 },
  existingRacks: [mockExistingRack],
});

assert(collisionPlan.collidingCandidates > 0, 'Should detect at least 1 collision with existing rack');
const collidingRack = collisionPlan.candidateRacks.find((c) => !c.isValid);
assert(!!collidingRack, 'Colliding candidate must exist');
assert(collidingRack?.collisionReason === 'obstacle_collision', `Expected "obstacle_collision", got "${collidingRack?.collisionReason}"`);

// Test boundary detection
const boundaryPlan = planAisleArray(
  {
    ...singleConfig,
    customOrigin: { x: 95, z: 95 }, // Near bottom-right edge of 100x100 room
  },
  {
    floorDimensions: { width: 100, depth: 100, height: 12 },
    existingRacks: [],
  }
);

assert(boundaryPlan.requiredFloor.requiresExpansion === true, 'Array near edge should require floor expansion');
const outOfBounds = boundaryPlan.candidateRacks.filter((c) => c.collisionReason === 'bounds');
assert(outOfBounds.length > 0, 'Should detect out of bounds candidates');
console.log('✅ Obstacle collision and floor boundary detection verified.');

// 6. Atomic Command Execution, Multi-Selection & Undo/Redo
console.log('\n6. Testing Atomic Command Execution & Undo/Redo...');
const store = useEditorStore.getState();
store.loadBlueprint({
  id: 'test-bp-aisle',
  name: 'Test Blueprint',
  floorDimensions: { width: 100, depth: 100, height: 12 },
  gridSnapStep: 0.5,
  zones: [],
  structuralElements: [],
  racks: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

assert(useEditorStore.getState().racks.length === 0, 'Initial racks should be 0');

const racksToInsert = singlePlan.candidateRacks.map((c) => c.entity);
const cmd = createGenerateAisleArrayCommand(racksToInsert);

// Execute command
store.executeCommand(cmd);

const stateAfterExec = useEditorStore.getState();
assert(stateAfterExec.racks.length === 6, `Expected 6 racks after execution, got ${stateAfterExec.racks.length}`);
assert(stateAfterExec.selectedEntityIds.length === 6, `All 6 generated racks should be multi-selected, got ${stateAfterExec.selectedEntityIds.length}`);
assert(stateAfterExec.canUndo() === true, 'Command stack must allow undo');

// Undo command
store.undo();
const stateAfterUndo = useEditorStore.getState();
assert(stateAfterUndo.racks.length === 0, `Expected 0 racks after undo, got ${stateAfterUndo.racks.length}`);
assert(stateAfterUndo.selectedEntityIds.length === 0, `Selection must be cleared after undo, got ${stateAfterUndo.selectedEntityIds.length}`);

// Redo command
store.redo();
const stateAfterRedo = useEditorStore.getState();
assert(stateAfterRedo.racks.length === 6, `Expected 6 racks after redo, got ${stateAfterRedo.racks.length}`);
assert(stateAfterRedo.selectedEntityIds.length === 6, `All 6 racks should be multi-selected after redo, got ${stateAfterRedo.selectedEntityIds.length}`);

console.log('✅ Atomic command execution, multi-selection, and undo/redo verified.');

console.log('\n🎉 ALL AISLE GENERATOR SMOKE TESTS PASSED CLEANLY!\n');
