// Fulfills ARCHITECTURE.md Section 2 (engine/commands/UpdateRackConfigCommand.ts)
// Applies a parametric patch (bays/levels/dimensions) to a rack and
// deterministically regenerates its bin set; undo restores the prior record.
// Reference: PRD.md Section 4.4 Bin Coordinate Engine.

import type { ICommand } from './Command';
import type { RackEntity } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { deriveRackDimensions, generateBinsForRack } from '@/engine/procedural/bin-generator';

import type { Vector3D } from '@/types/spatial';

export interface RackConfigPatch {
  bays?: number;
  levels?: number;
  bayWidth?: number;
  bayDepth?: number;
  levelHeight?: number;
  levelId?: string;
  position?: Vector3D;
}

type RackConfigFields = Pick<
  RackEntity,
  'bays' | 'levels' | 'bayWidth' | 'bayDepth' | 'levelHeight' | 'dimensions' | 'bins' | 'levelId' | 'position'
>;

function toConfigFields(rack: RackEntity): RackConfigFields {
  return {
    bays: rack.bays,
    levels: rack.levels,
    bayWidth: rack.bayWidth,
    bayDepth: rack.bayDepth,
    levelHeight: rack.levelHeight,
    dimensions: rack.dimensions,
    bins: rack.bins,
    levelId: rack.levelId,
    position: rack.position,
  };
}

export function createUpdateRackConfigCommand(rackId: string, patch: RackConfigPatch): ICommand {
  // Snapshot captured on first execution so undo can fully revert the record
  let previous: RackConfigFields | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const rack = store.racks.find((r) => r.id === rackId);
      if (!rack) return;

      if (!previous) {
        previous = toConfigFields(rack);
      }

      const next = { ...rack, ...patch };
      next.dimensions = deriveRackDimensions(next);

      const dimensionsChanged =
        next.bays !== rack.bays ||
        next.levels !== rack.levels ||
        next.bayWidth !== rack.bayWidth ||
        next.bayDepth !== rack.bayDepth ||
        next.levelHeight !== rack.levelHeight;

      let bins = next.bins;
      if (dimensionsChanged) {
        const freshBins = generateBinsForRack(next);
        const existingMap = new Map(
          rack.bins.map((b) => [`${b.bayIndex}-${b.levelIndex}-${b.slotPosition ?? ''}`, b])
        );
        bins = freshBins.map((fb) => {
          const prev =
            existingMap.get(`${fb.bayIndex}-${fb.levelIndex}-${fb.slotPosition ?? ''}`) ??
            existingMap.get(`${fb.bayIndex}-${fb.levelIndex}-`);
          if (prev) {
            return {
              ...fb,
              isOccupied: prev.isOccupied,
              skuData: prev.skuData,
            };
          }
          return fb;
        });
      }

      store.updateRackConfig(rackId, {
        bays: next.bays,
        levels: next.levels,
        bayWidth: next.bayWidth,
        bayDepth: next.bayDepth,
        levelHeight: next.levelHeight,
        dimensions: next.dimensions,
        bins,
        levelId: next.levelId,
        position: next.position,
      });
    },
    undo: () => {
      if (!previous) return;
      useEditorStore.getState().updateRackConfig(rackId, previous);
    },
  };
}
