// Fulfills Phase 29: Aisle Auto-Spanning & Array Generator Engine
// Pure procedural math for generating structured industrial rack arrays.
// Supports Single Rows, Back-to-Back Pairs with safety flue space,
// Collinear Multi-Bay Runs, Equipment clearance presets, and AABB collision testing.

import type { RackEntity, RackType, StructuralElement, WarehouseZone } from '@/types/layout';
import type { Vector3D } from '@/types/spatial';
import { generateBinsForRack, deriveRackDimensions } from './bin-generator';
import { checkAABBCollision, isWithinWarehouseBounds, getEffectiveDimensions } from '../spatial/spatial-math';
import { nextRackId } from './naming';

export type AisleTopology = 'single' | 'back_to_back';
export type AisleOrientation = 'along_x' | 'along_z';

export interface EquipmentPreset {
  id: string;
  name: string;
  aisleWidth: number;
  description: string;
}

export const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  {
    id: 'counterbalance',
    name: 'Counterbalance Forklift',
    aisleWidth: 3.5,
    description: 'Standard industrial counterbalance truck (3.5m clearance)',
  },
  {
    id: 'reach_truck',
    name: 'Reach Truck',
    aisleWidth: 2.8,
    description: 'High-lift reach truck (2.8m clearance)',
  },
  {
    id: 'vna',
    name: 'VNA Turret Truck',
    aisleWidth: 1.8,
    description: 'Very Narrow Aisle turret / wire-guided (1.8m clearance)',
  },
  {
    id: 'order_picker',
    name: 'Order Picker / Manual',
    aisleWidth: 1.4,
    description: 'Manual walkie & low-level order picker (1.4m clearance)',
  },
];

export interface RackTemplateConfig {
  type: RackType;
  bays: number;
  levels: number;
  bayWidth: number;
  levelHeight: number;
  depth: number;
}

export interface AisleArrayConfig {
  topology: AisleTopology;
  orientation: AisleOrientation;
  aisleCount: number;       // Number of aisles / row-pairs (1 - 20)
  racksPerRun: number;      // Number of collinear racks end-to-end per row (1 - 10)
  aisleWidth: number;       // Clearance between rows / pairs (m)
  flueSpace: number;        // Safety clearance between back-to-back rows (m)
  anchorMode: 'center' | 'custom' | 'selected';
  customOrigin?: { x: number; z: number };
  rackTemplate: RackTemplateConfig;
  namingPrefix?: string;    // e.g. 'A' -> A01R01, A01R02... (alphanumeric for bin regex)
  skipColliding?: boolean;  // When true, exclude candidate racks that collide
}

export interface CandidateRack {
  entity: RackEntity;
  isValid: boolean;
  collisionReason?: 'bounds' | 'obstacle_collision';
  aisleIndex: number;
  rowIndex: number;
  runIndex: number;
}

export interface AisleArrayPlan {
  totalCandidates: number;
  validCandidates: number;
  collidingCandidates: number;
  candidateRacks: CandidateRack[];
  boundingFootprint: {
    width: number;
    depth: number;
    height: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  requiredFloor: {
    width: number;
    depth: number;
    requiresExpansion: boolean;
  };
  totalBinsCount: number;
}

/**
 * Calculates candidate rack positions and tests collisions without mutating state.
 */
export function planAisleArray(
  config: AisleArrayConfig,
  sceneContext: {
    floorDimensions: { width: number; depth: number; height: number };
    existingRacks: RackEntity[];
    existingStructures?: StructuralElement[];
    existingZones?: WarehouseZone[];
    selectedRack?: RackEntity | null;
  }
): AisleArrayPlan {
  const {
    topology,
    orientation,
    aisleCount,
    racksPerRun,
    aisleWidth,
    flueSpace,
    anchorMode,
    customOrigin,
    rackTemplate,
    namingPrefix = 'A',
  } = config;

  const { floorDimensions, existingRacks, existingStructures = [] } = sceneContext;

  // Single rack unit bounding dimensions
  const unitDims = deriveRackDimensions({
    bays: rackTemplate.bays,
    bayWidth: rackTemplate.bayWidth,
    levels: rackTemplate.levels,
    levelHeight: rackTemplate.levelHeight,
    bayDepth: rackTemplate.depth,
  });

  const rotationY = orientation === 'along_x' ? 0 : Math.PI / 2;
  const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
    unitDims.width,
    unitDims.depth,
    rotationY
  );

  // Longitudinal dimension (length of 1 rack along run direction)
  const rackRunDim = orientation === 'along_x' ? effectiveWidth : effectiveDepth;
  // Transverse dimension (depth of 1 rack across aisle direction)
  const rackCrossDim = orientation === 'along_x' ? effectiveDepth : effectiveWidth;

  // Compute number of rows across the transverse axis
  // Single topology: 1 row per aisle unit -> aisleCount rows
  // Back-to-back: 2 rows per aisle unit -> 2 * aisleCount rows
  const rowsPerAisle = topology === 'back_to_back' ? 2 : 1;
  const totalRows = aisleCount * rowsPerAisle;

  // Calculate transverse offsets for each row relative to the array's transverse origin (0)
  const rowOffsets: number[] = [];
  let currentCrossOffset = 0;

  for (let a = 0; a < aisleCount; a++) {
    if (topology === 'single') {
      rowOffsets.push(currentCrossOffset);
      currentCrossOffset += rackCrossDim + aisleWidth;
    } else {
      // Row 1 of pair
      rowOffsets.push(currentCrossOffset);
      // Row 2 of pair (separated by flueSpace)
      currentCrossOffset += rackCrossDim + flueSpace;
      rowOffsets.push(currentCrossOffset);
      // Next pair separated by aisleWidth
      currentCrossOffset += rackCrossDim + aisleWidth;
    }
  }

  // Total array span dimensions
  const totalRunSpan = (racksPerRun - 1) * rackRunDim + rackRunDim;
  const totalCrossSpan =
    totalRows > 0
      ? rowOffsets[rowOffsets.length - 1] - rowOffsets[0] + rackCrossDim
      : 0;

  const arrayWidth = orientation === 'along_x' ? totalRunSpan : totalCrossSpan;
  const arrayDepth = orientation === 'along_x' ? totalCrossSpan : totalRunSpan;

  // Determine array center / starting reference point
  let startX = 0;
  let startZ = 0;

  if (anchorMode === 'center') {
    startX = (floorDimensions.width - arrayWidth) / 2 + (orientation === 'along_x' ? rackRunDim / 2 : rackCrossDim / 2);
    startZ = (floorDimensions.depth - arrayDepth) / 2 + (orientation === 'along_x' ? rackCrossDim / 2 : rackRunDim / 2);
  } else if (anchorMode === 'selected' && sceneContext.selectedRack) {
    // Start at selected rack coordinate
    startX = sceneContext.selectedRack.position.x;
    startZ = sceneContext.selectedRack.position.z;
  } else if (customOrigin) {
    startX = customOrigin.x;
    startZ = customOrigin.z;
  } else {
    // Default safe inset from corner
    startX = (orientation === 'along_x' ? rackRunDim / 2 : rackCrossDim / 2) + 2.0;
    startZ = (orientation === 'along_x' ? rackCrossDim / 2 : rackRunDim / 2) + 2.0;
  }

  // Clean prefix: uppercase letters and numbers only, default 'A'
  const sanitizedPrefix = (namingPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'A').slice(0, 4);

  const candidateRacks: CandidateRack[] = [];
  const warehouseBounds = {
    width: floorDimensions.width,
    depth: floorDimensions.depth,
    height: floorDimensions.height,
  };

  // Convert existing obstacles for fast AABB checking
  const existingFootprints = [
    ...existingRacks
      .filter((r) => !sceneContext.selectedRack || r.id !== sceneContext.selectedRack.id)
      .map((r) => ({
        x: r.position.x,
        z: r.position.z,
        width: r.dimensions.width,
        depth: r.dimensions.depth,
        rotationY: r.rotationY,
      })),
    ...existingStructures.map((s) => ({
      x: s.position.x,
      z: s.position.z,
      width: s.dimensions.width,
      depth: s.dimensions.depth,
      rotationY: s.rotationY,
    })),
  ];

  let totalBins = 0;

  // Iterate rows and collinear runs
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const aisleIndex = topology === 'back_to_back' ? Math.floor(rowIndex / 2) + 1 : rowIndex + 1;
    const sideSuffix = topology === 'back_to_back' ? (rowIndex % 2 === 0 ? 'A' : 'B') : '';
    const crossOffset = rowOffsets[rowIndex];

    for (let runIndex = 0; runIndex < racksPerRun; runIndex++) {
      const runOffset = runIndex * rackRunDim;

      const posX = orientation === 'along_x' ? startX + runOffset : startX + crossOffset;
      const posZ = orientation === 'along_x' ? startZ + crossOffset : startZ + runOffset;

      const rackPos: Vector3D = {
        x: Number(posX.toFixed(3)),
        y: 0,
        z: Number(posZ.toFixed(3)),
      };

      // Construct compliant deterministic rack name:
      // e.g. A0101, A01A01 (Single or Back-to-Back with run index)
      // Strictly matches [A-Z0-9]+ to ensure bin IDs comply with ^[A-Z0-9]+-\d{2}-\d{2}$
      const aislePadded = String(aisleIndex).padStart(2, '0');
      const runPadded = String(runIndex + 1).padStart(2, '0');
      const rackName = `${sanitizedPrefix}${aislePadded}${sideSuffix}${runPadded}`;

      const rackId = nextRackId();

      const candidateEntity: RackEntity = {
        id: rackId,
        name: rackName,
        type: rackTemplate.type,
        position: rackPos,
        rotationY,
        dimensions: {
          width: unitDims.width,
          height: unitDims.height,
          depth: unitDims.depth,
        },
        bays: rackTemplate.bays,
        levels: rackTemplate.levels,
        bayWidth: rackTemplate.bayWidth,
        bayDepth: rackTemplate.depth,
        levelHeight: rackTemplate.levelHeight,
        bins: [],
      };

      // Deterministic bin generation
      candidateEntity.bins = generateBinsForRack(candidateEntity);
      totalBins += candidateEntity.bins.length;

      const footprint = {
        x: rackPos.x,
        z: rackPos.z,
        width: unitDims.width,
        depth: unitDims.depth,
        rotationY,
      };

      // 1. Check floor bounds
      const inBounds = isWithinWarehouseBounds(footprint, warehouseBounds);

      // 2. Check collisions with existing scene obstacles
      let collidesWithExisting = false;
      if (inBounds) {
        for (const obs of existingFootprints) {
          if (checkAABBCollision(footprint, obs)) {
            collidesWithExisting = true;
            break;
          }
        }
      }

      let isValid = true;
      let collisionReason: CandidateRack['collisionReason'] = undefined;

      if (!inBounds) {
        isValid = false;
        collisionReason = 'bounds';
      } else if (collidesWithExisting) {
        isValid = false;
        collisionReason = 'obstacle_collision';
      }

      candidateRacks.push({
        entity: candidateEntity,
        isValid,
        collisionReason,
        aisleIndex,
        rowIndex: rowIndex + 1,
        runIndex: runIndex + 1,
      });
    }
  }

  const validCandidates = candidateRacks.filter((c) => c.isValid).length;
  const collidingCandidates = candidateRacks.length - validCandidates;

  const minX = Math.min(...candidateRacks.map((c) => c.entity.position.x - effectiveWidth / 2));
  const maxX = Math.max(...candidateRacks.map((c) => c.entity.position.x + effectiveWidth / 2));
  const minZ = Math.min(...candidateRacks.map((c) => c.entity.position.z - effectiveDepth / 2));
  const maxZ = Math.max(...candidateRacks.map((c) => c.entity.position.z + effectiveDepth / 2));

  const reqWidth = Math.max(floorDimensions.width, Math.ceil(maxX + 2.0));
  const reqDepth = Math.max(floorDimensions.depth, Math.ceil(maxZ + 2.0));
  const requiresExpansion = minX < 0 || minZ < 0 || maxX > floorDimensions.width || maxZ > floorDimensions.depth;

  return {
    totalCandidates: candidateRacks.length,
    validCandidates,
    collidingCandidates,
    candidateRacks,
    boundingFootprint: {
      width: Number((maxX - minX).toFixed(2)),
      depth: Number((maxZ - minZ).toFixed(2)),
      height: unitDims.height,
      minX,
      maxX,
      minZ,
      maxZ,
    },
    requiredFloor: {
      width: reqWidth,
      depth: reqDepth,
      requiresExpansion,
    },
    totalBinsCount: totalBins,
  };
}
