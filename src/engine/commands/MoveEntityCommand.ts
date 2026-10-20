// Fulfills ARCHITECTURE.md Section 3 Command Execution Flow
// MoveEntityCommand: translates a rack's bottom-center pivot and reverts to
// initialPosition on undo (INTERACTION-SPECIFICATION.md Section 5.2).

import type { ICommand } from './Command';
import { useEditorStore } from '@/stores/useEditorStore';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export function createMoveRackCommand(
  rackId: string,
  oldPosition: Vector3Like,
  newPosition: Vector3Like
): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().moveRack(rackId, newPosition);
    },
    undo: () => {
      useEditorStore.getState().moveRack(rackId, oldPosition);
    },
  };
}
