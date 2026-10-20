'use client';

// Fulfills Phase 28: Settings System & User Preferences Store
// Client-side initializer that safely hydrates user preferences (theme, language,
// units, graphics quality) from localStorage after React completes initial SSR hydration,
// eliminating React hydration mismatch warnings.

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function SettingsInitializer() {
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  return null;
}
