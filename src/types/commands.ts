// Fulfills ARCHITECTURE.md Section 3 Undo/Redo Invariant (Base Command Contract)

export interface ICommand {
  execute: () => void;
  undo: () => void;
}

// Fixed maximum undo history depth (PRD.md Section 4.5)
export const HISTORY_DEPTH_LIMIT = 30;
