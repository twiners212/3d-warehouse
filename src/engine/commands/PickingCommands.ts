// Fulfills Phase 37: Command Pipeline for Interactive Picking Route Editing
// Provides undoable actions for reordering stops, moving access points, moving depot, and custom waypoints

import type { ICommand } from './Command';
import type { CustomWaypoint, PickItem, FleetAgent } from '@/types/routing';
import { useEditorStore } from '@/stores/useEditorStore';
import { MAX_FLEET_SIZE, MAX_FLEET_PER_LEVEL } from '@/lib/constants/warehouse-defaults';

/** Reorder pick stops manually (locks manual order) */
export function createReorderPickStopsCommand(
  oldList: PickItem[],
  newList: PickItem[]
): ICommand {
  return {
    execute: () => {
      useEditorStore.setState({
        pickList: newList,
        isManualSequence: true,
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      useEditorStore.setState({
        pickList: oldList,
        isManualSequence: true,
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Move the aisle floor access point for a specific bin */
export function createMovePickAccessPointCommand(
  binId: string,
  oldPoint: { x: number; z: number },
  newPoint: { x: number; z: number }
): ICommand {
  const updateItemPoint = (pt: { x: number; z: number }) => {
    const state = useEditorStore.getState();
    const updated = state.pickList.map((item) => {
      if (item.binId === binId) {
        return {
          ...item,
          accessPoint3D: { x: pt.x, y: 0, z: pt.z },
        };
      }
      return item;
    });
    useEditorStore.setState({ pickList: updated });
    useEditorStore.getState().recalculateRoute();
  };

  return {
    execute: () => updateItemPoint(newPoint),
    undo: () => updateItemPoint(oldPoint),
  };
}

/** Move the warehouse depot / packing station position */
export function createMoveDepotPositionCommand(
  oldPos: { x: number; z: number },
  newPos: { x: number; z: number }
): ICommand {
  return {
    execute: () => {
      useEditorStore.setState({ depotPosition: newPos });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      useEditorStore.setState({ depotPosition: oldPos });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Add a custom transit waypoint */
export function createAddCustomWaypointCommand(
  waypoint: CustomWaypoint,
  targetIndex?: number
): ICommand {
  let appliedIndex = targetIndex;
  return {
    execute: () => {
      const state = useEditorStore.getState();
      const list = [...state.customWaypoints];
      if (typeof appliedIndex === 'number' && appliedIndex >= 0 && appliedIndex <= list.length) {
        list.splice(appliedIndex, 0, waypoint);
      } else {
        appliedIndex = list.length;
        list.push(waypoint);
      }
      useEditorStore.setState({ customWaypoints: list });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        customWaypoints: state.customWaypoints.filter((w) => w.id !== waypoint.id),
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Remove a custom transit waypoint */
export function createRemoveCustomWaypointCommand(waypoint: CustomWaypoint): ICommand {
  let originalIndex = -1;
  return {
    execute: () => {
      const state = useEditorStore.getState();
      originalIndex = state.customWaypoints.findIndex((w) => w.id === waypoint.id);
      useEditorStore.setState({
        customWaypoints: state.customWaypoints.filter((w) => w.id !== waypoint.id),
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      const state = useEditorStore.getState();
      const list = [...state.customWaypoints];
      if (originalIndex >= 0 && originalIndex <= list.length) {
        list.splice(originalIndex, 0, waypoint);
      } else {
        list.push(waypoint);
      }
      useEditorStore.setState({ customWaypoints: list });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Move a custom transit waypoint position */
export function createMoveCustomWaypointCommand(
  id: string,
  oldPos: { x: number; z: number },
  newPos: { x: number; z: number }
): ICommand {
  const updateWaypointPos = (pos: { x: number; z: number }) => {
    const state = useEditorStore.getState();
    const updated = state.customWaypoints.map((w) => {
      if (w.id === id) {
        return { ...w, x: pos.x, z: pos.z };
      }
      return w;
    });
    useEditorStore.setState({ customWaypoints: updated });
    useEditorStore.getState().recalculateRoute();
  };

  return {
    execute: () => updateWaypointPos(newPos),
    undo: () => updateWaypointPos(oldPos),
  };
}

/** Auto-optimize route back using TSP 2-Opt (clears manual sequence lock) */
export function createAutoOptimizeRouteCommand(
  prevList: PickItem[],
  wasManual: boolean
): ICommand {
  return {
    execute: () => {
      useEditorStore.setState({ isManualSequence: false });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      useEditorStore.setState({
        pickList: prevList,
        isManualSequence: wasManual,
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Clear entire picking route to scratch slate with full undo/redo support */
export function createClearPickingRouteCommand(snapshot: {
  pickList: PickItem[];
  customWaypoints: CustomWaypoint[];
  isManualSequence: boolean;
}): ICommand {
  return {
    execute: () => {
      useEditorStore.setState({
        pickList: [],
        routeResult: null,
        customWaypoints: [],
        isManualSequence: false,
        activeDraggingPinId: null,
        playbackState: {
          isPlaying: false,
          progress: 0,
          playbackSpeed: 1,
          currentStopIndex: 0,
          elapsedSeconds: 0,
        },
      });
    },
    undo: () => {
      useEditorStore.setState({
        pickList: snapshot.pickList,
        customWaypoints: snapshot.customWaypoints,
        isManualSequence: snapshot.isManualSequence,
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Append bin to route in manual sequence mode with undo/redo */
export function createAddBinToManualRouteCommand(item: PickItem): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        pickList: [...state.pickList, item],
        isManualSequence: true,
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        pickList: state.pickList.filter((p) => p.binId !== item.binId),
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Add a new vehicle to the fleet (Phase 41) */
export function createAddFleetAgentCommand(newAgent: FleetAgent): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.fleet.length >= MAX_FLEET_SIZE) return;
      const targetLevelId = newAgent.levelId || 'level-1';
      const floorCount = state.fleet.filter((a) => (a.levelId || 'level-1') === targetLevelId).length;
      if (floorCount >= MAX_FLEET_PER_LEVEL) return;

      useEditorStore.setState({
        fleet: [...state.fleet, newAgent],
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        fleet: state.fleet.filter((a) => a.id !== newAgent.id),
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Remove a vehicle from the fleet (Phase 41) */
export function createRemoveFleetAgentCommand(agentId: string): ICommand {
  let removedAgent: FleetAgent | undefined;
  return {
    execute: () => {
      const state = useEditorStore.getState();
      removedAgent = state.fleet.find((a) => a.id === agentId);
      if (!removedAgent) return;
      useEditorStore.setState({
        fleet: state.fleet.filter((a) => a.id !== agentId),
        selectedFleetAgentId: state.selectedFleetAgentId === agentId ? null : state.selectedFleetAgentId,
        isFollowCamActive: state.selectedFleetAgentId === agentId ? false : state.isFollowCamActive,
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      if (!removedAgent) return;
      const state = useEditorStore.getState();
      useEditorStore.setState({
        fleet: [...state.fleet, removedAgent],
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Add a pick stop to the pick list with full undo/redo */
export function createAddPickItemCommand(item: PickItem, isManualSequence = false): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        pickList: [...state.pickList, item],
        ...(isManualSequence ? { isManualSequence: true } : {}),
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        pickList: state.pickList.filter((p) => p.binId !== item.binId),
      });
      useEditorStore.getState().recalculateRoute();
    },
  };
}

/** Remove a pick stop from the pick list with full undo/redo */
export function createRemovePickItemCommand(item: PickItem, originalIndex?: number): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      useEditorStore.setState({
        pickList: state.pickList.filter((p) => p.binId !== item.binId),
      });
      useEditorStore.getState().recalculateRoute();
    },
    undo: () => {
      const state = useEditorStore.getState();
      const current = [...state.pickList];
      if (typeof originalIndex === 'number' && originalIndex >= 0 && originalIndex <= current.length) {
        current.splice(originalIndex, 0, item);
      } else {
        current.push(item);
      }
      useEditorStore.setState({ pickList: current });
      useEditorStore.getState().recalculateRoute();
    },
  };
}


