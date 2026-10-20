'use client';

// Fulfills Phase 36: Top Floating Toolbar HUD for Picking Route Mode
// Provides Sample Order Generator, Equipment Selector (Forklift/AGV/Cart), and Manifest Drawer toggle

import React, { useState } from 'react';
import {
  Route,
  Sparkles,
  Trash2,
  ListOrdered,
  Truck,
  Bot,
  ShoppingCart,
  MapPin,
  RefreshCw,
  Plus,
  Zap,
  Pencil,
  Tag,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTranslation } from '@/lib/i18n';
import { VEHICLE_CONFIGS } from '@/types/routing';
import type { VehicleType } from '@/types/routing';
import { ClearRouteModal } from './ClearRouteModal';

interface PickingToolbarHUDProps {
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
}

export const PickingToolbarHUD: React.FC<PickingToolbarHUDProps> = ({
  onToggleDrawer,
  isDrawerOpen,
}) => {
  const { t } = useTranslation();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const pickList = useEditorStore((s) => s.pickList);
  const selectedVehicle = useEditorStore((s) => s.selectedVehicleType);
  const setVehicleType = useEditorStore((s) => s.setVehicleType);
  const generateSamplePickList = useEditorStore((s) => s.generateSamplePickList);
  const clearPickList = useEditorStore((s) => s.clearPickList);
  const recalculateRoute = useEditorStore((s) => s.recalculateRoute);
  const depotPosition = useEditorStore((s) => s.depotPosition);
  const isGeneratingRoute = useEditorStore((s) => s.isGeneratingRoute);
  const isManualSequence = useEditorStore((s) => s.isManualSequence);
  const isManualRouteCreatorActive = useEditorStore((s) => s.isManualRouteCreatorActive);
  const toggleManualRouteCreator = useEditorStore((s) => s.toggleManualRouteCreator);
  const autoOptimizeRoute = useEditorStore((s) => s.autoOptimizeRoute);
  const addCustomWaypoint = useEditorStore((s) => s.addCustomWaypoint);
  const badgeDisplayMode = useEditorStore((s) => s.badgeDisplayMode);
  const toggleBadgeDisplayMode = useEditorStore((s) => s.toggleBadgeDisplayMode);


  if (editorViewMode !== 'PICKING') return null;

  const vehicleOptions: Array<{ type: VehicleType; icon: React.ReactNode; label: string; speed: string }> = [
    {
      type: 'FORKLIFT',
      icon: <Truck className="h-3.5 w-3.5" strokeWidth={1.75} />,
      label: 'Forklift',
      speed: '4.0 m/s',
    },
    {
      type: 'AGV',
      icon: <Bot className="h-3.5 w-3.5" strokeWidth={1.75} />,
      label: 'AGV Robot',
      speed: '2.5 m/s',
    },
    {
      type: 'CART',
      icon: <ShoppingCart className="h-3.5 w-3.5" strokeWidth={1.75} />,
      label: 'Picking Cart',
      speed: '1.2 m/s',
    },
  ];

  return (
    <div className="relative w-full shrink-0 border-b border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm z-20 backdrop-blur-md text-xs text-slate-800 dark:text-slate-200 select-none">
      {/* Left Section: Routing Engine Title & Actions */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Title Badge */}
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 dark:border-neutral-800 font-bold text-sky-600 dark:text-sky-400">
          <Route className="h-4 w-4" strokeWidth={2} />
          <span className="hidden sm:inline font-mono tracking-tight">ROUTING ENGINE</span>
        </div>

        {/* Quick Sample Order Buttons */}
        <button
          type="button"
          onClick={() => generateSamplePickList(8)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition shadow-sm active:scale-95"
          title="Buat pesanan simulasi acak 8 item"
        >
          <Sparkles className="h-3 w-3" />
          <span>Sample (8)</span>
        </button>

        <button
          type="button"
          onClick={() => generateSamplePickList(16)}
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 font-medium transition active:scale-95 border border-slate-200/60 dark:border-neutral-700/60"
          title="Buat pesanan simulasi batch besar 16 item"
        >
          <span>Wave (16)</span>
        </button>

        <button
          type="button"
          onClick={toggleManualRouteCreator}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition active:scale-95 border ${
            isManualRouteCreatorActive
              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-700'
          }`}
          title={t.picking.manualRouteMode}
        >
          <Pencil className="h-3 w-3" />
          <span className="hidden lg:inline">{t.picking.manualRouteMode}</span>
          {isManualRouteCreatorActive && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping ml-0.5" />
          )}
        </button>

        {pickList.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                const state = useEditorStore.getState();
                const bounds = state.floorDimensions;
                addCustomWaypoint({
                  x: Math.round((bounds.width / 2) * 2) / 2,
                  z: Math.round((bounds.depth / 2) * 2) / 2,
                });
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 font-semibold transition active:scale-95 border border-purple-300/40 dark:border-purple-700/40"
              title={t.picking.addWaypoint}
            >
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">{t.picking.addWaypoint}</span>
            </button>

            {isManualSequence && (
              <button
                type="button"
                onClick={autoOptimizeRoute}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition shadow-sm active:scale-95"
                title={t.picking.reOptimizeBtn}
              >
                <Zap className="h-3 w-3" />
                <span className="hidden sm:inline">⚡ {t.picking.reOptimizeBtn}</span>
              </button>
            )}

            <button
              type="button"
              onClick={recalculateRoute}
              disabled={isGeneratingRoute}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition active:scale-95 border border-slate-200/60 dark:border-neutral-700/60"
              title="Hitung ulang rute A* & TSP"
            >
              <RefreshCw className={`h-3 w-3 ${isGeneratingRoute ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition active:scale-95 border border-rose-200/60 dark:border-rose-900/40"
              title={t.picking.clearRouteConfirmTitle}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      {/* Right Section: Vehicle, Depot, Badges, Manifest Drawer Toggle */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Vehicle Equipment Selector */}
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950 p-0.5">
          {vehicleOptions.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setVehicleType(opt.type)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium transition ${
                selectedVehicle === opt.type
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={`${opt.label} (${opt.speed})`}
            >
              {opt.icon}
              <span className="hidden md:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Depot Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/10 text-[11px] font-mono font-semibold text-sky-600 dark:text-sky-400 border border-sky-500/20">
          <MapPin className="h-3.5 w-3.5 text-sky-500" />
          <span>
            Depot Base: ({depotPosition.x.toFixed(1)}m, {depotPosition.z.toFixed(1)}m)
          </span>
        </div>

        {/* 3D ID Badge Display Mode Toggle (SMART -> FULL -> COMPACT) */}
        <button
          type="button"
          onClick={toggleBadgeDisplayMode}
          className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition active:scale-95 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700"
          title={`${t.picking.badgeDisplayMode}: ${
            badgeDisplayMode === 'SMART'
              ? t.picking.badgeModeSmart
              : badgeDisplayMode === 'FULL'
              ? t.picking.badgeModeFull
              : t.picking.badgeModeCompact
          }`}
        >
          <Tag className="h-3 w-3 text-sky-500" />
          <span className="font-mono font-semibold text-[11px]">
            {badgeDisplayMode === 'SMART'
              ? 'Smart LOD'
              : badgeDisplayMode === 'FULL'
              ? 'Full IDs'
              : 'Compact'}
          </span>
        </button>

        {/* Manifest Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleDrawer}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition border ${
            isDrawerOpen
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/40'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 border-transparent'
          }`}
          title="Buka/Tutup Manifest Pesanan"
        >
          <ListOrdered className="h-3.5 w-3.5" />
          <span>Manifest</span>
          {pickList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500 text-white font-bold">
              {pickList.length}
            </span>
          )}
        </button>
      </div>

      {/* Manual Route Creator Banner Instruction (Rendered Docked Below Sub-Header if active) */}
      {isManualRouteCreatorActive && (
        <div className="w-full mt-1.5 py-1 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-medium text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span>{t.picking.manualRouteInstruction}</span>
          </div>
          <button
            type="button"
            onClick={toggleManualRouteCreator}
            className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] transition active:scale-95 shadow-sm"
          >
            {t.picking.exitManualRoute}
          </button>
        </div>
      )}

      {/* Clear Route Modal Confirmation */}
      <ClearRouteModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};

