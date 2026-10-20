// Shared transient bus between the HTML drop-target wrapper (outside the R3F
// Canvas) and PlacementPreview (inside). Mutable singleton avoids 60Hz React
// re-renders during drag-over; the ghost mesh reads it inside useFrame.
// The in-canvas CameraBridge registers camera + rect accessors so DOM-level
// drag events can be converted to floor coordinates without prop drilling.

import type { Camera } from 'three';
import type { DraggedPaletteItem } from '@/types/interaction';

export interface PlacementBusState {
  /** An HTML5 palette drag is currently over the canvas */
  isDraggingOver: boolean;
  clientX: number;
  clientY: number;
  /** Item being dragged from the palette */
  item: DraggedPaletteItem | null;
  /** Registered by CameraBridge inside the R3F Canvas */
  camera: Camera | null;
  getCanvasRect: (() => DOMRect) | null;
}

export const placementBus: PlacementBusState = {
  isDraggingOver: false,
  clientX: 0,
  clientY: 0,
  item: null,
  camera: null,
  getCanvasRect: null,
};

/**
 * Sets cursor position and dragging-over state during HTML dragover events.
 */
export function setPlacementDragOver(clientX: number, clientY: number, isDraggingOver: boolean = true): void {
  placementBus.isDraggingOver = isDraggingOver;
  placementBus.clientX = clientX;
  placementBus.clientY = clientY;
}

/**
 * Updates the active palette item being dragged.
 */
export function setPlacementItem(item: DraggedPaletteItem | null): void {
  placementBus.item = item;
}

/**
 * Registers active R3F camera and canvas rect accessor from CameraBridge.
 */
export function registerCameraBridge(camera: Camera, getCanvasRect: () => DOMRect): void {
  placementBus.camera = camera;
  placementBus.getCanvasRect = getCanvasRect;
}

/**
 * Unregisters camera and canvas rect accessor when CameraBridge unmounts.
 */
export function unregisterCameraBridge(): void {
  placementBus.camera = null;
  placementBus.getCanvasRect = null;
}

/**
 * Resets transient drag state back to initial idle defaults.
 */
export function resetPlacementBus(): void {
  placementBus.isDraggingOver = false;
  placementBus.clientX = 0;
  placementBus.clientY = 0;
  placementBus.item = null;
}

/**
 * Gets a read-only snapshot or direct reference of the placement bus state.
 */
export function getPlacementBusState(): Readonly<PlacementBusState> {
  return placementBus;
}
