// Fulfills PRD.md Section 4.5 Command Pattern & Phase 21 WMS Bin Management.
// Provides undoable actions for individual bin occupancy toggling, bulk stocking,
// and SKU metadata mutations.

import type { ICommand } from './Command';
import type { BinSlot, BinSkuData } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { generateMockSkuData } from '@/lib/constants/warehouse-defaults';

/**
 * Toggles or sets single bin occupancy and SKU data.
 * Fully undoable with previous state snapshot.
 */
export function createUpdateBinOccupancyCommand(
  rackId: string,
  binId: string,
  isOccupied: boolean,
  skuData?: BinSkuData
): ICommand {
  let previousBin: BinSlot | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const rack = store.racks.find((r) => r.id === rackId);
      const bin = rack?.bins.find((b) => b.id === binId);
      if (!bin) return;

      if (!previousBin) {
        previousBin = {
          ...bin,
          skuData: bin.skuData ? { ...bin.skuData } : undefined,
        };
      }

      const effectiveSku = isOccupied
        ? skuData ?? bin.skuData ?? generateMockSkuData(binId)
        : undefined;

      store.updateBin(rackId, binId, {
        isOccupied,
        skuData: effectiveSku,
      });
    },
    undo: () => {
      if (!previousBin) return;
      useEditorStore.getState().updateBin(rackId, binId, {
        isOccupied: previousBin.isOccupied,
        skuData: previousBin.skuData,
        maxWeightKg: previousBin.maxWeightKg,
      });
    },
  };
}

/**
 * Bulk updates occupancy for an entire rack (Stock All, Empty All, Randomize 70%).
 * Fully undoable with prior snapshot of all rack bins.
 */
export function createBatchUpdateRackBinsCommand(
  rackId: string,
  isOccupied: boolean | 'random',
  percentage = 0.7
): ICommand {
  let previousBins: BinSlot[] | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const rack = store.racks.find((r) => r.id === rackId);
      if (!rack) return;

      if (!previousBins) {
        previousBins = rack.bins.map((b) => ({ ...b }));
      }

      store.batchUpdateRackBins(rackId, isOccupied, percentage);
    },
    undo: () => {
      if (!previousBins) return;
      const store = useEditorStore.getState();
      store.updateRackConfig(rackId, { bins: previousBins });
    },
  };
}

/**
 * Bulk updates occupancy across the entire facility.
 * Fully undoable with snapshot of all bins across all racks.
 */
export function createBatchUpdateAllBinsCommand(
  isOccupied: boolean | 'random',
  percentage = 0.7,
  targetLevelId?: string
): ICommand {
  let previousRacksBins: Map<string, BinSlot[]> | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      if (!previousRacksBins) {
        previousRacksBins = new Map();
        const targetRacks = targetLevelId
          ? store.racks.filter((r) => (r.levelId ?? 'level-1') === targetLevelId)
          : store.racks;
        for (const rack of targetRacks) {
          previousRacksBins.set(
            rack.id,
            rack.bins.map((b) => ({ ...b }))
          );
        }
      }

      store.batchUpdateAllBins(isOccupied, percentage, targetLevelId);
    },
    undo: () => {
      if (!previousRacksBins) return;
      const store = useEditorStore.getState();
      for (const [rackId, bins] of previousRacksBins.entries()) {
        store.updateRackConfig(rackId, { bins });
      }
    },
  };
}

/**
 * Updates SKU metadata and weight for a specific bin.
 */
export function createUpdateBinSkuDataCommand(
  rackId: string,
  binId: string,
  skuData: BinSkuData,
  maxWeightKg?: number
): ICommand {
  let previousBin: BinSlot | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const rack = store.racks.find((r) => r.id === rackId);
      const bin = rack?.bins.find((b) => b.id === binId);
      if (!bin) return;

      if (!previousBin) {
        previousBin = {
          ...bin,
          skuData: bin.skuData ? { ...bin.skuData } : undefined,
        };
      }

      store.updateBin(rackId, binId, {
        isOccupied: true,
        skuData,
        ...(maxWeightKg !== undefined ? { maxWeightKg } : {}),
      });
    },
    undo: () => {
      if (!previousBin) return;
      useEditorStore.getState().updateBin(rackId, binId, {
        isOccupied: previousBin.isOccupied,
        skuData: previousBin.skuData,
        maxWeightKg: previousBin.maxWeightKg,
      });
    },
  };
}
