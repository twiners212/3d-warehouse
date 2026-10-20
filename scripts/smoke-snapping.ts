// Phase 3 smoke test: snapping resolution pipeline + placement validity gate
// (INTERACTION-SPECIFICATION.md Sections 4-5).
// Usage: npx tsx scripts/smoke-snapping.ts

import {
  isPlacementValid,
  resolvePlacementPosition,
} from '../src/engine/spatial/snapping';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

const BASE = {
  entityWidth: 4.5,
  entityDepth: 1.1,
  entityRotationY: 0,
  gridStep: 0.5,
  isSnapEnabled: true,
  neighbors: [],
  floorWidth: 60,
  floorDepth: 40,
};

console.log('\n[1] Grid snapping');
const grid = resolvePlacementPosition({ ...BASE, rawX: 4.23, rawZ: 5.37 });
assert(grid.x === 4.0 && Math.abs(grid.z - 5.5) < 1e-9, 'raw point snapped to nearest 0.5m grid line');

const noSnap = resolvePlacementPosition({ ...BASE, rawX: 4.23, rawZ: -1.62, isSnapEnabled: false });
assert(Math.abs(noSnap.x - 4.23) < 1e-9, 'snap disabled keeps raw coordinates');

console.log('\n[2] Magnetic edge-to-edge alignment (threshold 0.3m)');
// Neighbor right edge sits at 10.1 + 4.5/2 = 12.35 -> aligned x = 14.6 (off-grid)
const neighbor = {
  position: { x: 10.1, y: 0, z: 0 },
  rotationY: 0,
  dimensions: { width: 4.5, height: 6, depth: 1.1 },
};
const magnet = resolvePlacementPosition({
  ...BASE,
  rawX: 14.55,
  rawZ: 0,
  neighbors: [neighbor],
});
assert(
  Math.abs(magnet.x - 14.6) < 1e-6 && magnet.x !== 14.5,
  'left edge magnetically clamped to neighbor right edge (14.5 -> 14.6)'
);

const beyondThreshold = resolvePlacementPosition({
  ...BASE,
  rawX: 13.0,
  rawZ: 0,
  neighbors: [neighbor],
});
assert(beyondThreshold.x === 13.0, 'edge distance > 0.3m keeps grid-snapped position');

console.log('\n[3] Boundary clamping');
const clamped = resolvePlacementPosition({ ...BASE, rawX: -5, rawZ: 100 });
assert(clamped.x === 2.25 && clamped.z === 39.45, 'corners clamped inside floor bounds');

console.log('\n[4] Placement validity gate');
assert(
  isPlacementValid({ x: 20, z: 20, width: 4.5, depth: 1.1, rotationY: 0, neighbors: [], floorWidth: 60, floorDepth: 40 }),
  'empty area is valid'
);
assert(
  !isPlacementValid({
    x: 10,
    z: 0,
    width: 4.5,
    depth: 1.1,
    rotationY: 0,
    neighbors: [neighbor],
    floorWidth: 60,
    floorDepth: 40,
  }),
  'AABB overlap with neighbor is invalid'
);
assert(
  !isPlacementValid({ x: 1, z: 20, width: 4.5, depth: 1.1, rotationY: 0, neighbors: [], floorWidth: 60, floorDepth: 40 }),
  'out-of-bounds footprint is invalid'
);

console.log(`\n${failures === 0 ? 'ALL SNAPPING TESTS PASSED' : `${failures} FAILURE(S)`}\n`);
process.exitCode = failures === 0 ? 0 : 1;
