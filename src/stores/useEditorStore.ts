// Fulfills ARCHITECTURE.md Section 2 (stores/useEditorStore.ts)
// Unified Zustand store composing blueprint, history, and selection slices.

import { create } from 'zustand';
import { createBlueprintSlice } from './slices/blueprintSlice';
import { createHistorySlice } from './slices/historySlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createViewSlice } from './slices/viewSlice';
import { createPickingSlice } from './slices/pickingSlice';
import type { EditorStore } from './editor-store';

export type { EditorStore } from './editor-store';

export const useEditorStore = create<EditorStore>()((...args) => ({
  ...createBlueprintSlice(...args),
  ...createHistorySlice(...args),
  ...createSelectionSlice(...args),
  ...createViewSlice(...args),
  ...createPickingSlice(...args),
}));
