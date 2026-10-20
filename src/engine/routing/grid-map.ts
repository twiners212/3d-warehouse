// Fulfills Phase 36: 2D Walkability Grid & Obstacle Mapping Engine
// Discretizes warehouse floor into 0.5m cells and marks physical obstructions (racks, walls, pillars)

import type { WarehouseBounds } from '@/types/spatial';
import type { RackEntity, StructuralElement } from '@/types/layout';
import { getEffectiveDimensions } from '@/engine/spatial/spatial-math';
import { calculateBinLocalX } from '@/engine/procedural/bin-generator';
import { calculateLocalToWorld } from '@/engine/spatial/spatial-math';

export const GRID_CELL_SIZE = 0.5; // meters per grid cell
const RACK_PADDING = 0.2; // clearance padding around racks in meters
const STRUCTURE_PADDING = 0.15; // clearance padding around structural pillars/walls

export interface WalkabilityGrid {
  cols: number;
  rows: number;
  cellSize: number;
  bounds: WarehouseBounds;
  cells: Uint8Array; // 0 = Walkable, 1 = Obstacle
  worldToGrid: (x: number, z: number) => { col: number; row: number };
  gridToWorld: (col: number, row: number) => { x: number; z: number };
  isWalkable: (col: number, row: number) => boolean;
  findNearestWalkable: (col: number, row: number, maxRadius?: number) => { col: number; row: number };
}

export function createWalkabilityGrid(
  bounds: WarehouseBounds,
  racks: RackEntity[],
  structuralElements: StructuralElement[] = []
): WalkabilityGrid {
  const cellSize = GRID_CELL_SIZE;
  const cols = Math.max(1, Math.ceil(bounds.width / cellSize));
  const rows = Math.max(1, Math.ceil(bounds.depth / cellSize));
  const cells = new Uint8Array(cols * rows);

  function worldToGrid(x: number, z: number): { col: number; row: number } {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(z / cellSize);
    return {
      col: Math.max(0, Math.min(cols - 1, col)),
      row: Math.max(0, Math.min(rows - 1, row)),
    };
  }

  function gridToWorld(col: number, row: number): { x: number; z: number } {
    return {
      x: (col + 0.5) * cellSize,
      z: (row + 0.5) * cellSize,
    };
  }

  function isWalkable(col: number, row: number): boolean {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
    return cells[row * cols + col] === 0;
  }

  function markBoxObstacle(
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    padding: number
  ) {
    const minX = centerX - width / 2 - padding;
    const maxX = centerX + width / 2 + padding;
    const minZ = centerZ - depth / 2 - padding;
    const maxZ = centerZ + depth / 2 + padding;

    const minGrid = worldToGrid(minX, minZ);
    const maxGrid = worldToGrid(maxX, maxZ);

    for (let r = minGrid.row; r <= maxGrid.row; r++) {
      for (let c = minGrid.col; c <= maxGrid.col; c++) {
        cells[r * cols + c] = 1;
      }
    }
  }

  // 1. Mark racks as obstacles with padding
  for (const rack of racks) {
    const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
      rack.dimensions.width,
      rack.dimensions.depth,
      rack.rotationY
    );
    markBoxObstacle(rack.position.x, rack.position.z, effectiveWidth, effectiveDepth, RACK_PADDING);
  }

  // 2. Mark structural elements (walls, columns, bollards)
  for (const elem of structuralElements) {
    if (elem.type === 'dock_door') {
      // Dock doors should allow movement at their opening, skip marking as full block
      continue;
    }
    const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
      elem.dimensions.width,
      elem.dimensions.depth,
      elem.rotationY
    );
    markBoxObstacle(elem.position.x, elem.position.z, effectiveWidth, effectiveDepth, STRUCTURE_PADDING);
  }

  // Helper to find nearest walkable cell if a target happens to be blocked
  function findNearestWalkable(
    col: number,
    row: number,
    maxRadius: number = 15
  ): { col: number; row: number } {
    if (isWalkable(col, row)) return { col, row };

    for (let r = 1; r <= maxRadius; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) === r || Math.abs(dr) === r) {
            const nc = col + dc;
            const nr = row + dr;
            if (isWalkable(nc, nr)) {
              return { col: nc, row: nr };
            }
          }
        }
      }
    }
    // Fallback if surrounded
    return { col, row };
  }

  return {
    cols,
    rows,
    cellSize,
    bounds,
    cells,
    worldToGrid,
    gridToWorld,
    isWalkable,
    findNearestWalkable,
  };
}

/**
 * Calculates the walkable aisle access point (world X, Z) for picking from a specific bay in a rack.
 * Evaluates both local +Z and -Z sides of the rack to find the open aisle.
 */
export function calculateBayAccessPoint(
  rack: RackEntity,
  bayIndex: number,
  grid: WalkabilityGrid
): { x: number; z: number } {
  const rackTotalWidth = rack.bayWidth * rack.bays;
  const localX = calculateBinLocalX(bayIndex, rackTotalWidth, rack.bayWidth);
  const aisleOffset = rack.dimensions.depth / 2 + 0.8; // 0.8m standoff in the aisle

  // Test side A (+Z) and side B (-Z)
  const worldPosA = calculateLocalToWorld(rack.position, rack.rotationY, {
    x: localX,
    y: 0,
    z: aisleOffset,
  });

  const worldPosB = calculateLocalToWorld(rack.position, rack.rotationY, {
    x: localX,
    y: 0,
    z: -aisleOffset,
  });

  const gridA = grid.worldToGrid(worldPosA.x, worldPosA.z);
  const gridB = grid.worldToGrid(worldPosB.x, worldPosB.z);

  const walkableA = grid.isWalkable(gridA.col, gridA.row);
  const walkableB = grid.isWalkable(gridB.col, gridB.row);

  if (walkableA && !walkableB) {
    return { x: worldPosA.x, z: worldPosA.z };
  }
  if (walkableB && !walkableA) {
    return { x: worldPosB.x, z: worldPosB.z };
  }
  if (walkableA && walkableB) {
    // Both sides are open aisles, pick side A
    return { x: worldPosA.x, z: worldPosA.z };
  }

  // If neither directly walkable, find nearest walkable cell to side A
  const nearest = grid.findNearestWalkable(gridA.col, gridA.row);
  return grid.gridToWorld(nearest.col, nearest.row);
}

/**
 * Given a world coordinate (X, Z), checks if it is walkable.
 * If blocked, searches outward to find the nearest walkable point in the open aisle.
 */
export function findNearestWalkablePoint(
  grid: WalkabilityGrid,
  x: number,
  z: number,
  maxRadius: number = 20
): { x: number; z: number } {
  const g = grid.worldToGrid(x, z);
  if (grid.isWalkable(g.col, g.row)) {
    return { x, z };
  }
  const nearest = grid.findNearestWalkable(g.col, g.row, maxRadius);
  return grid.gridToWorld(nearest.col, nearest.row);
}

