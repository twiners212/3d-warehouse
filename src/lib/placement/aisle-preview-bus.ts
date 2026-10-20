// Fulfills Phase 29: Shared bus for live 3D Aisle Array Preview
// Connects AisleGeneratorModal with in-canvas AisleArrayPreview without
// causing frequent re-renders of the root editor components.

import type { CandidateRack } from '@/engine/procedural/aisle-generator';

export interface AislePreviewBusState {
  isActive: boolean;
  candidates: CandidateRack[];
  skipColliding: boolean;
  listeners: Set<() => void>;
  setPreview: (candidates: CandidateRack[], skipColliding: boolean) => void;
  clearPreview: () => void;
  subscribe: (listener: () => void) => () => void;
}

export const aislePreviewBus: AislePreviewBusState = {
  isActive: false,
  candidates: [],
  skipColliding: false,
  listeners: new Set(),
  setPreview(candidates, skipColliding) {
    this.isActive = true;
    this.candidates = candidates;
    this.skipColliding = skipColliding;
    this.listeners.forEach((l) => l());
  },
  clearPreview() {
    this.isActive = false;
    this.candidates = [];
    this.listeners.forEach((l) => l());
  },
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
};
