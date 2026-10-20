// Fulfills Phase 41: Multi-Agent Fleet Dispatcher & VRP Clustering Engine
// Partitions pick lists among fleet vehicles, calculates individual A* routes, and manages charging dock allocation.

import type { WarehouseBounds } from '@/types/spatial';
import type {
  RackEntity,
  StructuralElement,
  BuildingLevel,
  VerticalConnector,
} from '@/types/layout';
import type {
  FleetAgent,
  PickItem,
  VehicleType,
  CustomWaypoint,
} from '@/types/routing';
import { VEHICLE_CONFIGS } from '@/types/routing';
import { calculatePickingRoute } from './routing-engine';
import { FLEET_PALETTE_COLORS } from '@/lib/constants/warehouse-defaults';

/**
 * Creates default 3-vehicle fleet configuration (1 Forklift + 2 AGV Robots)
 * Multi-floor aware: maps vehicles to their respective building levels and elevations.
 */
export function createInitialFleet(
  depotPos?: { x: number; z: number },
  buildingLevels?: BuildingLevel[]
): FleetAgent[] {
  const baseX = depotPos?.x ?? 3.0;
  const baseZ = depotPos?.z ?? 3.0;

  const groundLevel =
    buildingLevels?.find((l) => l.elevationY === 0 || l.id === 'level-1') ||
    buildingLevels?.[0] || { id: 'level-1', name: 'Lantai 1 / Ground', elevationY: 0 };

  const mezzanineLevel = buildingLevels?.find((l) => l.id !== groundLevel.id);

  const fleet: FleetAgent[] = [
    {
      id: 'agent-forklift-01',
      name: 'Forklift Alpha',
      vehicleType: 'FORKLIFT',
      color: FLEET_PALETTE_COLORS[0], // Amber
      batteryLevel: 100,
      status: 'IDLE',
      currentSpeedMps: 0,
      assignedPickList: [],
      routeResult: null,
      progress: 0,
      currentStopIndex: 0,
      position3D: { x: baseX, y: groundLevel.elevationY ?? 0, z: baseZ },
      headingRad: 0,
      levelId: groundLevel.id,
      levelName: groundLevel.name,
    },
    {
      id: 'agent-agv-01',
      name: 'AGV Echo 01',
      vehicleType: 'AGV',
      color: FLEET_PALETTE_COLORS[1], // Cyan
      batteryLevel: 100,
      status: 'IDLE',
      currentSpeedMps: 0,
      assignedPickList: [],
      routeResult: null,
      progress: 0,
      currentStopIndex: 0,
      position3D: { x: baseX + 1.6, y: groundLevel.elevationY ?? 0, z: baseZ },
      headingRad: 0,
      levelId: groundLevel.id,
      levelName: groundLevel.name,
    },
  ];

  if (mezzanineLevel) {
    fleet.push({
      id: 'agent-agv-02',
      name: 'AGV Echo 02',
      vehicleType: 'AGV',
      color: FLEET_PALETTE_COLORS[2], // Purple
      batteryLevel: 100,
      status: 'IDLE',
      currentSpeedMps: 0,
      assignedPickList: [],
      routeResult: null,
      progress: 0,
      currentStopIndex: 0,
      position3D: { x: baseX, y: mezzanineLevel.elevationY, z: baseZ },
      headingRad: 0,
      levelId: mezzanineLevel.id,
      levelName: mezzanineLevel.name,
    });
  } else {
    fleet.push({
      id: 'agent-agv-02',
      name: 'AGV Echo 02',
      vehicleType: 'AGV',
      color: FLEET_PALETTE_COLORS[2], // Purple
      batteryLevel: 100,
      status: 'IDLE',
      currentSpeedMps: 0,
      assignedPickList: [],
      routeResult: null,
      progress: 0,
      currentStopIndex: 0,
      position3D: { x: baseX + 3.2, y: groundLevel.elevationY ?? 0, z: baseZ },
      headingRad: 0,
      levelId: groundLevel.id,
      levelName: groundLevel.name,
    });
  }

  return fleet;
}

/**
 * Generates a new unique fleet agent of a given vehicle type assigned to a specific level
 */
export function createFleetAgent(
  type: VehicleType,
  existingFleet: FleetAgent[],
  depotPos?: { x: number; z: number },
  targetLevel?: { id: string; name?: string; elevationY?: number }
): FleetAgent {
  const levelId = targetLevel?.id || 'level-1';
  const levelName = targetLevel?.name;
  const elevationY = targetLevel?.elevationY ?? 0;

  const countOfType = existingFleet.filter((a) => a.vehicleType === type && (a.levelId || 'level-1') === levelId).length + 1;
  const colorIndex = existingFleet.length % FLEET_PALETTE_COLORS.length;
  const baseX = depotPos?.x ?? 3.0;
  const baseZ = depotPos?.z ?? 3.0;
  const sameLevelCount = existingFleet.filter((a) => (a.levelId || 'level-1') === levelId).length;
  const spacingOffset = sameLevelCount * 1.5;

  const typeLabels: Record<VehicleType, string> = {
    FORKLIFT: 'Forklift',
    AGV: 'AGV Echo',
    CART: 'Cart Picker',
  };

  return {
    id: `agent-${type.toLowerCase()}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    name: `${typeLabels[type]} ${String(countOfType).padStart(2, '0')}`,
    vehicleType: type,
    color: FLEET_PALETTE_COLORS[colorIndex],
    batteryLevel: 100,
    status: 'IDLE',
    currentSpeedMps: 0,
    assignedPickList: [],
    routeResult: null,
    progress: 0,
    currentStopIndex: 0,
    position3D: { x: baseX + spacingOffset, y: elevationY, z: baseZ },
    headingRad: 0,
    levelId,
    levelName,
  };
}

/**
 * Partitions a master pick list among active fleet agents using Floor-Matched VRP
 * (Each floor's picks are only assigned to vehicles operating on that floor).
 */
export function partitionPickListToFleet(
  pickList: PickItem[],
  fleet: FleetAgent[]
): Map<string, PickItem[]> {
  const distribution = new Map<string, PickItem[]>();
  fleet.forEach((agent) => distribution.set(agent.id, []));

  if (pickList.length === 0 || fleet.length === 0) {
    return distribution;
  }

  // 1. Group picks by levelId
  const picksByLevel = new Map<string, PickItem[]>();
  for (const item of pickList) {
    const levelId = item.levelId || 'level-1';
    if (!picksByLevel.has(levelId)) {
      picksByLevel.set(levelId, []);
    }
    picksByLevel.get(levelId)!.push(item);
  }

  // 2. Group fleet by levelId
  const fleetByLevel = new Map<string, FleetAgent[]>();
  for (const agent of fleet) {
    const levelId = agent.levelId || 'level-1';
    if (!fleetByLevel.has(levelId)) {
      fleetByLevel.set(levelId, []);
    }
    fleetByLevel.get(levelId)!.push(agent);
  }

  // 3. For each level, distribute items to vehicles on that floor
  for (const [levelId, floorPicks] of picksByLevel.entries()) {
    let floorFleet = fleetByLevel.get(levelId) || [];

    // Fallback: If no fleet exists on this specific floor, but total fleet has only default level
    // (e.g. tests or legacy scenes where levelId wasn't populated), fall back to all fleet
    if (floorFleet.length === 0) {
      const allLevels = new Set(fleet.map((a) => a.levelId || 'level-1'));
      if (allLevels.size === 1 && allLevels.has('level-1')) {
        floorFleet = fleet;
      }
    }

    if (floorFleet.length === 0) {
      // No fleet available on this floor; items remain unassigned
      continue;
    }

    // Single agent on this floor gets all items on this floor
    if (floorFleet.length === 1) {
      const current = distribution.get(floorFleet[0].id) || [];
      distribution.set(floorFleet[0].id, [...current, ...floorPicks]);
      continue;
    }

    // Find heavy vehicles (Forklifts) vs lighter/faster vehicles (AGVs/Carts) on this floor
    const forklifts = floorFleet.filter((a) => a.vehicleType === 'FORKLIFT');
    const agvsAndCarts = floorFleet.filter((a) => a.vehicleType !== 'FORKLIFT');
    const unassigned: PickItem[] = [];

    // 3a. Assign heavy items (> 20kg) to Forklift if available on this floor
    for (const item of floorPicks) {
      if (item.weightKg >= 20.0 && forklifts.length > 0) {
        let bestForklift = forklifts[0];
        let minWeight = Number.POSITIVE_INFINITY;
        for (const fk of forklifts) {
          const currentList = distribution.get(fk.id) || [];
          const currentWeight = currentList.reduce((acc, p) => acc + p.weightKg, 0);
          if (currentWeight < minWeight) {
            minWeight = currentWeight;
            bestForklift = fk;
          }
        }
        distribution.get(bestForklift.id)!.push(item);
      } else {
        unassigned.push(item);
      }
    }

    // 3b. Spatial sector clustering on remaining items on this floor
    unassigned.sort((a, b) => {
      const diffX = a.accessPoint3D.x - b.accessPoint3D.x;
      if (Math.abs(diffX) > 2.0) return diffX;
      return a.accessPoint3D.z - b.accessPoint3D.z;
    });

    const pool = agvsAndCarts.length > 0 ? agvsAndCarts : floorFleet;
    const poolSize = pool.length;

    for (let i = 0; i < unassigned.length; i++) {
      const clusterIndex = Math.floor((i / unassigned.length) * poolSize);
      const agent = pool[Math.min(clusterIndex, poolSize - 1)];
      distribution.get(agent.id)!.push(unassigned[i]);
    }
  }

  return distribution;
}

/**
 * Calculates individual A* routes for every fleet agent based on their assigned pick list
 */
export function dispatchFleetRoutes(
  fleet: FleetAgent[],
  pickList: PickItem[],
  bounds: WarehouseBounds,
  racks: RackEntity[],
  structuralElements: StructuralElement[],
  depotPos: { x: number; z: number },
  buildingLevels: BuildingLevel[] = [],
  verticalConnectors: VerticalConnector[] = [],
  customWaypoints: CustomWaypoint[] = []
): FleetAgent[] {
  const partitions = partitionPickListToFleet(pickList, fleet);

  return fleet.map((agent, index) => {
    const assigned = partitions.get(agent.id) || [];
    const agentLevel = buildingLevels.find((l) => l.id === agent.levelId);
    const elevationY = agentLevel ? agentLevel.elevationY : (agent.position3D.y ?? 0);
    const agentDepot = {
      x: depotPos.x + (index % 3) * 1.5,
      z: depotPos.z + Math.floor(index / 3) * 1.5,
    };

    if (assigned.length === 0) {
      return {
        ...agent,
        assignedPickList: [],
        routeResult: null,
        status: 'IDLE',
        progress: 0,
        currentStopIndex: 0,
        position3D: { x: agentDepot.x, y: elevationY, z: agentDepot.z },
      };
    }

    const routeResult = calculatePickingRoute({
      bounds,
      racks,
      structuralElements,
      buildingLevels,
      verticalConnectors,
      pickItems: assigned,
      depotPos: agentDepot,
      vehicleType: agent.vehicleType,
      isManualSequence: false,
      customWaypoints,
    });

    const startPos =
      routeResult.polylinePoints.length > 0
        ? {
            x: routeResult.polylinePoints[0].x,
            y: routeResult.polylinePoints[0].y ?? elevationY,
            z: routeResult.polylinePoints[0].z,
          }
        : { x: agentDepot.x, y: elevationY, z: agentDepot.z };

    return {
      ...agent,
      assignedPickList: assigned,
      routeResult,
      status: 'MOVING',
      progress: 0,
      currentStopIndex: 0,
      currentSpeedMps: VEHICLE_CONFIGS[agent.vehicleType].speedMps,
      position3D: startPos,
      isYielding: false,
      yieldReason: undefined,
    };
  });
}

/**
 * Finds the nearest physical Charging Dock structural element to an agent
 */
export function findNearestChargingDock(
  agentPos: { x: number; y: number; z: number },
  structuralElements: StructuralElement[]
): StructuralElement | null {
  const docks = structuralElements.filter((s) => s.type === 'charging_dock');
  if (docks.length === 0) return null;

  let bestDock: StructuralElement | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const dock of docks) {
    const dist = Math.hypot(dock.position.x - agentPos.x, dock.position.z - agentPos.z);
    if (dist < minDistance) {
      minDistance = dist;
      bestDock = dock;
    }
  }

  return bestDock;
}
