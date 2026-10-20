// Automated Smoke Test for Phase 28: Settings & i18n Localization Engine
// Verifies:
// 1. 100% Key parity between Indonesian (id.ts) and English (en.ts) dictionaries
// 2. Linear and mass unit conversion math (meters <-> feet, kg <-> lbs)
// 3. Settings store state transitions, quality toggles, and reset functionality

import { id } from '../src/lib/i18n/id';
import { en } from '../src/lib/i18n/en';
import { formatDistance, formatWeight, formatArea, formatVolume } from '../src/lib/i18n';
import { useSettingsStore } from '../src/stores/useSettingsStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Starting Settings & i18n Engine Smoke Tests...\n');

// 1. Deep Key Parity Validation between ID and EN dictionaries
function getNestedKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getNestedKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const idKeys = getNestedKeys(id as unknown as Record<string, unknown>).sort();
const enKeys = getNestedKeys(en as unknown as Record<string, unknown>).sort();

console.log(`Checking dictionary parity (${idKeys.length} keys)...`);

const missingInEn = idKeys.filter((k) => !enKeys.includes(k));
const missingInId = enKeys.filter((k) => !idKeys.includes(k));

assert(
  missingInEn.length === 0,
  `Keys present in ID but missing in EN: ${missingInEn.join(', ')}`
);
assert(
  missingInId.length === 0,
  `Keys present in EN but missing in ID: ${missingInId.join(', ')}`
);
console.log('✅ Dictionary parity test passed: 100% match between ID and EN dictionaries.');

// 2. Unit Formatter Tests (Metric vs Imperial)
console.log('\nValidating unit conversion math...');

// Distance
const distMetric = formatDistance(10, 'metric');
const distImperial = formatDistance(10, 'imperial');
assert(distMetric === '10.0 m', `Expected "10.0 m", got "${distMetric}"`);
assert(distImperial === '32.8 ft', `Expected "32.8 ft", got "${distImperial}"`);
console.log(`  Distance: 10m -> Metric: ${distMetric}, Imperial: ${distImperial}`);

// Weight
const weightMetric = formatWeight(500, 'metric');
const weightMetricTons = formatWeight(2500, 'metric');
const weightImperial = formatWeight(500, 'imperial');
assert(weightMetric === '500 kg', `Expected "500 kg", got "${weightMetric}"`);
assert(weightMetricTons === '2.5 tonnes', `Expected "2.5 tonnes", got "${weightMetricTons}"`);
assert(weightImperial === '1,102 lbs', `Expected "1,102 lbs", got "${weightImperial}"`);
console.log(`  Weight: 500kg -> Metric: ${weightMetric}, Imperial: ${weightImperial}`);

// Area
const areaMetric = formatArea(100, 'metric');
const areaImperial = formatArea(100, 'imperial');
assert(areaMetric === '100 m²', `Expected "100 m²", got "${areaMetric}"`);
assert(areaImperial === '1,076 sq ft', `Expected "1,076 sq ft", got "${areaImperial}"`);
console.log(`  Area: 100m² -> Metric: ${areaMetric}, Imperial: ${areaImperial}`);

// Volume
const volMetric = formatVolume(200, 'metric');
const volImperial = formatVolume(200, 'imperial');
assert(volMetric === '200 m³', `Expected "200 m³", got "${volMetric}"`);
assert(volImperial === '7,063 cu ft', `Expected "7,063 cu ft", got "${volImperial}"`);
console.log(`  Volume: 200m³ -> Metric: ${volMetric}, Imperial: ${volImperial}`);

// 3. Settings Store State Transitions
console.log('\nValidating Settings Store reactivity...');
const store = useSettingsStore.getState();

// Reset first
useSettingsStore.getState().resetToDefaults();
const defaultState = useSettingsStore.getState();
assert(defaultState.language === 'id', 'Default language should be id');
assert(defaultState.theme === 'dark', 'Default theme should be dark');
assert(defaultState.unitSystem === 'metric', 'Default unitSystem should be metric');
assert(defaultState.graphicsQuality.shadows === true, 'Default shadows should be true');
assert(defaultState.showGridLines === true, 'Default showGridLines should be true');
assert(defaultState.autoSaveInterval === 120, 'Default autoSaveInterval should be 120s');

// Mutate language
useSettingsStore.getState().setLanguage('en');
assert(useSettingsStore.getState().language === 'en', 'Language should mutate to en');

// Mutate theme
useSettingsStore.getState().setTheme('light');
assert(useSettingsStore.getState().theme === 'light', 'Theme should mutate to light');

// Mutate units
useSettingsStore.getState().setUnitSystem('imperial');
assert(useSettingsStore.getState().unitSystem === 'imperial', 'Unit system should mutate to imperial');

// Mutate graphics
useSettingsStore.getState().setGraphicsQuality({ shadows: false });
assert(useSettingsStore.getState().graphicsQuality.shadows === false, 'Shadows should be disabled');

// Mutate autoSaveInterval
useSettingsStore.getState().setAutoSaveInterval(300);
assert(useSettingsStore.getState().autoSaveInterval === 300, 'Auto save interval should mutate to 300s');

// Reset
useSettingsStore.getState().resetToDefaults();
const resetState = useSettingsStore.getState();
assert(resetState.language === 'id', 'Language should reset to id');
assert(resetState.theme === 'dark', 'Theme should reset to dark');
assert(resetState.unitSystem === 'metric', 'Unit system should reset to metric');

console.log('✅ Settings Store transitions verified successfully.');
console.log('\n🎉 ALL SETTINGS & I18N SMOKE TESTS PASSED!\n');
