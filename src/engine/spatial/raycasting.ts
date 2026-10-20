// Fulfills ARCHITECTURE.md Section 2 (engine/spatial/raycasting.ts):
// Floor intersection math converting pointer coordinates to world XZ points.

import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { Vector3D } from '@/types/spatial';

/** Ground receiver plane at Y = 0 facing up */
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const TARGET_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hitPoint = new Vector3();

/**
 * Converts a pointer event position (client coordinates) to the intersection
 * point of its camera ray with the floor plane at Y = planeY. Returns null when the ray
 * points away from the plane (e.g. sky above horizon).
 */
export function screenToWorldFloor(
  clientX: number,
  clientY: number,
  camera: Camera,
  canvasRect: DOMRect,
  planeY: number = 0
): Vector3D | null {
  ndc.set(
    ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
    -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);

  const plane = planeY === 0 ? FLOOR_PLANE : TARGET_PLANE.set(TARGET_PLANE.normal, -planeY);
  if (!raycaster.ray.intersectPlane(plane, hitPoint)) {
    return null;
  }

  return { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };
}
