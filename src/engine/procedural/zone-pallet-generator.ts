// Fulfills Phase 39: Procedural Staging Pallet Generator for Operational Zones
// Generates standard Euro/ISO pallet layouts, spacing, and 3D instance matrices for floor staging areas.

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { BinSkuData, WarehouseZone, ZonePalletSlot, ZoneType } from '@/types/layout';
import { DEFAULT_PALLET_OCCUPANCY_RATIO } from '@/lib/constants/warehouse-defaults';

export const STANDARD_PALLET_WIDTH = 1.2; // meters (X)
export const STANDARD_PALLET_DEPTH = 1.0; // meters (Z)
export const STANDARD_PALLET_HEIGHT = 0.144; // meters (Y)
export const PALLET_CORRIDOR_GAP_X = 0.45; // meters aisle gap between pallets
export const PALLET_CORRIDOR_GAP_Z = 0.45; // meters lane gap between pallets
export const ZONE_PERIMETER_MARGIN = 0.5; // meters buffer from zone boundary line

export interface ZonePalletInstanceSets {
  pallets: Matrix4[];
  cartons: Matrix4[];
  occupiedSlots: ZonePalletSlot[];
  allSlots: ZonePalletSlot[];
}

/**
 * Checks whether an operational zone should display staging pallets.
 * Enabled by default for receiving, shipping, and picking/staging zones.
 */
export function isZoneStagingEligible(zone: WarehouseZone): boolean {
  if (zone.stagingConfig?.enabled !== undefined) {
    return zone.stagingConfig.enabled;
  }
  return zone.type === 'receiving' || zone.type === 'shipping' || zone.type === 'picking';
}

/**
 * Generates realistic mock SKU data tailored for Inbound/Outbound staging pallets.
 */
export function generateMockZonePalletSku(zoneType: ZoneType, slotIndex: number): BinSkuData {
  const categories = [
    { name: 'Industrial Servo Motors', prefix: 'MOT', weight: 450, unit: 'crates' },
    { name: 'Lithium Battery Packs', prefix: 'BAT', weight: 620, unit: 'crates' },
    { name: 'Hydraulic Valve Manifolds', prefix: 'HYD', weight: 380, unit: 'crates' },
    { name: 'Pneumatic Actuators', prefix: 'PNE', weight: 290, unit: 'crates' },
    { name: 'Control Circuit Boards', prefix: 'PCB', weight: 180, unit: 'cartons' },
    { name: 'Heavy Duty Caster Wheels', prefix: 'CST', weight: 520, unit: 'crates' },
  ];

  const cat = categories[slotIndex % categories.length];
  const lotYear = new Date().getFullYear();
  const lotNum = `LOT-${lotYear}-${zoneType.slice(0, 3).toUpperCase()}-${(slotIndex + 1).toString().padStart(3, '0')}`;
  const sku = `SKU-${cat.prefix}-${(1000 + (slotIndex * 17) % 9000)}`;

  return {
    sku,
    productName: cat.name,
    quantity: 24 + ((slotIndex * 7) % 48),
    unit: cat.unit,
    lotNumber: lotNum,
    weightKg: cat.weight,
    velocityClass: (['A', 'B', 'C'] as const)[slotIndex % 3],
  };
}

/**
 * Calculates deterministic grid slots for staging pallets within a zone footprint.
 * Preserves existing occupancy and SKU modifications if present in zone.stagingConfig.
 */
export function calculateZonePalletSlots(zone: WarehouseZone): ZonePalletSlot[] {
  if (!isZoneStagingEligible(zone)) {
    return [];
  }

  const width = zone.dimensions?.width ?? 10;
  const depth = zone.dimensions?.depth ?? 10;

  const palletW = zone.stagingConfig?.palletWidth ?? STANDARD_PALLET_WIDTH;
  const palletD = zone.stagingConfig?.palletDepth ?? STANDARD_PALLET_DEPTH;

  const colPitch = palletW + PALLET_CORRIDOR_GAP_X;
  const rowPitch = palletD + PALLET_CORRIDOR_GAP_Z;

  const usableWidth = Math.max(0.5, width - 2 * ZONE_PERIMETER_MARGIN);
  const usableDepth = Math.max(0.5, depth - 2 * ZONE_PERIMETER_MARGIN);

  const cols = Math.max(1, Math.floor((usableWidth + PALLET_CORRIDOR_GAP_X) / colPitch));
  const rows = Math.max(1, Math.floor((usableDepth + PALLET_CORRIDOR_GAP_Z) / rowPitch));

  const totalGridWidth = cols * palletW + (cols - 1) * PALLET_CORRIDOR_GAP_X;
  const totalGridDepth = rows * palletD + (rows - 1) * PALLET_CORRIDOR_GAP_Z;

  const startX = -totalGridWidth / 2 + palletW / 2;
  const startZ = -totalGridDepth / 2 + palletD / 2;

  const existingMap = new Map<string, ZonePalletSlot>();
  if (zone.stagingConfig?.slots) {
    for (const slot of zone.stagingConfig.slots) {
      existingMap.set(slot.id, slot);
      existingMap.set(`index-${slot.slotIndex}`, slot);
    }
  }

  const slots: ZonePalletSlot[] = [];
  let slotIndex = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * colPitch;
      const z = startZ + r * rowPitch;
      const id = `${zone.name.replace(/\s+/g, '-').toUpperCase()}-P${slotIndex.toString().padStart(2, '0')}`;

      // Check if this slot was previously configured
      const existing = existingMap.get(id) || existingMap.get(`index-${slotIndex}`);
      const occupancyMod = Math.max(2, Math.round(1 / (1 - DEFAULT_PALLET_OCCUPANCY_RATIO)));
      const isOccupied = existing ? existing.isOccupied : slotIndex % occupancyMod !== 0;
      let skuData = existing?.skuData;

      if (isOccupied && !skuData) {
        skuData = generateMockZonePalletSku(zone.type, slotIndex);
      }

      slots.push({
        id,
        slotIndex,
        gridRow: r + 1,
        gridCol: c + 1,
        relativePosition: { x, y: 0, z },
        isOccupied,
        skuData,
      });

      slotIndex++;
    }
  }

  return slots;
}

function createMatrix4(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number
): Matrix4 {
  const pos = new Vector3(x, y, z);
  const rot = new Quaternion();
  const scale = new Vector3(sx, sy, sz);
  return new Matrix4().compose(pos, rot, scale);
}

/**
 * Generates Three.js Matrix4 sets for instanced rendering of wooden Euro-pallets and cargo cartons.
 */
export function generateZonePalletInstances(
  zone: WarehouseZone,
  slots: ZonePalletSlot[]
): ZonePalletInstanceSets {
  const pallets: Matrix4[] = [];
  const cartons: Matrix4[] = [];
  const occupiedSlots: ZonePalletSlot[] = [];

  const palletW = zone.stagingConfig?.palletWidth ?? STANDARD_PALLET_WIDTH;
  const palletD = zone.stagingConfig?.palletDepth ?? STANDARD_PALLET_DEPTH;
  const palletH = STANDARD_PALLET_HEIGHT;

  for (const slot of slots) {
    const x = slot.relativePosition.x;
    const z = slot.relativePosition.z;
    const palletY = palletH / 2;

    // Pallet base matrix
    pallets.push(createMatrix4(x, palletY, z, palletW, palletH, palletD));

    if (slot.isOccupied) {
      occupiedSlots.push(slot);

      // Deterministic carton stack height and shape
      let hash = 0;
      for (let i = 0; i < slot.id.length; i++) {
        hash = (hash << 5) - hash + slot.id.charCodeAt(i);
        hash |= 0;
      }
      const absHash = Math.abs(hash);

      const cartonH = 0.65 + (absHash % 40) / 100; // 0.65m to 1.05m stack
      const cartonW = palletW * 0.94;
      const cartonD = palletD * 0.94;
      const cartonY = palletH + cartonH / 2;

      cartons.push(createMatrix4(x, cartonY, z, cartonW, cartonH, cartonD));
    }
  }

  return { pallets, cartons, occupiedSlots, allSlots: slots };
}
