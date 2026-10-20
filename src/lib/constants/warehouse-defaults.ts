// Fulfills ARCHITECTURE.md Section 2 (lib/constants/warehouse-defaults.ts)
// Centralizes spatial tuning constants referenced by PRD.md Sections 4 & 7.

/** Default grid snapping interval in meters (PRD.md Section 2 gridSnapStep) */
export const DEFAULT_GRID_SNAP_STEP = 0.5;

/** Allowed snapping intervals for the blueprint grid */
export const GRID_SNAP_STEPS = [0.25, 0.5, 1.0] as const;

/** Magnetic edge-to-edge snap threshold in meters (SPATIAL-MODEL.md Section 5.4) */
export const MAGNETIC_SNAP_THRESHOLD = 0.3;

/**
 * Epsilon buffer preventing false-positive collisions when edges merely touch
 * (SPATIAL-MODEL.md Section 5.3 reference implementation).
 */
export const COLLISION_EPSILON = 0.001;

/** Maximum undo history depth (PRD.md Section 4.5) */
export const MAX_HISTORY_DEPTH = 30;

/** Bin insert chunk size to respect Neon HTTP payload limits (PRD.md Section 7) */
export const BIN_BATCH_CHUNK_SIZE = 1000;

/** Default bin payload capacity in kilograms (DATA-MODEL.md Section 3.3) */
export const DEFAULT_BIN_MAX_WEIGHT_KG = 1000.0;

/**
 * Custom warehouse room dimension limits:
 * Panjang (Depth Z): 5 - 500m
 * Lebar (Width X): 5 - 200m
 * Tinggi Plafon (Height Y): 2.5 - 30m
 */
export const WAREHOUSE_DIMENSION_LIMITS = {
  minWidth: 5,
  maxWidth: 200,
  minDepth: 5,
  maxDepth: 500,
  minHeight: 2.5,
  maxHeight: 30,
} as const;

/** Mandatory clearance below warehouse ceiling (for lighting, HVAC, and fire sprinkler systems) */
export const FIRE_SPRINKLER_CLEARANCE = 0.5;

/** Maximum realistic building levels allowed in warehouse (Ground + up to 3 Mezzanine tiers) */
export const MAX_BUILDING_LEVELS = 4;

/** Default staging pallet slot occupancy ratio for demo realism (~66%) */
export const DEFAULT_PALLET_OCCUPANCY_RATIO = 0.66;

/** Default clearance height in meters per building level floor slab */
export const DEFAULT_LEVEL_HEIGHT = 3.6;

/** Clearance buffer between topmost floor ceiling and roof structure */
export const DEFAULT_LEVEL_CLEARANCE = 0.5;

/** Inspector panel minimum and maximum clamps for Storage Racking */
export const RACK_PARAM_CLAMPS = {
  minBays: 1,
  maxBays: 30,
  minLevels: 1,
  maxLevels: 12,
  minBayWidth: 1.0,
  maxBayWidth: 4.5,
  minBayDepth: 0.8,
  maxBayDepth: 3.0,
  minLevelHeight: 0.8,
  maxLevelHeight: 3.5,
  minDoubleDeepBayDepth: 2.0,
  maxDoubleDeepBayDepth: 2.8,
} as const;

/** Inspector clamps tailored to specific facility structural elements */
export const STRUCTURE_PARAM_CLAMPS = {
  bollard: {
    minHeight: 0.8,
    maxHeight: 1.5,
    minWidth: 0.15,
    maxWidth: 0.4,
    minDepth: 0.15,
    maxDepth: 0.4,
    step: 0.05,
  },
  dock_door: {
    minHeight: 2.5,
    maxHeight: 5.0,
    minWidth: 2.4,
    maxWidth: 4.5,
    minDepth: 0.15,
    maxDepth: 0.3,
    step: 0.1,
  },
  column: {
    minHeight: 2.0,
    maxHeight: 30.0,
    minWidth: 0.3,
    maxWidth: 1.5,
    minDepth: 0.3,
    maxDepth: 1.5,
    step: 0.1,
  },
  wall: {
    minHeight: 1.0,
    maxHeight: 30.0,
    minWidth: 1.0,
    maxWidth: 200.0,
    minDepth: 0.15,
    maxDepth: 1.0,
    step: 0.1,
  },
  charging_dock: {
    minHeight: 0.8,
    maxHeight: 2.5,
    minWidth: 1.0,
    maxWidth: 3.0,
    minDepth: 1.0,
    maxDepth: 3.0,
    step: 0.1,
  },
} as const;

/** Fleet Simulation and Traffic Control Constants (Phase 41) */
export const DEFAULT_FLEET_SIZE = 3;
export const MAX_FLEET_SIZE = 8;
export const MAX_FLEET_PER_LEVEL = 4;
export const RADAR_DETECTION_RADIUS_METERS = 2.8;
export const RADAR_STOP_DISTANCE_METERS = 1.4;
export const BATTERY_DRAIN_PER_KM = 3.5; // % battery consumed per km traveled unloaded
export const BATTERY_DRAIN_PER_TON_KM = 2.0; // additional % battery consumed per ton-km
export const BATTERY_CHARGING_SPEED_PCT_PER_SEC = 2.5; // % battery recharged per second while docked
export const FLEET_PALETTE_COLORS = [
  '#f59e0b', // Amber (Forklift 1)
  '#06b6d4', // Cyan (AGV 1)
  '#a855f7', // Purple (AGV 2)
  '#10b981', // Emerald (Cart 1)
  '#ec4899', // Pink (AGV 3)
  '#3b82f6', // Blue (Forklift 2)
  '#14b8a6', // Teal (AGV 4)
  '#f97316', // Orange (Cart 2)
] as const;

/** Vehicle suitability per building level (Structural weight load realism) */
export const LEVEL_VEHICLE_RESTRICTIONS = {
  GROUND: ['FORKLIFT', 'AGV', 'CART'] as const,
  UPPER_LEVEL: ['AGV', 'CART'] as const, // Forklifts forbidden on mezzanines due to slab point load limits
} as const;

/** Operational Zone clamps */
export const ZONE_PARAM_CLAMPS = {
  minWidth: 2.0,
  minDepth: 2.0,
} as const;

/**
 * Calculates dynamic max dimensions for an operational zone to guarantee
 * that its footprint never extends outside the warehouse floor boundaries.
 */
export function calculateMaxZoneDimensions(
  zonePosition: { x: number; z: number },
  floorDimensions: { width: number; depth: number }
): { maxWidth: number; maxDepth: number } {
  const distToEdgeX = Math.min(zonePosition.x, floorDimensions.width - zonePosition.x);
  const distToEdgeZ = Math.min(zonePosition.z, floorDimensions.depth - zonePosition.z);

  const maxWidth = Math.max(ZONE_PARAM_CLAMPS.minWidth, Math.floor(Math.max(0.1, distToEdgeX * 2) * 10) / 10);
  const maxDepth = Math.max(ZONE_PARAM_CLAMPS.minDepth, Math.floor(Math.max(0.1, distToEdgeZ * 2) * 10) / 10);

  return { maxWidth, maxDepth };
}

/**
 * Calculates maximum allowed levels for a rack given the current ceiling height and level height.
 */
export function calculateMaxRackLevels(ceilingHeight: number, levelHeight: number): number {
  const maxAllowableHeight = Math.max(0.5, ceilingHeight - FIRE_SPRINKLER_CLEARANCE);
  return Math.max(1, Math.min(RACK_PARAM_CLAMPS.maxLevels, Math.floor(maxAllowableHeight / Math.max(0.1, levelHeight))));
}

/**
 * Calculates maximum allowed level height for a rack given the current ceiling height and number of levels.
 */
export function calculateMaxRackLevelHeight(ceilingHeight: number, levels: number): number {
  const maxAllowableHeight = Math.max(0.5, ceilingHeight - FIRE_SPRINKLER_CLEARANCE);
  const calculated = maxAllowableHeight / Math.max(1, levels);
  return Math.min(
    RACK_PARAM_CLAMPS.maxLevelHeight,
    Math.max(RACK_PARAM_CLAMPS.minLevelHeight, Number(calculated.toFixed(2)))
  );
}

/** Discrete yaw increments in radians (SPATIAL-MODEL.md Section 3) */
export const ROTATION_STEP_RAD = Math.PI / 2;

/** Default new warehouse floor dimensions in meters */
export const DEFAULT_FLOOR_DIMENSIONS = { width: 60, height: 10, depth: 40 } as const;

/** Ghost preview material states (INTERACTION-SPECIFICATION.md Section 5.1) */
export const PLACEMENT_COLORS = {
  valid: 0x22c55e,
  invalid: 0xef4444,
} as const;

/** Standard European pallet (EUR 1) dimensions in meters */
export const EURO_PALLET_DIMENSIONS = {
  width: 1.2,
  depth: 0.8,
  height: 0.144,
} as const;

export interface MockSkuTemplate {
  prefix: string;
  name: string;
  unit: string;
  qtyRange: [number, number];
  weightPerUnit: number;
  velocityClass: 'A' | 'B' | 'C';
}

export const MOCK_SKU_CATALOG: MockSkuTemplate[] = [
  { prefix: 'ELEC', name: '4K Ultra-HD Smart Display 55"', unit: 'cartons', qtyRange: [12, 36], weightPerUnit: 14.5, velocityClass: 'A' },
  { prefix: 'AUTO', name: 'Ceramic Brake Rotor Assembly', unit: 'sets', qtyRange: [20, 60], weightPerUnit: 11.2, velocityClass: 'B' },
  { prefix: 'FMCG', name: 'Organic Cold-Pressed Olive Oil', unit: 'cases', qtyRange: [40, 120], weightPerUnit: 4.8, velocityClass: 'A' },
  { prefix: 'PHRM', name: 'Sterile Vacuum Blood Tubes', unit: 'packs', qtyRange: [100, 300], weightPerUnit: 1.2, velocityClass: 'A' },
  { prefix: 'TOOL', name: 'Brushless Cordless Drill Kit 18V', unit: 'boxes', qtyRange: [24, 72], weightPerUnit: 5.5, velocityClass: 'B' },
  { prefix: 'IND', name: 'High-Torque Planetary Gearmotor', unit: 'units', qtyRange: [8, 24], weightPerUnit: 26.0, velocityClass: 'C' },
  { prefix: 'CHEM', name: 'Industrial Epoxy Resin Drum 25kg', unit: 'drums', qtyRange: [6, 16], weightPerUnit: 27.5, velocityClass: 'C' },
  { prefix: 'SOLAR', name: 'Monocrystalline PV Module 450W', unit: 'panels', qtyRange: [15, 40], weightPerUnit: 22.0, velocityClass: 'B' },
];

/**
 * Deterministically generates realistic SKU and lot data for a given bin ID.
 */
export function generateMockSkuData(binId: string) {
  let hash = 0;
  for (let i = 0; i < binId.length; i++) {
    hash = (hash << 5) - hash + binId.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const template = MOCK_SKU_CATALOG[absHash % MOCK_SKU_CATALOG.length];

  const qtySpread = template.qtyRange[1] - template.qtyRange[0];
  const quantity = template.qtyRange[0] + ((absHash >> 3) % (qtySpread + 1));
  const weightKg = Math.round(quantity * template.weightPerUnit * 10) / 10;
  const skuNumber = String(1000 + ((absHash >> 5) % 9000));
  const lotNumber = `LOT-2026-${String(absHash % 99).padStart(2, '0')}-${String((absHash >> 2) % 999).padStart(3, '0')}`;

  const month = String(1 + (absHash % 12)).padStart(2, '0');
  const year = 2027 + (absHash % 3);
  const expiryDate = `${year}-${month}-28`;

  return {
    sku: `${template.prefix}-${skuNumber}`,
    productName: template.name,
    quantity,
    unit: template.unit,
    lotNumber,
    weightKg,
    velocityClass: template.velocityClass,
    expiryDate,
  };
}

/**
 * Heatmap visual palettes and color resolvers.
 */
export const HEATMAP_COLORS = {
  DEFAULT_CARTON: '#cd9f6c',
  WEIGHT: {
    SAFE: '#10b981',      // < 50%
    MODERATE: '#eab308',  // 50% - 75%
    WARNING: '#f97316',   // 75% - 90%
    CRITICAL: '#ef4444',  // 90% - 100%
    OVERLOAD: '#a855f7',  // > 100%
  },
  ABC: {
    A: '#10b981',         // Fast mover - Emerald
    B: '#f59e0b',         // Medium mover - Amber
    C: '#64748b',         // Slow mover - Slate
  },
  OCCUPANCY: {
    LOW: '#38bdf8',       // < 40%
    MEDIUM: '#f59e0b',    // 40% - 75%
    HIGH: '#ef4444',      // > 75%
  },
} as const;

export function resolveWeightStressColor(weightKg: number, maxWeightKg: number): string {
  const ratio = maxWeightKg > 0 ? weightKg / maxWeightKg : 0;
  if (ratio > 1.0) return HEATMAP_COLORS.WEIGHT.OVERLOAD;
  if (ratio >= 0.9) return HEATMAP_COLORS.WEIGHT.CRITICAL;
  if (ratio >= 0.75) return HEATMAP_COLORS.WEIGHT.WARNING;
  if (ratio >= 0.5) return HEATMAP_COLORS.WEIGHT.MODERATE;
  return HEATMAP_COLORS.WEIGHT.SAFE;
}

export function resolveAbcVelocityColor(velocityClass?: 'A' | 'B' | 'C'): string {
  if (velocityClass === 'A') return HEATMAP_COLORS.ABC.A;
  if (velocityClass === 'B') return HEATMAP_COLORS.ABC.B;
  return HEATMAP_COLORS.ABC.C;
}

export function resolveOccupancyColor(rackOccupancyRatio: number): string {
  if (rackOccupancyRatio >= 0.75) return HEATMAP_COLORS.OCCUPANCY.HIGH;
  if (rackOccupancyRatio >= 0.4) return HEATMAP_COLORS.OCCUPANCY.MEDIUM;
  return HEATMAP_COLORS.OCCUPANCY.LOW;
}

/** Default Ground Building Level */
export const DEFAULT_GROUND_LEVEL = {
  id: 'level-1',
  name: 'Lantai 1 / Ground',
  elevationY: 0,
  height: 6.0,
  isDefault: true,
  colorHex: '#38bdf8',
} as const;

/** Default Mezzanine Level */
export const DEFAULT_MEZZANINE_LEVEL = {
  id: 'level-2',
  name: 'Lantai 2 / Mezzanine',
  elevationY: 4.5,
  height: 4.0,
  isDefault: false,
  colorHex: '#a855f7',
} as const;

/** Default dimensions and properties for Vertical Connectors */
export const VERTICAL_CONNECTOR_DEFAULTS = {
  cargo_lift: {
    name: 'Cargo Lift',
    width: 3.2,
    depth: 3.2,
    defaultHeight: 4.5,
    minWidth: 2.0,
    maxWidth: 6.0,
    minDepth: 2.0,
    maxDepth: 6.0,
  },
  lift: {
    name: 'Cargo Lift',
    width: 3.2,
    depth: 3.2,
    defaultHeight: 4.5,
    minWidth: 2.0,
    maxWidth: 6.0,
    minDepth: 2.0,
    maxDepth: 6.0,
  },
  ramp: {
    name: 'Access Ramp',
    width: 3.0,
    depth: 8.0,
    defaultHeight: 4.5,
    minWidth: 1.8,
    maxWidth: 6.0,
    minDepth: 4.0,
    maxDepth: 25.0,
  },
  stairs: {
    name: 'Industrial Stairs',
    width: 1.8,
    depth: 4.5,
    defaultHeight: 4.5,
    minWidth: 1.2,
    maxWidth: 3.5,
    minDepth: 3.0,
    maxDepth: 10.0,
  },
} as const;

/** Multi-tier vertical transit parameters */
export const VERTICAL_TRANSIT_PARAMS = {
  LIFT_SPEED_MPS: 0.8, // Vertical lift transit speed in meters per second
  LIFT_DOOR_DELAY_SEC: 2.0, // Door opening/closing delay per floor
  RAMP_SPEED_MULTIPLIER: 0.8, // Speed reduction when climbing inclined ramp
  STAIRS_SPEED_MPS: 0.9, // Manual walking speed on stairs
} as const;

