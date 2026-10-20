// Fulfills Phase 36: TSP Route Sequencing & 2-Opt Optimization Heuristic
// Solves Traveling Salesperson Problem for warehouse pick stops (Depot -> Picks -> Depot)

import type { PickItem } from '@/types/routing';

export interface Point2D {
  x: number;
  z: number;
}

/** Distance function between two 2D points (Manhattan + Euclidean blend for aisle grid) */
export function calculateDistance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Calculates total tour distance including start and end at depot */
export function calculateTourDistance(depot: Point2D, stops: Point2D[]): number {
  if (stops.length === 0) return 0;

  let dist = calculateDistance(depot, stops[0]);
  for (let i = 0; i < stops.length - 1; i++) {
    dist += calculateDistance(stops[i], stops[i + 1]);
  }
  dist += calculateDistance(stops[stops.length - 1], depot);
  return dist;
}

/** Nearest-Neighbor Heuristic to create an initial ordered tour */
export function nearestNeighborTSP(depot: Point2D, items: PickItem[]): PickItem[] {
  if (items.length <= 1) return [...items];

  const unvisited = [...items];
  const ordered: PickItem[] = [];
  let currentPos: Point2D = depot;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = calculateDistance(currentPos, unvisited[i].accessPoint3D);
      if (d < minDistance) {
        minDistance = d;
        nearestIndex = i;
      }
    }

    const nextItem = unvisited.splice(nearestIndex, 1)[0];
    ordered.push(nextItem);
    currentPos = nextItem.accessPoint3D;
  }

  return ordered;
}

/**
 * 2-Opt Local Search Heuristic
 * Iteratively untangles crossing edges to shorten the total tour length.
 */
export function twoOptOptimization(depot: Point2D, initialTour: PickItem[], maxIterations: number = 100): PickItem[] {
  if (initialTour.length <= 2) return [...initialTour];

  const tour = [...initialTour];
  let improved = true;
  let iterations = 0;

  while (improved && iterations++ < maxIterations) {
    improved = false;

    // Full tour nodes including depot at start (index 0) and depot at end (index N + 1)
    const points: Point2D[] = [depot, ...tour.map((t) => t.accessPoint3D), depot];
    const n = points.length;

    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n - 1; j++) {
        const d1 = calculateDistance(points[i], points[i + 1]) + calculateDistance(points[j], points[j + 1]);
        const d2 = calculateDistance(points[i], points[j]) + calculateDistance(points[i + 1], points[j + 1]);

        if (d2 < d1 - 0.01) {
          // Reversing sub-tour between index i+1 and j in tour array
          // In tour array, point 1 is index 0
          const tourI = i; // maps to tour[i]
          const tourJ = j - 1; // maps to tour[j - 1]

          if (tourI <= tourJ && tourI < tour.length && tourJ < tour.length) {
            const sub = tour.slice(tourI, tourJ + 1).reverse();
            tour.splice(tourI, sub.length, ...sub);
            improved = true;
            break;
          }
        }
      }
      if (improved) break;
    }
  }

  return tour;
}

/** Solves TSP for pick list: Nearest-Neighbor followed by 2-Opt */
export function optimizePickSequence(
  depot: Point2D,
  rawPicks: PickItem[]
): {
  optimizedPicks: PickItem[];
  optimizedDistance: number;
  unoptimizedDistance: number;
  distanceSavedPercent: number;
} {
  if (rawPicks.length === 0) {
    return {
      optimizedPicks: [],
      optimizedDistance: 0,
      unoptimizedDistance: 0,
      distanceSavedPercent: 0,
    };
  }

  // Calculate unoptimized sequence distance
  const unoptimizedDistance = calculateTourDistance(
    depot,
    rawPicks.map((p) => p.accessPoint3D)
  );

  // Run Nearest-Neighbor + 2-Opt
  const nnTour = nearestNeighborTSP(depot, rawPicks);
  const optimizedPicks = twoOptOptimization(depot, nnTour);
  const optimizedDistance = calculateTourDistance(
    depot,
    optimizedPicks.map((p) => p.accessPoint3D)
  );

  const saved = Math.max(0, unoptimizedDistance - optimizedDistance);
  const distanceSavedPercent = unoptimizedDistance > 0 ? Math.round((saved / unoptimizedDistance) * 100) : 0;

  return {
    optimizedPicks,
    optimizedDistance,
    unoptimizedDistance,
    distanceSavedPercent,
  };
}
