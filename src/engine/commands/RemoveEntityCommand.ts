// Fulfills ARCHITECTURE.md Section 3 (RemoveEntityCommand)
// Removes a rack and cascades its child bins; undo restores the full prior
// record including bins (INTERACTION-SPECIFICATION.md Section 7 Delete key).

import type { ICommand } from './Command';
import type { RackEntity } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';

export function createRemoveRackCommand(rack: RackEntity): ICommand {
  return {
    execute: () => {
      // Deselect if the removed entity was active
      const store = useEditorStore.getState();
      if (store.selectedEntityId === rack.id) {
        store.deselectEntity();
      }
      store.removeRack(rack.id);
    },
    undo: () => {
      useEditorStore.getState().addRack(rack);
    },
  };
}
