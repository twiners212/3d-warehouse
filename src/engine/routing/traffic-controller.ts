// Fulfills Phase 41: Dynamic Traffic Controller & Proximity Radar Collision Avoidance
// Monitors multi-agent spatial radar, resolves intersection yields, regulates speeds, and manages battery energy lifecycle.

import type {
  FleetAgent,
  TrafficAlert,
  FleetSimulationMetrics,
  VehicleType,
} from '@/types/routing';
import {
  RADAR_DETECTION_RADIUS_METERS,
  RADAR_STOP_DISTANCE_METERS,
  BATTERY_DRAIN_PER_KM,
  BATTERY_DRAIN_PER_TON_KM,
  BATTERY_CHARGING_SPEED_PCT_PER_SEC,
} from '@/lib/constants/warehouse-defaults';

const VEHICLE_PRIORITY_WEIGHT: Record<VehicleType, number> = {
  FORKLIFT: 3, // Heavy tonnage, long braking distance
  AGV: 2, // Autonomous mobile robot
  CART: 1, // Agile manual picker cart
};

let alertSeqCounter = 0;

/**
 * Calculates 2D planar floor distance between two agents on the same building level
 */
export function calculateFloorDistance(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number }
): number {
  // If vertically on different floors (> 1.5m), no direct floor collision
  if (Math.abs(posA.y - posB.y) > 1.5) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(posA.x - posB.x, posA.z - posB.z);
}

/**
 * Evaluates radar proximity and priority yielding across all active fleet vehicles.
 */
export function evaluateFleetTraffic(
  fleet: FleetAgent[],
  deltaSeconds: number = 0.05
): {
  updatedFleet: FleetAgent[];
  alerts: TrafficAlert[];
} {
  const alerts: TrafficAlert[] = [];
  const yieldingAgentIds = new Map<string, { higherAgentName: string; dist: number }>();

  // Compare every pair of agents (A, B)
  for (let i = 0; i < fleet.length; i++) {
    for (let j = i + 1; j < fleet.length; j++) {
      const agentA = fleet[i];
      const agentB = fleet[j];

      // Only check collision if both agents are navigating
      const isNavigatingA = agentA.status === 'MOVING' || agentA.status === 'YIELDING';
      const isNavigatingB = agentB.status === 'MOVING' || agentB.status === 'YIELDING';

      if (!isNavigatingA && !isNavigatingB) continue;

      // Skip collision checks between agents on different building floors
      if (agentA.levelId && agentB.levelId && agentA.levelId !== agentB.levelId) continue;

      const dist = calculateFloorDistance(agentA.position3D, agentB.position3D);

      if (dist < RADAR_DETECTION_RADIUS_METERS) {
        const isStationaryA = !isNavigatingA;
        const isStationaryB = !isNavigatingB;

        let higherAgent: FleetAgent;
        let lowerAgent: FleetAgent;

        if (isStationaryA && !isStationaryB) {
          // A is parked/stationary: moving agent B must yield to avoid collision
          higherAgent = agentA;
          lowerAgent = agentB;
        } else if (isStationaryB && !isStationaryA) {
          // B is parked/stationary: moving agent A must yield to avoid collision
          higherAgent = agentB;
          lowerAgent = agentA;
        } else {
          // Both are navigating: resolve priority by vehicle type weight
          const weightA = VEHICLE_PRIORITY_WEIGHT[agentA.vehicleType];
          const weightB = VEHICLE_PRIORITY_WEIGHT[agentB.vehicleType];

          if (weightA > weightB) {
            higherAgent = agentA;
            lowerAgent = agentB;
          } else if (weightB > weightA) {
            higherAgent = agentB;
            lowerAgent = agentA;
          } else {
            // Same vehicle type: right of way given to higher route progress
            if (agentA.progress >= agentB.progress) {
              higherAgent = agentA;
              lowerAgent = agentB;
            } else {
              higherAgent = agentB;
              lowerAgent = agentA;
            }
          }
        }

        yieldingAgentIds.set(lowerAgent.id, {
          higherAgentName: higherAgent.name,
          dist,
        });

        // Only generate a new alert when the agent transitions into yielding (avoids 60fps alert spam)
        if (!lowerAgent.isYielding) {
          alerts.push({
            id: `traffic-alert-${lowerAgent.id}-${higherAgent.id}-${Date.now()}-${++alertSeqCounter}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'INTERSECTION_YIELD',
            vehicleIdA: lowerAgent.id,
            vehicleIdB: higherAgent.id,
            position: lowerAgent.position3D,
            timestamp: Date.now(),
            message: `${lowerAgent.name} mendahulukan jalan untuk ${higherAgent.name} (Jarak: ${dist.toFixed(1)}m)`,
          });
        }
      }
    }
  }

  // Update fleet statuses, speeds, and battery simulation
  const updatedFleet: FleetAgent[] = fleet.map((agent) => {
    const yieldInfo = yieldingAgentIds.get(agent.id);

    let nextStatus = agent.status;
    let nextSpeed = agent.currentSpeedMps;
    let isYielding = false;
    let yieldReason: string | undefined = undefined;

    if (yieldInfo) {
      isYielding = true;
      yieldReason = `Mendahulukan ${yieldInfo.higherAgentName}`;
      nextStatus = 'YIELDING';
      // If dangerously close (< stop distance), full brake (speed 0); otherwise slow crawl
      nextSpeed = yieldInfo.dist < RADAR_STOP_DISTANCE_METERS ? 0 : 0.4;
    } else if (agent.status === 'YIELDING') {
      // Clear yield state
      isYielding = false;
      yieldReason = undefined;
      nextStatus = agent.routeResult && agent.progress < 1.0 ? 'MOVING' : 'IDLE';
    }

    // Battery energy lifecycle simulation
    let nextBattery = agent.batteryLevel;

    if (nextStatus === 'MOVING' && nextSpeed > 0) {
      const distanceStepKm = (nextSpeed * deltaSeconds) / 1000;
      const totalPayloadTon =
        (agent.assignedPickList.reduce((acc, p) => acc + p.weightKg, 0)) / 1000;
      const drain =
        distanceStepKm * (BATTERY_DRAIN_PER_KM + totalPayloadTon * BATTERY_DRAIN_PER_TON_KM);
      nextBattery = Math.max(0, nextBattery - drain);

      if (nextBattery < 20 && agent.batteryLevel >= 20) {
        alerts.push({
          id: `low-battery-${agent.id}-${Date.now()}`,
          type: 'LOW_BATTERY',
          vehicleIdA: agent.id,
          position: agent.position3D,
          timestamp: Date.now(),
          message: `Daya baterai ${agent.name} rendah (${nextBattery.toFixed(0)}%). Disarankan menuju Charging Dock.`,
        });
      }
    } else if (nextStatus === 'CHARGING') {
      const rechargeStep = BATTERY_CHARGING_SPEED_PCT_PER_SEC * deltaSeconds;
      nextBattery = Math.min(100, nextBattery + rechargeStep);
      if (nextBattery >= 100) {
        nextStatus = 'IDLE';
      }
    }

    return {
      ...agent,
      status: nextStatus,
      currentSpeedMps: nextSpeed,
      batteryLevel: nextBattery,
      isYielding,
      yieldReason,
    };
  });

  return { updatedFleet, alerts };
}

/**
 * Calculates aggregate telemetric metrics for the entire fleet
 */
export function computeFleetMetrics(fleet: FleetAgent[]): FleetSimulationMetrics {
  const totalAgents = fleet.length;
  let activeAgents = 0;
  let yieldingAgents = 0;
  let chargingAgents = 0;
  let totalBattery = 0;
  let totalOrdersCompleted = 0;
  let totalOrdersAssigned = 0;
  let totalDistanceTraveledMeters = 0;

  for (const agent of fleet) {
    totalBattery += agent.batteryLevel;
    totalOrdersAssigned += agent.assignedPickList.length;

    if (agent.status === 'MOVING') activeAgents++;
    if (agent.status === 'YIELDING') yieldingAgents++;
    if (agent.status === 'CHARGING') chargingAgents++;

    if (agent.routeResult) {
      const completedCount = Math.floor(agent.progress * agent.assignedPickList.length);
      totalOrdersCompleted += completedCount;
      totalDistanceTraveledMeters += agent.progress * agent.routeResult.metrics.totalDistanceMeters;
    }
  }

  return {
    totalAgents,
    activeAgents,
    yieldingAgents,
    chargingAgents,
    averageBatteryPct: totalAgents > 0 ? totalBattery / totalAgents : 0,
    totalOrdersCompleted,
    totalOrdersAssigned,
    totalDistanceTraveledMeters: Math.round(totalDistanceTraveledMeters),
  };
}
