// Fulfills SPATIAL-MODEL.md Section 6 & ARCHITECTURE.md Section 2 (types/spatial.ts)

export interface Vector2D {
  x: number;
  z: number;
}

export interface Vector3D extends Vector2D {
  y: number;
}

export interface Size3D {
  width: number; // X-dimension (meters)
  height: number; // Y-dimension (meters)
  depth: number; // Z-dimension (meters)
}

// Rotated XZ footprint used by collision / bounds validation (SPATIAL-MODEL.md Section 5.2-5.5)
export interface Footprint {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotationY: number; // radians, discrete {0, PI/2, PI, 3PI/2}
}

// Warehouse floor bounds anchored at origin (0,0,0) Bottom-Left-Front (SPATIAL-MODEL.md Section 1)
export interface WarehouseBounds {
  width: number;
  depth: number;
}
