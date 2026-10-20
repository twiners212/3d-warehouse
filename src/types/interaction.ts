// Fulfills INTERACTION-SPECIFICATION.md Section 8 TypeScript Interaction Contracts

export type EditorInteractionMode =
  | 'IDLE'
  | 'HOVER'
  | 'SELECTED'
  | 'PREVIEW_PLACEMENT'
  | 'ACTIVE_TRANSLATION'
  | 'ROTATING';

export interface DraggedPaletteItem {
  type: 'rack' | 'structural' | 'zone' | 'connector';
  subType: string;
  defaultConfig: {
    width: number;
    depth: number;
    height: number;
    bays?: number;
    levels?: number;
  };
}

export interface InteractionState {
  mode: EditorInteractionMode;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  draggedItem: DraggedPaletteItem | null;
  isSnappingEnabled: boolean;
  isCollisionValid: boolean;
  activeTransformOrigin: { x: number; y: number; z: number } | null;
}
