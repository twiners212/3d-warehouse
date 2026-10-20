import type { Size3D, Vector3D } from './spatial';
import type { PickingRouteConfig } from './routing';

export type RackType =
  | 'selective_pallet'
  | 'cantilever'
  | 'shelving'
  | 'double_deep'
  | 'drive_in'
  | 'push_back'
  | 'mezzanine';

export type StructuralItemType = 'wall' | 'column' | 'dock_door' | 'bollard' | 'charging_dock';

export type ZoneType = 'receiving' | 'storage' | 'picking' | 'quarantine' | 'shipping';

export type HeatmapMetric = 'NONE' | 'OCCUPANCY' | 'WEIGHT_STRESS' | 'ABC_VELOCITY';

export interface BinSkuData {
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  lotNumber: string;
  weightKg: number;
  velocityClass?: 'A' | 'B' | 'C';
  expiryDate?: string;
}

export interface BinSlot {
  id: string; // Canonical address "[RACK]-[BAY:2]-[LEVEL:2]" or "[RACK]-[BAY:2]-[LEVEL:2]-[SLOT]" e.g. "A01-02-03" or "A01-02-03-A"
  rackId: string;
  bayIndex: number; // 1-indexed
  levelIndex: number; // 1-indexed
  slotPosition?: string; // e.g. "A", "B", "FL", "FR", "BL", "BR", "01", "D01", "P1"
  containerType?: 'pallet' | 'tote' | 'carton' | 'open_bin' | 'long_goods';
  relativePosition: Vector3D; // Local offset in parent rack space (SPATIAL-MODEL.md Section 4)
  dimension: Size3D;
  maxWeightKg: number;
  isOccupied: boolean;
  skuData?: BinSkuData;
}

export interface RackEntity {
  id: string;
  name: string; // Aisle identifier e.g. "A01"
  type: RackType;
  position: Vector3D; // World-space pivot: Bottom-Center (Xc, Y=0, Zc) (SPATIAL-MODEL.md Section 2)
  rotationY: number; // Radians in {0, PI/2, PI, 3PI/2} (SPATIAL-MODEL.md Section 3)
  dimensions: Size3D; // Total bounding volume
  bays: number; // >= 1
  levels: number; // >= 1
  levelHeight: number; // meters per vertical tier
  bayWidth: number; // meters per horizontal bay
  bayDepth: number; // depth of rack frame in meters
  bins: BinSlot[];
  levelId?: string;
}

export interface ZonePalletSlot {
  id: string; // Canonical address e.g. "RCV-01-P01"
  slotIndex: number; // 1-indexed
  gridRow: number;
  gridCol: number;
  relativePosition: Vector3D; // Local offset from zone center
  isOccupied: boolean;
  skuData?: BinSkuData;
}

export interface ZoneStagingConfig {
  enabled: boolean;
  slots?: ZonePalletSlot[];
  palletWidth?: number;
  palletDepth?: number;
}

export interface WarehouseZone {
  id: string;
  name: string;
  colorHex: string;
  type: ZoneType;
  position: Vector3D;
  dimensions: Size3D;
  polygon?: Array<{ x: number; z: number }>; // Optional polygon coordinates
  stagingConfig?: ZoneStagingConfig;
  levelId?: string;
}

export interface StructuralElement {
  id: string;
  name: string;
  type: StructuralItemType;
  position: Vector3D;
  dimensions: Size3D;
  rotationY: number;
  levelId?: string;
}

export interface BuildingLevel {
  id: string; // e.g. "level-1", "level-2"
  name: string; // e.g. "Lantai 1 / Ground", "Lantai 2 / Mezzanine"
  elevationY: number; // Base height of floor in meters (0, 4.5, 9.0)
  height: number; // Clearance height to next ceiling / floor slab
  orderIndex?: number;
  type?: 'GROUND' | 'MEZZANINE' | 'UPPER';
  isDefault?: boolean;
  colorHex?: string;
}

export type VerticalConnectorType = 'cargo_lift' | 'lift' | 'ramp' | 'stairs';

export interface VerticalConnector {
  id: string;
  name: string;
  type: VerticalConnectorType;
  fromLevelId: string;
  toLevelId: string;
  position: Vector3D;
  dimensions: Size3D;
  rotationY: number;
}

export interface WarehouseLayoutBlueprint {
  id: string;
  name: string;
  floorDimensions: Size3D;
  gridSnapStep: number; // Default: 0.5m
  zones: WarehouseZone[];
  racks: RackEntity[];
  structuralElements: StructuralElement[];
  buildingLevels?: BuildingLevel[];
  verticalConnectors?: VerticalConnector[];
  pickingConfig?: PickingRouteConfig;
  createdAt: string;
  updatedAt: string;
}


