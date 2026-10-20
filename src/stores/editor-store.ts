// Shared composite store type so every slice's StateCreator is fully typed
// (zero-any invariant). Kept separate from useEditorStore.ts to avoid a
// circular import between the store factory and its slices.

import type { BlueprintSlice } from './slices/blueprintSlice';
import type { HistorySlice } from './slices/historySlice';
import type { SelectionSlice } from './slices/selectionSlice';
import type { ViewSlice } from './slices/viewSlice';
import type { PickingSlice } from './slices/pickingSlice';

export type EditorStore = BlueprintSlice & HistorySlice & SelectionSlice & ViewSlice & PickingSlice;
