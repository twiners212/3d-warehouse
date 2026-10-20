// Fulfills ARCHITECTURE.md Section 3 (AddEntityCommand)
// Commits a new rack entity (with pre-generated bins) into blueprint state.

import type { ICommand } from './Command';
import type { RackEntity } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';

export function createAddRackCommand(rack: RackEntity): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().addRack(rack);
    },
    undo: () => {
      useEditorStore.getState().removeRack(rack.id);
    },
  };
}
