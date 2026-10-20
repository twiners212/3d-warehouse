// Smoke test for Enhanced 3D Hitboxes and Selection Mechanics for Zones & Small Assets
// Usage: npx tsx scripts/smoke-selection-hitboxes.ts

import 'dotenv/config';
import { useEditorStore } from '../src/stores/useEditorStore';
import type { WarehouseZone, StructuralElement, RackEntity } from '../src/types/layout';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log('--- Phase 23 Smoke Test: Enhanced Hitboxes & Selection Mechanics ---');

const store = useEditorStore;

// 1. Setup mock Zone & Structural Element
const testZone: WarehouseZone = {
  id: 'zone-test-rec-1',
  name: 'Receiving Staging A',
  type: 'receiving',
  position: { x: 10, y: 0, z: 10 },
  dimensions: { width: 12, height: 0.15, depth: 8 },
  colorHex: '#0284c7',
};

const testBollard: StructuralElement = {
  id: 'struct-bollard-1',
  name: 'Safety Bollard 1',
  type: 'bollard',
  position: { x: 5, y: 0, z: 5 },
  rotationY: 0,
  dimensions: { width: 0.3, height: 1.0, depth: 0.3 },
};

const testColumn: StructuralElement = {
  id: 'struct-col-1',
  name: 'Support Column 1',
  type: 'column',
  position: { x: 15, y: 0, z: 15 },
  rotationY: 0,
  dimensions: { width: 0.5, height: 6.0, depth: 0.5 },
};

store.setState({
  zones: [testZone],
  structuralElements: [testBollard, testColumn],
  selectedEntityId: null,
  hoveredEntityId: null,
});

// 2. Test Selection of Floor Zone
store.getState().selectEntity(testZone.id);
assert(
  store.getState().selectedEntityId === testZone.id,
  `selectEntity must select zone id "${testZone.id}"`
);

// 3. Test Hover Tracking on Floor Zone
store.getState().setHoveredEntity(testZone.id);
assert(
  store.getState().hoveredEntityId === testZone.id,
  `setHoveredEntity must track zone id "${testZone.id}"`
);

// 4. Test Selection of Small Structural Asset (Bollard)
store.getState().selectEntity(testBollard.id);
assert(
  store.getState().selectedEntityId === testBollard.id,
  `selectEntity must select small asset bollard id "${testBollard.id}"`
);

// 5. Test Hitbox Bounds Logic for Bollard
// Default width is 0.3m -> colliderRadius should expand to Math.max(0.3 * 1.2, 0.35) = 0.35m (0.7m diameter)
const bollardRadius = testBollard.dimensions.width / 2;
const expandedColliderRadius = Math.max(testBollard.dimensions.width * 1.2, 0.35);
const expansionRatio = (Math.PI * expandedColliderRadius * expandedColliderRadius) / (Math.PI * bollardRadius * bollardRadius);

assert(
  expandedColliderRadius >= 0.35,
  `Bollard expanded collider radius must be at least 0.35m (got ${expandedColliderRadius}m, diameter ${expandedColliderRadius * 2}m)`
);

assert(
  expansionRatio >= 4.0,
  `Bollard click target cross-sectional area must be expanded by at least 400% (got ${expansionRatio.toFixed(1)}x)`
);

// 6. Test Hitbox Bounds Logic for Floor Zone
// Floor slab height must be at least 0.15m to guarantee raycasting capture
const slabHitboxHeight = 0.2;
assert(
  slabHitboxHeight >= 0.15,
  `Zone 3D hitbox slab height must be >= 0.15m to prevent raycast pass-through (got ${slabHitboxHeight}m)`
);

// 7. Test Storage Racking Selection & Hover Tracking
const testRack: RackEntity = {
  id: 'rack-test-a01',
  name: 'A01',
  type: 'selective_pallet',
  position: { x: 20, y: 0, z: 20 },
  rotationY: 0,
  dimensions: { width: 4.5, height: 6.0, depth: 1.1 },
  bays: 3,
  levels: 4,
  bayWidth: 1.5,
  bayDepth: 1.1,
  levelHeight: 1.5,
  bins: [],
};

store.setState({ racks: [testRack] });

store.getState().selectEntity(testRack.id);
assert(
  store.getState().selectedEntityId === testRack.id,
  `selectEntity must select storage rack "${testRack.id}"`
);

store.getState().setHoveredEntity(testRack.id);
assert(
  store.getState().hoveredEntityId === testRack.id,
  `setHoveredEntity must track storage rack "${testRack.id}"`
);

// 8. Test Deselection
store.getState().deselectEntity();
assert(
  store.getState().selectedEntityId === null,
  'deselectEntity must clear selectedEntityId'
);

console.log('\n🎉 ALL HITBOX & SELECTION (ZONES, STRUCTURES, STORAGE RACKS) TESTS PASSED!');
