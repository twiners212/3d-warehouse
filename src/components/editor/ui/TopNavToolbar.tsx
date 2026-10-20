'use client';

// Fulfills ARCHITECTURE.md Section 2 (editor/ui/TopNavToolbar.tsx):
// Frosted glass command header:
// - Inline facility rename with instant sync
// - Floor dimensions & operational footprint indicator
// - Tactile mode switcher: 📐 Layout Builder vs 📦 WMS Inventory
// - Contextual WMS batch controls & live occupancy meter
// - Undo / Redo with shortcut badges
// - Export Dropdown (JSON blueprint & CSV inventory manifest)
// - Primary glowing save button with async feedback

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  exportBinsCsv,
  exportBlueprintJson,
} from '@/lib/io/blueprint-io';
import { persistWarehouseLayout } from '@/app/actions/layout-actions';
import { useEditorStore } from '@/stores/useEditorStore';
import type { WarehouseLayoutBlueprint } from '@/types/layout';

export function buildBlueprintFromStore(
  state: ReturnType<typeof useEditorStore.getState>,
  blueprintId: string
): WarehouseLayoutBlueprint {
  const existing = state.blueprintId ?? blueprintId;
  const now = new Date().toISOString();
  return {
    id: existing,
    name: state.blueprintName,
    floorDimensions: state.floorDimensions,
    gridSnapStep: state.gridSnapStep,
    zones: state.zones,
    structuralElements: state.structuralElements,
    racks: state.racks,
    buildingLevels: state.buildingLevels,
    verticalConnectors: state.verticalConnectors,
    pickingConfig:
      state.pickList.length > 0 || state.fleet.length > 0
        ? {
            pickList: state.pickList,
            customWaypoints: state.customWaypoints,
            depotPosition: state.depotPosition,
            selectedVehicleType: state.selectedVehicleType,
            isManualSequence: state.isManualSequence,
            fleet: state.fleet,
          }
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

import { useTranslation } from '@/lib/i18n';
import { getCurrentUserAction, logoutAction } from '@/app/actions/auth-actions';
import type { AuthUser } from '@/lib/auth/types';
import {
  ArrowLeft,
  Pencil,
  Ruler,
  LayoutGrid,
  Boxes,
  Route,
  Settings,
  HelpCircle,
  Undo2,
  Redo2,
  Download,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  Save,
  Check,
  Database,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

export function TopNavToolbar({
  blueprintId,
  onRequestExit,
  onOpenTour,
  onOpenSettings,
  onOpenAisleGenerator: _onOpenAisleGenerator,
  onOpenWmsHub,
  currentUser: initialUser,
}: {
  blueprintId: string;
  onRequestExit?: () => void;
  onOpenTour?: () => void;
  onOpenSettings?: () => void;
  onOpenAisleGenerator?: () => void;
  onOpenWmsHub?: () => void;
  currentUser?: AuthUser | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser ?? null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialUser) {
      getCurrentUserAction().then((u) => {
        if (u) setCurrentUser(u);
      });
    }
  }, [initialUser]);

  // Inline rename state
  const blueprintName = useEditorStore((s) => s.blueprintName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(blueprintName);
  const [prevBlueprintName, setPrevBlueprintName] = useState(blueprintName);

  if (prevBlueprintName !== blueprintName) {
    setPrevBlueprintName(blueprintName);
    setTempName(blueprintName);
  }

  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const isDirty = useEditorStore((s) => s.isDirty);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  async function handleSave(): Promise<boolean> {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSaveState('saving');
    setSaveError(null);
    const result = await persistWarehouseLayout(
      buildBlueprintFromStore(useEditorStore.getState(), blueprintId)
    );
    if (result.success) {
      setSaveState('saved');
      useEditorStore.getState().markSaved();
      setTimeout(() => {
        setSaveState((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2500);
      return true;
    } else {
      setSaveState('error');
      setSaveError(result.error ?? 'Unknown error');
      return false;
    }
  }

  function handleBackNavigation(): void {
    if (isDirty) {
      if (onRequestExit) {
        onRequestExit();
      } else {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }

  function handleCommitName(): void {
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== blueprintName) {
      useEditorStore.getState().setBlueprintMeta({ name: trimmed });
    } else {
      setTempName(blueprintName);
    }
    setIsEditingName(false);
  }

  const floorArea = floorDimensions.width * floorDimensions.depth;

  return (
    <header
      data-tour="top-nav-toolbar"
      className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] h-14 w-full items-center border-b border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/90 px-3 lg:px-4 select-none backdrop-blur-md z-30 shrink-0 gap-2 overflow-visible"
    >
      {/* Left Section: Back, Brand, Editable Facility Name */}
      <div className="flex items-center justify-start gap-2 sm:gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleBackNavigation}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-100 dark:bg-neutral-800/60 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:border-sky-500 hover:bg-slate-200 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition shadow-sm shrink-0"
          title="Return to Facility Dashboard"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="hidden lg:inline">Facilities</span>
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-neutral-800 shrink-0" />

        {/* Inline Name Editor & Dimensions */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleCommitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitName();
                if (e.key === 'Escape') {
                  setTempName(blueprintName);
                  setIsEditingName(false);
                }
              }}
              className="rounded-lg border border-sky-500 bg-white dark:bg-neutral-950 px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-neutral-100 focus:outline-none ring-1 ring-sky-500 max-w-[130px] sm:max-w-[180px]"
            />
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-neutral-800/60 transition cursor-pointer min-w-0"
              title="Click to rename blueprint"
            >
              <span className="font-bold text-slate-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-300 transition truncate max-w-[90px] sm:max-w-[140px] md:max-w-[180px] 2xl:max-w-[240px]">
                {blueprintName}
              </span>
              <Pencil className="h-3 w-3 text-slate-400 dark:text-neutral-500 opacity-0 group-hover:opacity-100 transition shrink-0" strokeWidth={1.75} />
            </div>
          )}

          <button
            onClick={() => useEditorStore.getState().deselectEntity()}
            className="flex items-center gap-1.5 rounded-full border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/50 px-2 sm:px-2.5 py-0.5 text-[10px] font-mono text-sky-700 dark:text-sky-300 hover:border-sky-300 dark:hover:border-sky-400 transition shadow-sm shrink-0"
            title="Click to inspect Room Dimensions"
          >
            <Ruler className="h-3 w-3" strokeWidth={1.75} />
            <span>
              {floorDimensions.width}×{floorDimensions.depth}m
            </span>
            <span className="hidden xl:inline text-sky-400 dark:text-sky-600">·</span>
            <span className="hidden xl:inline font-semibold">{floorArea.toLocaleString()} m²</span>
          </button>
        </div>
      </div>

      {/* Center Section: Mode Switcher */}
      <div className="flex items-center justify-center shrink-0 px-1">
        <div
          data-tour="mode-switcher"
          className="flex items-center rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950/80 p-0.5 shadow-inner"
        >
          <button
            type="button"
            onClick={() => useEditorStore.getState().setEditorViewMode('LAYOUT')}
            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 xl:px-3 py-1.5 text-xs font-semibold transition ${
              editorViewMode === 'LAYOUT'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
            }`}
            title="Layout Builder"
          >
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden xl:inline">Layout Builder</span>
            <span className="inline xl:hidden">Layout</span>
          </button>
          <button
            type="button"
            onClick={() => useEditorStore.getState().setEditorViewMode('WMS')}
            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 xl:px-3 py-1.5 text-xs font-semibold transition ${
              editorViewMode === 'WMS'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
            }`}
            title="WMS Inventory"
          >
            <Boxes className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden xl:inline">WMS Inventory</span>
            <span className="inline xl:hidden">Inventory</span>
          </button>
          <button
            type="button"
            onClick={() => useEditorStore.getState().setEditorViewMode('PICKING')}
            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 xl:px-3 py-1.5 text-xs font-semibold transition ${
              editorViewMode === 'PICKING'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
            }`}
            title="Picking Route"
          >
            <Route className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden xl:inline">Picking Route</span>
            <span className="inline xl:hidden">Picking</span>
          </button>
        </div>
      </div>

      {/* Right Section: Integrated Utility Capsule, Export, Data Hub, Save & User */}
      <div data-tour="save-export" className="flex items-center justify-end gap-1.5 sm:gap-2 xl:gap-2.5 min-w-0">
        {/* Unified Utility Toolbar (Settings, Panduan, Undo, Redo) */}
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100/90 dark:bg-neutral-950/70 p-0.5 shrink-0 shadow-sm">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-neutral-800/80 transition"
              title={t.common.settings}
              aria-label={t.common.settings}
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}

          {onOpenTour && (
            <button
              type="button"
              onClick={onOpenTour}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-950/60 transition"
              title="Buka Tutorial Panduan Penggunaan"
              aria-label="Panduan"
            >
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-neutral-800 mx-0.5" />

          <button
            type="button"
            onClick={() => useEditorStore.getState().undo()}
            disabled={!canUndo}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-neutral-400 enabled:hover:text-slate-900 dark:enabled:hover:text-white enabled:hover:bg-slate-200/80 dark:enabled:hover:bg-neutral-800/80 disabled:opacity-30 transition"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => useEditorStore.getState().redo()}
            disabled={!canRedo}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-neutral-400 enabled:hover:text-slate-900 dark:enabled:hover:text-white enabled:hover:bg-slate-200/80 dark:enabled:hover:bg-neutral-800/80 disabled:opacity-30 transition"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Unsaved Status Badge */}
        {isDirty ? (
          <span
            className="flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/60 px-2 sm:px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 animate-pulse shrink-0"
            title="Ada perubahan belum disimpan"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            <span className="hidden xl:inline">Unsaved</span>
          </span>
        ) : (
          <span className="hidden 2xl:flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-neutral-500 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-neutral-600" />
            <span>Saved</span>
          </span>
        )}

        {/* Export Dropdown */}
        <div className="relative shrink-0" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setShowExportMenu((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-100 dark:bg-neutral-800/60 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="h-3 w-3 text-slate-500 dark:text-neutral-400" strokeWidth={1.75} />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 p-1.5 shadow-2xl shadow-slate-900/20 dark:shadow-black/60 backdrop-blur-xl z-50 animate-fade-in text-xs">
              <button
                type="button"
                onClick={() => {
                  exportBlueprintJson(buildBlueprintFromStore(useEditorStore.getState(), blueprintId));
                  setShowExportMenu(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
              >
                <FileJson className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-neutral-100">Export Blueprint</div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-500">Full JSON layout</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportBinsCsv(buildBlueprintFromStore(useEditorStore.getState(), blueprintId));
                  setShowExportMenu(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-neutral-100">Export WMS Bins</div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-500">CSV slot manifest</div>
                </div>
              </button>

              {onOpenWmsHub && (
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    onOpenWmsHub();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-slate-700 dark:text-neutral-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition border-t border-slate-100 dark:border-neutral-800/80"
                >
                  <Database className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-neutral-100">WMS Data Hub</div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">Bulk Sync & Slotting</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dedicated WMS Data Hub Quick Launcher in WMS mode (Icon + Tooltip, text on 2xl) */}
        {editorViewMode === 'WMS' && onOpenWmsHub && (
          <button
            type="button"
            data-tour="wms-hub-trigger"
            onClick={onOpenWmsHub}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/60 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition shadow-sm shrink-0"
            title="Buka WMS Data Hub & Slotting Optimizer"
          >
            <Database className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={1.75} />
            <span className="hidden 2xl:inline">Data Hub</span>
          </button>
        )}

        {/* Primary Save Button / Viewer Lock */}
        {currentUser?.role === 'VIEWER' ? (
          <div
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/40 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-sm cursor-not-allowed opacity-90 select-none shrink-0"
            title="Mode Baca: Hanya role Admin dan Editor yang dapat menyimpan layout"
          >
            <Lock className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.75} />
            <span className="hidden sm:inline">Mode Baca</span>
          </div>
        ) : (
          <button
            onClick={() => void handleSave()}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-3 sm:px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-sky-600/30 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 transition shrink-0"
          >
            {saveState === 'saving' ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="hidden sm:inline">Saving…</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Save</span>
              </>
            )}
          </button>
        )}

        {saveState === 'saved' && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 animate-fade-in shrink-0">
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden md:inline">Saved</span>
          </span>
        )}
        {saveState === 'error' && (
          <span className="max-w-28 truncate text-xs text-red-400 shrink-0" title={saveError ?? ''}>
            Save failed
          </span>
        )}

        <div className="h-5 w-px bg-slate-200 dark:bg-neutral-800 shrink-0" />

        {/* User Profile Pill & Dropdown */}
        {currentUser && (
          <div className="relative shrink-0" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-100 dark:bg-neutral-800/60 px-2 sm:px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
              title={`Masuk sebagai ${currentUser.email} (${currentUser.role})`}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white uppercase shrink-0">
                {currentUser.name.slice(0, 1)}
              </div>
              <span className="hidden 2xl:inline max-w-24 truncate">{currentUser.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/50'
                    : currentUser.role === 'EDITOR'
                    ? 'bg-sky-950 text-sky-300 border border-sky-700/50'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                }`}
              >
                {currentUser.role}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 text-xs shadow-xl z-50 animate-fade-in">
                <div className="px-2.5 py-2 border-b border-slate-100 dark:border-neutral-800/80">
                  <div className="font-bold text-slate-900 dark:text-neutral-100">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">{currentUser.email}</div>
                  <div className="mt-1">
                    <span className="inline-block text-[9px] font-semibold text-slate-400 uppercase">
                      Role: <span className="font-bold text-sky-500">{currentUser.role}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-1.5 space-y-1">
                  {currentUser.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        router.push('/admin/users');
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Manajemen User (RBAC)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
