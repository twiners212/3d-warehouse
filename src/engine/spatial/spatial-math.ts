// Fulfills SPATIAL-MODEL.md Section 6 TypeScript Spatial Math Reference Implementation
// Pure functions: grid snapping, rotated AABB collision, bounds, local-to-world.

import type { Footprint, Vector2D, Vector3D, WarehouseBounds } from '@/types/spatial';

/** Floor grid snapping (SPATIAL-MODEL.md Section 5.1), default step 0.5m */
export function snapToGrid(value: number, step: number = 0.5): number {
  return Math.round(value / step) * step;
}

/**
 * Effective footprint dimensions under discrete 90-degree yaw rotation
 * (SPATIAL-MODEL.md Section 5.2).
 */
export function getEffectiveDimensions(width: number, depth: number, rotationY: number) {
  const normalizedRotation = Math.abs(rotationY % Math.PI);
  const isPerpendicular = Math.abs(normalizedRotation - Math.PI / 2) < 0.01;

  return {
    effectiveWidth: isPerpendicular ? depth : width,
    effectiveDepth: isPerpendicular ? width : depth,
  };
}

const COLLISION_EPSILON = 0.001; // Margin buffer against edge-touch false positives

/** 2D XZ-plane AABB overlap check (SPATIAL-MODEL.md Section 5.3) */
export function checkAABBCollision(a: Footprint, b: Footprint): boolean {
  const dimA = getEffectiveDimensions(a.width, a.depth, a.rotationY);
  const dimB = getEffectiveDimensions(b.width, b.depth, b.rotationY);

  const deltaX = Math.abs(a.x - b.x);
  const deltaZ = Math.abs(a.z - b.z);

  return (
    deltaX < (dimA.effectiveWidth + dimB.effectiveWidth) / 2 - COLLISION_EPSILON &&
    deltaZ < (dimA.effectiveDepth + dimB.effectiveDepth) / 2 - COLLISION_EPSILON
  );
}

/** Out-of-bounds invariant: all footprint corners within [0..W] x [0..L] (SPATIAL-MODEL.md Section 5.5) */
export function isWithinWarehouseBounds(entity: Footprint, warehouseBounds: WarehouseBounds): boolean {
  const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
    entity.width,
    entity.depth,
    entity.rotationY
  );

  const halfW = effectiveWidth / 2;
  const halfD = effectiveDepth / 2;

  return (
    entity.x - halfW >= 0 &&
    entity.x + halfW <= warehouseBounds.width &&
    entity.z - halfD >= 0 &&
    entity.z + halfD <= warehouseBounds.depth
  );
}

/** P_world = P_rack + R_Y(theta) * P_local (SPATIAL-MODEL.md Section 4) */
export function calculateLocalToWorld(
  rackPos: Vector3D,
  rackRotationY: number,
  localPos: Vector3D
): Vector3D {
  const cosTheta = Math.cos(rackRotationY);
  const sinTheta = Math.sin(rackRotationY);

  return {
    x: rackPos.x + (localPos.x * cosTheta + localPos.z * sinTheta),
    y: rackPos.y + localPos.y,
    z: rackPos.z + (-localPos.x * sinTheta + localPos.z * cosTheta),
  };
}

/** Discrete rotation step: theta_new = (theta + PI/2) mod 2PI (INTERACTION-SPECIFICATION.md Section 6) */
export function nextRotationStep(rotationY: number): number {
  return (rotationY + Math.PI / 2) % (Math.PI * 2);
}

export type { Vector2D };
