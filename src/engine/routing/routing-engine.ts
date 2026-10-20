// Fulfills Phase 36: Unified Picking Routing Engine & Logistics Simulation Facade
// Coordinates Walkability Grid, TSP 2-Opt sequencing, A* segment generation, and telemetry metrics.

import type { WarehouseBounds } from '@/types/spatial';
import type { BuildingLevel, RackEntity, StructuralElement, VerticalConnector, VerticalConnectorType, WarehouseZone } from '@/types/layout';
import type { PickItem, RouteWaypoint, PickingRouteResult, VehicleType, CustomWaypoint } from '@/types/routing';
import { VEHICLE_CONFIGS } from '@/types/routing';
import { createWalkabilityGrid, calculateBayAccessPoint } from './grid-map';
import { findPathAStar } from './astar-pathfinder';
import { optimizePickSequence } from './tsp-optimizer';
import { calculateLocalToWorld } from '@/engine/spatial/spatial-math';
import { VERTICAL_TRANSIT_PARAMS } from '@/lib/constants/warehouse-defaults';

/** Sample industrial cargo goods catalog for realistic picking orders */
const PICK_CATALOG = [
  { sku: 'ELC-4092-MB', name: 'Industrial Micro-Inverter 5kW', weightKg: 14.5 },
  { sku: 'HVY-9921-PL', name: 'Alloy Hydraulic Pump Unit', weightKg: 28.0 },
  { sku: 'MED-1044-BX', name: 'Diagnostic Sensor Module Pack', weightKg: 3.2 },
  { sku: 'FOD-3391-CT', name: 'Organic Cold Brew Extract Box', weightKg: 12.0 },
  { sku: 'AUT-7712-GB', name: 'Automotive Disc Brake Caliper Set', weightKg: 18.5 },
  { sku: 'ROB-5520-SV', name: 'Servo Motor High-Torque 24V', weightKg: 6.8 },
  { sku: 'CON-8841-WR', name: 'High-Tensile Wire Spool 50m', weightKg: 22.0 },
  { sku: 'PKG-2104-TP', name: 'Thermal Barrier Sealant Drums', weightKg: 15.0 },
  { sku: 'RET-6610-TX', name: 'Precision Caliper Tooling Kit', weightKg: 4.5 },
  { sku: 'MAT-3301-ST', name: 'Structural Fastener Keg M16', weightKg: 25.0 },
];

/** Find best vertical connector connecting two floor elevations with equipment constraints */
export function findBestConnector(
  startPos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  vehicleType: VehicleType,
  verticalConnectors: VerticalConnector[],
  startLevelId?: string,
  targetLevelId?: string
): VerticalConnector | null {
  const allowedTypes: VerticalConnectorType[] =
    vehicleType === 'CART'
      ? ['cargo_lift', 'lift', 'ramp', 'stairs']
      : ['cargo_lift', 'lift', 'ramp']; // Forklift and AGV cannot use stairs

  const candidates = verticalConnectors.filter((c) => {
    if (!allowedTypes.includes(c.type)) return false;
    if (startLevelId && targetLevelId && startLevelId !== targetLevelId) {
      const connects =
        (c.fromLevelId === startLevelId && c.toLevelId === targetLevelId) ||
        (c.fromLevelId === targetLevelId && c.toLevelId === startLevelId);
      if (!connects) return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  let bestConnector: VerticalConnector | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const c of candidates) {
    const d1 = Math.hypot(c.position.x - startPos.x, c.position.z - startPos.z);
    const d2 = Math.hypot(targetPos.x - c.position.x, targetPos.z - c.position.z);
    if (d1 + d2 < bestDist) {
      bestDist = d1 + d2;
      bestConnector = c;
    }
  }

  return bestConnector;
}

/** Detects optimal starting depot location from warehouse zones or dock doors */
export function detectDefaultDepot(
  bounds: WarehouseBounds,
  zones: WarehouseZone[] = [],
  structuralElements: StructuralElement[] = []
): { x: number; z: number } {
  // 1. Check for shipping or staging zone
  const preferredZone = zones.find(
    (z) => z.type === 'shipping' || z.type === 'picking' || z.type === 'receiving'
  );
  if (preferredZone) {
    return {
      x: preferredZone.position.x,
      z: preferredZone.position.z,
    };
  }

  // 2. Check for overhead dock door
  const dockDoor = structuralElements.find((s) => s.type === 'dock_door');
  if (dockDoor) {
    return {
      x: dockDoor.position.x,
      z: dockDoor.position.z,
    };
  }

  // 3. Fallback to safety margin near origin
  return {
    x: Math.min(3.0, bounds.width / 2),
    z: Math.min(3.0, bounds.depth / 2),
  };
}

/** Generates a sample pick order list of N items from existing warehouse racks */
export function generateSamplePickOrder(
  racks: RackEntity[],
  bounds: WarehouseBounds,
  structuralElements: StructuralElement[] = [],
  count: number = 8
): PickItem[] {
  if (racks.length === 0) return [];

  const grid = createWalkabilityGrid(bounds, racks, structuralElements);
  const candidates: Array<{ rack: RackEntity; bay: number; level: number; binId: string }> = [];

  for (const rack of racks) {
    if (!rack.bins || rack.bins.length === 0) continue;
    for (const bin of rack.bins) {
      candidates.push({
        rack,
        bay: bin.bayIndex,
        level: bin.levelIndex,
        binId: bin.id,
      });
    }
  }

  if (candidates.length === 0) return [];

  // Shuffle and pick `count` items
  const shuffled = [...candidates].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  const items: PickItem[] = selected.map((item, idx) => {
    const catalogItem = PICK_CATALOG[idx % PICK_CATALOG.length];
    const rack = item.rack;
    const bin = rack.bins.find((b) => b.id === item.binId);

    // 3D position of bin
    const binPos3D = bin
      ? calculateLocalToWorld(rack.position, rack.rotationY, bin.relativePosition)
      : { x: rack.position.x, y: (rack.position.y || 0) + 1.5, z: rack.position.z };

    // Walkable floor access point in aisle (at rack's floor elevation)
    const accessPoint = calculateBayAccessPoint(rack, item.bay, grid);

    return {
      binId: item.binId,
      rackId: rack.id,
      rackName: rack.name,
      bayIndex: item.bay,
      levelIndex: item.level,
      position3D: binPos3D,
      accessPoint3D: { x: accessPoint.x, y: rack.position.y || 0, z: accessPoint.z },
      sku: bin?.skuData?.sku || catalogItem.sku,
      productName: bin?.skuData?.productName || catalogItem.name,
      quantity: bin?.skuData?.quantity || Math.floor(Math.random() * 8) + 1,
      weightKg: bin?.skuData?.weightKg || catalogItem.weightKg,
      isPicked: false,
      levelId: rack.levelId || 'level-1',
    };
  });

  return items;
}

export interface NearestPolylineSegmentResult {
  segmentIndex: number;
  projectedPoint: { x: number; y: number; z: number };
  distance: number;
  insertAfterStopIndex: number;
  prevWaypointId?: string;
  nextWaypointId?: string;
}

/**
 * Finds the nearest polyline segment to a given 2D (x, z) coordinate.
 * Accurately projects the query coordinate onto each segment [P_i, P_{i+1}]
 * and returns the closest segment along with exact leg & waypoint metadata.
 */
export function findNearestPolylineSegment(
  polylinePoints: Array<{
    x: number;
    y?: number;
    z: number;
    insertAfterStopIndex?: number;
    prevWaypointId?: string;
    nextWaypointId?: string;
  }>,
  clickX: number,
  clickZ: number
): NearestPolylineSegmentResult | null {
  if (!polylinePoints || polylinePoints.length < 2) return null;

  let bestSegmentIndex = -1;
  let minDistance = Infinity;
  let bestProj = { x: clickX, y: 0, z: clickZ };
  let bestStopIdx = 0;
  let bestPrevWpId: string | undefined = undefined;
  let bestNextWpId: string | undefined = undefined;

  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const p1 = polylinePoints[i];
    const p2 = polylinePoints[i + 1];

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;

    let t = 0;
    if (lenSq > 1e-6) {
      t = ((clickX - p1.x) * dx + (clickZ - p1.z) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const y1 = p1.y || 0;
    const y2 = p2.y || 0;
    const projY = y1 + t * (y2 - y1);

    const dist = Math.hypot(clickX - projX, clickZ - projZ);

    if (dist < minDistance) {
      minDistance = dist;
      bestSegmentIndex = i;
      bestProj = { x: projX, y: projY, z: projZ };
      const preferP2 = t > 0.5;
      bestStopIdx = preferP2
        ? (p2.insertAfterStopIndex ?? p1.insertAfterStopIndex ?? 0)
        : (p1.insertAfterStopIndex ?? p2.insertAfterStopIndex ?? 0);
      bestPrevWpId = preferP2
        ? (p2.prevWaypointId ?? p1.prevWaypointId)
        : (p1.prevWaypointId ?? p2.prevWaypointId);
      bestNextWpId = preferP2
        ? (p2.nextWaypointId ?? p1.nextWaypointId)
        : (p1.nextWaypointId ?? p2.nextWaypointId);
    }
  }

  if (bestSegmentIndex === -1) return null;

  return {
    segmentIndex: bestSegmentIndex,
    projectedPoint: bestProj,
    distance: minDistance,
    insertAfterStopIndex: bestStopIdx,
    prevWaypointId: bestPrevWpId,
    nextWaypointId: bestNextWpId,
  };
}

/**
 * Calculates complete picking route with A* pathfinding and TSP 2-Opt optimization.
 * Computes comparative metrics against an unoptimized route across multi-tier building levels.
 */
export function calculatePickingRoute(params: {
  bounds: WarehouseBounds;
  racks: RackEntity[];
  structuralElements?: StructuralElement[];
  buildingLevels?: BuildingLevel[];
  verticalConnectors?: VerticalConnector[];
  pickItems: PickItem[];
  depotPos: { x: number; z: number };
  vehicleType: VehicleType;
  isManualSequence?: boolean;
  customWaypoints?: CustomWaypoint[];
}): PickingRouteResult {
  const {
    bounds,
    racks,
    structuralElements = [],
    verticalConnectors = [],
    pickItems,
    depotPos,
    vehicleType,
    isManualSequence = false,
    customWaypoints = [],
  } = params;

  if (pickItems.length === 0) {
    return {
      orderedPicks: [],
      waypoints: [],
      polylinePoints: [{
        x: depotPos.x,
        y: 0,
        z: depotPos.z,
        insertAfterStopIndex: 0,
        prevWaypointId: 'depot-start',
        nextWaypointId: 'depot-end',
      }],
      metrics: {
        totalDistanceMeters: 0,
        unoptimizedDistanceMeters: 0,
        distanceSavedPercent: 0,
        estimatedDurationSeconds: 0,
        unoptimizedDurationSeconds: 0,
        timeSavedPercent: 0,
        totalWeightKg: 0,
        itemCount: 0,
      },
      isManualSequence,
    };
  }

  const grid = createWalkabilityGrid(bounds, racks, structuralElements);
  const vehicleConfig = VEHICLE_CONFIGS[vehicleType];

  // 1. Determine stop sequence (Honor manual sequence lock or run TSP 2-Opt)
  let orderedPicks: PickItem[] = [];
  if (isManualSequence) {
    orderedPicks = [...pickItems];
  } else {
    const { optimizedPicks } = optimizePickSequence(depotPos, pickItems);
    orderedPicks = optimizedPicks;
  }

  // 2. Generate detailed A* path segments connecting Depot -> Waypoints -> Stops -> Depot
  const fullPolyline: Array<{
    x: number;
    y: number;
    z: number;
    insertAfterStopIndex?: number;
    prevWaypointId?: string;
    nextWaypointId?: string;
  }> = [];
  const waypoints: RouteWaypoint[] = [];

  waypoints.push({
    id: 'depot-start',
    x: depotPos.x,
    y: 0,
    z: depotPos.z,
    type: 'DEPOT_START',
  });
  let lastWaypointId = 'depot-start';

  let currentPos: { x: number; y: number; z: number } = {
    x: depotPos.x,
    y: 0,
    z: depotPos.z,
  };
  let totalDistance = 0;
  let verticalTransitSeconds = 0;

  const appendSimple2DSegment = (
    fromPos: { x: number; y: number; z: number },
    toPos: { x: number; y: number; z: number },
    elevation: number,
    insertAfterStopIndex?: number,
    prevWaypointId?: string,
    nextWaypointId?: string
  ) => {
    const segment = findPathAStar(grid, fromPos, toPos, true);
    totalDistance += segment.distance;

    for (let p = 0; p < segment.points.length; p++) {
      const pt = {
        x: segment.points[p].x,
        y: elevation,
        z: segment.points[p].z,
        insertAfterStopIndex,
        prevWaypointId,
        nextWaypointId,
      };
      if (
        fullPolyline.length === 0 ||
        Math.hypot(
          fullPolyline[fullPolyline.length - 1].x - pt.x,
          fullPolyline[fullPolyline.length - 1].y - pt.y,
          fullPolyline[fullPolyline.length - 1].z - pt.z
        ) > 0.05
      ) {
        fullPolyline.push(pt);
      }
    }
  };

  const appendSegment = (
    targetPos: { x: number; y: number; z: number },
    insertAfterStopIndex: number,
    prevWpId: string,
    nextWpId: string
  ) => {
    const heightDiff = Math.abs(currentPos.y - targetPos.y);

    if (heightDiff > 0.5 && verticalConnectors.length > 0) {
      // Traverse via vertical connector
      const connector = findBestConnector(currentPos, targetPos, vehicleType, verticalConnectors);

      if (connector) {
        const fromY = currentPos.y;
        const toY = targetPos.y;
        const connectorBottom = { x: connector.position.x, y: Math.min(fromY, toY), z: connector.position.z };
        const connectorTop = { x: connector.position.x, y: Math.max(fromY, toY), z: connector.position.z };

        if (fromY < toY) {
          // Going Up: bottom floor to connector -> vertical transit -> top floor to target
          appendSimple2DSegment(currentPos, connectorBottom, fromY, insertAfterStopIndex, prevWpId, nextWpId);

          // Vertical transit
          const dy = toY - fromY;
          totalDistance += dy;

          if (connector.type === 'cargo_lift' || connector.type === 'lift') {
            verticalTransitSeconds +=
              VERTICAL_TRANSIT_PARAMS.LIFT_DOOR_DELAY_SEC +
              dy / VERTICAL_TRANSIT_PARAMS.LIFT_SPEED_MPS;
            fullPolyline.push({ ...connectorTop, insertAfterStopIndex, prevWaypointId: prevWpId, nextWaypointId: nextWpId });
          } else if (connector.type === 'ramp') {
            const slopeDist = Math.hypot(connector.dimensions.depth, dy);
            verticalTransitSeconds +=
              (slopeDist / vehicleConfig.speedMps) *
              (1 / VERTICAL_TRANSIT_PARAMS.RAMP_SPEED_MULTIPLIER);
            // Intermediate slope points
            fullPolyline.push({
              x: connector.position.x,
              y: fromY + dy * 0.5,
              z: connector.position.z,
              insertAfterStopIndex,
              prevWaypointId: prevWpId,
              nextWaypointId: nextWpId,
            });
            fullPolyline.push({ ...connectorTop, insertAfterStopIndex, prevWaypointId: prevWpId, nextWaypointId: nextWpId });
          } else {
            verticalTransitSeconds += dy / VERTICAL_TRANSIT_PARAMS.STAIRS_SPEED_MPS;
            fullPolyline.push({ ...connectorTop, insertAfterStopIndex, prevWaypointId: prevWpId, nextWaypointId: nextWpId });
          }

          appendSimple2DSegment(connectorTop, targetPos, toY, insertAfterStopIndex, prevWpId, nextWpId);
        } else {
          // Going Down: top floor to connector -> vertical transit -> bottom floor to target
          appendSimple2DSegment(currentPos, connectorTop, fromY, insertAfterStopIndex, prevWpId, nextWpId);

          const dy = fromY - toY;
          totalDistance += dy;

          if (connector.type === 'cargo_lift' || connector.type === 'lift') {
            verticalTransitSeconds +=
              VERTICAL_TRANSIT_PARAMS.LIFT_DOOR_DELAY_SEC +
              dy / VERTICAL_TRANSIT_PARAMS.LIFT_SPEED_MPS;
            fullPolyline.push({ ...connectorBottom, insertAfterStopIndex, prevWaypointId: prevWpId, nextWaypointId: nextWpId });
          } else if (connector.type === 'ramp') {
            const slopeDist = Math.hypot(connector.dimensions.depth, dy);
            verticalTransitSeconds +=
              (slopeDist / vehicleConfig.speedMps) *
              (1 / VERTICAL_TRANSIT_PARAMS.RAMP_SPEED_MULTIPLIER);
            fullPolyline.push({
              x: connector.position.x,
              y: fromY - dy * 0.5,
              z: connector.position.z,
              insertAfterStopIndex,
              prevWaypointId: prevWpId,
              nextWaypointId: nextWpId,
            });
            fullPolyline.push({ ...connectorBottom, insertAfterStopIndex, prevWaypointId: prevWpId, nextWaypointId: nextWpId });
          } else {
            verticalTransitSeconds += dy / VERTICAL_TRANSIT_PARAMS.STAIRS_SPEED_MPS;
            fullPolyline.push({ ...connectorBottom, insertAfterStopIndex, prevWaypointId: prevWpId, nextWaypointId: nextWpId });
          }

          appendSimple2DSegment(connectorBottom, targetPos, toY, insertAfterStopIndex, prevWpId, nextWpId);
        }

        currentPos = targetPos;
        return;
      }
    }

    // Single-level or fallback
    appendSimple2DSegment(currentPos, targetPos, targetPos.y, insertAfterStopIndex, prevWpId, nextWpId);
    currentPos = targetPos;
  };

  for (let i = 0; i < orderedPicks.length; i++) {
    const customBefore = customWaypoints.filter((w) => w.insertAfterStopIndex === i);
    for (const cw of customBefore) {
      appendSegment({ x: cw.x, y: currentPos.y, z: cw.z }, i, lastWaypointId, cw.id);
      waypoints.push({
        id: cw.id,
        x: cw.x,
        y: currentPos.y,
        z: cw.z,
        type: 'TRANSIT',
        customWaypointId: cw.id,
      });
      lastWaypointId = cw.id;
    }

    const pick = orderedPicks[i];
    const targetPos = {
      x: pick.accessPoint3D.x,
      y: pick.accessPoint3D.y || 0,
      z: pick.accessPoint3D.z,
    };
    const stopId = `stop-${i + 1}`;

    appendSegment(targetPos, i, lastWaypointId, stopId);

    waypoints.push({
      id: stopId,
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      type: 'PICK_STOP',
      binId: pick.binId,
      stopNumber: i + 1,
    });
    lastWaypointId = stopId;
  }

  // Check intermediate custom waypoints after the last stop
  const customAfterLast = customWaypoints.filter(
    (w) => w.insertAfterStopIndex >= orderedPicks.length
  );
  for (const cw of customAfterLast) {
    appendSegment({ x: cw.x, y: currentPos.y, z: cw.z }, orderedPicks.length, lastWaypointId, cw.id);
    waypoints.push({
      id: cw.id,
      x: cw.x,
      y: currentPos.y,
      z: cw.z,
      type: 'TRANSIT',
      customWaypointId: cw.id,
    });
    lastWaypointId = cw.id;
  }

  // Final return segment to Depot (ground floor Y=0)
  appendSegment({ x: depotPos.x, y: 0, z: depotPos.z }, orderedPicks.length, lastWaypointId, 'depot-end');
  waypoints.push({
    id: 'depot-end',
    x: depotPos.x,
    y: 0,
    z: depotPos.z,
    type: 'DEPOT_END',
  });

  // 3. Compute unoptimized distance (baseline order without TSP)
  let unoptimizedDistance = 0;
  let unoptPos = depotPos;
  for (let i = 0; i < pickItems.length; i++) {
    const seg = findPathAStar(
      grid,
      unoptPos,
      { x: pickItems[i].accessPoint3D.x, z: pickItems[i].accessPoint3D.z },
      true
    );
    unoptimizedDistance += seg.distance;
    unoptPos = { x: pickItems[i].accessPoint3D.x, z: pickItems[i].accessPoint3D.z };
  }
  const unoptReturn = findPathAStar(grid, unoptPos, depotPos, true);
  unoptimizedDistance += unoptReturn.distance;

  // 4. Calculate Durations & Metrics
  const dwellTime = pickItems.length * vehicleConfig.pickDwellSeconds;
  const estimatedDuration = Math.round(
    totalDistance / vehicleConfig.speedMps + dwellTime + verticalTransitSeconds
  );
  const unoptimizedDuration = Math.round(
    unoptimizedDistance / vehicleConfig.speedMps + dwellTime + verticalTransitSeconds
  );


  const distSaved = Math.max(0, unoptimizedDistance - totalDistance);
  const distanceSavedPercent =
    unoptimizedDistance > 0 ? Math.round((distSaved / unoptimizedDistance) * 100) : 0;
  const timeSaved = Math.max(0, unoptimizedDuration - estimatedDuration);
  const timeSavedPercent =
    unoptimizedDuration > 0 ? Math.round((timeSaved / unoptimizedDuration) * 100) : 0;

  const totalWeightKg = pickItems.reduce((acc, p) => acc + (p.weightKg || 0), 0);

  return {
    orderedPicks,
    waypoints,
    polylinePoints: fullPolyline,
    metrics: {
      totalDistanceMeters: Math.round(totalDistance * 10) / 10,
      unoptimizedDistanceMeters: Math.round(unoptimizedDistance * 10) / 10,
      distanceSavedPercent,
      estimatedDurationSeconds: estimatedDuration,
      unoptimizedDurationSeconds: unoptimizedDuration,
      timeSavedPercent,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      itemCount: pickItems.length,
    },
    isManualSequence,
  };
}

/**
 * Interpolates a 3D world coordinate along polyline points at a given progress (0.0 to 1.0).
 */
export function interpolatePolylinePosition(
  points: Array<{ x: number; z: number; y?: number }>,
  progress: number,
  defaultY: number = 0
): { x: number; y: number; z: number } {
  if (points.length === 0) {
    return { x: 0, y: defaultY, z: 0 };
  }
  if (points.length === 1 || progress <= 0) {
    return { x: points[0].x, y: points[0].y ?? defaultY, z: points[0].z };
  }
  if (progress >= 1.0) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y ?? defaultY, z: last.z };
  }

  let totalLength = 0;
  const segs: Array<{
    p1: { x: number; z: number; y?: number };
    p2: { x: number; z: number; y?: number };
    len: number;
    cumStart: number;
    cumEnd: number;
  }> = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const d = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    segs.push({ p1, p2, len: d, cumStart: totalLength, cumEnd: totalLength + d });
    totalLength += d;
  }

  if (totalLength <= 0.0001) {
    return { x: points[0].x, y: points[0].y ?? defaultY, z: points[0].z };
  }

  const targetDist = progress * totalLength;
  let activeSeg = segs[0];

  for (let i = 0; i < segs.length; i++) {
    if (
      targetDist >= segs[i].cumStart &&
      (targetDist <= segs[i].cumEnd || i === segs.length - 1)
    ) {
      activeSeg = segs[i];
      break;
    }
  }

  const segProgress =
    activeSeg.len > 0
      ? Math.max(0, Math.min(1, (targetDist - activeSeg.cumStart) / activeSeg.len))
      : 0;

  const posX = activeSeg.p1.x + segProgress * (activeSeg.p2.x - activeSeg.p1.x);
  const y1 = activeSeg.p1.y ?? defaultY;
  const y2 = activeSeg.p2.y ?? defaultY;
  const posY = y1 + segProgress * (y2 - y1);
  const posZ = activeSeg.p1.z + segProgress * (activeSeg.p2.z - activeSeg.p1.z);

  return { x: posX, y: posY, z: posZ };
}
