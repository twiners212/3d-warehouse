// Fulfills PRD.md Section 4.4 Auto-Naming & Bin Coordinate Engine
// and SPATIAL-MODEL.md Section 4 Parametric Bin Coordinate Calculation.

import type { BinSlot, RackEntity, RackType } from '@/types/layout';
import { DEFAULT_BIN_MAX_WEIGHT_KG } from '@/lib/constants/warehouse-defaults';

/**
 * Returns physical slot multiplier per bay-level according to warehouse racking standard.
 */
export function getSlotsPerBayLevel(type?: RackType): number {
  switch (type) {
    case 'selective_pallet':
      return 2; // 2 pallet positions side-by-side per beam
    case 'double_deep':
      return 4; // 2 wide x 2 deep = 4 pallet positions per tier
    case 'drive_in':
      return 3; // 3 deep LIFO lane positions per tier
    case 'push_back':
      return 3; // 3 deep gravity nested carts per tier
    case 'shelving':
      return 3; // 3 small-parts tote/carton compartments per shelf
    case 'cantilever':
      return 1; // 1 continuous long goods slot per arm tier
    case 'mezzanine':
      return 1; // platform deck space
    default:
      return 2;
  }
}

/**
 * Deterministic bin ID: "[RackName]-[Bay:2]-[Level:2]" or with slot suffix "[RackName]-[Bay:2]-[Level:2]-[Suffix]"
 * b in [1, B] left-to-right, l in [1, L] bottom-to-top.
 */
export function generateBinId(
  rackName: string,
  bayIndex: number,
  levelIndex: number,
  positionSuffix?: string
): string {
  const base = `${rackName}-${String(bayIndex).padStart(2, '0')}-${String(levelIndex).padStart(2, '0')}`;
  return positionSuffix ? `${base}-${positionSuffix}` : base;
}

/**
 * Local X offset for bay b relative to the rack's bottom-center pivot:
 *   X_local(b) = (b - 1) * w_bay - W/2 + w_bay/2
 */
export function calculateBinLocalX(bayIndex: number, rackWidth: number, bayWidth: number): number {
  return (bayIndex - 1) * bayWidth - rackWidth / 2 + bayWidth / 2;
}

/** Local Y offset for level l: Y_local(l) = (l - 1) * h_level */
export function calculateBinLocalY(levelIndex: number, levelHeight: number): number {
  return (levelIndex - 1) * levelHeight;
}

/** Regenerates the full deterministic multi-slot bin set tailored to the specific storage rack type. */
export function generateBinsForRack(
  rack: Pick<RackEntity, 'id' | 'name' | 'bays' | 'levels' | 'dimensions' | 'bayWidth' | 'levelHeight'> & {
    type?: RackType;
    bayDepth?: number;
  }
): BinSlot[] {
  const bins: BinSlot[] = [];
  const type = rack.type ?? 'selective_pallet';
  const rackDepth = rack.bayDepth ?? (rack.dimensions.depth > 0 ? rack.dimensions.depth : 1.1);

  for (let b = 1; b <= rack.bays; b++) {
    const bayCenterX = calculateBinLocalX(b, rack.bayWidth * rack.bays, rack.bayWidth);

    for (let l = 1; l <= rack.levels; l++) {
      const bayFloorY = calculateBinLocalY(l, rack.levelHeight);

      if (type === 'selective_pallet') {
        // 2 Pallet slots side-by-side: -A (Left), -B (Right)
        const slotWidth = rack.bayWidth / 2;
        const leftX = bayCenterX - slotWidth / 2;
        const rightX = bayCenterX + slotWidth / 2;

        bins.push({
          id: generateBinId(rack.name, b, l, 'A'),
          rackId: rack.id,
          bayIndex: b,
          levelIndex: l,
          slotPosition: 'A',
          containerType: 'pallet',
          relativePosition: { x: leftX, y: bayFloorY, z: 0 },
          dimension: { width: slotWidth, height: rack.levelHeight, depth: rackDepth },
          maxWeightKg: DEFAULT_BIN_MAX_WEIGHT_KG,
          isOccupied: false,
        });

        bins.push({
          id: generateBinId(rack.name, b, l, 'B'),
          rackId: rack.id,
          bayIndex: b,
          levelIndex: l,
          slotPosition: 'B',
          containerType: 'pallet',
          relativePosition: { x: rightX, y: bayFloorY, z: 0 },
          dimension: { width: slotWidth, height: rack.levelHeight, depth: rackDepth },
          maxWeightKg: DEFAULT_BIN_MAX_WEIGHT_KG,
          isOccupied: false,
        });
      } else if (type === 'double_deep') {
        // 4 Pallet slots: 2 wide x 2 deep (-FL, -FR, -BL, -BR)
        const slotWidth = rack.bayWidth / 2;
        const slotDepth = rackDepth / 2;
        const leftX = bayCenterX - slotWidth / 2;
        const rightX = bayCenterX + slotWidth / 2;
        const frontZ = slotDepth / 2;
        const backZ = -slotDepth / 2;

        const positions: Array<{ suffix: string; x: number; z: number }> = [
          { suffix: 'FL', x: leftX, z: frontZ },
          { suffix: 'FR', x: rightX, z: frontZ },
          { suffix: 'BL', x: leftX, z: backZ },
          { suffix: 'BR', x: rightX, z: backZ },
        ];

        for (const pos of positions) {
          bins.push({
            id: generateBinId(rack.name, b, l, pos.suffix),
            rackId: rack.id,
            bayIndex: b,
            levelIndex: l,
            slotPosition: pos.suffix,
            containerType: 'pallet',
            relativePosition: { x: pos.x, y: bayFloorY, z: pos.z },
            dimension: { width: slotWidth, height: rack.levelHeight, depth: slotDepth },
            maxWeightKg: DEFAULT_BIN_MAX_WEIGHT_KG,
            isOccupied: false,
          });
        }
      } else if (type === 'drive_in') {
        // 3 Pallet slots deep along the lane (-D01 front, -D02 mid, -D03 back)
        const laneSlots = 3;
        const slotDepth = rackDepth / laneSlots;
        for (let d = 0; d < laneSlots; d++) {
          const suffix = `D0${d + 1}`;
          const zPos = rackDepth / 2 - slotDepth / 2 - d * slotDepth;
          bins.push({
            id: generateBinId(rack.name, b, l, suffix),
            rackId: rack.id,
            bayIndex: b,
            levelIndex: l,
            slotPosition: suffix,
            containerType: 'pallet',
            relativePosition: { x: bayCenterX, y: bayFloorY, z: zPos },
            dimension: { width: rack.bayWidth, height: rack.levelHeight, depth: slotDepth },
            maxWeightKg: DEFAULT_BIN_MAX_WEIGHT_KG,
            isOccupied: false,
          });
        }
      } else if (type === 'push_back') {
        // 3 Nested cart slots (-P1 front, -P2 mid, -P3 back)
        const cartSlots = 3;
        const slotDepth = rackDepth / cartSlots;
        for (let p = 0; p < cartSlots; p++) {
          const suffix = `P${p + 1}`;
          const zPos = rackDepth / 2 - slotDepth / 2 - p * slotDepth;
          bins.push({
            id: generateBinId(rack.name, b, l, suffix),
            rackId: rack.id,
            bayIndex: b,
            levelIndex: l,
            slotPosition: suffix,
            containerType: 'pallet',
            relativePosition: { x: bayCenterX, y: bayFloorY, z: zPos },
            dimension: { width: rack.bayWidth, height: rack.levelHeight, depth: slotDepth },
            maxWeightKg: DEFAULT_BIN_MAX_WEIGHT_KG,
            isOccupied: false,
          });
        }
      } else if (type === 'shelving') {
        // 3 Small parts compartments per shelf tier (-01, -02, -03)
        const compCount = 3;
        const compWidth = rack.bayWidth / compCount;
        for (let c = 0; c < compCount; c++) {
          const suffix = String(c + 1).padStart(2, '0');
          const compX = bayCenterX - rack.bayWidth / 2 + compWidth / 2 + c * compWidth;
          bins.push({
            id: generateBinId(rack.name, b, l, suffix),
            rackId: rack.id,
            bayIndex: b,
            levelIndex: l,
            slotPosition: suffix,
            containerType: 'tote',
            relativePosition: { x: compX, y: bayFloorY, z: 0 },
            dimension: { width: compWidth, height: rack.levelHeight, depth: rackDepth },
            maxWeightKg: 150.0, // Hand-loaded tote capacity
            isOccupied: false,
          });
        }
      } else if (type === 'cantilever') {
        // 1 Continuous long-goods slot per arm tier (-CG1)
        bins.push({
          id: generateBinId(rack.name, b, l, 'CG1'),
          rackId: rack.id,
          bayIndex: b,
          levelIndex: l,
          slotPosition: 'CG1',
          containerType: 'long_goods',
          relativePosition: { x: bayCenterX, y: bayFloorY, z: 0 },
          dimension: { width: rack.bayWidth, height: rack.levelHeight, depth: rackDepth },
          maxWeightKg: 2000.0,
          isOccupied: false,
        });
      } else if (type === 'mezzanine') {
        // Mezzanine platform deck: storage slots sit ON TOP of each elevated deck tier.
        // Headroom underneath (0 to height) remains clear for ground-floor forklift corridors / operations.
        const tierDeckY = (l + 1) * rack.levelHeight;
        const slotH = 1.8; // 1.8m usable vertical storage clearance envelope on top of mezzanine deck
        bins.push({
          id: generateBinId(rack.name, b, l),
          rackId: rack.id,
          bayIndex: b,
          levelIndex: l,
          slotPosition: 'TOP',
          containerType: 'pallet',
          relativePosition: { x: bayCenterX, y: tierDeckY, z: 0 },
          dimension: { width: rack.bayWidth, height: slotH, depth: rackDepth },
          maxWeightKg: 1500.0,
          isOccupied: false,
        });
      } else {
        // Default single-slot
        bins.push({
          id: generateBinId(rack.name, b, l),
          rackId: rack.id,
          bayIndex: b,
          levelIndex: l,
          relativePosition: { x: bayCenterX, y: bayFloorY, z: 0 },
          dimension: { width: rack.bayWidth, height: rack.levelHeight, depth: rackDepth },
          maxWeightKg: DEFAULT_BIN_MAX_WEIGHT_KG,
          isOccupied: false,
        });
      }
    }
  }

  return bins;
}

/** Derives total rack bounding dimensions from its parametric config. */
export function deriveRackDimensions(config: {
  bays: number;
  levels: number;
  bayWidth: number;
  bayDepth: number;
  levelHeight: number;
}): { width: number; height: number; depth: number } {
  return {
    width: config.bays * config.bayWidth,
    height: config.levels * config.levelHeight,
    depth: config.bayDepth,
  };
}
