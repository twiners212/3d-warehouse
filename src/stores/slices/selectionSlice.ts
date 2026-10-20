// Fulfills ARCHITECTURE.md Section 2 (stores/slices/selectionSlice.ts)
// Single-entity selection for Phase 1 MVP (INTERACTION-SPECIFICATION.md Section 2.2).

import type { StateCreator } from 'zustand';
import type { DraggedPaletteItem, EditorInteractionMode } from '@/types/interaction';
import type { EditorStore } from '../editor-store';

export type EditorViewMode = 'LAYOUT' | 'WMS' | 'PICKING';

export interface SelectionSlice {
  mode: EditorInteractionMode;
  editorViewMode: EditorViewMode;
  selectedEntityId: string | null;
  selectedEntityIds: string[];
  hoveredEntityId: string | null;
  selectedBinId: string | null;
  hoveredBinId: string | null;
  selectedZonePallet: { zoneId: string; palletId: string } | null;
  draggedItem: DraggedPaletteItem | null;
  isSnappingEnabled: boolean;
  isCollisionValid: boolean;
  activeTransformOrigin: { x: number; y: number; z: number } | null;
  isDirectDragging: boolean;

  setMode: (mode: EditorInteractionMode) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  toggleEditorViewMode: () => void;
  setIsDirectDragging: (dragging: boolean) => void;
  selectEntity: (entityId: string) => void;
  toggleEntitySelection: (entityId: string) => void;
  setMultipleSelection: (entityIds: string[]) => void;
  clearSelection: () => void;
  deselectEntity: () => void;
  selectBin: (binId: string | null) => void;
  deselectBin: () => void;
  selectZonePallet: (zoneId: string, palletId: string) => void;
  deselectZonePallet: () => void;
  setHoveredEntity: (entityId: string | null) => void;
  setHoveredBin: (binId: string | null) => void;
  setDraggedItem: (item: DraggedPaletteItem | null) => void;
  setCollisionValid: (valid: boolean) => void;
  setActiveTransformOrigin: (origin: { x: number; y: number; z: number } | null) => void;
  toggleSnapping: () => void;
}

export const createSelectionSlice: StateCreator<
  EditorStore,
  [],
  [],
  SelectionSlice
> = (set) => ({
  mode: 'IDLE',
  editorViewMode: 'LAYOUT',
  selectedEntityId: null,
  selectedEntityIds: [],
  hoveredEntityId: null,
  selectedBinId: null,
  hoveredBinId: null,
  selectedZonePallet: null,
  draggedItem: null,
  isSnappingEnabled: true,
  isCollisionValid: true,
  activeTransformOrigin: null,
  isDirectDragging: false,

  setMode: (mode) => set({ mode }),
  setIsDirectDragging: (isDirectDragging) => set({ isDirectDragging }),

  setEditorViewMode: (mode) =>
    set({
      editorViewMode: mode,
      selectedBinId: mode === 'LAYOUT' ? null : undefined,
      selectedZonePallet: mode === 'WMS' ? undefined : null,
      ...(mode === 'PICKING'
        ? {
            selectedEntityId: null,
            selectedEntityIds: [],
            mode: 'IDLE',
            hoveredEntityId: null,
            selectedZonePallet: null,
          }
        : {}),
    }),

  toggleEditorViewMode: () =>
    set((state) => ({
      editorViewMode: state.editorViewMode === 'LAYOUT' ? 'WMS' : 'LAYOUT',
      selectedBinId: state.editorViewMode === 'LAYOUT' ? state.selectedBinId : null,
      selectedZonePallet: null,
    })),

  selectEntity: (entityId) =>
    set({
      selectedEntityId: entityId,
      selectedEntityIds: [entityId],
      mode: 'SELECTED',
    }),

  toggleEntitySelection: (entityId) =>
    set((state) => {
      const exists = state.selectedEntityIds.includes(entityId);
      const nextIds = exists
        ? state.selectedEntityIds.filter((id) => id !== entityId)
        : [...state.selectedEntityIds, entityId];
      return {
        selectedEntityIds: nextIds,
        selectedEntityId: nextIds.length > 0 ? nextIds[0] : null,
        mode: nextIds.length > 0 ? 'SELECTED' : 'IDLE',
      };
    }),

  setMultipleSelection: (entityIds) =>
    set({
      selectedEntityIds: entityIds,
      selectedEntityId: entityIds.length > 0 ? entityIds[0] : null,
      mode: entityIds.length > 0 ? 'SELECTED' : 'IDLE',
    }),

  clearSelection: () =>
    set({
      selectedEntityId: null,
      selectedEntityIds: [],
      mode: 'IDLE',
      activeTransformOrigin: null,
      selectedBinId: null,
      selectedZonePallet: null,
    }),

  deselectEntity: () =>
    set({
      selectedEntityId: null,
      selectedEntityIds: [],
      mode: 'IDLE',
      activeTransformOrigin: null,
      selectedBinId: null,
      selectedZonePallet: null,
    }),

  selectBin: (binId) =>
    set((state) => {
      if (!binId) {
        return { selectedBinId: null };
      }
      // Find parent rack if available
      const parentRack = state.racks.find((r) => r.bins.some((b) => b.id === binId));
      return {
        selectedBinId: binId,
        selectedZonePallet: null,
        selectedEntityId: parentRack ? parentRack.id : state.selectedEntityId,
        editorViewMode: 'WMS',
      };
    }),

  deselectBin: () => set({ selectedBinId: null }),

  selectZonePallet: (zoneId, palletId) =>
    set({
      selectedZonePallet: { zoneId, palletId },
      selectedEntityId: zoneId,
      selectedBinId: null,
      editorViewMode: 'WMS',
    }),

  deselectZonePallet: () => set({ selectedZonePallet: null }),

  setHoveredEntity: (entityId) => set({ hoveredEntityId: entityId }),

  setHoveredBin: (binId) => set({ hoveredBinId: binId }),

  setDraggedItem: (item) =>
    set({
      draggedItem: item,
      mode: item ? 'PREVIEW_PLACEMENT' : 'IDLE',
    }),

  setCollisionValid: (valid) => set({ isCollisionValid: valid }),

  setActiveTransformOrigin: (origin) =>
    set({
      activeTransformOrigin: origin,
      mode: origin ? 'ACTIVE_TRANSLATION' : 'IDLE',
    }),

  toggleSnapping: () =>
    set((state) => ({ isSnappingEnabled: !state.isSnappingEnabled })),
});
