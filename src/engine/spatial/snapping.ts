// Fulfills INTERACTION-SPECIFICATION.md Section 4 Snapping Resolution Pipeline:
//   Step 1: grid snapping (round to step)
//   Step 2: magnetic edge-to-edge alignment within MAGNETIC_SNAP_THRESHOLD
//   Step 3: boundary clamping so all 4 corners stay inside the floor
// Plus the placement validity gate (Section 5.1 valid/collision/out-of-bounds).

import type { BuildingLevel, RackEntity } from '@/types/layout';
import {
  checkAABBCollision,
  getEffectiveDimensions,
  isWithinWarehouseBounds,
  snapToGrid,
} from './spatial-math';
import { MAGNETIC_SNAP_THRESHOLD } from '@/lib/constants/warehouse-defaults';

export interface FootprintLike {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotationY: number;
}

interface EdgeSpan {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function getEdgeSpan(footprint: FootprintLike): EdgeSpan {
  const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
    footprint.width,
    footprint.depth,
    footprint.rotationY
  );
  return {
    minX: footprint.x - effectiveWidth / 2,
    maxX: footprint.x + effectiveWidth / 2,
    minZ: footprint.z - effectiveDepth / 2,
    maxZ: footprint.z + effectiveDepth / 2,
  };
}

/**
 * Full snapping pipeline for a moving/placing entity.
 * `neighbors` must exclude the entity being moved.
 */
export function resolvePlacementPosition(params: {
  rawX: number;
  rawZ: number;
  entityWidth: number;
  entityDepth: number;
  entityRotationY: number;
  gridStep: number;
  isSnapEnabled: boolean;
  neighbors: Array<Pick<RackEntity, 'position' | 'rotationY' | 'dimensions'>>;
  floorWidth: number;
  floorDepth: number;
}): { x: number; z: number } {
  const {
    rawX,
    rawZ,
    entityWidth,
    entityDepth,
    gridStep,
    isSnapEnabled,
    neighbors,
  } = params;

  // Step 1: grid snapping
  let x = isSnapEnabled ? snapToGrid(rawX, gridStep) : rawX;
  let z = isSnapEnabled ? snapToGrid(rawZ, gridStep) : rawZ;

  if (!isSnapEnabled) {
    return { x, z };
  }

  // Step 2: magnetic edge-to-edge alignment
  const halfW = entityWidth / 2;
  const halfD = entityDepth / 2;
  let bestCandidate: { x: number; z: number; distance: number } | null = null;

  for (const neighbor of neighbors) {
    const span = getEdgeSpan({
      x: neighbor.position.x,
      z: neighbor.position.z,
      width: neighbor.dimensions.width,
      depth: neighbor.dimensions.depth,
      rotationY: neighbor.rotationY,
    });

    const candidates: Array<{ x: number; z: number; distance: number }> = [
      // Our left edge -> neighbor right edge
      { x: span.maxX + halfW, z, distance: Math.abs(span.maxX + halfW - x) },
      // Our right edge -> neighbor left edge
      { x: span.minX - halfW, z, distance: Math.abs(span.minX - halfW - x) },
      // Our front/back edges vs neighbor's Z edges
      { x, z: span.maxZ + halfD, distance: Math.abs(span.maxZ + halfD - z) },
      { x, z: span.minZ - halfD, distance: Math.abs(span.minZ - halfD - z) },
    ];

    for (const candidate of candidates) {
      if (
        candidate.distance <= MAGNETIC_SNAP_THRESHOLD &&
        (!bestCandidate || candidate.distance < bestCandidate.distance)
      ) {
        bestCandidate = candidate;
      }
    }
  }

  if (bestCandidate) {
    if (bestCandidate.x !== x) x = bestCandidate.x;
    if (bestCandidate.z !== z) z = bestCandidate.z;
  }

  // Step 3: boundary clamping
  return clampToFloor(x, z, halfW, halfD, params);
}

function clampToFloor(
  x: number,
  z: number,
  halfW: number,
  halfD: number,
  params: { floorWidth: number; floorDepth: number }
): { x: number; z: number } {
  return {
    x: Math.min(Math.max(x, halfW), params.floorWidth - halfW),
    z: Math.min(Math.max(z, halfD), params.floorDepth - halfD),
  };
}

/** Section 5.1 validity: no AABB overlap with any neighbor AND inside bounds. */
export function isPlacementValid(params: {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotationY: number;
  neighbors: Array<Pick<RackEntity, 'position' | 'rotationY' | 'dimensions'>>;
  floorWidth: number;
  floorDepth: number;
}): boolean {
  const { x, z, width, depth, rotationY } = params;

  const withinBounds = isWithinWarehouseBounds(
    { x, z, width, depth, rotationY },
    { width: params.floorWidth, depth: params.floorDepth }
  );
  if (!withinBounds) return false;

  for (const neighbor of params.neighbors) {
    if (
      checkAABBCollision(
        { x, z, width, depth, rotationY },
        {
          x: neighbor.position.x,
          z: neighbor.position.z,
          width: neighbor.dimensions.width,
          depth: neighbor.dimensions.depth,
          rotationY: neighbor.rotationY,
        }
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Finds a valid, collision-free position starting from floor center
 * and probing outward in grid steps.
 */
export function findAvailablePlacementPosition(params: {
  width: number;
  depth: number;
  preferredX?: number;
  preferredZ?: number;
  rotationY?: number;
  gridStep?: number;
  neighbors: Array<Pick<RackEntity, 'position' | 'rotationY' | 'dimensions'>>;
  floorWidth: number;
  floorDepth: number;
}): { x: number; z: number } {
  const {
    width,
    depth,
    preferredX,
    preferredZ,
    rotationY = 0,
    gridStep = 0.5,
    neighbors,
    floorWidth,
    floorDepth,
  } = params;

  const baseCenterX = preferredX !== undefined ? preferredX : floorWidth / 2;
  const baseCenterZ = preferredZ !== undefined ? preferredZ : floorDepth / 2;
  const centerX = snapToGrid(
    Math.max(width / 2, Math.min(floorWidth - width / 2, baseCenterX)),
    gridStep
  );
  const centerZ = snapToGrid(
    Math.max(depth / 2, Math.min(floorDepth - depth / 2, baseCenterZ)),
    gridStep
  );

  // Check center first
  if (
    isPlacementValid({
      x: centerX,
      z: centerZ,
      width,
      depth,
      rotationY,
      neighbors,
      floorWidth,
      floorDepth,
    })
  ) {
    return { x: centerX, z: centerZ };
  }

  // Outward grid search
  const stepX = Math.max(gridStep, Math.round((width + 1.0) / gridStep) * gridStep);
  const stepZ = Math.max(gridStep, Math.round((depth + 1.5) / gridStep) * gridStep);

  const maxRadius = Math.ceil(Math.max(floorWidth / stepX, floorDepth / stepZ));
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

        const candX = snapToGrid(centerX + dx * stepX, gridStep);
        const candZ = snapToGrid(centerZ + dz * stepZ, gridStep);

        if (
          isPlacementValid({
            x: candX,
            z: candZ,
            width,
            depth,
            rotationY,
            neighbors,
            floorWidth,
            floorDepth,
          })
        ) {
          return { x: candX, z: candZ };
        }
      }
    }
  }

  return { x: centerX, z: centerZ };
}

export interface WarehouseOccupiedBounds {
  minWidth: number;
  minDepth: number;
  minHeight: number;
  furthestRackX: { name: string; requiredWidth: number } | null;
  furthestRackZ: { name: string; requiredDepth: number } | null;
  tallestRackY: { name: string; requiredHeight: number } | null;
}

/**
 * Calculates the minimal warehouse dimensions (Width, Depth, Height)
 * required to enclose all currently placed racks, structural elements, and zones without clipping.
 */
export function getWarehouseOccupiedBounds(
  racks: Array<Pick<RackEntity, 'name' | 'position' | 'rotationY' | 'dimensions'>>,
  structuralElements?: Array<{
    name: string;
    position: { x: number; y?: number; z: number };
    rotationY?: number;
    dimensions: { width: number; depth: number; height: number };
  }>,
  zones?: Array<{
    name: string;
    position: { x: number; y?: number; z: number };
    dimensions: { width: number; depth: number };
  }>,
  buildingLevels?: BuildingLevel[]
): WarehouseOccupiedBounds {
  let minWidth = 5;
  let minDepth = 5;
  let minHeight = 2.5;
  let furthestRackX: { name: string; requiredWidth: number } | null = null;
  let furthestRackZ: { name: string; requiredDepth: number } | null = null;
  let tallestRackY: { name: string; requiredHeight: number } | null = null;

  // 1. Process Racks
  for (const rack of racks) {
    const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
      rack.dimensions.width,
      rack.dimensions.depth,
      rack.rotationY
    );

    const requiredW = Math.ceil((rack.position.x + effectiveWidth / 2) * 10) / 10;
    const requiredD = Math.ceil((rack.position.z + effectiveDepth / 2) * 10) / 10;
    const rackElevY = rack.position.y ?? 0;
    const requiredH = Math.ceil((rackElevY + rack.dimensions.height + 0.5) * 10) / 10; // +0.5m sprinkler clearance

    if (requiredW > minWidth) {
      minWidth = requiredW;
      furthestRackX = { name: rack.name, requiredWidth: requiredW };
    }
    if (requiredD > minDepth) {
      minDepth = requiredD;
      furthestRackZ = { name: rack.name, requiredDepth: requiredD };
    }
    if (requiredH > minHeight) {
      minHeight = requiredH;
      tallestRackY = { name: rack.name, requiredHeight: requiredH };
    }
  }

  // 2. Process Structural Elements
  if (structuralElements) {
    for (const struct of structuralElements) {
      const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
        struct.dimensions.width,
        struct.dimensions.depth,
        struct.rotationY ?? 0
      );

      const requiredW = Math.ceil((struct.position.x + effectiveWidth / 2) * 10) / 10;
      const requiredD = Math.ceil((struct.position.z + effectiveDepth / 2) * 10) / 10;
      const structElevY = struct.position.y ?? 0;
      const requiredH = Math.ceil((structElevY + struct.dimensions.height) * 10) / 10;

      if (requiredW > minWidth) {
        minWidth = requiredW;
        furthestRackX = { name: struct.name, requiredWidth: requiredW };
      }
      if (requiredD > minDepth) {
        minDepth = requiredD;
        furthestRackZ = { name: struct.name, requiredDepth: requiredD };
      }
      if (requiredH > minHeight) {
        minHeight = requiredH;
        tallestRackY = { name: struct.name, requiredHeight: requiredH };
      }
    }
  }

  // 3. Process Operational Zones
  if (zones) {
    for (const zone of zones) {
      const requiredW = Math.ceil((zone.position.x + zone.dimensions.width / 2) * 10) / 10;
      const requiredD = Math.ceil((zone.position.z + zone.dimensions.depth / 2) * 10) / 10;

      if (requiredW > minWidth) {
        minWidth = requiredW;
        furthestRackX = { name: zone.name, requiredWidth: requiredW };
      }
      if (requiredD > minDepth) {
        minDepth = requiredD;
        furthestRackZ = { name: zone.name, requiredDepth: requiredD };
      }
    }
  }

  // 4. Process Building Levels
  if (buildingLevels) {
    for (const lvl of buildingLevels) {
      const requiredH = Math.ceil((lvl.elevationY + lvl.height + 0.5) * 10) / 10;
      if (requiredH > minHeight) {
        minHeight = requiredH;
        tallestRackY = { name: lvl.name, requiredHeight: requiredH };
      }
    }
  }

  return { minWidth, minDepth, minHeight, furthestRackX, furthestRackZ, tallestRackY };
}
