// Commands for Vertical Connectors (Cargo Lift, Ramp, Stairs)
// Implements ICommand for full Undo/Redo integration.

import type { ICommand } from './Command';
import type { VerticalConnector } from '@/types/layout';
import type { Vector3D } from '@/types/spatial';
import { useEditorStore } from '@/stores/useEditorStore';

export function createAddVerticalConnectorCommand(connector: VerticalConnector): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().addVerticalConnector(connector);
    },
    undo: () => {
      useEditorStore.getState().removeVerticalConnector(connector.id);
    },
  };
}

export function createRemoveVerticalConnectorCommand(connector: VerticalConnector): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().removeVerticalConnector(connector.id);
    },
    undo: () => {
      useEditorStore.getState().addVerticalConnector(connector);
    },
  };
}

export function createMoveVerticalConnectorCommand(
  connectorId: string,
  from: Vector3D,
  to: Vector3D
): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().moveVerticalConnector(connectorId, to);
    },
    undo: () => {
      useEditorStore.getState().moveVerticalConnector(connectorId, from);
    },
  };
}

export function createRotateVerticalConnectorCommand(
  connectorId: string,
  fromRotation: number,
  toRotation: number
): ICommand {
  return {
    execute: () => {
      useEditorStore.getState().rotateVerticalConnector(connectorId, toRotation);
    },
    undo: () => {
      useEditorStore.getState().rotateVerticalConnector(connectorId, fromRotation);
    },
  };
}

export function createUpdateVerticalConnectorCommand(
  connectorId: string,
  patch: Partial<VerticalConnector>,
  prevPatch?: Partial<VerticalConnector>
): ICommand {
  const current = useEditorStore
    .getState()
    .verticalConnectors.find((c) => c.id === connectorId);
  const rollback: Partial<VerticalConnector> =
    prevPatch ?? (current ? { ...current } : {});

  return {
    execute: () => {
      useEditorStore.getState().updateVerticalConnector(connectorId, patch);
    },
    undo: () => {
      useEditorStore.getState().updateVerticalConnector(connectorId, rollback);
    },
  };
}
