// Smoke Test for Phase 36: Picking Path & Routing Optimization Engine
// Tests Walkability Grid, A* Obstacle Avoidance, TSP 2-Opt, Multi-Equipment Telemetry, and State Slice

import { createWalkabilityGrid, calculateBayAccessPoint } from '../src/engine/routing/grid-map';
import { findPathAStar, hasLineOfSight } from '../src/engine/routing/astar-pathfinder';
import { optimizePickSequence, nearestNeighborTSP, twoOptOptimization } from '../src/engine/routing/tsp-optimizer';
import { calculatePickingRoute, generateSamplePickOrder, detectDefaultDepot } from '../src/engine/routing/routing-engine';
import { VEHICLE_CONFIGS } from '../src/types/routing';
import type { RackEntity, StructuralElement, WarehouseZone } from '../src/types/layout';
import type { WarehouseBounds } from '../src/types/spatial';
import { id } from '../src/lib/i18n/id';
import { en } from '../src/lib/i18n/en';

console.log('🧪 Running Smoke Tests for Phase 36: Picking Path & Routing Engine...\n');

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
// Test 1: 2D Walkability Grid & Obstacle Boundary Mapping
// -------------------------------------------------------------
console.log('1. Testing Walkability Grid & Obstacle Mapping:');
const bounds: WarehouseBounds = { width: 40, depth: 30 };

const mockRacks: RackEntity[] = [
  {
    id: 'rack-1',
    name: 'A01',
    type: 'selective_pallet',
    position: { x: 10, y: 0, z: 15 },
    rotationY: 0,
    dimensions: { width: 8, height: 6, depth: 1.2 },
    bays: 3,
    levels: 3,
    bayWidth: 2.6,
    bayDepth: 1.2,
    levelHeight: 2.0,
    bins: [
      {
        id: 'A01-01-01',
        rackId: 'rack-1',
        bayIndex: 1,
        levelIndex: 1,
        relativePosition: { x: -2.6, y: 0, z: 0 },
        dimension: { width: 2.6, height: 2.0, depth: 1.2 },
        maxWeightKg: 1000,
        isOccupied: true,
      },
      {
        id: 'A01-02-01',
        rackId: 'rack-1',
        bayIndex: 2,
        levelIndex: 1,
        relativePosition: { x: 0, y: 0, z: 0 },
        dimension: { width: 2.6, height: 2.0, depth: 1.2 },
        maxWeightKg: 1000,
        isOccupied: true,
      },
    ],
  },
];

const mockStructures: StructuralElement[] = [
  {
    id: 'pillar-1',
    name: 'P01',
    type: 'column',
    position: { x: 25, y: 0, z: 15 },
    dimensions: { width: 1.0, height: 8, depth: 1.0 },
    rotationY: 0,
  },
];

const grid = createWalkabilityGrid(bounds, mockRacks, mockStructures);

assert(grid.cols === 80 && grid.rows === 60, `Grid discretized to ${grid.cols}x${grid.rows} cells (0.5m resolution)`);

// Rack center (10, 15) should be blocked (obstacle)
const rackGrid = grid.worldToGrid(10, 15);
assert(!grid.isWalkable(rackGrid.col, rackGrid.row), 'Center of rack A01 is correctly marked as unwalkable');

// Pillar center (25, 15) should be blocked (obstacle)
const pillarGrid = grid.worldToGrid(25, 15);
assert(!grid.isWalkable(pillarGrid.col, pillarGrid.row), 'Structural pillar P01 is correctly marked as unwalkable');

// Empty aisle area (10, 22) should be walkable
const clearGrid = grid.worldToGrid(10, 22);
assert(grid.isWalkable(clearGrid.col, clearGrid.row), 'Clear warehouse aisle (10, 22) is walkable');

// Bay access point should be walkable and positioned outside rack body
const accessPoint = calculateBayAccessPoint(mockRacks[0], 2, grid);
const accessGrid = grid.worldToGrid(accessPoint.x, accessPoint.z);
assert(grid.isWalkable(accessGrid.col, accessGrid.row), 'Bay access point in aisle is walkable');
assert(
  Math.abs(accessPoint.z - mockRacks[0].position.z) > mockRacks[0].dimensions.depth / 2,
  'Access point is offset into the aisle clear of the rack frame'
);

// -------------------------------------------------------------
// Test 2: A* Shortest Pathfinding & Obstacle Detour
// -------------------------------------------------------------
console.log('\n2. Testing A* Pathfinding & Obstacle Detour:');

// Straight line in clear space
const pathClear = findPathAStar(grid, { x: 2, z: 2 }, { x: 2, z: 10 }, true);
assert(pathClear.points.length >= 2, 'A* finds straight path in unobstructed space');
assert(Math.abs(pathClear.distance - 8.0) < 0.2, `Distance is ~8.0m (measured: ${pathClear.distance.toFixed(2)}m)`);

// Path going from (5, 15) to (15, 15), right through the rack at (10, 15)
const pathAround = findPathAStar(grid, { x: 5, z: 15 }, { x: 15, z: 15 }, true);
assert(pathAround.points.length > 2, 'A* navigates around obstacle with intermediate waypoints');
assert(pathAround.distance > 10.0, `Detour distance exceeds direct line (measured: ${pathAround.distance.toFixed(2)}m > 10.0m)`);

// Verify that no point on the path intersects an unwalkable cell
let hasCollision = false;
for (const pt of pathAround.points) {
  const g = grid.worldToGrid(pt.x, pt.z);
  if (!grid.isWalkable(g.col, g.row)) {
    hasCollision = true;
    break;
  }
}
assert(!hasCollision, 'A* path points are 100% collision-free');

// -------------------------------------------------------------
// Test 3: TSP 2-Opt Order Optimization
// -------------------------------------------------------------
console.log('\n3. Testing TSP 2-Opt Heuristic Optimization:');

const depot = { x: 3, z: 3 };
const samplePicks = [
  {
    binId: 'A01-01-01',
    rackId: 'r1',
    rackName: 'A01',
    bayIndex: 1,
    levelIndex: 1,
    position3D: { x: 10, y: 1.5, z: 20 },
    accessPoint3D: { x: 10, y: 0, z: 20 },
    sku: 'SKU-001',
    productName: 'Item 1',
    quantity: 2,
    weightKg: 10,
    isPicked: false,
  },
  {
    binId: 'A01-02-01',
    rackId: 'r1',
    rackName: 'A01',
    bayIndex: 2,
    levelIndex: 1,
    position3D: { x: 30, y: 1.5, z: 5 },
    accessPoint3D: { x: 30, y: 0, z: 5 },
    sku: 'SKU-002',
    productName: 'Item 2',
    quantity: 1,
    weightKg: 15,
    isPicked: false,
  },
  {
    binId: 'A01-03-01',
    rackId: 'r1',
    rackName: 'A01',
    bayIndex: 3,
    levelIndex: 1,
    position3D: { x: 12, y: 1.5, z: 22 },
    accessPoint3D: { x: 12, y: 0, z: 22 },
    sku: 'SKU-003',
    productName: 'Item 3',
    quantity: 4,
    weightKg: 20,
    isPicked: false,
  },
  {
    binId: 'A01-04-01',
    rackId: 'r1',
    rackName: 'A01',
    bayIndex: 4,
    levelIndex: 1,
    position3D: { x: 32, y: 1.5, z: 6 },
    accessPoint3D: { x: 32, y: 0, z: 6 },
    sku: 'SKU-004',
    productName: 'Item 4',
    quantity: 3,
    weightKg: 8,
    isPicked: false,
  },
];

const tspResult = optimizePickSequence(depot, samplePicks);
assert(tspResult.optimizedPicks.length === 4, 'All 4 picks included in optimized tour');
assert(
  tspResult.optimizedDistance <= tspResult.unoptimizedDistance,
  `TSP 2-Opt tour (${tspResult.optimizedDistance.toFixed(1)}m) <= unoptimized tour (${tspResult.unoptimizedDistance.toFixed(1)}m)`
);
assert(tspResult.distanceSavedPercent >= 0, `Distance savings is non-negative: ${tspResult.distanceSavedPercent}%`);

// -------------------------------------------------------------
// Test 4: Unified Routing Engine & Multi-Equipment Telemetry
// -------------------------------------------------------------
console.log('\n4. Testing Unified Routing Engine & Vehicle Specs:');

assert(VEHICLE_CONFIGS.FORKLIFT.speedMps === 4.0, 'Forklift speed is calibrated to 4.0 m/s');
assert(VEHICLE_CONFIGS.AGV.speedMps === 2.5, 'AGV speed is calibrated to 2.5 m/s');
assert(VEHICLE_CONFIGS.CART.speedMps === 1.2, 'Picking Cart speed is calibrated to 1.2 m/s');

const fullRoute = calculatePickingRoute({
  bounds,
  racks: mockRacks,
  structuralElements: mockStructures,
  pickItems: samplePicks,
  depotPos: depot,
  vehicleType: 'FORKLIFT',
});

assert(fullRoute.orderedPicks.length === 4, 'Full route contains 4 ordered picks');
assert(fullRoute.waypoints.length === 6, 'Waypoints include Depot Start + 4 Stops + Depot End');
assert(fullRoute.polylinePoints.length >= 6, 'Full continuous polyline generated for 3D canvas');
assert(fullRoute.metrics.totalDistanceMeters > 0, `Total distance calculated: ${fullRoute.metrics.totalDistanceMeters}m`);
assert(fullRoute.metrics.estimatedDurationSeconds > 0, `Estimated duration calculated: ${fullRoute.metrics.estimatedDurationSeconds}s`);
assert(fullRoute.metrics.totalWeightKg === 53, `Total payload weight summed: ${fullRoute.metrics.totalWeightKg}kg`);

// -------------------------------------------------------------
// Test 5: Depot Detection
// -------------------------------------------------------------
console.log('\n5. Testing Automatic Depot Detection:');

const mockZones: WarehouseZone[] = [
  {
    id: 'zone-ship',
    name: 'Shipping Outbound',
    type: 'shipping',
    colorHex: '#0284c7',
    position: { x: 35, y: 0, z: 5 },
    dimensions: { width: 6, height: 0.1, depth: 6 },
  },
];

const detectedDepot = detectDefaultDepot(bounds, mockZones, []);
assert(detectedDepot.x === 35 && detectedDepot.z === 5, 'Depot automatically detected at shipping zone center');

// -------------------------------------------------------------
// Test 6: i18n Key Parity
// -------------------------------------------------------------
console.log('\n6. Testing Dual-Language Dictionary Parity:');

const idKeys = Object.keys(id.picking);
const enKeys = Object.keys(en.picking);

assert(idKeys.length === enKeys.length, `Key counts match: ID (${idKeys.length}) vs EN (${enKeys.length})`);
for (const key of idKeys) {
  assert(key in en.picking, `Key "${key}" exists in both Indonesian and English dictionaries`);
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`Results: ${passedTests} / ${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL PICKING & ROUTING SMOKE TESTS PASSED!');
} else {
  console.error('⚠️ SOME TESTS FAILED!');
  process.exit(1);
}
