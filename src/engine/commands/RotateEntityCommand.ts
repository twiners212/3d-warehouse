// Fulfills INTERACTION-SPECIFICATION.md Section 6 Rotation Mechanics:
// discrete +90 degree Y rotation; undo restores prior orientation.

import type { ICommand } from './Command';
import { useEditorStore } from '@/stores/useEditorStore';
import { nextRotationStep } from '@/engine/spatial/spatial-math';

export function createRotateRackCommand(rackId: string): ICommand {
  let previousRotationY: number | null = null;

  return {
    execute: () => {
      const rack = useEditorStore.getState().racks.find((r) => r.id === rackId);
      if (!rack) return;

      previousRotationY = rack.rotationY;
      useEditorStore.getState().rotateRack(rackId, nextRotationStep(rack.rotationY));
    },
    undo: () => {
      if (previousRotationY === null) return;
      useEditorStore.getState().rotateRack(rackId, previousRotationY);
    },
  };
}
