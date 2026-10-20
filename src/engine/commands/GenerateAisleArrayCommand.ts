// Fulfills Phase 29: Atomic Command for Aisle Array Generation
// Implements ICommand so generating dozens of racks is committed as a single
// undoable action: a single Ctrl+Z cleanly deletes the generated array,
// and Ctrl+Y restores it.

import type { ICommand } from './Command';
import type { RackEntity } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';

export function createGenerateAisleArrayCommand(racks: RackEntity[]): ICommand {
  const rackIds = racks.map((r) => r.id);

  return {
    execute: () => {
      const state = useEditorStore.getState();
      state.addRacks(racks);
      state.setMultipleSelection(rackIds);
    },
    undo: () => {
      const state = useEditorStore.getState();
      state.removeRacks(rackIds);
      state.clearSelection();
    },
  };
}
