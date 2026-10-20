// Fulfills DATA-MODEL.md Section 6 Runtime Validation Schemas
// Zod contracts validated at every payload boundary (server actions, imports).

import { z } from 'zod';
import {
  RACK_PARAM_CLAMPS,
  MAX_BUILDING_LEVELS,
} from '@/lib/constants/warehouse-defaults';

export const Vector3DSchema = z.object({
  x: z.number(),
  y: z.number().min(0, 'Y elevation cannot be negative'),
  z: z.number(),
});

export const Size3DSchema = z.object({
  width: z.number().positive('Width must be greater than 0'),
  height: z.number().positive('Height must be greater than 0'),
  depth: z.number().positive('Depth must be greater than 0'),
});

export const BinSkuDataSchema = z.object({
  sku: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  unit: z.string().default('units'),
  lotNumber: z.string().default(''),
  weightKg: z.number().nonnegative().default(0),
  velocityClass: z.enum(['A', 'B', 'C']).optional(),
  expiryDate: z.string().optional(),
});

// Bin ID canonical address pattern "[RACK]-[BAY:2]-[LEVEL:2]" or "[RACK]-[BAY:2]-[LEVEL:2]-[SLOT]" (DATA-MODEL.md Section 3.3)
export const BinSlotSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]+-\d{2}-\d{2}(-[A-Z0-9]+)?$/, 'Bin ID must follow pattern [RACK]-[BAY:2]-[LEVEL:2] or [RACK]-[BAY:2]-[LEVEL:2]-[SLOT]'),
  rackId: z.string().min(1),
  bayIndex: z.number().int().positive(),
  levelIndex: z.number().int().positive(),
  slotPosition: z.string().optional(),
  containerType: z.enum(['pallet', 'tote', 'carton', 'open_bin', 'long_goods']).optional(),
  relativePosition: Vector3DSchema,
  dimension: Size3DSchema,
  maxWeightKg: z.number().positive().default(1000.0),
  isOccupied: z.boolean().default(false),
  skuData: BinSkuDataSchema.optional(),
});

const c = RACK_PARAM_CLAMPS;

export const RackEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  type: z.enum([
    'selective_pallet',
    'cantilever',
    'shelving',
    'double_deep',
    'drive_in',
    'push_back',
    'mezzanine',
  ]),
  position: Vector3DSchema,
  rotationY: z.number(),
  dimensions: Size3DSchema,
  bays: z.number().int().min(c.minBays).max(c.maxBays),
  levels: z.number().int().min(c.minLevels).max(c.maxLevels),
  bayWidth: z.number().min(c.minBayWidth).max(c.maxBayWidth),
  bayDepth: z.number().min(c.minBayDepth).max(c.maxBayDepth),
  levelHeight: z.number().min(c.minLevelHeight).max(c.maxLevelHeight),
  bins: z.array(BinSlotSchema),
  levelId: z.string().optional(),
});

export const ZonePalletSlotSchema = z.object({
  id: z.string().min(1),
  slotIndex: z.number().int().min(1),
  gridRow: z.number().int(),
  gridCol: z.number().int(),
  relativePosition: Vector3DSchema,
  isOccupied: z.boolean().default(false),
  skuData: BinSkuDataSchema.optional(),
});

export const ZoneStagingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  slots: z.array(ZonePalletSlotSchema).optional(),
  palletWidth: z.number().positive().optional(),
  palletDepth: z.number().positive().optional(),
});

export const WarehouseZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colorHex: z.string(),
  type: z.enum(['receiving', 'storage', 'picking', 'quarantine', 'shipping']),
  position: Vector3DSchema.default({ x: 0, y: 0, z: 0 }),
  dimensions: Size3DSchema.default({ width: 10, height: 0.1, depth: 10 }),
  polygon: z.array(z.object({ x: z.number(), z: z.number() })).optional(),
  stagingConfig: ZoneStagingConfigSchema.optional(),
  levelId: z.string().optional(),
});

export const StructuralElementSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Structure'),
  type: z.enum(['wall', 'column', 'dock_door', 'bollard', 'charging_dock']),
  position: Vector3DSchema,
  dimensions: Size3DSchema,
  rotationY: z.number().default(0),
  levelId: z.string().optional(),
});

export const BuildingLevelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  elevationY: z.number().min(0),
  height: z.number().min(2),
  orderIndex: z.number().int().nonnegative().optional(),
  type: z.enum(['GROUND', 'MEZZANINE', 'UPPER']).optional(),
  isDefault: z.boolean().optional(),
  colorHex: z.string().optional(),
});

export const VerticalConnectorSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Connector'),
  type: z.enum(['cargo_lift', 'lift', 'ramp', 'stairs']),
  fromLevelId: z.string(),
  toLevelId: z.string(),
  position: Vector3DSchema,
  dimensions: Size3DSchema,
  rotationY: z.number().default(0),
});

export const PickItemSchema = z.object({
  binId: z.string(),
  rackId: z.string(),
  rackName: z.string(),
  bayIndex: z.number(),
  levelIndex: z.number(),
  position3D: Vector3DSchema,
  accessPoint3D: Vector3DSchema,
  sku: z.string(),
  productName: z.string(),
  quantity: z.number(),
  weightKg: z.number(),
  isPicked: z.boolean().default(false),
  levelId: z.string().optional(),
});

export const CustomWaypointSchema = z.object({
  id: z.string(),
  x: z.number(),
  z: z.number(),
  name: z.string().optional(),
  insertAfterStopIndex: z.number(),
});

export const FleetAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  vehicleType: z.enum(['FORKLIFT', 'AGV', 'CART']),
  color: z.string(),
  batteryLevel: z.number().min(0).max(100).default(100),
  status: z.enum([
    'IDLE',
    'MOVING',
    'PICKING',
    'YIELDING',
    'RETURNING_TO_DOCK',
    'CHARGING',
  ]).default('IDLE'),
  currentSpeedMps: z.number().nonnegative().default(0),
  assignedPickList: z.array(PickItemSchema).default([]),
  routeResult: z.any().nullable().optional(),
  progress: z.number().min(0).max(1).default(0),
  currentStopIndex: z.number().int().nonnegative().default(0),
  position3D: Vector3DSchema.default({ x: 0, y: 0, z: 0 }),
  headingRad: z.number().default(0),
  homeDockId: z.string().optional(),
  isYielding: z.boolean().optional(),
  yieldReason: z.string().optional(),
  levelId: z.string().default('level-1'),
  levelName: z.string().optional(),
});

export const TrafficAlertSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['PROXIMITY_WARNING', 'INTERSECTION_YIELD', 'LOW_BATTERY', 'BLOCKED_CORRIDOR']),
  vehicleIdA: z.string(),
  vehicleIdB: z.string().optional(),
  position: Vector3DSchema,
  timestamp: z.number(),
  message: z.string(),
});

export const PickingRouteConfigSchema = z.object({
  pickList: z.array(PickItemSchema).default([]),
  customWaypoints: z.array(CustomWaypointSchema).default([]),
  depotPosition: z.object({ x: z.number(), z: z.number() }),
  selectedVehicleType: z.enum(['FORKLIFT', 'AGV', 'CART']).optional(),
  isManualSequence: z.boolean().optional(),
  fleet: z.array(FleetAgentSchema).optional(),
});

export const WarehouseBlueprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  gridSnapStep: z.number().default(0.5),
  floorDimensions: Size3DSchema,
  zones: z.array(WarehouseZoneSchema).default([]),
  structuralElements: z.array(StructuralElementSchema).default([]),
  racks: z.array(RackEntitySchema).default([]),
  buildingLevels: z
    .array(BuildingLevelSchema)
    .max(MAX_BUILDING_LEVELS, `Maksimal ${MAX_BUILDING_LEVELS} tingkat lantai gudang diizinkan`)
    .optional(),
  verticalConnectors: z.array(VerticalConnectorSchema).optional(),
  pickingConfig: PickingRouteConfigSchema.optional(),
});

export type ValidatedBlueprint = z.infer<typeof WarehouseBlueprintSchema>;
export type ValidatedRack = z.infer<typeof RackEntitySchema>;
export type ValidatedBin = z.infer<typeof BinSlotSchema>;
export type ValidatedZone = z.infer<typeof WarehouseZoneSchema>;
export type ValidatedStructure = z.infer<typeof StructuralElementSchema>;
export type ValidatedBuildingLevel = z.infer<typeof BuildingLevelSchema>;
export type ValidatedVerticalConnector = z.infer<typeof VerticalConnectorSchema>;
export type ValidatedPickingConfig = z.infer<typeof PickingRouteConfigSchema>;


