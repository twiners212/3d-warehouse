// Commands for Operational Zones (Receiving, Shipping, Staging, Quarantine)
// Implements ICommand for full Undo/Redo integration.

import type { ICommand } from './Command';
import type { WarehouseZone } from '@/types/layout';
import type { Vector3D } from '@/types/spatial';
import { useEditorStore } from '@/stores/useEditorStore';

export function createAddZoneCommand(zone: WarehouseZone): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().addZone(zone);
    },
    undo: () => {
      useEditorStore.getState().removeZone(zone.id);
    },
  };
}

export function createRemoveZoneCommand(zone: WarehouseZone): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().removeZone(zone.id);
    },
    undo: () => {
      useEditorStore.getState().addZone(zone);
    },
  };
}

export function createMoveZoneCommand(
  zoneId: string,
  from: Vector3D,
  to: Vector3D
): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().moveZone(zoneId, to);
    },
    undo: () => {
      useEditorStore.getState().moveZone(zoneId, from);
    },
  };
}

export function createUpdateZoneCommand(
  zoneId: string,
  patch: Partial<WarehouseZone>,
  prevPatch?: Partial<WarehouseZone>
): ICommand {
  const current = useEditorStore.getState().zones.find((z) => z.id === zoneId);
  const rollback: Partial<WarehouseZone> = prevPatch ?? (current ? { ...current } : {});

  return {
    execute: () => {
      useEditorStore.getState().updateZone(zoneId, patch);
    },
    undo: () => {
      useEditorStore.getState().updateZone(zoneId, rollback);
    },
  };
}
