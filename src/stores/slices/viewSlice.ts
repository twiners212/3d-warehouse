// Fulfills INTERACTION-SPECIFICATION.md Section 7 keyboard bindings (2/V -> 2D,
// 3/B -> 3D) and ARCHITECTURE.md Section 2 (CameraController dual-camera).
// View-layer state is separate from spatial mutation slices.

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editor-store';
import type { HeatmapMetric } from '@/types/layout';

export type CameraMode = 'ORTHO_2D' | 'PERSP_3D';
export type FloorSliceMode = 'ISOLATE' | 'GHOST_UPPER' | 'ALL';

export interface ViewSlice {
  cameraMode: CameraMode;
  isGridVisible: boolean;
  heatmapMetric: HeatmapMetric;
  activeLevelId: string | 'ALL';
  floorSliceMode: FloorSliceMode;

  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  toggleGrid: () => void;
  setHeatmapMetric: (metric: HeatmapMetric) => void;
  setActiveLevelId: (levelId: string | 'ALL') => void;
  setFloorSliceMode: (mode: FloorSliceMode) => void;
}

export const createViewSlice: StateCreator<
  EditorStore,
  [],
  [],
  ViewSlice
> = (set) => ({
  cameraMode: 'PERSP_3D',
  isGridVisible: true,
  heatmapMetric: 'NONE',
  activeLevelId: 'ALL',
  floorSliceMode: 'GHOST_UPPER',

  setCameraMode: (mode) => set({ cameraMode: mode }),

  toggleCameraMode: () =>
    set((state) => ({
      cameraMode: state.cameraMode === 'ORTHO_2D' ? 'PERSP_3D' : 'ORTHO_2D',
    })),

  toggleGrid: () => set((state) => ({ isGridVisible: !state.isGridVisible })),

  setHeatmapMetric: (metric) => set({ heatmapMetric: metric }),

  setActiveLevelId: (levelId) => set({ activeLevelId: levelId }),

  setFloorSliceMode: (mode) => set({ floorSliceMode: mode }),
});

