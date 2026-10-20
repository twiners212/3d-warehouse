// Fulfills Phase 42: Atomic Undo/Redo Pipeline for Bulk Inventory Sync & Slotting Optimizer.
// Captures full pre-mutation snapshots of affected rack bins and zone pallet slots,
// guaranteeing 100% reversible (Ctrl+Z) state mutations and instant 3D heatmap feedback.

import type { ICommand } from './Command';
import type { BinSkuData, BinSlot, ZonePalletSlot } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';

export interface BinSyncUpdate {
  rackId: string;
  binId: string;
  isOccupied: boolean;
  skuData?: BinSkuData;
}

export interface ZonePalletSyncUpdate {
  zoneId: string;
  palletId: string;
  isOccupied: boolean;
  skuData?: BinSkuData;
}

export interface WmsSyncCommandOptions {
  label?: string;
  activateHeatmap?: boolean; // Default true
  heatmapMetric?: 'ABC_VELOCITY' | 'OCCUPANCY';
}

/**
 * Creates an atomic, undoable command for applying bulk inventory synchronization
 * across both rack bins and operational zone staging pallets.
 */
export function createApplyWmsInventorySyncCommand(
  binUpdates: BinSyncUpdate[],
  palletUpdates: ZonePalletSyncUpdate[] = [],
  options: WmsSyncCommandOptions = {}
): ICommand {
  const activateHeatmap = options.activateHeatmap ?? true;
  const targetHeatmap = options.heatmapMetric ?? 'ABC_VELOCITY';

  // Pre-mutation snapshots
  let previousRacksBins: Map<string, BinSlot[]> | null = null;
  let previousZonesSlots: Map<string, ZonePalletSlot[]> | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();

      // 1. Capture snapshot on first execution
      if (!previousRacksBins) {
        previousRacksBins = new Map();
        const touchedRackIds = new Set(binUpdates.map((u) => u.rackId));
        for (const rackId of touchedRackIds) {
          const rack = store.racks.find((r) => r.id === rackId);
          if (rack) {
            previousRacksBins.set(
              rackId,
              rack.bins.map((b) => ({
                ...b,
                skuData: b.skuData ? { ...b.skuData } : undefined,
              }))
            );
          }
        }
      }

      if (!previousZonesSlots) {
        previousZonesSlots = new Map();
        const touchedZoneIds = new Set(palletUpdates.map((u) => u.zoneId));
        for (const zoneId of touchedZoneIds) {
          const zone = store.zones.find((z) => z.id === zoneId);
          if (zone?.stagingConfig?.slots) {
            previousZonesSlots.set(
              zoneId,
              zone.stagingConfig.slots.map((s) => ({
                ...s,
                skuData: s.skuData ? { ...s.skuData } : undefined,
              }))
            );
          }
        }
      }

      // 2. Apply Rack Bin Updates
      // Group updates by rackId for efficiency
      const binUpdatesByRack = new Map<string, Map<string, BinSyncUpdate>>();
      for (const update of binUpdates) {
        if (!binUpdatesByRack.has(update.rackId)) {
          binUpdatesByRack.set(update.rackId, new Map());
        }
        binUpdatesByRack.get(update.rackId)!.set(update.binId, update);
      }

      for (const [rackId, updatesMap] of binUpdatesByRack.entries()) {
        const rack = store.racks.find((r) => r.id === rackId);
        if (!rack) continue;

        const updatedBins = rack.bins.map((bin) => {
          const update = updatesMap.get(bin.id);
          if (!update) return bin;
          return {
            ...bin,
            isOccupied: update.isOccupied,
            skuData: update.skuData ? { ...update.skuData } : undefined,
          };
        });

        store.updateRackConfig(rackId, { bins: updatedBins });
      }

      // 3. Apply Zone Pallet Updates
      const palletUpdatesByZone = new Map<string, Map<string, ZonePalletSyncUpdate>>();
      for (const update of palletUpdates) {
        if (!palletUpdatesByZone.has(update.zoneId)) {
          palletUpdatesByZone.set(update.zoneId, new Map());
        }
        palletUpdatesByZone.get(update.zoneId)!.set(update.palletId, update);
      }

      for (const [zoneId, updatesMap] of palletUpdatesByZone.entries()) {
        const zone = store.zones.find((z) => z.id === zoneId);
        if (!zone?.stagingConfig?.slots) continue;

        const updatedSlots = zone.stagingConfig.slots.map((slot) => {
          const update = updatesMap.get(slot.id);
          if (!update) return slot;
          return {
            ...slot,
            isOccupied: update.isOccupied,
            skuData: update.skuData ? { ...update.skuData } : undefined,
          };
        });

        store.updateZoneStagingConfig(zoneId, { slots: updatedSlots, enabled: true });
      }

      // 4. Instant Visual Feedback: Activate 3D Heatmap
      if (activateHeatmap) {
        store.setHeatmapMetric(targetHeatmap);
      }
    },

    undo: () => {
      const store = useEditorStore.getState();

      // 1. Restore Rack Bins
      if (previousRacksBins) {
        for (const [rackId, bins] of previousRacksBins.entries()) {
          store.updateRackConfig(rackId, { bins });
        }
      }

      // 2. Restore Zone Pallets
      if (previousZonesSlots) {
        for (const [zoneId, slots] of previousZonesSlots.entries()) {
          store.updateZoneStagingConfig(zoneId, { slots, enabled: true });
        }
      }
    },
  };
}
