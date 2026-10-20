// Fulfills ARCHITECTURE.md Section 3 (Command Pattern)
// Commits room dimension & blueprint metadata updates with undo/redo support.

import type { ICommand } from './Command';
import type { Size3D } from '@/types/spatial';
import { useEditorStore } from '@/stores/useEditorStore';

export interface BlueprintMetaPatch {
  name?: string;
  gridSnapStep?: number;
  floorDimensions?: Size3D;
}

export function createUpdateFloorDimensionsCommand(
  newDimensions: Size3D,
  customPrevDimensions?: Size3D
): ICommand {
  const prevDimensions = customPrevDimensions ?? { ...useEditorStore.getState().floorDimensions };
  const targetDimensions = { ...newDimensions };

  return {
    execute: () => {
      useEditorStore.getState().setBlueprintMeta({ floorDimensions: targetDimensions });
    },
    undo: () => {
      useEditorStore.getState().setBlueprintMeta({ floorDimensions: prevDimensions });
    },
  };
}

export function createUpdateBlueprintMetaCommand(
  patch: BlueprintMetaPatch,
  customPrev?: BlueprintMetaPatch
): ICommand {
  const state = useEditorStore.getState();
  const prev: BlueprintMetaPatch = customPrev ?? {
    name: state.blueprintName,
    gridSnapStep: state.gridSnapStep,
    floorDimensions: { ...state.floorDimensions },
  };

  return {
    execute: () => {
      useEditorStore.getState().setBlueprintMeta(patch);
    },
    undo: () => {
      useEditorStore.getState().setBlueprintMeta(prev);
    },
  };
}
