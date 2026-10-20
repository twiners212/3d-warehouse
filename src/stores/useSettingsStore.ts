'use client';

// Fulfills Phase 28: Settings System & User Preferences Store
// Manages application preferences including Language (ID/EN), Theme (Dark/Light),
// Measurement Units (Metric/Imperial), 3D Graphics Quality (Shadows, Anti-Aliasing),
// Floor Grid Visibility, and Auto-Save Interval with localStorage persistence.

import { useEffect } from 'react';
import { create } from 'zustand';

export type Language = 'id' | 'en';
export type AppTheme = 'dark' | 'light';
export type UnitSystem = 'metric' | 'imperial';

export interface GraphicsQuality {
  shadows: boolean;
  antialias: boolean;
}

export interface SettingsState {
  hasHydrated: boolean;
  language: Language;
  theme: AppTheme;
  unitSystem: UnitSystem;
  graphicsQuality: GraphicsQuality;
  showGridLines: boolean;
  autoSaveInterval: number; // in seconds (0 = disabled, 120 = 2 mins, 300 = 5 mins)

  // Actions
  hydrateSettings: () => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: AppTheme) => void;
  setUnitSystem: (units: UnitSystem) => void;
  setGraphicsQuality: (quality: Partial<GraphicsQuality>) => void;
  setShowGridLines: (show: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = 'warehouse_app_settings';

const DEFAULT_SETTINGS: Omit<
  SettingsState,
  | 'hasHydrated'
  | 'hydrateSettings'
  | 'setLanguage'
  | 'setTheme'
  | 'setUnitSystem'
  | 'setGraphicsQuality'
  | 'setShowGridLines'
  | 'setAutoSaveInterval'
  | 'resetToDefaults'
> = {
  language: 'id',
  theme: 'dark',
  unitSystem: 'metric',
  graphicsQuality: {
    shadows: true,
    antialias: true,
  },
  showGridLines: true,
  autoSaveInterval: 120, // 2 minutes default
};

function loadStoredSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      graphicsQuality: {
        ...DEFAULT_SETTINGS.graphicsQuality,
        ...(parsed.graphicsQuality || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(state: typeof DEFAULT_SETTINGS) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Apply theme class to document root for seamless global styling
    if (state.theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  } catch {
    // Ignore quota or private browsing errors
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  return {
    ...DEFAULT_SETTINGS,
    hasHydrated: false,

    hydrateSettings: () => {
      if (typeof window === 'undefined') return;
      if (get().hasHydrated) return;
      const stored = loadStoredSettings();
      set({ ...stored, hasHydrated: true });
      if (stored.theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    },

    setLanguage: (language) => {
      set({ language });
      const current = get();
      persistSettings({
        language,
        theme: current.theme,
        unitSystem: current.unitSystem,
        graphicsQuality: current.graphicsQuality,
        showGridLines: current.showGridLines,
        autoSaveInterval: current.autoSaveInterval,
      });
    },

    setTheme: (theme) => {
      set({ theme });
      const current = get();
      persistSettings({
        language: current.language,
        theme,
        unitSystem: current.unitSystem,
        graphicsQuality: current.graphicsQuality,
        showGridLines: current.showGridLines,
        autoSaveInterval: current.autoSaveInterval,
      });
    },

    setUnitSystem: (unitSystem) => {
      set({ unitSystem });
      const current = get();
      persistSettings({
        language: current.language,
        theme: current.theme,
        unitSystem,
        graphicsQuality: current.graphicsQuality,
        showGridLines: current.showGridLines,
        autoSaveInterval: current.autoSaveInterval,
      });
    },

    setGraphicsQuality: (partial) => {
      set((s) => ({
        graphicsQuality: { ...s.graphicsQuality, ...partial },
      }));
      const current = get();
      persistSettings({
        language: current.language,
        theme: current.theme,
        unitSystem: current.unitSystem,
        graphicsQuality: current.graphicsQuality,
        showGridLines: current.showGridLines,
        autoSaveInterval: current.autoSaveInterval,
      });
    },

    setShowGridLines: (showGridLines) => {
      set({ showGridLines });
      const current = get();
      persistSettings({
        language: current.language,
        theme: current.theme,
        unitSystem: current.unitSystem,
        graphicsQuality: current.graphicsQuality,
        showGridLines,
        autoSaveInterval: current.autoSaveInterval,
      });
    },

    setAutoSaveInterval: (autoSaveInterval) => {
      set({ autoSaveInterval });
      const current = get();
      persistSettings({
        language: current.language,
        theme: current.theme,
        unitSystem: current.unitSystem,
        graphicsQuality: current.graphicsQuality,
        showGridLines: current.showGridLines,
        autoSaveInterval,
      });
    },

    resetToDefaults: () => {
      set({ ...DEFAULT_SETTINGS, hasHydrated: true });
      persistSettings(DEFAULT_SETTINGS);
    },
  };
});

/**
 * Hook to safely hydrate user settings from localStorage on client mount.
 * Prevents SSR hydration mismatches in Next.js.
 */
export function useHydrateSettings(): boolean {
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  return hasHydrated;
}
