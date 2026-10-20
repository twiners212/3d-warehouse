// Fulfills Phase 36: A* Shortest Pathfinding & Path Smoothing Engine
// Computes collision-free routes across the 2D walkability floor grid

import type { WalkabilityGrid } from './grid-map';

export interface PathNode {
  col: number;
  row: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

const SQRT2 = Math.SQRT2;

/** 8-directional neighbor offsets (col, row, cost) */
const NEIGHBORS = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: SQRT2 },
  { dc: -1, dr: 1, cost: SQRT2 },
  { dc: 1, dr: -1, cost: SQRT2 },
  { dc: -1, dr: -1, cost: SQRT2 },
];

/** Octile distance heuristic for 8-way grid movement */
function octileDistance(c1: number, r1: number, c2: number, r2: number): number {
  const dc = Math.abs(c1 - c2);
  const dr = Math.abs(r1 - r2);
  return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
}

/** Check line of sight on grid using Bresenham algorithm */
export function hasLineOfSight(
  grid: WalkabilityGrid,
  c0: number,
  r0: number,
  c1: number,
  r1: number
): boolean {
  const dx = Math.abs(c1 - c0);
  const dy = Math.abs(r1 - r0);
  const sx = c0 < c1 ? 1 : -1;
  const sy = r0 < r1 ? 1 : -1;
  let err = dx - dy;

  let currC = c0;
  let currR = r0;

  while (true) {
    if (!grid.isWalkable(currC, currR)) return false;
    if (currC === c1 && currR === r1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currC += sx;
    }
    if (e2 < dx) {
      err += dx;
      currR += sy;
    }
  }

  return true;
}

/** Smooths raw grid path by skipping intermediate nodes with unobstructed line of sight */
export function smoothPath(
  grid: WalkabilityGrid,
  rawPath: Array<{ x: number; z: number }>
): Array<{ x: number; z: number }> {
  if (rawPath.length <= 2) return rawPath;

  const smoothed: Array<{ x: number; z: number }> = [rawPath[0]];
  let currentIndex = 0;

  while (currentIndex < rawPath.length - 1) {
    let furthest = currentIndex + 1;
    for (let testIndex = rawPath.length - 1; testIndex > currentIndex + 1; testIndex--) {
      const g0 = grid.worldToGrid(rawPath[currentIndex].x, rawPath[currentIndex].z);
      const g1 = grid.worldToGrid(rawPath[testIndex].x, rawPath[testIndex].z);

      if (hasLineOfSight(grid, g0.col, g0.row, g1.col, g1.row)) {
        furthest = testIndex;
        break;
      }
    }

    smoothed.push(rawPath[furthest]);
    currentIndex = furthest;
  }

  return smoothed;
}

/**
 * A* Pathfinding from world start (x, z) to world goal (x, z).
 * Returns array of world coordinates { x, z }.
 */
export function findPathAStar(
  grid: WalkabilityGrid,
  startWorld: { x: number; z: number },
  goalWorld: { x: number; z: number },
  shouldSmooth: boolean = true
): { points: Array<{ x: number; z: number }>; distance: number } {
  let startGrid = grid.worldToGrid(startWorld.x, startWorld.z);
  let goalGrid = grid.worldToGrid(goalWorld.x, goalWorld.z);

  if (!grid.isWalkable(startGrid.col, startGrid.row)) {
    startGrid = grid.findNearestWalkable(startGrid.col, startGrid.row);
  }
  if (!grid.isWalkable(goalGrid.col, goalGrid.row)) {
    goalGrid = grid.findNearestWalkable(goalGrid.col, goalGrid.row);
  }

  // If already at the same cell
  if (startGrid.col === goalGrid.col && startGrid.row === goalGrid.row) {
    return {
      points: [startWorld, goalWorld],
      distance: Math.hypot(goalWorld.x - startWorld.x, goalWorld.z - startWorld.z),
    };
  }

  const cols = grid.cols;
  const rows = grid.rows;

  // Open set and closed set tracking
  const openSet: PathNode[] = [];
  const openMap = new Map<number, PathNode>();
  const closedSet = new Uint8Array(cols * rows);

  const startNode: PathNode = {
    col: startGrid.col,
    row: startGrid.row,
    g: 0,
    h: octileDistance(startGrid.col, startGrid.row, goalGrid.col, goalGrid.row),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openSet.push(startNode);
  openMap.set(startGrid.row * cols + startGrid.col, startNode);

  let targetFoundNode: PathNode | null = null;
  const MAX_ITERATIONS = 8000;
  let iterations = 0;

  while (openSet.length > 0 && iterations++ < MAX_ITERATIONS) {
    // Find node with minimum f score
    let minIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[minIndex].f) {
        minIndex = i;
      }
    }

    const current = openSet.splice(minIndex, 1)[0];
    const currentKey = current.row * cols + current.col;
    openMap.delete(currentKey);
    closedSet[currentKey] = 1;

    // Check goal reached
    if (current.col === goalGrid.col && current.row === goalGrid.row) {
      targetFoundNode = current;
      break;
    }

    // Expand neighbors
    for (const { dc, dr, cost } of NEIGHBORS) {
      const nc = current.col + dc;
      const nr = current.row + dr;

      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nKey = nr * cols + nc;
      if (closedSet[nKey] === 1) continue;
      if (!grid.isWalkable(nc, nr)) continue;

      // Prevent cutting diagonal corners between two blocked cells
      if (dc !== 0 && dr !== 0) {
        if (!grid.isWalkable(current.col + dc, current.row) || !grid.isWalkable(current.col, current.row + dr)) {
          continue;
        }
      }

      const tentativeG = current.g + cost * grid.cellSize;
      const existingNode = openMap.get(nKey);

      if (!existingNode) {
        const h = octileDistance(nc, nr, goalGrid.col, goalGrid.row) * grid.cellSize;
        const neighborNode: PathNode = {
          col: nc,
          row: nr,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        };
        openSet.push(neighborNode);
        openMap.set(nKey, neighborNode);
      } else if (tentativeG < existingNode.g) {
        existingNode.g = tentativeG;
        existingNode.f = tentativeG + existingNode.h;
        existingNode.parent = current;
      }
    }
  }

  // Reconstruct path
  const rawPath: Array<{ x: number; z: number }> = [];
  if (targetFoundNode) {
    let curr: PathNode | null = targetFoundNode;
    while (curr) {
      rawPath.unshift(grid.gridToWorld(curr.col, curr.row));
      curr = curr.parent;
    }
  } else {
    // Fallback direct line if unreachable
    rawPath.push(startWorld, goalWorld);
  }

  // Ensure exact start and goal world coordinates are preserved at ends
  if (rawPath.length > 0) {
    rawPath[0] = { x: startWorld.x, z: startWorld.z };
    rawPath[rawPath.length - 1] = { x: goalWorld.x, z: goalWorld.z };
  }

  const finalPoints = shouldSmooth ? smoothPath(grid, rawPath) : rawPath;

  // Calculate total path distance
  let totalDist = 0;
  for (let i = 1; i < finalPoints.length; i++) {
    totalDist += Math.hypot(
      finalPoints[i].x - finalPoints[i - 1].x,
      finalPoints[i].z - finalPoints[i - 1].z
    );
  }

  return {
    points: finalPoints,
    distance: totalDist,
  };
}
