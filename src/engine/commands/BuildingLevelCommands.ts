// Commands for Building Levels (Lantai 1, Mezzanine, Lantai 2, etc.)
// Implements ICommand for full Undo/Redo integration.

import type { ICommand } from './Command';
import type { BuildingLevel } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';

export function createAddBuildingLevelCommand(level: BuildingLevel): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().addBuildingLevel(level);
    },
    undo: () => {
      useEditorStore.getState().removeBuildingLevel(level.id);
    },
  };
}

export function createRemoveBuildingLevelCommand(level: BuildingLevel): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().removeBuildingLevel(level.id);
    },
    undo: () => {
      useEditorStore.getState().addBuildingLevel(level);
    },
  };
}

export function createUpdateBuildingLevelCommand(
  levelId: string,
  patch: Partial<BuildingLevel>,
  prevPatch?: Partial<BuildingLevel>
): ICommand {
  const current = useEditorStore.getState().buildingLevels.find((l) => l.id === levelId);
  const rollback: Partial<BuildingLevel> = prevPatch ?? (current ? { ...current } : {});

  return {
    execute: () => {
      useEditorStore.getState().updateBuildingLevel(levelId, patch);
    },
    undo: () => {
      useEditorStore.getState().updateBuildingLevel(levelId, rollback);
    },
  };
}
