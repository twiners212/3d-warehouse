// Fulfills ARCHITECTURE.md Section 2 (stores/slices/blueprintSlice.ts)
// Immutable spatial state primitives. Commands wrap these mutators; UI never
// calls them directly without a Command (State & Mutation Invariant).

import type { StateCreator } from 'zustand';
import type { BinSlot, BuildingLevel, RackEntity, StructuralElement, VerticalConnector, WarehouseLayoutBlueprint, WarehouseZone, ZonePalletSlot, ZoneStagingConfig } from '@/types/layout';
import { DEFAULT_FLOOR_DIMENSIONS, DEFAULT_GRID_SNAP_STEP, DEFAULT_GROUND_LEVEL, generateMockSkuData } from '@/lib/constants/warehouse-defaults';
import { calculateZonePalletSlots, generateMockZonePalletSku } from '@/engine/procedural/zone-pallet-generator';
import { createInitialFleet } from '@/engine/routing/fleet-dispatcher';
import type { EditorStore } from '../editor-store';

export interface BlueprintSlice {
  blueprintId: string | null;
  blueprintName: string;
  floorDimensions: WarehouseLayoutBlueprint['floorDimensions'];
  gridSnapStep: number;
  racks: RackEntity[];
  zones: WarehouseZone[];
  structuralElements: StructuralElement[];
  buildingLevels: BuildingLevel[];
  verticalConnectors: VerticalConnector[];

  loadBlueprint: (blueprint: WarehouseLayoutBlueprint) => void;
  setBlueprintMeta: (
    meta: Partial<Pick<WarehouseLayoutBlueprint, 'name' | 'gridSnapStep' | 'floorDimensions'>> & {
      blueprintName?: string;
    }
  ) => void;


  addRack: (rack: RackEntity) => void;
  addRacks: (racks: RackEntity[]) => void;
  removeRack: (rackId: string) => void;
  removeRacks: (rackIds: string[]) => void;
  moveRack: (rackId: string, position: { x: number; y: number; z: number }) => void;
  rotateRack: (rackId: string, rotationY: number) => void;
  updateRackConfig: (
    rackId: string,
    patch: Partial<
      Pick<
        RackEntity,
        | 'bays'
        | 'levels'
        | 'bayWidth'
        | 'bayDepth'
        | 'levelHeight'
        | 'type'
        | 'dimensions'
        | 'bins'
        | 'levelId'
        | 'position'
      >
    >
  ) => void;

  updateBin: (rackId: string, binId: string, patch: Partial<BinSlot>) => void;
  batchUpdateRackBins: (rackId: string, isOccupied: boolean | 'random', percentage?: number) => void;
  batchUpdateAllBins: (isOccupied: boolean | 'random', percentage?: number, targetLevelId?: string) => void;

  addZone: (zone: WarehouseZone) => void;
  removeZone: (zoneId: string) => void;
  moveZone: (zoneId: string, position: { x: number; y: number; z: number }) => void;
  updateZone: (zoneId: string, patch: Partial<WarehouseZone>) => void;
  updateZonePallet: (zoneId: string, palletId: string, patch: Partial<ZonePalletSlot>) => void;
  batchUpdateZonePallets: (zoneId: string, isOccupied: boolean | 'random') => void;
  updateZoneStagingConfig: (zoneId: string, configPatch: Partial<ZoneStagingConfig>) => void;

  addStructuralElement: (elem: StructuralElement) => void;
  removeStructuralElement: (elemId: string) => void;
  moveStructuralElement: (elemId: string, position: { x: number; y: number; z: number }) => void;
  rotateStructuralElement: (elemId: string, rotationY: number) => void;
  updateStructuralElement: (elemId: string, patch: Partial<StructuralElement>) => void;

  addBuildingLevel: (level: BuildingLevel) => void;
  updateBuildingLevel: (levelId: string, patch: Partial<BuildingLevel>) => void;
  removeBuildingLevel: (levelId: string) => void;

  addVerticalConnector: (connector: VerticalConnector) => void;
  removeVerticalConnector: (connectorId: string) => void;
  moveVerticalConnector: (connectorId: string, position: { x: number; y: number; z: number }) => void;
  rotateVerticalConnector: (connectorId: string, rotationY: number) => void;
  updateVerticalConnector: (connectorId: string, patch: Partial<VerticalConnector>) => void;
}

export const createBlueprintSlice: StateCreator<
  EditorStore,
  [],
  [],
  BlueprintSlice
> = (set) => ({
  blueprintId: null,
  blueprintName: 'Untitled Warehouse',
  floorDimensions: { ...DEFAULT_FLOOR_DIMENSIONS },
  gridSnapStep: DEFAULT_GRID_SNAP_STEP,
  racks: [],
  zones: [],
  structuralElements: [],
  buildingLevels: [{ ...DEFAULT_GROUND_LEVEL }],
  verticalConnectors: [],

  loadBlueprint: (blueprint) =>
    set({
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
      floorDimensions: blueprint.floorDimensions,
      gridSnapStep: blueprint.gridSnapStep,
      racks: blueprint.racks,
      zones: blueprint.zones,
      structuralElements: blueprint.structuralElements,
      buildingLevels:
        blueprint.buildingLevels && blueprint.buildingLevels.length > 0
          ? blueprint.buildingLevels
          : [{ ...DEFAULT_GROUND_LEVEL, height: blueprint.floorDimensions?.height || 6.0 }],
      verticalConnectors: blueprint.verticalConnectors || [],
      isDirty: false,
      history: [],
      historyIndex: -1,

      ...(blueprint.pickingConfig
        ? {
            pickList: blueprint.pickingConfig.pickList || [],
            customWaypoints: blueprint.pickingConfig.customWaypoints || [],
            depotPosition: blueprint.pickingConfig.depotPosition || { x: 3, z: 3 },
            selectedVehicleType: blueprint.pickingConfig.selectedVehicleType || 'FORKLIFT',
            isManualSequence: blueprint.pickingConfig.isManualSequence ?? false,
            fleet:
              blueprint.pickingConfig.fleet?.map((a) => ({
                ...a,
                levelId: a.levelId || 'level-1',
              })) ||
              createInitialFleet(
                blueprint.pickingConfig.depotPosition,
                blueprint.buildingLevels
              ),
          }
        : {
            fleet: createInitialFleet(undefined, blueprint.buildingLevels),
          }),
    }),

  setBlueprintMeta: (meta) =>
    set((state) => {
      const nextName = meta.blueprintName ?? meta.name;
      return {
        ...(nextName !== undefined ? { blueprintName: nextName } : {}),
        ...(meta.gridSnapStep !== undefined ? { gridSnapStep: meta.gridSnapStep } : {}),
        ...(meta.floorDimensions !== undefined ? { floorDimensions: meta.floorDimensions } : {}),
      };
    }),

  addRack: (rack) => set((state) => ({ racks: [...state.racks, rack] })),
  addRacks: (newRacks) => set((state) => ({ racks: [...state.racks, ...newRacks] })),

  removeRack: (rackId) =>
    set((state) => ({
      // Child bins cascade with the rack record (DATA-MODEL.md Section 3.2)
      racks: state.racks.filter((r: RackEntity) => r.id !== rackId),
      selectedEntityId: state.selectedEntityId === rackId ? null : state.selectedEntityId,
      selectedEntityIds: state.selectedEntityIds.filter((id) => id !== rackId),
    })),
  removeRacks: (rackIds) => {
    const idSet = new Set(rackIds);
    set((state) => ({
      racks: state.racks.filter((r: RackEntity) => !idSet.has(r.id)),
      selectedEntityId:
        state.selectedEntityId && idSet.has(state.selectedEntityId)
          ? null
          : state.selectedEntityId,
      selectedEntityIds: state.selectedEntityIds.filter((id) => !idSet.has(id)),
    }));
  },

  moveRack: (rackId, position) =>
    set((state) => ({
      racks: state.racks.map((r: RackEntity) =>
        r.id === rackId ? { ...r, position } : r
      ),
    })),

  rotateRack: (rackId, rotationY) =>
    set((state) => ({
      racks: state.racks.map((r: RackEntity) =>
        r.id === rackId ? { ...r, rotationY } : r
      ),
    })),

  updateRackConfig: (rackId, patch) =>
    set((state) => ({
      racks: state.racks.map((r: RackEntity) =>
        r.id === rackId ? { ...r, ...patch } : r
      ),
    })),

  updateBin: (rackId, binId, patch) =>
    set((state) => ({
      racks: state.racks.map((r: RackEntity) =>
        r.id === rackId
          ? {
              ...r,
              bins: r.bins.map((b) => (b.id === binId ? { ...b, ...patch } : b)),
            }
          : r
      ),
    })),

  batchUpdateRackBins: (rackId, isOccupied, percentage = 0.7) =>
    set((state) => ({
      racks: state.racks.map((r: RackEntity) => {
        if (r.id !== rackId) return r;
        return {
          ...r,
          bins: r.bins.map((b) => {
            const occupied =
              isOccupied === 'random' ? Math.random() < percentage : isOccupied;
            return {
              ...b,
              isOccupied: occupied,
              skuData: occupied
                ? b.skuData ?? generateMockSkuData(b.id)
                : undefined,
            };
          }),
        };
      }),
    })),

  batchUpdateAllBins: (isOccupied, percentage = 0.7, targetLevelId) =>
    set((state) => ({
      racks: state.racks.map((r: RackEntity) => {
        if (targetLevelId && (r.levelId ?? 'level-1') !== targetLevelId) {
          return r;
        }
        return {
          ...r,
          bins: r.bins.map((b) => {
            const occupied =
              isOccupied === 'random' ? Math.random() < percentage : isOccupied;
            return {
              ...b,
              isOccupied: occupied,
              skuData: occupied
                ? b.skuData ?? generateMockSkuData(b.id)
                : undefined,
            };
          }),
        };
      }),
    })),

  addZone: (zone) => set((state) => ({ zones: [...state.zones, zone] })),

  removeZone: (zoneId) =>
    set((state) => ({
      zones: state.zones.filter((z: WarehouseZone) => z.id !== zoneId),
      selectedEntityId: state.selectedEntityId === zoneId ? null : state.selectedEntityId,
      selectedEntityIds: state.selectedEntityIds.filter((id) => id !== zoneId),
    })),

  moveZone: (zoneId, position) =>
    set((state) => ({
      zones: state.zones.map((z: WarehouseZone) =>
        z.id === zoneId ? { ...z, position } : z
      ),
    })),

  updateZone: (zoneId, patch) =>
    set((state) => ({
      zones: state.zones.map((z: WarehouseZone) =>
        z.id === zoneId ? { ...z, ...patch } : z
      ),
    })),

  updateZonePallet: (zoneId, palletId, patch) =>
    set((state) => ({
      zones: state.zones.map((z: WarehouseZone) => {
        if (z.id !== zoneId) return z;
        const currentSlots = z.stagingConfig?.slots ?? calculateZonePalletSlots(z);
        const updatedSlots = currentSlots.map((slot) =>
          slot.id === palletId ? { ...slot, ...patch } : slot
        );
        return {
          ...z,
          stagingConfig: {
            ...z.stagingConfig,
            enabled: z.stagingConfig?.enabled ?? true,
            slots: updatedSlots,
          },
        };
      }),
    })),

  batchUpdateZonePallets: (zoneId, isOccupied) =>
    set((state) => ({
      zones: state.zones.map((z: WarehouseZone) => {
        if (z.id !== zoneId) return z;
        const currentSlots = z.stagingConfig?.slots ?? calculateZonePalletSlots(z);
        const updatedSlots = currentSlots.map((slot, idx) => {
          const occupied =
            isOccupied === 'random' ? Math.random() < 0.7 : isOccupied;
          return {
            ...slot,
            isOccupied: occupied,
            skuData: occupied
              ? slot.skuData ?? generateMockZonePalletSku(z.type, idx + 1)
              : undefined,
          };
        });
        return {
          ...z,
          stagingConfig: {
            ...z.stagingConfig,
            enabled: z.stagingConfig?.enabled ?? true,
            slots: updatedSlots,
          },
        };
      }),
    })),

  updateZoneStagingConfig: (zoneId, configPatch) =>
    set((state) => ({
      zones: state.zones.map((z: WarehouseZone) => {
        if (z.id !== zoneId) return z;
        return {
          ...z,
          stagingConfig: {
            ...z.stagingConfig,
            enabled: z.stagingConfig?.enabled ?? true,
            ...configPatch,
          },
        };
      }),
    })),

  addStructuralElement: (elem) =>
    set((state) => ({ structuralElements: [...state.structuralElements, elem] })),

  removeStructuralElement: (elemId) =>
    set((state) => ({
      structuralElements: state.structuralElements.filter(
        (e: StructuralElement) => e.id !== elemId
      ),
      selectedEntityId: state.selectedEntityId === elemId ? null : state.selectedEntityId,
      selectedEntityIds: state.selectedEntityIds.filter((id) => id !== elemId),
    })),

  moveStructuralElement: (elemId, position) =>
    set((state) => ({
      structuralElements: state.structuralElements.map((e: StructuralElement) =>
        e.id === elemId ? { ...e, position } : e
      ),
    })),

  rotateStructuralElement: (elemId, rotationY) =>
    set((state) => ({
      structuralElements: state.structuralElements.map((e: StructuralElement) =>
        e.id === elemId ? { ...e, rotationY } : e
      ),
    })),

  updateStructuralElement: (elemId, patch) =>
    set((state) => ({
      structuralElements: state.structuralElements.map((e: StructuralElement) =>
        e.id === elemId ? { ...e, ...patch } : e
      ),
    })),

  addBuildingLevel: (level) =>
    set((state) => ({ buildingLevels: [...state.buildingLevels, level] })),

  updateBuildingLevel: (levelId, patch) =>
    set((state) => ({
      buildingLevels: state.buildingLevels.map((lvl) =>
        lvl.id === levelId ? { ...lvl, ...patch } : lvl
      ),
    })),

  removeBuildingLevel: (levelId) =>
    set((state) => ({
      buildingLevels: state.buildingLevels.filter((lvl) => lvl.id !== levelId),
    })),

  addVerticalConnector: (connector) =>
    set((state) => ({ verticalConnectors: [...state.verticalConnectors, connector] })),

  removeVerticalConnector: (connectorId) =>
    set((state) => ({
      verticalConnectors: state.verticalConnectors.filter((c) => c.id !== connectorId),
      selectedEntityId: state.selectedEntityId === connectorId ? null : state.selectedEntityId,
      selectedEntityIds: state.selectedEntityIds.filter((id) => id !== connectorId),
    })),

  moveVerticalConnector: (connectorId, position) =>
    set((state) => ({
      verticalConnectors: state.verticalConnectors.map((c) =>
        c.id === connectorId ? { ...c, position } : c
      ),
    })),

  rotateVerticalConnector: (connectorId, rotationY) =>
    set((state) => ({
      verticalConnectors: state.verticalConnectors.map((c) =>
        c.id === connectorId ? { ...c, rotationY } : c
      ),
    })),

  updateVerticalConnector: (connectorId, patch) =>
    set((state) => ({
      verticalConnectors: state.verticalConnectors.map((c) =>
        c.id === connectorId ? { ...c, ...patch } : c
      ),
    })),
});


