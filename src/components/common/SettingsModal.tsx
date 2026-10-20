'use client';

// Fulfills Phase 28: Settings Modal Dialog
// Provides categorized preference management for Language, Theme, Measurement Units,
// 3D Graphics Quality (Shadows, Anti-Aliasing), Grid Display, and Auto-Save Interval.

import { useState } from 'react';
import { useSettingsStore, type Language, type AppTheme, type UnitSystem } from '@/stores/useSettingsStore';
import { useTranslation } from '@/lib/i18n';
import {
  Settings,
  X,
  Globe,
  Ruler,
  Sliders,
  HardDrive,
  Moon,
  Sun,
  Sparkles,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'units' | 'graphics' | 'storage';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const graphicsQuality = useSettingsStore((s) => s.graphicsQuality);
  const showGridLines = useSettingsStore((s) => s.showGridLines);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);

  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
  const setGraphicsQuality = useSettingsStore((s) => s.setGraphicsQuality);
  const setShowGridLines = useSettingsStore((s) => s.setShowGridLines);
  const setAutoSaveInterval = useSettingsStore((s) => s.setAutoSaveInterval);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative flex h-[620px] max-h-[92vh] w-[700px] max-w-full flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/95 shadow-2xl shadow-slate-900/20 dark:shadow-black/80 backdrop-blur-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800/80 px-6 py-4 bg-slate-50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/80 border border-sky-500/30 shadow-inner">
              <Settings className="h-5 w-5 text-sky-600 dark:text-sky-400" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {t.settingsModal.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {t.settingsModal.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
            title={t.common.close}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex border-b border-slate-200 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-neutral-900/20 px-6 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 transition ${
              activeTab === 'general'
                ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Globe className="h-4 w-4" strokeWidth={1.75} />
            <span>{t.settingsModal.tabs.general}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 transition ${
              activeTab === 'units'
                ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Ruler className="h-4 w-4" strokeWidth={1.75} />
            <span>{t.settingsModal.tabs.units}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('graphics')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 transition ${
              activeTab === 'graphics'
                ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Sliders className="h-4 w-4" strokeWidth={1.75} />
            <span>{t.settingsModal.tabs.graphics}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 transition ${
              activeTab === 'storage'
                ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <HardDrive className="h-4 w-4" strokeWidth={1.75} />
            <span>{t.settingsModal.tabs.storage}</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* TAB 1: GENERAL (LANGUAGE & THEME) */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              {/* Language Selection */}
              <div>
                <label className="text-sm font-bold text-slate-900 dark:text-white block mb-1">
                  {t.settingsModal.general.languageTitle}
                </label>
                <p className="text-slate-500 dark:text-neutral-400 mb-3 text-[11px]">
                  {t.settingsModal.general.languageDesc}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLanguage('id')}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      language === 'id'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-slate-900 dark:text-white shadow-sm'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-2xl">🇮🇩</span>
                    <div>
                      <div className="font-bold text-sm">Bahasa Indonesia</div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400">Standar Indonesia</div>
                    </div>
                    {language === 'id' && (
                      <span className="ml-auto text-sky-600 dark:text-sky-400 font-bold">✓</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      language === 'en'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-slate-900 dark:text-white shadow-sm'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-2xl">🇬🇧</span>
                    <div>
                      <div className="font-bold text-sm">English</div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400">International English</div>
                    </div>
                    {language === 'en' && (
                      <span className="ml-auto text-sky-600 dark:text-sky-400 font-bold">✓</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="border-t border-slate-200 dark:border-neutral-800/80 pt-5">
                <label className="text-sm font-bold text-slate-900 dark:text-white block mb-1">
                  {t.settingsModal.general.themeTitle}
                </label>
                <p className="text-slate-500 dark:text-neutral-400 mb-3 text-[11px]">
                  {t.settingsModal.general.themeDesc}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
                      theme === 'dark'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-slate-900 dark:text-white shadow-sm ring-1 ring-sky-500/50'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold text-sm">
                        <Moon className="h-4 w-4 text-sky-400" strokeWidth={1.75} />
                        <span>{t.settingsModal.general.themeDark}</span>
                      </span>
                      {theme === 'dark' && <span className="text-sky-600 dark:text-sky-400 font-bold">✓</span>}
                    </div>
                    <div className="h-12 w-full rounded-xl bg-[#0a0e17] border border-neutral-800 flex items-center justify-center p-2">
                      <div className="h-4 w-12 rounded bg-neutral-800/80 mr-2" />
                      <div className="h-4 w-16 rounded bg-sky-600/80" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                      {t.settingsModal.general.themeDarkDesc}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
                      theme === 'light'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-slate-900 dark:text-white shadow-sm ring-1 ring-sky-500/50'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold text-sm">
                        <Sun className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
                        <span>{t.settingsModal.general.themeLight}</span>
                      </span>
                      {theme === 'light' && <span className="text-sky-600 dark:text-sky-400 font-bold">✓</span>}
                    </div>
                    <div className="h-12 w-full rounded-xl bg-[#f8fafc] border border-slate-300 flex items-center justify-center p-2">
                      <div className="h-4 w-12 rounded bg-slate-200 mr-2" />
                      <div className="h-4 w-16 rounded bg-sky-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                      {t.settingsModal.general.themeLightDesc}
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UNITS & GRID */}
          {activeTab === 'units' && (
            <div className="space-y-6 animate-fade-in">
              {/* Unit System */}
              <div>
                <label className="text-sm font-bold text-slate-900 dark:text-white block mb-1">
                  {t.settingsModal.units.unitsTitle}
                </label>
                <p className="text-slate-500 dark:text-neutral-400 mb-3 text-[11px]">
                  {t.settingsModal.units.unitsDesc}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUnitSystem('metric')}
                    className={`flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition ${
                      unitSystem === 'metric'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-slate-900 dark:text-white shadow-sm'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        <Ruler className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
                        <span>Metrik (Metric - m, kg)</span>
                      </span>
                      {unitSystem === 'metric' && <span className="text-sky-600 dark:text-sky-400 font-bold">✓</span>}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                      {t.settingsModal.units.metricDesc}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnitSystem('imperial')}
                    className={`flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition ${
                      unitSystem === 'imperial'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-slate-900 dark:text-white shadow-sm'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        <Ruler className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
                        <span>Imperial (US - ft, lbs)</span>
                      </span>
                      {unitSystem === 'imperial' && <span className="text-sky-600 dark:text-sky-400 font-bold">✓</span>}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                      {t.settingsModal.units.imperialDesc}
                    </span>
                  </button>
                </div>
              </div>

              {/* Grid Lines Toggle */}
              <div className="border-t border-slate-200 dark:border-neutral-800/80 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-slate-900 dark:text-white block">
                      {t.settingsModal.units.gridTitle}
                    </label>
                    <p className="text-slate-500 dark:text-neutral-400 text-[11px] mt-0.5">
                      {t.settingsModal.units.gridDesc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGridLines(!showGridLines)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showGridLines ? 'bg-sky-600' : 'bg-slate-300 dark:bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showGridLines ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GRAPHICS & 3D */}
          {activeTab === 'graphics' && (
            <div className="space-y-6 animate-fade-in">
              {/* Shadows Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 p-4">
                <div>
                  <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Moon className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
                    <span>{t.settingsModal.graphics.shadowsTitle}</span>
                  </label>
                  <p className="text-slate-500 dark:text-neutral-400 text-[11px] mt-1">
                    {t.settingsModal.graphics.shadowsDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setGraphicsQuality({ shadows: !graphicsQuality.shadows })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    graphicsQuality.shadows ? 'bg-sky-600' : 'bg-slate-300 dark:bg-neutral-800'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      graphicsQuality.shadows ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Anti-Aliasing Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 p-4">
                <div>
                  <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
                    <span>{t.settingsModal.graphics.antialiasTitle}</span>
                  </label>
                  <p className="text-slate-500 dark:text-neutral-400 text-[11px] mt-1">
                    {t.settingsModal.graphics.antialiasDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setGraphicsQuality({ antialias: !graphicsQuality.antialias })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    graphicsQuality.antialias ? 'bg-sky-600' : 'bg-slate-300 dark:bg-neutral-800'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      graphicsQuality.antialias ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: STORAGE & AUTO-SAVE */}
          {activeTab === 'storage' && (
            <div className="space-y-6 animate-fade-in">
              {/* Auto Save Interval */}
              <div>
                <label className="text-sm font-bold text-slate-900 dark:text-white block mb-1">
                  {t.settingsModal.storage.autoSaveTitle}
                </label>
                <p className="text-slate-500 dark:text-neutral-400 mb-3 text-[11px]">
                  {t.settingsModal.storage.autoSaveDesc}
                </p>

                <div className="space-y-2">
                  {[
                    { val: 120, label: t.settingsModal.storage.autoSave2Min },
                    { val: 300, label: t.settingsModal.storage.autoSave5Min },
                    { val: 0, label: t.settingsModal.storage.autoSaveDisabled },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setAutoSaveInterval(opt.val)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                        autoSaveInterval === opt.val
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-slate-900 dark:text-white font-bold'
                          : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/30 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {autoSaveInterval === opt.val && (
                        <span className="text-sky-600 dark:text-sky-400 font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset to Factory Defaults */}
              <div className="border-t border-slate-200 dark:border-neutral-800/80 pt-5">
                <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-red-600 dark:text-red-300">
                      {t.settingsModal.storage.resetTitle}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                      {t.settingsModal.storage.resetDesc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Reset all settings to default values?')) {
                        resetToDefaults();
                      }
                    }}
                    className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-100 dark:bg-red-900/50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 hover:text-red-900 dark:hover:text-white transition"
                  >
                    {t.settingsModal.storage.resetBtn}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-900/40 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-sky-600/30 hover:brightness-110 active:scale-95 transition"
          >
            {t.common.finish}
          </button>
        </div>
      </div>
    </div>
  );
}
