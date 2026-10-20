'use client';

// Central i18n module and translation hooks
import { useSettingsStore, type UnitSystem } from '@/stores/useSettingsStore';
import { id } from './id';
import { en } from './en';

export const DICTIONARIES = {
  id,
  en,
} as const;

export type TranslationDictionary = typeof id;

/**
 * Hook to access current translation dictionary and language setter
 */
export function useTranslation() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const t: TranslationDictionary = DICTIONARIES[language] || DICTIONARIES.id;

  return {
    t,
    language,
    setLanguage,
  };
}

/**
 * Formats linear distance in meters or feet based on unitSystem
 */
export function formatDistance(meters: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const feet = meters * 3.28084;
    return `${feet.toFixed(1)} ft`;
  }
  return `${meters.toFixed(1)} m`;
}

/**
 * Formats area in square meters or square feet based on unitSystem
 */
export function formatArea(sqm: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const sqft = Math.round(sqm * 10.7639);
    return `${sqft.toLocaleString('en-US')} sq ft`;
  }
  return `${sqm.toLocaleString('en-US')} m²`;
}

/**
 * Formats volume in cubic meters or cubic feet based on unitSystem
 */
export function formatVolume(cbm: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const cbft = Math.round(cbm * 35.3147);
    return `${cbft.toLocaleString('en-US')} cu ft`;
  }
  return `${cbm.toLocaleString('en-US')} m³`;
}

/**
 * Formats payload weight in kilograms, tonnes, or pounds based on unitSystem
 */
export function formatWeight(kg: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const lbs = Math.round(kg * 2.20462);
    if (lbs >= 2000) {
      return `${(lbs / 2000).toFixed(1)} tons`;
    }
    return `${lbs.toLocaleString('en-US')} lbs`;
  }

  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)} tonnes`;
  }
  return `${Math.round(kg)} kg`;
}
