// Fulfills ARCHITECTURE.md Section 3 Undo/Redo Invariant & PRD.md Section 4.5
// All spatial mutations flow through ICommand objects pushed onto this stack.

import type { StateCreator } from 'zustand';
import type { ICommand } from '@/types/commands';
import { MAX_HISTORY_DEPTH } from '@/lib/constants/warehouse-defaults';
import type { EditorStore } from '../editor-store';

export interface HistorySlice {
  history: ICommand[];
  historyIndex: number;
  isDirty: boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  executeCommand: (command: ICommand) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  markSaved: () => void;
  setIsDirty: (dirty: boolean) => void;
}

export const createHistorySlice: StateCreator<
  EditorStore,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  history: [],
  historyIndex: -1,
  isDirty: false,

  canUndo: () => get().historyIndex >= 0,

  canRedo: () => get().historyIndex < get().history.length - 1,

  executeCommand: (command: ICommand) => {
    command.execute();

    const { history, historyIndex } = get();
    // Truncate redo tail, then push new command (ARCHITECTURE.md Section 3)
    const truncated = history.slice(0, historyIndex + 1);
    truncated.push(command);

    // Enforce fixed max depth of 30 (PRD.md Section 4.5): drop oldest entries
    while (truncated.length > MAX_HISTORY_DEPTH) {
      truncated.shift();
    }

    set({ history: truncated, historyIndex: truncated.length - 1, isDirty: true });
  },

  undo: () => {
    const { history, historyIndex, canUndo } = get();
    if (!canUndo()) return;

    history[historyIndex].undo();
    set({ historyIndex: historyIndex - 1, isDirty: true });
  },

  redo: () => {
    const { history, historyIndex, canRedo } = get();
    if (!canRedo()) return;

    const nextIndex = historyIndex + 1;
    history[nextIndex].execute();
    set({ historyIndex: nextIndex, isDirty: true });
  },

  clearHistory: () => set({ history: [], historyIndex: -1, isDirty: false }),
  markSaved: () => set({ isDirty: false }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
});

