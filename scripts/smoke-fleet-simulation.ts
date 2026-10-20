// Smoke Test for Phase 41: Multi-Agent Fleet Simulation & Dynamic Traffic Control
// Validates:
// 1. Initial Fleet Generation (3 default agents, max 6 limit)
// 2. VRP Capacity & Spatial Clustering Partitioning
// 3. Multi-Vehicle Dispatching & Color Palettes
// 4. Traffic Controller Radar Proximity, Priority Yielding (FORKLIFT > AGV > CART), and Traffic Alerts
// 5. Battery Drain & Charging Logic
// 6. Add/Remove Fleet Agent Command Undo/Redo
// 7. Zod Schema Validation for Fleet and Charging Dock

import {
  createInitialFleet,
  createFleetAgent,
  partitionPickListToFleet,
  dispatchFleetRoutes,
  findNearestChargingDock,
} from '../src/engine/routing/fleet-dispatcher';
import {
  evaluateFleetTraffic,
  computeFleetMetrics,
  calculateFloorDistance,
} from '../src/engine/routing/traffic-controller';
import {
  createAddFleetAgentCommand,
  createRemoveFleetAgentCommand,
} from '../src/engine/commands/PickingCommands';
import {
  WarehouseBlueprintSchema,
  FleetAgentSchema,
  StructuralElementSchema,
} from '../src/lib/validations/layout-schema';
import {
  DEFAULT_FLEET_SIZE,
  MAX_FLEET_SIZE,
  MAX_FLEET_PER_LEVEL,
  LEVEL_VEHICLE_RESTRICTIONS,
  RADAR_DETECTION_RADIUS_METERS,
  RADAR_STOP_DISTANCE_METERS,
  BATTERY_DRAIN_PER_KM,
  BATTERY_DRAIN_PER_TON_KM,
  BATTERY_CHARGING_SPEED_PCT_PER_SEC,
  FLEET_PALETTE_COLORS,
} from '../src/lib/constants/warehouse-defaults';
import type { FleetAgent, PickItem, VehicleType } from '../src/types/routing';
import type { WarehouseBounds } from '../src/types/spatial';
import type { RackEntity, StructuralElement, BuildingLevel } from '../src/types/layout';
import { useEditorStore } from '../src/stores/useEditorStore';

console.log('🧪 Running Smoke Tests for Phase 41: Multi-Agent Fleet Simulation & Dynamic Traffic Control...\n');

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
// Test 1: Initial Fleet Generation & Capacity Clamps
// -------------------------------------------------------------
console.log('\n--- Test 1: Initial Fleet Generation & Capacity Clamps ---');

const depotPos = { x: 5, z: 5 };
const initialFleet = createInitialFleet(depotPos);

assert(initialFleet.length === DEFAULT_FLEET_SIZE, `Initial fleet size is ${DEFAULT_FLEET_SIZE} (got ${initialFleet.length})`);
assert(initialFleet[0].vehicleType === 'FORKLIFT', `First agent is a FORKLIFT (got ${initialFleet[0].vehicleType})`);
assert(initialFleet[1].vehicleType === 'AGV', `Second agent is an AGV (got ${initialFleet[1].vehicleType})`);
assert(initialFleet[2].vehicleType === 'AGV', `Third agent is an AGV (got ${initialFleet[2].vehicleType})`);
assert(initialFleet.every((a) => a.batteryLevel === 100), 'All initial agents have 100% battery level');
assert(initialFleet.every((a) => a.status === 'IDLE'), 'All initial agents start in IDLE status');
assert(initialFleet.every((a) => a.levelId === 'level-1'), 'All initial agents defaulted to level-1');
assert(new Set(initialFleet.map((a) => a.color)).size === initialFleet.length, 'All initial agents have distinct palette colors');

// Test adding vehicles up to MAX_FLEET_SIZE (8)
const currentFleet = [...initialFleet];
const agent4 = createFleetAgent('AGV', currentFleet, depotPos);
currentFleet.push(agent4);
const agent5 = createFleetAgent('CART', currentFleet, depotPos);
currentFleet.push(agent5);
const agent6 = createFleetAgent('FORKLIFT', currentFleet, depotPos);
currentFleet.push(agent6);
const agent7 = createFleetAgent('AGV', currentFleet, depotPos);
currentFleet.push(agent7);
const agent8 = createFleetAgent('CART', currentFleet, depotPos);
currentFleet.push(agent8);

assert(currentFleet.length === MAX_FLEET_SIZE, `Fleet expanded to maximum size ${MAX_FLEET_SIZE}`);
assert(currentFleet[5].vehicleType === 'FORKLIFT', 'Agent 6 is FORKLIFT');
assert(currentFleet[7].vehicleType === 'CART', 'Agent 8 is CART');

// -------------------------------------------------------------
// Test 2: VRP Order Partitioning & Spatial Clustering
// -------------------------------------------------------------
console.log('\n--- Test 2: VRP Capacity & Spatial Clustering Partitioning ---');

const bounds: WarehouseBounds = { width: 40, depth: 30 };
const mockRacks: RackEntity[] = [
  {
    id: 'rack-test-1',
    name: 'R01',
    type: 'selective_pallet',
    position: { x: 15, y: 0, z: 10 },
    rotationY: 0,
    dimensions: { width: 10, height: 5, depth: 2 },
    bays: 4,
    levels: 3,
    bayWidth: 2.5,
    bayDepth: 2.0,
    levelHeight: 1.6,
    bins: [],
  },
  {
    id: 'rack-test-2',
    name: 'R02',
    type: 'selective_pallet',
    position: { x: 15, y: 0, z: 20 },
    rotationY: 0,
    dimensions: { width: 10, height: 5, depth: 2 },
    bays: 4,
    levels: 3,
    bayWidth: 2.5,
    bayDepth: 2.0,
    levelHeight: 1.6,
    bins: [],
  },
];

// Generate 6 sample pick items distributed across two racks
const mockPickList: PickItem[] = [
  {
    binId: 'BIN-1',
    rackId: 'rack-test-1',
    rackName: 'R01',
    bayIndex: 0,
    levelIndex: 0,
    position3D: { x: 12, y: 0.5, z: 10 },
    accessPoint3D: { x: 12, y: 0, z: 12 },
    sku: 'SKU-A1',
    productName: 'Heavy Motor 1',
    quantity: 1,
    weightKg: 200,
    isPicked: false,
  },
  {
    binId: 'BIN-2',
    rackId: 'rack-test-1',
    rackName: 'R01',
    bayIndex: 1,
    levelIndex: 0,
    position3D: { x: 14, y: 0.5, z: 10 },
    accessPoint3D: { x: 14, y: 0, z: 12 },
    sku: 'SKU-A2',
    productName: 'Heavy Motor 2',
    quantity: 1,
    weightKg: 300,
    isPicked: false,
  },
  {
    binId: 'BIN-3',
    rackId: 'rack-test-1',
    rackName: 'R01',
    bayIndex: 2,
    levelIndex: 0,
    position3D: { x: 16, y: 0.5, z: 10 },
    accessPoint3D: { x: 16, y: 0, z: 12 },
    sku: 'SKU-A3',
    productName: 'Heavy Motor 3',
    quantity: 1,
    weightKg: 400,
    isPicked: false,
  },
  {
    binId: 'BIN-4',
    rackId: 'rack-test-2',
    rackName: 'R02',
    bayIndex: 0,
    levelIndex: 0,
    position3D: { x: 12, y: 0.5, z: 20 },
    accessPoint3D: { x: 12, y: 0, z: 22 },
    sku: 'SKU-B1',
    productName: 'Small Sensors 1',
    quantity: 5,
    weightKg: 10,
    isPicked: false,
  },
  {
    binId: 'BIN-5',
    rackId: 'rack-test-2',
    rackName: 'R02',
    bayIndex: 1,
    levelIndex: 0,
    position3D: { x: 14, y: 0.5, z: 20 },
    accessPoint3D: { x: 14, y: 0, z: 22 },
    sku: 'SKU-B2',
    productName: 'Small Sensors 2',
    quantity: 5,
    weightKg: 10,
    isPicked: false,
  },
  {
    binId: 'BIN-6',
    rackId: 'rack-test-2',
    rackName: 'R02',
    bayIndex: 2,
    levelIndex: 0,
    position3D: { x: 16, y: 0.5, z: 20 },
    accessPoint3D: { x: 16, y: 0, z: 22 },
    sku: 'SKU-B3',
    productName: 'Small Sensors 3',
    quantity: 5,
    weightKg: 10,
    isPicked: false,
  },
];

const partitioned = partitionPickListToFleet(mockPickList, initialFleet);
assert(partitioned.size === initialFleet.length, `Partitioned map contains all ${initialFleet.length} agents`);

let totalAssignedPicks = 0;
for (const [, picks] of partitioned.entries()) {
  totalAssignedPicks += picks.length;
}
assert(totalAssignedPicks === mockPickList.length, `All ${mockPickList.length} items assigned without loss (got ${totalAssignedPicks})`);

// -------------------------------------------------------------
// Test 3: Multi-Vehicle Dispatching & Route Calculation
// -------------------------------------------------------------
console.log('\n--- Test 3: Multi-Vehicle Dispatching & Route Calculation ---');

const dispatchedFleet = dispatchFleetRoutes(
  initialFleet,
  mockPickList,
  bounds,
  mockRacks,
  [],
  depotPos
);

assert(dispatchedFleet.length === initialFleet.length, `Dispatched fleet count matches initial (${dispatchedFleet.length})`);
assert(
  dispatchedFleet.some((a) => a.assignedPickList.length > 0 && a.routeResult !== null),
  'At least one fleet agent was assigned picks and computed a valid routeResult'
);

for (const agent of dispatchedFleet) {
  if (agent.routeResult) {
    assert(agent.routeResult.waypoints.length > 0, `Agent ${agent.name} has non-empty waypoints`);
    assert(agent.routeResult.metrics.totalDistanceMeters > 0, `Agent ${agent.name} distance > 0m`);
    assert(agent.color.length > 0, `Agent ${agent.name} has valid color hex (${agent.color})`);
  }
}

// -------------------------------------------------------------
// Test 4: Nearest Charging Dock Search
// -------------------------------------------------------------
console.log('\n--- Test 4: Nearest Charging Dock Search ---');

const mockChargingDocks: StructuralElement[] = [
  {
    id: 'dock-1',
    name: 'Dock East',
    type: 'charging_dock',
    position: { x: 30, y: 0, z: 10 },
    rotationY: 0,
    dimensions: { width: 3, height: 1.5, depth: 2 },
  },
  {
    id: 'dock-2',
    name: 'Dock West',
    type: 'charging_dock',
    position: { x: 5, y: 0, z: 5 },
    rotationY: 0,
    dimensions: { width: 3, height: 1.5, depth: 2 },
  },
];

const nearestDock = findNearestChargingDock({ x: 6, y: 0, z: 6 }, mockChargingDocks);
assert(nearestDock !== null, 'Found charging dock successfully');
assert(
  nearestDock?.position.x === 5 && nearestDock?.position.z === 5,
  `Correct nearest dock selected (expected {5, 5}, got {${nearestDock?.position.x}, ${nearestDock?.position.z}})`
);

// -------------------------------------------------------------
// Test 5: Traffic Controller Radar, Priority Hierarchy & Collision Avoidance
// -------------------------------------------------------------
console.log('\n--- Test 5: Traffic Controller Radar, Priority Hierarchy & Collision Avoidance ---');

// Setup two agents approaching each other:
// Agent A: Forklift (Priority 3) at { x: 10, y: 0, z: 10 }
// Agent B: AGV (Priority 2) at { x: 11.5, y: 0, z: 10 } (Distance: 1.5m -> within 2.8m detection radius)
const agentForklift: FleetAgent = {
  ...initialFleet[0],
  vehicleType: 'FORKLIFT',
  status: 'MOVING',
  position3D: { x: 10, y: 0, z: 10 },
  currentSpeedMps: 2.0,
  isYielding: false,
};

const agentAgv: FleetAgent = {
  ...initialFleet[1],
  vehicleType: 'AGV',
  status: 'MOVING',
  position3D: { x: 11.5, y: 0, z: 10 },
  currentSpeedMps: 1.5,
  isYielding: false,
};

const distance = calculateFloorDistance(agentForklift.position3D, agentAgv.position3D);
assert(distance === 1.5, `Calculated distance is 1.5m (within 2.8m radar radius)`);

const { updatedFleet, alerts } = evaluateFleetTraffic([agentForklift, agentAgv]);

const postForklift = updatedFleet.find((a) => a.id === agentForklift.id)!;
const postAgv = updatedFleet.find((a) => a.id === agentAgv.id)!;

assert(postForklift.isYielding !== true, 'FORKLIFT (higher priority) does NOT yield');
assert(postForklift.currentSpeedMps === 2.0, 'FORKLIFT maintains full speed (2.0 m/s)');

assert(postAgv.isYielding === true, 'AGV (lower priority) yields to FORKLIFT');
assert(postAgv.status === 'YIELDING', 'AGV status set to YIELDING');
assert(postAgv.currentSpeedMps === 0.4, `AGV speed slowed down to crawl (0.4 m/s, got ${postAgv.currentSpeedMps})`);
assert(alerts.length > 0, `Traffic alert generated (count: ${alerts.length})`);
assert(alerts[0].vehicleIdA === agentAgv.id, 'Traffic alert correctly identifies yielding agent');

// -------------------------------------------------------------
// Test 6: Stop Distance Threshold (< 1.4m)
// -------------------------------------------------------------
console.log('\n--- Test 6: Stop Distance Threshold (< 1.4m) ---');

// Position AGV at 0.8m from Forklift (< 1.4m stop distance)
const closeAgv: FleetAgent = {
  ...agentAgv,
  position3D: { x: 10.8, y: 0, z: 10 }, // 0.8m distance
  currentSpeedMps: 1.5,
  isYielding: false,
};

const closeEval = evaluateFleetTraffic([agentForklift, closeAgv]);
const postCloseAgv = closeEval.updatedFleet.find((a) => a.id === closeAgv.id)!;
assert(postCloseAgv.currentSpeedMps === 0, `AGV comes to a complete halt (currentSpeedMps === 0) at 0.8m distance (< ${RADAR_STOP_DISTANCE_METERS}m)`);

// -------------------------------------------------------------
// Test 7: Battery Drain and Charging Metrics
// -------------------------------------------------------------
console.log('\n--- Test 7: Battery Drain and Charging Metrics ---');

const metrics = computeFleetMetrics(updatedFleet);
assert(metrics.activeAgents === 1, `Active agents count is 1 (got ${metrics.activeAgents})`);
assert(metrics.yieldingAgents === 1, `Yielding agents count is 1 (got ${metrics.yieldingAgents})`);
assert(metrics.averageBatteryPct > 0, `Average battery percentage computed (${metrics.averageBatteryPct}%)`);

// Test Battery Drain Rate
// 100 meters travel with 500kg load
const distKm = 0.1;
const tonKm = distKm * 0.5;
const expectedDrain = (distKm * BATTERY_DRAIN_PER_KM) + (tonKm * BATTERY_DRAIN_PER_TON_KM);
assert(expectedDrain > 0 && expectedDrain < 5, `Expected drain computed properly (${expectedDrain.toFixed(3)}%)`);

// Test Charging Rate
const chargedPct = Math.min(100, 50 + (1.0 * BATTERY_CHARGING_SPEED_PCT_PER_SEC));
assert(chargedPct === 52.5, `Charging rate adds 2.5% per second (got ${chargedPct}%)`);

// -------------------------------------------------------------
// Test 8: Undo/Redo Commands for Add and Remove Fleet Vehicle
// -------------------------------------------------------------
console.log('\n--- Test 8: Undo/Redo Commands for Add and Remove Fleet Vehicle ---');

const store = useEditorStore.getState();

// Reset fleet to default initial
store.resetFleetBatteries();
const baseCount = useEditorStore.getState().fleet.length;

// Test Add Command
const newAgentPayload = createFleetAgent('AGV', useEditorStore.getState().fleet, depotPos);
const addCmd = createAddFleetAgentCommand(newAgentPayload);

addCmd.execute();
assert(useEditorStore.getState().fleet.length === baseCount + 1, `AddFleetAgentCommand increased count to ${baseCount + 1}`);

addCmd.undo();
assert(useEditorStore.getState().fleet.length === baseCount, `Undo restored fleet count to ${baseCount}`);

addCmd.execute(); // Redo is execute
assert(useEditorStore.getState().fleet.length === baseCount + 1, `Redo (execute) increased count back to ${baseCount + 1}`);

// Test Remove Command
const removeCmd = createRemoveFleetAgentCommand(newAgentPayload.id);

removeCmd.execute();
assert(useEditorStore.getState().fleet.length === baseCount, `RemoveFleetAgentCommand reduced count to ${baseCount}`);

removeCmd.undo();
assert(useEditorStore.getState().fleet.length === baseCount + 1, `Undo restore reinstated agent`);

removeCmd.execute(); // Redo is execute
assert(useEditorStore.getState().fleet.length === baseCount, `Redo re-removed agent`);

// -------------------------------------------------------------
// Test 9: Zod Schema Validation & Serialization
// -------------------------------------------------------------
console.log('\n--- Test 9: Zod Schema Validation & Serialization ---');

// Validate FleetAgentSchema
const agentValidation = FleetAgentSchema.safeParse(agentForklift);
assert(agentValidation.success, `FleetAgentSchema validation successful`);

// Validate StructuralElementSchema with charging_dock
const dockValidation = StructuralElementSchema.safeParse(mockChargingDocks[0]);
assert(dockValidation.success, `StructuralElementSchema with type 'charging_dock' validated successfully`);

// Validate WarehouseBlueprintSchema with Fleet and Charging Dock
const mockBlueprint = {
  id: 'blueprint-fleet-01',
  name: 'Fleet Logistics Hub',
  floorDimensions: { width: 50, height: 8, depth: 40 },
  racks: mockRacks,
  zones: [],
  structuralElements: mockChargingDocks,
  buildingLevels: [],
  verticalConnectors: [],
  pickingConfig: {
    pickList: mockPickList,
    depotPosition: { x: 5, z: 5 },
    selectedVehicleType: 'FORKLIFT',
    isManualSequence: false,
    customWaypoints: [],
    fleet: [agentForklift, agentAgv],
  },
};

const blueprintValidation = WarehouseBlueprintSchema.safeParse(mockBlueprint);
if (!blueprintValidation.success) {
  console.error('Blueprint validation error:', blueprintValidation.error.format());
}
assert(blueprintValidation.success, `WarehouseBlueprintSchema safeParse passed with fleet config and charging dock elements`);

// -------------------------------------------------------------
// Test 10: Multi-Level Roster Quotas & Floor-Matched VRP
// -------------------------------------------------------------
console.log('\n--- Test 10: Multi-Level Roster Quotas, Structural Restrictions & Floor-Matched VRP ---');

const mockLevels: BuildingLevel[] = [
  { id: 'level-1', name: 'Lantai 1 / Ground', elevationY: 0, height: 4.5, isDefault: true },
  { id: 'level-2', name: 'Lantai 2 / Mezzanine', elevationY: 4.5, height: 4.0, type: 'MEZZANINE' },
];

// 1. Multi-level initial fleet generation
const multiLevelFleet = createInitialFleet(depotPos, mockLevels);
assert(multiLevelFleet.length === 3, 'Multi-level initial fleet creates 3 vehicles');
assert(multiLevelFleet.filter((a) => a.levelId === 'level-1').length === 2, '2 vehicles assigned to Ground (level-1)');
assert(multiLevelFleet.filter((a) => a.levelId === 'level-2').length === 1, '1 vehicle assigned to Mezzanine (level-2)');
assert(multiLevelFleet.find((a) => a.levelId === 'level-2')?.position3D.y === 4.5, 'Mezzanine vehicle positioned at y = 4.5m');

// 2. Floor-Matched VRP Partitioning
const groundPick: PickItem = {
  ...mockPickList[0],
  binId: 'bin-ground-01',
  levelId: 'level-1',
  accessPoint3D: { x: 10, y: 0, z: 10 },
};
const mezzaninePick: PickItem = {
  ...mockPickList[1],
  binId: 'bin-mezzanine-01',
  levelId: 'level-2',
  accessPoint3D: { x: 10, y: 4.5, z: 10 },
};

const floorDistribution = partitionPickListToFleet([groundPick, mezzaninePick], multiLevelFleet);

const groundAgents = multiLevelFleet.filter((a) => a.levelId === 'level-1');
const mezzanineAgents = multiLevelFleet.filter((a) => a.levelId === 'level-2');

const groundAssigned = groundAgents.flatMap((a) => floorDistribution.get(a.id) || []);
const mezzanineAssigned = mezzanineAgents.flatMap((a) => floorDistribution.get(a.id) || []);

assert(groundAssigned.some((p) => p.binId === 'bin-ground-01'), 'Ground pick assigned to Ground vehicle');
assert(!groundAssigned.some((p) => p.binId === 'bin-mezzanine-01'), 'Mezzanine pick NOT assigned to Ground vehicle');
assert(mezzanineAssigned.some((p) => p.binId === 'bin-mezzanine-01'), 'Mezzanine pick assigned to Mezzanine vehicle');
assert(!mezzanineAssigned.some((p) => p.binId === 'bin-ground-01'), 'Ground pick NOT assigned to Mezzanine vehicle');

// 3. Multi-Level Traffic Radar Isolation
const groundAgentAtSpot: FleetAgent = {
  ...multiLevelFleet[0],
  position3D: { x: 15, y: 0, z: 15 },
  status: 'MOVING',
  isYielding: false,
};
const mezzanineAgentAtSpot: FleetAgent = {
  ...multiLevelFleet[2],
  position3D: { x: 15, y: 4.5, z: 15 }, // exact same x and z, but vertically on mezzanine
  status: 'MOVING',
  isYielding: false,
};

const verticalTraffic = evaluateFleetTraffic([groundAgentAtSpot, mezzanineAgentAtSpot]);
assert(verticalTraffic.alerts.length === 0, 'No traffic collision or yield between Ground and Mezzanine vehicles at same X/Z');

// 4. Store Capacity Clamps and Structural Restrictions via useEditorStore
useEditorStore.setState({
  buildingLevels: mockLevels,
  activeLevelId: 'level-2',
  fleet: [...multiLevelFleet],
});

// Try to add Forklift to Mezzanine (should be rejected by structural rule)
const prevCount = useEditorStore.getState().fleet.length;
useEditorStore.getState().addFleetVehicle('FORKLIFT', 'level-2');
assert(useEditorStore.getState().fleet.length === prevCount, 'Adding FORKLIFT to Mezzanine is rejected by structural restriction');

// Add AGV to Mezzanine (should succeed)
useEditorStore.getState().addFleetVehicle('AGV', 'level-2');
assert(useEditorStore.getState().fleet.length === prevCount + 1, 'Adding AGV to Mezzanine succeeds');

// Add more to reach MAX_FLEET_PER_LEVEL = 4 on Mezzanine
useEditorStore.getState().addFleetVehicle('CART', 'level-2'); // 3rd on mezzanine
useEditorStore.getState().addFleetVehicle('AGV', 'level-2');  // 4th on mezzanine (max reached)

const mezzanineFleetCount = useEditorStore.getState().fleet.filter((a) => a.levelId === 'level-2').length;
assert(mezzanineFleetCount === MAX_FLEET_PER_LEVEL, `Mezzanine fleet reached MAX_FLEET_PER_LEVEL (${MAX_FLEET_PER_LEVEL})`);

// Try to add 5th vehicle to Mezzanine (should be rejected)
useEditorStore.getState().addFleetVehicle('AGV', 'level-2');
const afterFifthCount = useEditorStore.getState().fleet.filter((a) => a.levelId === 'level-2').length;
assert(afterFifthCount === MAX_FLEET_PER_LEVEL, `Adding 5th vehicle to Mezzanine is blocked by MAX_FLEET_PER_LEVEL clamp`);

// -------------------------------------------------------------
// Test Results Summary
// -------------------------------------------------------------
console.log(`\n==================================================`);
console.log(`Phase 41 Fleet Simulation Smoke Tests: ${passedTests}/${totalTests} Passed`);
console.log(`==================================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 41 SMOKE TESTS PASSED SUCCESSFULLY!\n');
} else {
  console.error(`💥 ${totalTests - passedTests} tests failed!`);
  process.exit(1);
}
