// Fulfills ARCHITECTURE.md Section 4.1 Instanced Geometry Composition.
// Builds transformation matrices for shared THREE.InstancedMesh nodes so one
// rack renders as 3 draw calls (uprights, beams, decks) regardless of slots.
// All matrices are in rack LOCAL space; pivot is Bottom-Center (SPATIAL-MODEL §2).

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { BinSlot, RackEntity } from '@/types/layout';

/** Structural member cross-sections in meters */
export const RACK_MEMBERS = {
  uprightThickness: 0.1,
  beamDepth: 0.06,
  beamHeight: 0.1,
} as const;

const IDENTITY_QUATERNION = new Quaternion();

function createMatrix4(
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number
): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    IDENTITY_QUATERNION,
    new Vector3(scaleX, scaleY, scaleZ)
  );
}

/**
 * Upright frames: 1 instance per bay boundary per side (front/rear rails).
 * Local x runs from -W/2 to +W/2 across bays + 1 boundaries.
 */
/**
 * Upright frames: tailored to rack type (e.g. open-arm rear masts for cantilever, 
 * tandem uprights for double deep, drive-in tunnel posts).
 */
export function generateUprightMatrices(rack: RackEntity): Matrix4[] {
  const matrices: Matrix4[] = [];
  const halfW = rack.dimensions.width / 2;
  const t = RACK_MEMBERS.uprightThickness;
  const halfDepth = rack.bayDepth / 2;

  if (rack.type === 'cantilever') {
    // Cantilever Rack: Heavy rear column masts + forward floor base feet (NO front columns!)
    for (let b = 0; b <= rack.bays; b++) {
      const xPos = -halfW + b * rack.bayWidth;
      // Heavy rear vertical column mast
      matrices.push(createMatrix4(xPos, rack.dimensions.height / 2, -halfDepth + t / 2, t * 1.5, rack.dimensions.height, t * 1.5));
      // Base foot extending forward along the floor to prevent tipping
      matrices.push(createMatrix4(xPos, t / 2, 0, t * 1.3, t, rack.bayDepth));
    }
    return matrices;
  }

  // Standard, Double-Deep, Drive-In, Push-Back, Shelving, Mezzanine
  for (let b = 0; b <= rack.bays; b++) {
    const xPos = -halfW + b * rack.bayWidth;
    // Rear rail (z-) and front rail (z+)
    matrices.push(createMatrix4(xPos, rack.dimensions.height / 2, -halfDepth, t, rack.dimensions.height, t));
    matrices.push(createMatrix4(xPos, rack.dimensions.height / 2, halfDepth, t, rack.dimensions.height, t));

    if (rack.type === 'double_deep') {
      // Middle tandem upright frame for 2.2m double-deep depth stability
      matrices.push(createMatrix4(xPos, rack.dimensions.height / 2, 0, t, rack.dimensions.height, t));
    }
  }

  return matrices;
}

/**
 * Horizontal load beams & guide rails:
 * - Cantilever: forward-projecting load arms at each level tier + rear cross-bracing ties.
 * - Drive-In: continuous side pallet runner rails along lane depth + top tie beam (NO entry-blocking front beams).
 * - Push-Back: front/rear load beams + inclined gravity rail runners.
 * - Double-Deep & Standard: front, middle (if double deep), and rear load beams.
 */
export function generateBeamMatrices(rack: RackEntity): Matrix4[] {
  const matrices: Matrix4[] = [];
  const halfW = rack.dimensions.width / 2;
  const halfDepth = rack.bayDepth / 2;
  const t = RACK_MEMBERS.uprightThickness;

  if (rack.type === 'cantilever') {
    const armLength = rack.bayDepth * 0.88;
    const armZ = -halfDepth + armLength / 2;

    for (let l = 1; l <= rack.levels; l++) {
      const yPos = l * rack.levelHeight - RACK_MEMBERS.beamHeight / 2;

      // Forward-projecting cantilever load arms attached to each mast
      for (let b = 0; b <= rack.bays; b++) {
        const xPos = -halfW + b * rack.bayWidth;
        matrices.push(createMatrix4(xPos, yPos, armZ, t * 0.9, RACK_MEMBERS.beamHeight, armLength));
      }

      // Rear cross-tie beams between vertical masts for rigid framework
      for (let b = 0; b < rack.bays; b++) {
        const bayCenterX = -halfW + b * rack.bayWidth + rack.bayWidth / 2;
        matrices.push(createMatrix4(bayCenterX, yPos, -halfDepth + t / 2, rack.bayWidth, RACK_MEMBERS.beamHeight, RACK_MEMBERS.beamDepth));
      }
    }
    return matrices;
  }

  if (rack.type === 'drive_in') {
    // Drive-In: Top header tie beams across bay entrances for rigidity
    const topY = rack.dimensions.height - RACK_MEMBERS.beamHeight / 2;
    for (let b = 0; b < rack.bays; b++) {
      const xPos = -halfW + b * rack.bayWidth + rack.bayWidth / 2;
      matrices.push(createMatrix4(xPos, topY, -halfDepth, rack.bayWidth, RACK_MEMBERS.beamHeight, RACK_MEMBERS.beamDepth));
      matrices.push(createMatrix4(xPos, topY, halfDepth, rack.bayWidth, RACK_MEMBERS.beamHeight, RACK_MEMBERS.beamDepth));
    }

    // Continuous side pallet guide runner rails running front-to-back along Z for each lane
    for (let l = 1; l <= rack.levels; l++) {
      const yPos = l * rack.levelHeight - RACK_MEMBERS.beamHeight / 2;
      for (let b = 0; b < rack.bays; b++) {
        const leftX = -halfW + b * rack.bayWidth + t / 2 + 0.04;
        const rightX = -halfW + (b + 1) * rack.bayWidth - t / 2 - 0.04;
        // Left and right pallet runner rails along lane depth
        matrices.push(createMatrix4(leftX, yPos, 0, 0.08, RACK_MEMBERS.beamHeight * 0.7, rack.bayDepth));
        matrices.push(createMatrix4(rightX, yPos, 0, 0.08, RACK_MEMBERS.beamHeight * 0.7, rack.bayDepth));
      }
    }
    return matrices;
  }

  // Selective Pallet, Double-Deep, Push-Back, Shelving, Mezzanine
  for (let l = 1; l <= rack.levels; l++) {
    const yPos = l * rack.levelHeight - RACK_MEMBERS.beamHeight / 2;
    for (let b = 0; b < rack.bays; b++) {
      const xPos = -halfW + b * rack.bayWidth + rack.bayWidth / 2;
      matrices.push(createMatrix4(xPos, yPos, -halfDepth, rack.bayWidth, RACK_MEMBERS.beamHeight, RACK_MEMBERS.beamDepth));
      matrices.push(createMatrix4(xPos, yPos, halfDepth, rack.bayWidth, RACK_MEMBERS.beamHeight, RACK_MEMBERS.beamDepth));

      if (rack.type === 'double_deep') {
        // Middle load beam supporting tandem inner pallets
        matrices.push(createMatrix4(xPos, yPos, 0, rack.bayWidth, RACK_MEMBERS.beamHeight, RACK_MEMBERS.beamDepth));
      }
    }
  }

  return matrices;
}

/**
 * Pallet wire decks / base plates:
 * - Cantilever: 0 decks (open arms for long pipe/timber/bar stock).
 * - Drive-In: 0 decks (pallets rest on side runner rails).
 * - Double-Deep: 2 decks deep per bay.
 * - Shelving, Selective, Push-Back, Mezzanine: full deck plates.
 */
export function generateDeckMatrices(rack: RackEntity): Matrix4[] {
  if (rack.type === 'cantilever' || rack.type === 'drive_in') {
    return []; // Open arms / open drive-in lane
  }

  const matrices: Matrix4[] = [];
  const halfW = rack.dimensions.width / 2;
  const deckThickness = 0.04;

  if (rack.type === 'double_deep') {
    const halfDepth = rack.bayDepth / 2;
    const quarterDepth = rack.bayDepth / 4;
    for (let l = 1; l <= rack.levels; l++) {
      const yPos = l * rack.levelHeight - deckThickness / 2;
      for (let b = 1; b <= rack.bays; b++) {
        const xPos = (b - 1) * rack.bayWidth - halfW + rack.bayWidth / 2;
        // Front deck and Rear deck
        matrices.push(createMatrix4(xPos, yPos, quarterDepth, rack.bayWidth - RACK_MEMBERS.uprightThickness, deckThickness, halfDepth - 0.04));
        matrices.push(createMatrix4(xPos, yPos, -quarterDepth, rack.bayWidth - RACK_MEMBERS.uprightThickness, deckThickness, halfDepth - 0.04));
      }
    }
    return matrices;
  }

  for (let l = 1; l <= rack.levels; l++) {
    const yPos = l * rack.levelHeight - deckThickness / 2;
    for (let b = 1; b <= rack.bays; b++) {
      const xPos = (b - 1) * rack.bayWidth - halfW + rack.bayWidth / 2;
      matrices.push(createMatrix4(xPos, yPos, 0, rack.bayWidth - RACK_MEMBERS.uprightThickness, deckThickness, rack.bayDepth));
    }
  }

  return matrices;
}

export interface RackInstanceSets {
  uprights: Matrix4[];
  beams: Matrix4[];
  decks: Matrix4[];
}

/** Full procedural instance set for one rack entity. */
export function generateRackInstances(rack: RackEntity): RackInstanceSets {
  return {
    uprights: generateUprightMatrices(rack),
    beams: generateBeamMatrices(rack),
    decks: generateDeckMatrices(rack),
  };
}

export interface CargoInstanceSets {
  pallets: Matrix4[];
  cartons: Matrix4[];
  occupiedBinIds: string[];
  occupiedBins: BinSlot[];
}

/**
 * Generates instanced transformation matrices for Euro-pallets and stacked
 * containers/carton boxes for all occupied bins in a rack.
 * Respects bin.relativePosition and bin.dimension for multi-slot layouts.
 */
export function generateCargoInstances(rack: RackEntity): CargoInstanceSets {
  const pallets: Matrix4[] = [];
  const cartons: Matrix4[] = [];
  const occupiedBinIds: string[] = [];
  const occupiedBins: BinSlot[] = [];

  const halfW = rack.dimensions.width / 2;
  const isShelving = rack.type === 'shelving';
  const isCantilever = rack.type === 'cantilever';
  const isMezzanine = rack.type === 'mezzanine';

  for (const bin of rack.bins) {
    if (!bin.isOccupied) continue;

    occupiedBinIds.push(bin.id);
    occupiedBins.push(bin);

    // Calculate slot position in local rack space using parametric relativePosition
    const xPos = bin.relativePosition?.x ?? ((bin.bayIndex - 1) * rack.bayWidth - halfW + rack.bayWidth / 2);
    const floorY = bin.relativePosition?.y ?? (isMezzanine ? rack.dimensions.height : ((bin.levelIndex - 1) * rack.levelHeight));
    const zPos = bin.relativePosition?.z ?? 0;

    const slotW = bin.dimension?.width ?? rack.bayWidth;
    const slotD = bin.dimension?.depth ?? rack.bayDepth;

    let hash = 0;
    for (let i = 0; i < bin.id.length; i++) {
      hash = (hash << 5) - hash + bin.id.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);

    if (isShelving || bin.containerType === 'tote') {
      // Small-parts container / plastic tote on shelf deck: NO wooden pallet!
      const toteW = Math.max(0.2, slotW * 0.86);
      const toteD = Math.max(0.2, slotD * 0.82);
      const toteH = Math.min(Math.max(0.2, rack.levelHeight * 0.65), 0.45);
      const toteY = floorY + toteH / 2 + 0.02;

      cartons.push(createMatrix4(xPos, toteY, zPos, toteW, toteH, toteD));
    } else if (isCantilever || bin.containerType === 'long_goods') {
      // Long goods bundles (pipes / structural lumber): NO wooden pallet!
      const bundleW = Math.max(0.8, slotW * 0.95);
      const bundleD = Math.max(0.3, slotD * 0.7);
      const bundleH = Math.min(0.28, rack.levelHeight * 0.4);
      const bundleY = floorY + bundleH / 2 + 0.04;

      cartons.push(createMatrix4(xPos, bundleY, zPos, bundleW, bundleH, bundleD));
    } else if (isMezzanine) {
      // Mezzanine platform deck: Pallet & cargo sit ON TOP of the elevated floor deck plate!
      const palW = 1.2;
      const palD = 0.8;
      const palH = 0.144;
      const palY = floorY + palH / 2;
      pallets.push(createMatrix4(xPos, palY, zPos, palW, palH, palD));

      const ctnW = palW * 0.9;
      const ctnD = palD * 0.9;
      const ctnH = Math.min(1.2, (bin.dimension?.height ?? 1.8) * 0.65);
      cartons.push(createMatrix4(xPos, palY + palH / 2 + ctnH / 2, zPos, ctnW, ctnH, ctnD));
    } else {
      // Standard pallet racking (selective_pallet, double_deep, drive_in, push_back)
      const palletW = Math.max(0.6, Math.min(slotW - 0.08, 1.2));
      const palletD = Math.max(0.6, Math.min(slotD - 0.08, 1.0));
      const palletH = 0.144;
      const palletY = floorY + palletH / 2;

      pallets.push(createMatrix4(xPos, palletY, zPos, palletW, palletH, palletD));

      const availableH = Math.max(0.3, rack.levelHeight - palletH - 0.12);
      const heightFactor = 0.65 + (absHash % 30) / 100; // 65% to 95%
      const cartonH = Math.min(availableH, availableH * heightFactor);

      const cartonW = palletW * 0.92;
      const cartonD = palletD * 0.92;
      const cartonY = floorY + palletH + cartonH / 2;

      cartons.push(createMatrix4(xPos, cartonY, zPos, cartonW, cartonH, cartonD));
    }
  }

  return { pallets, cartons, occupiedBinIds, occupiedBins };
}

