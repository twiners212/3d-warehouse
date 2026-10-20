// Commands for Structural Elements (Walls, Columns, Dock Doors, Bollards)
// Implements ICommand for full Undo/Redo integration.

import type { ICommand } from './Command';
import type { StructuralElement } from '@/types/layout';
import type { Vector3D } from '@/types/spatial';
import { useEditorStore } from '@/stores/useEditorStore';

export function createAddStructuralElementCommand(elem: StructuralElement): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().addStructuralElement(elem);
    },
    undo: () => {
      useEditorStore.getState().removeStructuralElement(elem.id);
    },
  };
}

export function createRemoveStructuralElementCommand(elem: StructuralElement): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().removeStructuralElement(elem.id);
    },
    undo: () => {
      useEditorStore.getState().addStructuralElement(elem);
    },
  };
}

export function createMoveStructuralElementCommand(
  elemId: string,
  from: Vector3D,
  to: Vector3D
): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().moveStructuralElement(elemId, to);
    },
    undo: () => {
      useEditorStore.getState().moveStructuralElement(elemId, from);
    },
  };
}

export function createRotateStructuralElementCommand(
  elemId: string,
  fromRotation: number,
  toRotation: number
): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().rotateStructuralElement(elemId, toRotation);
    },
    undo: () => {
      useEditorStore.getState().rotateStructuralElement(elemId, fromRotation);
    },
  };
}

export function createUpdateStructuralElementCommand(
  elemId: string,
  patch: Partial<StructuralElement>,
  prevPatch?: Partial<StructuralElement>
): ICommand {
  const current = useEditorStore.getState().structuralElements.find((e) => e.id === elemId);
  const rollback: Partial<StructuralElement> = prevPatch ?? (current ? { ...current } : {});

  return {
    execute: () => {
      useEditorStore.getState().updateStructuralElement(elemId, patch);
    },
    undo: () => {
      useEditorStore.getState().updateStructuralElement(elemId, rollback);
    },
  };
}
