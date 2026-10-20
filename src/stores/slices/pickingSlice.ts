// Fulfills Phase 36-41: State Management Slice for Picking Route & Multi-Agent Fleet Simulation
// Manages Pick List, Multi-Agent Fleet, VRP Dispatching, Dynamic Traffic Radar, and Simulation Playback

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editor-store';
import type {
  PickItem,
  PickingRouteResult,
  PlaybackState,
  VehicleType,
  CustomWaypoint,
  PickBadgeDisplayMode,
  FleetAgent,
  FleetAgentStatus,
  TrafficAlert,
} from '@/types/routing';

import {
  generateSamplePickOrder,
  detectDefaultDepot,
  calculatePickingRoute,
  interpolatePolylinePosition,
} from '@/engine/routing/routing-engine';
import {
  createWalkabilityGrid,
  calculateBayAccessPoint,
  findNearestWalkablePoint,
} from '@/engine/routing/grid-map';
import { calculateLocalToWorld } from '@/engine/spatial/spatial-math';
import {
  createReorderPickStopsCommand,
  createMovePickAccessPointCommand,
  createMoveDepotPositionCommand,
  createAddCustomWaypointCommand,
  createRemoveCustomWaypointCommand,
  createMoveCustomWaypointCommand,
  createAutoOptimizeRouteCommand,
  createClearPickingRouteCommand,
  createAddBinToManualRouteCommand,
  createAddFleetAgentCommand,
  createRemoveFleetAgentCommand,
  createAddPickItemCommand,
  createRemovePickItemCommand,
} from '@/engine/commands/PickingCommands';
import {
  createInitialFleet,
  createFleetAgent,
  dispatchFleetRoutes,
} from '@/engine/routing/fleet-dispatcher';
import { evaluateFleetTraffic } from '@/engine/routing/traffic-controller';
import { MAX_FLEET_SIZE, MAX_FLEET_PER_LEVEL } from '@/lib/constants/warehouse-defaults';

export interface PickingSlice {
  pickList: PickItem[];
  routeResult: PickingRouteResult | null;
  depotPosition: { x: number; z: number };
  selectedVehicleType: VehicleType;
  playbackState: PlaybackState;
  isGeneratingRoute: boolean;
  isManualSequence: boolean;
  isManualRouteCreatorActive: boolean;
  customWaypoints: CustomWaypoint[];
  activeDraggingPinId: string | null;
  badgeDisplayMode: PickBadgeDisplayMode;

  // Phase 41 Multi-Agent Fleet Simulation & Dynamic Traffic Control
  fleet: FleetAgent[];
  selectedFleetAgentId: string | null;
  isFollowCamActive: boolean;
  trafficAlerts: TrafficAlert[];
  activeManifestTab: 'FLEET' | 'ORDERS';

  setActiveManifestTab: (tab: 'FLEET' | 'ORDERS') => void;
  selectFleetAgent: (id: string | null) => void;
  toggleFollowCam: (active?: boolean) => void;
  addFleetVehicle: (type?: VehicleType, targetLevelId?: string) => void;
  removeFleetVehicle: (id: string) => void;
  resetFleetBatteries: () => void;
  updateFleetSimulationTick: (deltaSeconds: number) => void;
  dismissTrafficAlert: (id: string) => void;
  clearTrafficAlerts: () => void;

  setVehicleType: (vehicle: VehicleType) => void;
  setDepotPosition: (pos: { x: number; z: number }) => void;
  generateSamplePickList: (count?: number) => void;
  addBinToPickList: (binId: string) => void;
  removeBinFromPickList: (binId: string) => void;
  clearPickList: () => void;
  clearRouteWithCommand: () => void;
  recalculateRoute: () => void;
  setPlaybackState: (patch: Partial<PlaybackState>) => void;
  togglePlayPause: () => void;
  setPlaybackProgress: (progress: number) => void;
  resetPlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;

  // Phase 37 & 38: Interactive Route Editing, Manual Creator & Badge Decluttering
  toggleManualRouteCreator: () => void;
  reorderPicks: (fromIndex: number, toIndex: number) => void;
  movePickAccessPoint: (binId: string, newPoint: { x: number; z: number }) => void;
  moveDepot: (newPos: { x: number; z: number }) => void;
  addCustomWaypoint: (waypoint: {
    x: number;
    z: number;
    name?: string;
    insertAfterStopIndex?: number;
    id?: string;
    insertAfterWaypointId?: string;
  }) => void;
  moveCustomWaypoint: (id: string, newPos: { x: number; z: number }) => void;
  removeCustomWaypoint: (id: string) => void;
  autoOptimizeRoute: () => void;
  setActiveDraggingPinId: (id: string | null) => void;
  setBadgeDisplayMode: (mode: PickBadgeDisplayMode) => void;
  toggleBadgeDisplayMode: () => void;
}

export const createPickingSlice: StateCreator<
  EditorStore,
  [],
  [],
  PickingSlice
> = (set, get) => ({
  pickList: [],
  routeResult: null,
  depotPosition: { x: 3, z: 3 },
  selectedVehicleType: 'FORKLIFT',
  playbackState: {
    isPlaying: false,
    progress: 0,
    playbackSpeed: 1,
    currentStopIndex: 0,
    elapsedSeconds: 0,
  },
  isGeneratingRoute: false,
  isManualSequence: false,
  isManualRouteCreatorActive: false,
  customWaypoints: [],
  activeDraggingPinId: null,
  badgeDisplayMode: 'SMART',

  // Phase 41 Initial State
  fleet: createInitialFleet({ x: 3, z: 3 }),
  selectedFleetAgentId: null,
  isFollowCamActive: false,
  trafficAlerts: [],
  activeManifestTab: 'FLEET',

  setActiveManifestTab: (tab) => set({ activeManifestTab: tab }),

  selectFleetAgent: (id) =>
    set((state) => {
      // If choosing a vehicle, automatically switch active vehicleType to match
      const agent = state.fleet.find((a) => a.id === id);
      return {
        selectedFleetAgentId: id,
        selectedVehicleType: agent ? agent.vehicleType : state.selectedVehicleType,
      };
    }),

  toggleFollowCam: (active) =>
    set((s) => ({
      isFollowCamActive: active !== undefined ? active : !s.isFollowCamActive,
    })),

  addFleetVehicle: (type = 'AGV', targetLevelId?: string) => {
    const state = get();
    // 1. Check total warehouse fleet capacity
    if (state.fleet.length >= MAX_FLEET_SIZE) return;

    // 2. Resolve target floor
    const resolvedLevelId =
      targetLevelId ||
      (state.activeLevelId && state.activeLevelId !== 'ALL' ? state.activeLevelId : 'level-1');

    const targetLevel = state.buildingLevels.find((l) => l.id === resolvedLevelId) || {
      id: resolvedLevelId,
      name: resolvedLevelId === 'level-1' ? 'Lantai 1 / Ground' : `Lantai (${resolvedLevelId})`,
      elevationY: 0,
    };

    // 3. Check floor fleet quota (max 4 per floor)
    const floorCount = state.fleet.filter(
      (a) => (a.levelId || 'level-1') === resolvedLevelId
    ).length;
    if (floorCount >= MAX_FLEET_PER_LEVEL) return;

    // 4. Structural load realism: Forklift forbidden on mezzanine/upper floors
    const isGround = targetLevel.elevationY === 0 || resolvedLevelId === 'level-1';
    if (!isGround && type === 'FORKLIFT') {
      console.warn(
        `[Fleet] Forklift dilarang di ${targetLevel.name || resolvedLevelId} karena limitasi beban struktural lantai atas.`
      );
      return;
    }

    // 5. Create agent and execute command
    const newAgent = createFleetAgent(type, state.fleet, state.depotPosition, targetLevel);
    get().executeCommand(createAddFleetAgentCommand(newAgent));
  },

  removeFleetVehicle: (id) => {
    const state = get();
    if (state.fleet.length === 0) return;
    get().executeCommand(createRemoveFleetAgentCommand(id));
  },

  resetFleetBatteries: () =>
    set((s) => ({
      fleet: s.fleet.map((a) => ({ ...a, batteryLevel: 100 })),
    })),

  dismissTrafficAlert: (id) =>
    set((s) => ({
      trafficAlerts: s.trafficAlerts.filter((a) => a.id !== id),
    })),

  clearTrafficAlerts: () => set({ trafficAlerts: [] }),

  setBadgeDisplayMode: (mode) => set({ badgeDisplayMode: mode }),
  toggleBadgeDisplayMode: () =>
    set((s) => {
      const nextMode: PickBadgeDisplayMode =
        s.badgeDisplayMode === 'SMART'
          ? 'FULL'
          : s.badgeDisplayMode === 'FULL'
          ? 'COMPACT'
          : 'SMART';
      return { badgeDisplayMode: nextMode };
    }),

  setVehicleType: (vehicle) => {
    set({ selectedVehicleType: vehicle });
    get().recalculateRoute();
  },

  setDepotPosition: (pos) => {
    const state = get();
    const oldPos = state.depotPosition;
    if (oldPos.x === pos.x && oldPos.z === pos.z) return;
    get().executeCommand(createMoveDepotPositionCommand(oldPos, pos));
  },

  generateSamplePickList: (count = 8) => {
    const state = get();
    const bounds = {
      width: state.floorDimensions.width,
      depth: state.floorDimensions.depth,
      height: state.floorDimensions.height,
    };

    const depot = detectDefaultDepot(bounds, state.zones, state.structuralElements);
    const items = generateSamplePickOrder(
      state.racks,
      bounds,
      state.structuralElements,
      count
    );

    set({
      pickList: items,
      depotPosition: depot,
      isManualSequence: false,
      customWaypoints: [],
      activeDraggingPinId: null,
      playbackState: {
        isPlaying: false,
        progress: 0,
        playbackSpeed: 1,
        currentStopIndex: 0,
        elapsedSeconds: 0,
      },
    });

    get().recalculateRoute();
  },

  addBinToPickList: (binId: string) => {
    const state = get();
    if (state.pickList.some((p) => p.binId === binId)) return;

    let targetRack = null;
    let targetBin = null;

    for (const rack of state.racks) {
      const bin = rack.bins?.find((b) => b.id === binId);
      if (bin) {
        targetRack = rack;
        targetBin = bin;
        break;
      }
    }

    if (!targetRack || !targetBin) return;

    const bounds = {
      width: state.floorDimensions.width,
      depth: state.floorDimensions.depth,
      height: state.floorDimensions.height,
    };
    const grid = createWalkabilityGrid(bounds, state.racks, state.structuralElements);
    const accessPoint = calculateBayAccessPoint(targetRack, targetBin.bayIndex, grid);
    const binPos3D = calculateLocalToWorld(
      targetRack.position,
      targetRack.rotationY,
      targetBin.relativePosition
    );

    const newItem: PickItem = {
      binId: targetBin.id,
      rackId: targetRack.id,
      rackName: targetRack.name,
      bayIndex: targetBin.bayIndex,
      levelIndex: targetBin.levelIndex,
      position3D: binPos3D,
      accessPoint3D: { x: accessPoint.x, y: targetRack.position.y || 0, z: accessPoint.z },
      sku: targetBin.skuData?.sku || `SKU-${targetBin.id}`,
      productName: targetBin.skuData?.productName || `Industrial Cargo Box ${targetBin.id}`,
      quantity: targetBin.skuData?.quantity || 1,
      weightKg: targetBin.skuData?.weightKg || 15.0,
      isPicked: false,
      levelId: targetRack.levelId || 'level-1',
    };

    const isManual = state.isManualRouteCreatorActive || state.isManualSequence;
    get().executeCommand(createAddPickItemCommand(newItem, isManual));
  },

  removeBinFromPickList: (binId: string) => {
    const state = get();
    const index = state.pickList.findIndex((p) => p.binId === binId);
    if (index === -1) return;
    const item = state.pickList[index];
    get().executeCommand(createRemovePickItemCommand(item, index));
  },

  clearPickList: () => {
    const state = get();
    set({
      pickList: [],
      routeResult: null,
      fleet: state.fleet.map((a) => ({
        ...a,
        assignedPickList: [],
        routeResult: null,
        status: 'IDLE',
        progress: 0,
      })),
      isManualSequence: false,
      customWaypoints: [],
      activeDraggingPinId: null,
      trafficAlerts: [],
      playbackState: {
        isPlaying: false,
        progress: 0,
        playbackSpeed: 1,
        currentStopIndex: 0,
        elapsedSeconds: 0,
      },
    });
  },

  clearRouteWithCommand: () => {
    const state = get();
    if (state.pickList.length === 0 && state.customWaypoints.length === 0) return;
    get().executeCommand(
      createClearPickingRouteCommand({
        pickList: state.pickList,
        customWaypoints: state.customWaypoints,
        isManualSequence: state.isManualSequence,
      })
    );
  },

  recalculateRoute: () => {
    const state = get();
    if (state.pickList.length === 0) {
      set({
        routeResult: null,
        fleet: state.fleet.map((a) => ({
          ...a,
          assignedPickList: [],
          routeResult: null,
          status: 'IDLE',
          progress: 0,
        })),
        isGeneratingRoute: false,
      });
      return;
    }

    set({ isGeneratingRoute: true });
    const bounds = {
      width: state.floorDimensions.width,
      depth: state.floorDimensions.depth,
      height: state.floorDimensions.height,
    };

    const route = calculatePickingRoute({
      bounds,
      racks: state.racks,
      structuralElements: state.structuralElements,
      buildingLevels: state.buildingLevels,
      verticalConnectors: state.verticalConnectors,
      pickItems: state.pickList,
      depotPos: state.depotPosition,
      vehicleType: state.selectedVehicleType,
      isManualSequence: state.isManualSequence,
      customWaypoints: state.customWaypoints,
    });

    // Multi-agent fleet dispatching
    const updatedFleet = dispatchFleetRoutes(
      state.fleet,
      state.pickList,
      bounds,
      state.racks,
      state.structuralElements,
      state.depotPosition,
      state.buildingLevels,
      state.verticalConnectors,
      state.customWaypoints
    );

    set({
      routeResult: route,
      fleet: updatedFleet,
      isGeneratingRoute: false,
    });
  },

  setPlaybackState: (patch) =>
    set((state) => ({
      playbackState: { ...state.playbackState, ...patch },
    })),

  togglePlayPause: () =>
    set((state) => {
      const newProgress =
        state.playbackState.progress >= 0.999 ? 0 : state.playbackState.progress;
      return {
        playbackState: {
          ...state.playbackState,
          progress: newProgress,
          isPlaying: !state.playbackState.isPlaying,
        },
      };
    }),

  setPlaybackProgress: (progress) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(1, progress));
      const totalSeconds = state.routeResult?.metrics.estimatedDurationSeconds || 60;
      const elapsedSeconds = Math.round(clamped * totalSeconds);

      const numStops = state.routeResult?.orderedPicks.length || 0;
      const currentStopIndex = Math.min(numStops, Math.floor(clamped * numStops));

      // Synchronize fleet agents to proportionate progress
      const updatedFleet = state.fleet.map((agent) => {
        const nextPos =
          agent.routeResult && agent.routeResult.polylinePoints.length > 1
            ? interpolatePolylinePosition(
                agent.routeResult.polylinePoints,
                clamped,
                agent.position3D.y
              )
            : agent.position3D;

        return {
          ...agent,
          progress: clamped,
          position3D: nextPos,
          currentStopIndex: Math.min(
            agent.assignedPickList.length,
            Math.floor(clamped * agent.assignedPickList.length)
          ),
        };
      });

      return {
        playbackState: {
          ...state.playbackState,
          progress: clamped,
          elapsedSeconds,
          currentStopIndex,
        },
        fleet: updatedFleet,
      };
    }),

  resetPlayback: () =>
    set((state) => ({
      playbackState: {
        ...state.playbackState,
        isPlaying: false,
        progress: 0,
        currentStopIndex: 0,
        elapsedSeconds: 0,
      },
      fleet: state.fleet.map((a) => ({
        ...a,
        progress: 0,
        currentStopIndex: 0,
        isYielding: false,
      })),
      trafficAlerts: [],
    })),

  setPlaybackSpeed: (speed) =>
    set((state) => ({
      playbackState: { ...state.playbackState, playbackSpeed: speed },
    })),

  updateFleetSimulationTick: (deltaSeconds: number) => {
    const state = get();
    if (!state.playbackState.isPlaying) return;

    const speedMultiplier = state.playbackState.playbackSpeed;

    // Advance individual fleet agents
    let allFinished = true;
    let maxProgress = 0;

    const advancedFleet = state.fleet.map((agent) => {
      if (!agent.routeResult || agent.routeResult.polylinePoints.length < 2) {
        return agent;
      }

      const totalDist = Math.max(0.1, agent.routeResult.metrics.totalDistanceMeters);
      const effectiveSpeed = agent.isYielding ? 0 : agent.currentSpeedMps;
      const stepDist = effectiveSpeed * speedMultiplier * deltaSeconds;
      const nextProg = Math.min(1.0, agent.progress + stepDist / totalDist);

      if (nextProg < 1.0) {
        allFinished = false;
      }
      if (nextProg > maxProgress) {
        maxProgress = nextProg;
      }

      const nextStatus: FleetAgentStatus =
        nextProg >= 1.0 ? 'IDLE' : agent.isYielding ? 'YIELDING' : 'MOVING';

      const nextPos = interpolatePolylinePosition(
        agent.routeResult.polylinePoints,
        nextProg,
        agent.position3D.y
      );

      return {
        ...agent,
        progress: nextProg,
        position3D: nextPos,
        status: nextStatus,
        currentStopIndex: Math.min(
          agent.assignedPickList.length,
          Math.floor(nextProg * agent.assignedPickList.length)
        ),
      };
    });

    // Run dynamic traffic collision & radar evaluation
    const { updatedFleet, alerts } = evaluateFleetTraffic(advancedFleet, deltaSeconds);

    const nextPlaybackProgress = maxProgress;
    const isStillPlaying = !allFinished && nextPlaybackProgress < 1.0;

    // Merge alerts (keep last 5 alerts, deduplicated by unique ID)
    let combinedAlerts = state.trafficAlerts;
    if (alerts.length > 0) {
      const existingIds = new Set(state.trafficAlerts.map((a) => a.id));
      const freshAlerts = alerts.filter((a) => !existingIds.has(a.id));
      if (freshAlerts.length > 0) {
        combinedAlerts = [...freshAlerts, ...state.trafficAlerts].slice(0, 5);
      }
    }

    set({
      fleet: updatedFleet,
      trafficAlerts: combinedAlerts,
      playbackState: {
        ...state.playbackState,
        progress: nextPlaybackProgress,
        isPlaying: isStillPlaying,
      },
    });
  },

  // Phase 37 & 38: Interactive Route Editing & Manual Creator Actions
  toggleManualRouteCreator: () => {
    set((s) => ({
      isManualRouteCreatorActive: !s.isManualRouteCreatorActive,
      isManualSequence: true,
    }));
  },

  reorderPicks: (fromIndex, toIndex) => {
    const state = get();
    const currentList = state.routeResult?.orderedPicks.length
      ? [...state.routeResult.orderedPicks]
      : [...state.pickList];

    if (
      fromIndex < 0 ||
      fromIndex >= currentList.length ||
      toIndex < 0 ||
      toIndex >= currentList.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [moved] = currentList.splice(fromIndex, 1);
    currentList.splice(toIndex, 0, moved);

    const oldList = state.pickList;
    get().executeCommand(createReorderPickStopsCommand(oldList, currentList));
  },

  movePickAccessPoint: (binId, newPoint) => {
    const state = get();
    const item = state.pickList.find((p) => p.binId === binId);
    if (!item) return;
    const oldPoint = { x: item.accessPoint3D.x, z: item.accessPoint3D.z };
    get().executeCommand(createMovePickAccessPointCommand(binId, oldPoint, newPoint));
  },

  moveDepot: (newPos) => {
    const state = get();
    const oldPos = state.depotPosition;
    get().executeCommand(createMoveDepotPositionCommand(oldPos, newPos));
  },

  addCustomWaypoint: (waypoint) => {
    const state = get();
    const bounds = {
      width: state.floorDimensions.width,
      depth: state.floorDimensions.depth,
      height: state.floorDimensions.height,
    };
    const grid = createWalkabilityGrid(bounds, state.racks, state.structuralElements);
    const validPoint = findNearestWalkablePoint(grid, waypoint.x, waypoint.z);

    const id = waypoint.id || `cw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const stopIdx =
      waypoint.insertAfterStopIndex ?? (state.routeResult?.orderedPicks.length || 0);

    const fullWp: CustomWaypoint = {
      id,
      x: validPoint.x,
      z: validPoint.z,
      name: waypoint.name || `Waypoint ${state.customWaypoints.length + 1}`,
      insertAfterStopIndex: stopIdx,
    };

    // Calculate insertion index in customWaypoints to guarantee topological ordering without stray lines
    let targetIndex = state.customWaypoints.length;
    if (waypoint.insertAfterWaypointId) {
      const matchIdx = state.customWaypoints.findIndex((w) => w.id === waypoint.insertAfterWaypointId);
      if (matchIdx !== -1) {
        targetIndex = matchIdx + 1;
      } else {
        // If preceding waypoint was a stop or depot, insert before existing waypoints on this leg
        const firstOfLeg = state.customWaypoints.findIndex((w) => w.insertAfterStopIndex === stopIdx);
        if (firstOfLeg !== -1) {
          targetIndex = firstOfLeg;
        } else {
          // Fallback: maintain ascending insertAfterStopIndex
          const foundIdx = state.customWaypoints.findIndex((w) => w.insertAfterStopIndex > stopIdx);
          if (foundIdx !== -1) {
            targetIndex = foundIdx;
          }
        }
      }
    } else {
      const foundIdx = state.customWaypoints.findIndex((w) => w.insertAfterStopIndex > stopIdx);
      if (foundIdx !== -1) {
        targetIndex = foundIdx;
      }
    }

    get().executeCommand(createAddCustomWaypointCommand(fullWp, targetIndex));
  },

  moveCustomWaypoint: (id, newPos) => {
    const state = get();
    const wp = state.customWaypoints.find((w) => w.id === id);
    if (!wp) return;
    const bounds = {
      width: state.floorDimensions.width,
      depth: state.floorDimensions.depth,
      height: state.floorDimensions.height,
    };
    const grid = createWalkabilityGrid(bounds, state.racks, state.structuralElements);
    const validPoint = findNearestWalkablePoint(grid, newPos.x, newPos.z);

    const oldPos = { x: wp.x, z: wp.z };
    get().executeCommand(createMoveCustomWaypointCommand(id, oldPos, validPoint));
  },

  removeCustomWaypoint: (id) => {
    const state = get();
    const wp = state.customWaypoints.find((w) => w.id === id);
    if (!wp) return;
    get().executeCommand(createRemoveCustomWaypointCommand(wp));
  },

  autoOptimizeRoute: () => {
    const state = get();
    if (!state.isManualSequence) return;
    get().executeCommand(createAutoOptimizeRouteCommand(state.pickList, state.isManualSequence));
  },

  setActiveDraggingPinId: (id) => set({ activeDraggingPinId: id }),
});
