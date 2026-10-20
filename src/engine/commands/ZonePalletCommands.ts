// Fulfills Phase 39: Operational Zone Staging Pallet Commands & Undo/Redo
// Provides undoable actions for updating single zone pallet occupancy, SKU data, and batch pallet updates.

import type { ICommand } from './Command';
import type { ZonePalletSlot, ZoneStagingConfig } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { calculateZonePalletSlots } from '@/engine/procedural/zone-pallet-generator';

/**
 * Updates a single zone pallet's occupancy and SKU data with full Undo/Redo.
 */
export function createUpdateZonePalletCommand(
  zoneId: string,
  palletId: string,
  patch: Partial<ZonePalletSlot>
): ICommand {
  let previousSlot: ZonePalletSlot | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const zone = store.zones.find((z) => z.id === zoneId);
      if (zone && !previousSlot) {
        const currentSlots = zone.stagingConfig?.slots ?? calculateZonePalletSlots(zone);
        const slot = currentSlots.find((s) => s.id === palletId);
        if (slot) {
          previousSlot = {
            ...slot,
            skuData: slot.skuData ? { ...slot.skuData } : undefined,
          };
        }
      }
      store.updateZonePallet(zoneId, palletId, patch);
    },
    undo: () => {
      if (!previousSlot) return;
      useEditorStore.getState().updateZonePallet(zoneId, palletId, previousSlot);
    },
  };
}

/**
 * Bulk updates all pallets within an operational zone (Stock All, Empty All, or Randomize).
 * Fully undoable with snapshot of previous slots.
 */
export function createBatchUpdateZonePalletsCommand(
  zoneId: string,
  isOccupied: boolean | 'random'
): ICommand {
  let previousSlots: ZonePalletSlot[] | null = null;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const zone = store.zones.find((z) => z.id === zoneId);
      if (zone && !previousSlots) {
        const currentSlots = zone.stagingConfig?.slots ?? calculateZonePalletSlots(zone);
        previousSlots = currentSlots.map((s) => ({
          ...s,
          skuData: s.skuData ? { ...s.skuData } : undefined,
        }));
      }
      store.batchUpdateZonePallets(zoneId, isOccupied);
    },
    undo: () => {
      if (!previousSlots) return;
      const store = useEditorStore.getState();
      store.updateZoneStagingConfig(zoneId, { slots: previousSlots });
    },
  };
}

/**
 * Updates the staging configuration of an operational zone (e.g. toggle enabled).
 * Fully undoable.
 */
export function createUpdateZoneStagingConfigCommand(
  zoneId: string,
  configPatch: Partial<ZoneStagingConfig>
): ICommand {
  let previousConfig: ZoneStagingConfig | undefined;

  return {
    execute: () => {
      const store = useEditorStore.getState();
      const zone = store.zones.find((z) => z.id === zoneId);
      if (zone && previousConfig === undefined) {
        previousConfig = zone.stagingConfig ? { ...zone.stagingConfig } : { enabled: true };
      }
      store.updateZoneStagingConfig(zoneId, configPatch);
    },
    undo: () => {
      if (!previousConfig) return;
      useEditorStore.getState().updateZoneStagingConfig(zoneId, previousConfig);
    },
  };
}
