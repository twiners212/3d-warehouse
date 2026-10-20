'use client';

// Fulfills Phase 36 & 41: Picking Manifest Drawer & Multi-Agent Fleet Manager
// Displays Tabbed Fleet Roster with battery telemetries, traffic alerts, and order assignment checklist.

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Navigation,
  Scale,
  Sparkles,
  TrendingDown,
  Trash2,
  Package,
  ChevronUp,
  ChevronDown,
  Lock,
  Zap,
  Truck,
  Bot,
  ShoppingCart,
  MapPin,
  RefreshCw,
  Plus,
  Pencil,
  Tag,
  Camera,
  BatteryCharging,
  AlertTriangle,
  Users,
  Layers,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTranslation } from '@/lib/i18n';
import type { VehicleType } from '@/types/routing';
import { ClearRouteModal } from './ClearRouteModal';
import { MAX_FLEET_SIZE, MAX_FLEET_PER_LEVEL } from '@/lib/constants/warehouse-defaults';

interface PickingManifestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docked?: boolean;
}

export const PickingManifestDrawer: React.FC<PickingManifestDrawerProps> = ({
  isOpen,
  onClose,
  docked = false,
}) => {
  const { t } = useTranslation();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const routeResult = useEditorStore((s) => s.routeResult);

  const pickList = useEditorStore((s) => s.pickList);
  const playbackState = useEditorStore((s) => s.playbackState);
  const removeBinFromPickList = useEditorStore((s) => s.removeBinFromPickList);
  const generateSamplePickList = useEditorStore((s) => s.generateSamplePickList);
  const isManualSequence = useEditorStore((s) => s.isManualSequence);
  const customWaypoints = useEditorStore((s) => s.customWaypoints);
  const reorderPicks = useEditorStore((s) => s.reorderPicks);
  const autoOptimizeRoute = useEditorStore((s) => s.autoOptimizeRoute);
  const removeCustomWaypoint = useEditorStore((s) => s.removeCustomWaypoint);

  const selectedVehicle = useEditorStore((s) => s.selectedVehicleType);
  const setVehicleType = useEditorStore((s) => s.setVehicleType);
  const recalculateRoute = useEditorStore((s) => s.recalculateRoute);
  const depotPosition = useEditorStore((s) => s.depotPosition);
  const isGeneratingRoute = useEditorStore((s) => s.isGeneratingRoute);
  const isManualRouteCreatorActive = useEditorStore((s) => s.isManualRouteCreatorActive);
  const toggleManualRouteCreator = useEditorStore((s) => s.toggleManualRouteCreator);
  const addCustomWaypoint = useEditorStore((s) => s.addCustomWaypoint);
  const badgeDisplayMode = useEditorStore((s) => s.badgeDisplayMode);
  const toggleBadgeDisplayMode = useEditorStore((s) => s.toggleBadgeDisplayMode);
  const racks = useEditorStore((s) => s.racks);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);

  // Phase 41 Fleet State & Actions
  const fleet = useEditorStore((s) => s.fleet);
  const selectedFleetAgentId = useEditorStore((s) => s.selectedFleetAgentId);
  const selectFleetAgent = useEditorStore((s) => s.selectFleetAgent);
  const isFollowCamActive = useEditorStore((s) => s.isFollowCamActive);
  const toggleFollowCam = useEditorStore((s) => s.toggleFollowCam);
  const addFleetVehicle = useEditorStore((s) => s.addFleetVehicle);
  const removeFleetVehicle = useEditorStore((s) => s.removeFleetVehicle);
  const resetFleetBatteries = useEditorStore((s) => s.resetFleetBatteries);
  const trafficAlerts = useEditorStore((s) => s.trafficAlerts);
  const dismissTrafficAlert = useEditorStore((s) => s.dismissTrafficAlert);
  const activeManifestTab = useEditorStore((s) => s.activeManifestTab);
  const setActiveManifestTab = useEditorStore((s) => s.setActiveManifestTab);

  const [addVehicleType, setAddVehicleType] = useState<VehicleType>('AGV');
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const [selectedFleetLevelTab, setSelectedFleetLevelTab] = useState<string>('ALL');
  const [addVehicleTargetLevelId, setAddVehicleTargetLevelId] = useState<string>('level-1');

  const activeLevelsList =
    buildingLevels && buildingLevels.length > 0
      ? buildingLevels
      : [{ id: 'level-1', name: 'Lantai 1 / Ground', elevationY: 0, height: 6.0 }];

  const effectiveTargetLevelId =
    selectedFleetLevelTab !== 'ALL' ? selectedFleetLevelTab : addVehicleTargetLevelId;
  const effectiveTargetLevel =
    activeLevelsList.find((l) => l.id === effectiveTargetLevelId) || activeLevelsList[0];
  const isGroundLevel =
    effectiveTargetLevel.elevationY === 0 || effectiveTargetLevel.id === 'level-1';
  const targetFloorFleetCount = fleet.filter(
    (a) => (a.levelId || 'level-1') === effectiveTargetLevel.id
  ).length;
  const isTargetFloorFull = targetFloorFleetCount >= MAX_FLEET_PER_LEVEL;
  const isWarehouseFleetFull = fleet.length >= MAX_FLEET_SIZE;
  const isAddDisabled = isTargetFloorFull || isWarehouseFleetFull;
  const displayedFleet =
    selectedFleetLevelTab === 'ALL'
      ? fleet
      : fleet.filter((a) => (a.levelId || 'level-1') === selectedFleetLevelTab);

  const orderedPicks = routeResult?.orderedPicks || pickList;

  const vehicleOptions: Array<{
    type: VehicleType;
    icon: React.ReactNode;
    label: string;
    speed: string;
  }> = [
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

  if (!isOpen) {
    return null;
  }

  const avgBattery =
    fleet.length > 0
      ? Math.round(fleet.reduce((acc, a) => acc + a.batteryLevel, 0) / fleet.length)
      : 100;

  return (
    <aside
      data-tour="picking-manifest"
      className={
        docked
          ? 'h-full w-full bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col select-none'
          : 'fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-300'
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.picking.manifestTitle}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {fleet.length} Armada • {pickList.length} Item
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {pickList.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title={t.picking.clearRouteConfirmTitle}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tab Switcher: Fleet Roster vs Orders */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-neutral-950/40 p-1">
        <button
          type="button"
          onClick={() => setActiveManifestTab('FLEET')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
            activeManifestTab === 'FLEET'
              ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>{t.picking.fleetRoster || 'Fleet Roster'} ({fleet.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveManifestTab('ORDERS')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
            activeManifestTab === 'ORDERS'
              ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>{t.picking.orderManifest || 'Order Manifest'} ({pickList.length})</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= TAB 1: FLEET ROSTER ================= */}
        {activeManifestTab === 'FLEET' && (
          <div className="space-y-3.5">
            {/* Fleet Telemetry Summary Strip */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/50">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Unit</span>
                <span className="text-base font-bold font-mono text-slate-800 dark:text-white">
                  {fleet.length}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center border-x border-slate-200 dark:border-neutral-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Rata2 Baterai</span>
                <span className="text-base font-bold font-mono text-emerald-500">
                  ⚡{avgBattery}%
                </span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {fleet.filter((a) => a.status === 'MOVING').length} Bergerak
                </span>
              </div>
            </div>

            {/* Floor Filter Tabs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3 text-sky-500" />
                  <span>Filter Lantai Armada</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {fleet.length} / {MAX_FLEET_SIZE} Unit
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 overflow-x-auto text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedFleetLevelTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    selectedFleetLevelTab === 'ALL'
                      ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Semua Lantai
                </button>
                {activeLevelsList.map((lvl) => {
                  const count = fleet.filter((a) => (a.levelId || 'level-1') === lvl.id).length;
                  const isSelected = selectedFleetLevelTab === lvl.id;
                  const isFull = count >= MAX_FLEET_PER_LEVEL;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        setSelectedFleetLevelTab(lvl.id);
                        setAddVehicleTargetLevelId(lvl.id);
                        // If switching to upper floor and Forklift was selected, auto reset to AGV
                        if (lvl.elevationY > 0 && addVehicleType === 'FORKLIFT') {
                          setAddVehicleType('AGV');
                        }
                      }}
                      className={`px-2 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
                        isSelected
                          ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="truncate max-w-[90px]">{lvl.name || lvl.id}</span>
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-mono ${
                          isFull
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 font-bold'
                            : 'bg-slate-200/60 dark:bg-neutral-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {count}/{MAX_FLEET_PER_LEVEL}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions Strip & Floor Quota */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {/* Add Vehicle Selector */}
                <div className="flex items-center gap-1.5 flex-1">
                  {selectedFleetLevelTab === 'ALL' && activeLevelsList.length > 1 && (
                    <select
                      value={addVehicleTargetLevelId}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setAddVehicleTargetLevelId(targetId);
                        const lvl = activeLevelsList.find((l) => l.id === targetId);
                        if (lvl && lvl.elevationY > 0 && addVehicleType === 'FORKLIFT') {
                          setAddVehicleType('AGV');
                        }
                      }}
                      className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 font-semibold max-w-[110px]"
                      title="Pilih lantai penugasan kendaraan baru"
                    >
                      {activeLevelsList.map((lvl) => (
                        <option key={lvl.id} value={lvl.id}>
                          {lvl.name || lvl.id}
                        </option>
                      ))}
                    </select>
                  )}

                  <select
                    value={addVehicleType}
                    onChange={(e) => setAddVehicleType(e.target.value as VehicleType)}
                    className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 font-semibold"
                  >
                    <option value="AGV">AGV Robot</option>
                    <option
                      value="FORKLIFT"
                      disabled={!isGroundLevel}
                    >
                      {isGroundLevel ? 'Forklift' : 'Forklift (Dilarang di Lantai Atas)'}
                    </option>
                    <option value="CART">Picking Cart</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (isAddDisabled) return;
                      const vehicleTypeToAdd =
                        !isGroundLevel && addVehicleType === 'FORKLIFT' ? 'AGV' : addVehicleType;
                      addFleetVehicle(vehicleTypeToAdd, effectiveTargetLevel.id);
                    }}
                    disabled={isAddDisabled}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition"
                    title={
                      isWarehouseFleetFull
                        ? `Kapasitas total gudang (${MAX_FLEET_SIZE} unit) telah tercapai`
                        : isTargetFloorFull
                        ? `Kapasitas lantai ${effectiveTargetLevel.name} (${MAX_FLEET_PER_LEVEL} unit) telah penuh`
                        : `Tambahkan kendaraan ke ${effectiveTargetLevel.name}`
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetFleetBatteries}
                  className="px-2 py-1 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition whitespace-nowrap"
                  title="Isi ulang daya seluruh armada ke 100%"
                >
                  ⚡ 100%
                </button>
              </div>

              {/* Floor Quota & Structural Note */}
              <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 dark:text-neutral-400">
                <span>
                  Lantai {effectiveTargetLevel.name}:{' '}
                  <strong className={isTargetFloorFull ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}>
                    {targetFloorFleetCount}/{MAX_FLEET_PER_LEVEL}
                  </strong>{' '}
                  • Total: {fleet.length}/{MAX_FLEET_SIZE}
                </span>
                {!isGroundLevel && (
                  <span className="text-amber-500 font-semibold">
                    Mezzanine: AGV & Cart Only
                  </span>
                )}
              </div>
            </div>

            {/* Traffic Alerts List */}
            {trafficAlerts.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-500">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Peringatan Lalu Lintas</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{trafficAlerts.length} Konflik</span>
                </div>
                {trafficAlerts.map((alert, idx) => (
                  <div
                    key={`${alert.id}-${idx}`}
                    className="flex items-center justify-between p-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[11px]"
                  >
                    <span className="truncate max-w-[260px] font-semibold">{alert.message}</span>
                    <button
                      type="button"
                      onClick={() => dismissTrafficAlert(alert.id)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active Fleet List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                <span>
                  {selectedFleetLevelTab === 'ALL'
                    ? 'Seluruh Kendaraan Aktif'
                    : `Armada ${effectiveTargetLevel.name}`}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {displayedFleet.length} Unit
                </span>
              </div>

              {displayedFleet.length === 0 ? (
                <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-neutral-800 text-center space-y-2.5 bg-slate-50/50 dark:bg-neutral-950/40">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mx-auto">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {selectedFleetLevelTab === 'ALL'
                        ? 'Belum Ada Armada'
                        : `Belum Ada Armada di ${effectiveTargetLevel.name}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {selectedFleetLevelTab === 'ALL'
                        ? 'Tambahkan kendaraan untuk mengaktifkan simulasi pergerakan rute.'
                        : `Tambahkan kendaraan ke ${effectiveTargetLevel.name} untuk memproses item di lantai ini.`}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => addFleetVehicle('AGV', effectiveTargetLevel.id)}
                      disabled={isAddDisabled}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition active:scale-95"
                    >
                      + Tambah AGV
                    </button>
                    {isGroundLevel && (
                      <button
                        type="button"
                        onClick={() => addFleetVehicle('FORKLIFT', effectiveTargetLevel.id)}
                        disabled={isAddDisabled}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold transition active:scale-95"
                      >
                        + Tambah Forklift
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                displayedFleet.map((agent) => {
                  const isSelected = selectedFleetAgentId === agent.id;
                  const batteryColor =
                    agent.batteryLevel > 50
                      ? 'bg-emerald-500'
                      : agent.batteryLevel > 20
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                  const floorBadgeLabel =
                    agent.levelName ||
                    activeLevelsList.find((l) => l.id === agent.levelId)?.name ||
                    'Lantai 1';

                  return (
                    <div
                      key={agent.id}
                      onClick={() => selectFleetAgent(agent.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-1 ring-sky-500/40'
                          : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-slate-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full ring-2 ring-white/40"
                            style={{ backgroundColor: agent.color }}
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {agent.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
                            {agent.vehicleType}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/50 dark:border-sky-800/50">
                            {floorBadgeLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectFleetAgent(agent.id);
                              toggleFollowCam(true);
                            }}
                            className={`p-1 rounded-lg transition ${
                              isSelected && isFollowCamActive
                                ? 'bg-sky-500 text-white'
                                : 'text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-neutral-800'
                            }`}
                            title="Ikuti kendaraan ini dengan Follow-Cam"
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFleetVehicle(agent.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Hapus kendaraan dari armada"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                    {/* Battery Bar & Status */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500 dark:text-neutral-400">
                          Status:{' '}
                          <strong
                            className={
                              agent.status === 'YIELDING'
                                ? 'text-rose-500'
                                : agent.status === 'MOVING'
                                ? 'text-sky-500'
                                : 'text-slate-400'
                            }
                          >
                            {agent.status}
                          </strong>
                          {agent.yieldReason && ` (${agent.yieldReason})`}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-neutral-300">
                          ⚡ {agent.batteryLevel.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${batteryColor}`}
                          style={{ width: `${agent.batteryLevel}%` }}
                        />
                      </div>
                    </div>

                    {/* Assigned Stops count */}
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {agent.assignedPickList.length} Perhentian
                        {agent.routeResult && ` (${agent.routeResult.metrics.totalDistanceMeters}m)`}
                      </span>
                      <span>
                        Progress: {Math.round(agent.progress * 100)}%
                      </span>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
        )}

        {/* ================= TAB 2: ORDER MANIFEST ================= */}
        {activeManifestTab === 'ORDERS' && (
          <>
            {/* Unified Routing Control Center Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/60 p-3.5 space-y-3">
              {/* Section 1: Fleet / Equipment Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                    Armada Utama
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-neutral-500">
                    Kecepatan
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  {vehicleOptions.map((opt) => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setVehicleType(opt.type)}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-xs font-semibold transition ${
                        selectedVehicle === opt.type
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-800'
                      }`}
                      title={`${opt.label} (${opt.speed})`}
                    >
                      <div className="flex items-center gap-1">
                        {opt.icon}
                        <span className="text-[11px]">{opt.label}</span>
                      </div>
                      <span className="text-[9px] opacity-80 font-mono">{opt.speed}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Order Generation & Batch Tools */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                    Simulasi Pesanan
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                    VRP Dispatch
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => generateSamplePickList(8)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition active:scale-95"
                    title="Buat pesanan simulasi acak 8 item"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Sample (8)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => generateSamplePickList(16)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 font-bold text-xs transition active:scale-95"
                    title="Buat pesanan simulasi besar 16 item"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Wave (16)</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Route Creation & Optimization Actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                    Alat Rancang Rute
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleBadgeDisplayMode()}
                      className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-mono font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-50"
                      title="Ubah mode tampilan ID label di kanvas 3D"
                    >
                      {badgeDisplayMode === 'SMART'
                        ? 'Smart LOD'
                        : badgeDisplayMode === 'FULL'
                        ? 'Full IDs'
                        : 'Compact'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={toggleManualRouteCreator}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition border ${
                      isManualRouteCreatorActive
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-500/30'
                        : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700 hover:bg-slate-50'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                    <span>{isManualRouteCreatorActive ? 'Selesai Manual' : 'Rancang Manual'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      addCustomWaypoint({
                        x: depotPosition.x + 4,
                        z: depotPosition.z + 4,
                      })
                    }
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 text-xs font-bold transition"
                  >
                    <Plus className="h-3 w-3" />
                    <span>+ Waypoint</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stops Order Checklist */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                <span>Daftar Perhentian ({orderedPicks.length + 2} Titik Rute)</span>
                <span className="text-[10px] text-slate-400">
                  {isManualSequence ? 'Urutan Manual' : 'Optimal TSP'}
                </span>
              </div>

              {/* Stop 0: Departure Depot / Packing Station */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-sky-500/40 bg-sky-50/60 dark:bg-sky-950/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-mono font-bold shadow-sm">
                    0
                  </span>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-sky-500" />
                      <span className="font-bold text-xs text-sky-700 dark:text-sky-300 font-mono">
                        Depot / Packing Station
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 font-bold uppercase">
                        Asal
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                      Titik Keberangkatan • ({depotPosition.x.toFixed(1)}m, {depotPosition.z.toFixed(1)}m)
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-sky-600 dark:text-sky-400 font-semibold px-1.5 py-0.5 rounded bg-sky-500/10">
                  Start Base
                </span>
              </div>

              {/* Waypoints after Depot Start (Leg 0) */}
              {customWaypoints
                .filter((w) => w.insertAfterStopIndex === 0)
                .map((wp) => (
                  <div
                    key={wp.id}
                    className="flex items-center justify-between p-2 pl-3 ml-2.5 rounded-xl border border-purple-500/30 border-l-4 border-l-purple-500 bg-purple-50/40 dark:bg-purple-950/20 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white text-[9px] font-bold">
                        W
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          {wp.name || 'Waypoint'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">
                          ({wp.x.toFixed(1)}m, {wp.z.toFixed(1)}m)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomWaypoint(wp.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition"
                      title="Hapus transit waypoint"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}

              {/* Intermediate Pick Stops & Interleaved Leg Waypoints */}
              {orderedPicks.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-center text-xs text-slate-400">
                  Belum ada slot bin dalam daftar pick. Klik bin di rak 3D atau generate sampel.
                </div>
              ) : (
                orderedPicks.map((pick, idx) => {
                  const isCompleted = playbackState.currentStopIndex > idx;
                  const isCurrent =
                    playbackState.currentStopIndex === idx && playbackState.isPlaying;
                  const legIndex = idx + 1;
                  const waypointsAfterThisStop = customWaypoints.filter(
                    (w) =>
                      legIndex === orderedPicks.length
                        ? w.insertAfterStopIndex >= orderedPicks.length
                        : w.insertAfterStopIndex === legIndex
                  );

                  return (
                    <React.Fragment key={`${pick.binId}-${idx}`}>
                      <div
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                          isCurrent
                            ? 'border-amber-500 bg-amber-500/10'
                            : isCompleted
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800 text-[10px] font-mono font-bold">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 font-mono">
                              {pick.binId}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {pick.productName} • {pick.weightKg}kg
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeBinFromPickList(pick.binId)}
                          className="text-slate-400 hover:text-rose-500 transition p-1"
                          title="Hapus perhentian (Ctrl+Z untuk membatalkan)"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Waypoints after this stop */}
                      {waypointsAfterThisStop.map((wp) => (
                        <div
                          key={wp.id}
                          className="flex items-center justify-between p-2 pl-3 ml-2.5 rounded-xl border border-purple-500/30 border-l-4 border-l-purple-500 bg-purple-50/40 dark:bg-purple-950/20 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white text-[9px] font-bold">
                              W
                            </span>
                            <div className="truncate">
                              <span className="font-bold text-purple-700 dark:text-purple-300">
                                {wp.name || 'Waypoint'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">
                                ({wp.x.toFixed(1)}m, {wp.z.toFixed(1)}m)
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomWaypoint(wp.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 transition"
                            title="Hapus transit waypoint"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })
              )}

              {/* Stop N+1: Return Depot / Packing Station */}
              {orderedPicks.length > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-mono font-bold shadow-sm">
                      {orderedPicks.length + 1}
                    </span>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-sky-500" />
                        <span className="font-bold text-xs text-sky-700 dark:text-sky-300 font-mono">
                          Depot / Packing Station
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 font-bold uppercase">
                          Tujuan Akhir
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                        Konsolidasi & Drop-off • ({depotPosition.x.toFixed(1)}m, {depotPosition.z.toFixed(1)}m)
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-sky-600 dark:text-sky-400 font-semibold px-1.5 py-0.5 rounded bg-sky-500/10">
                    Return Base
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ClearRouteModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
      />
    </aside>
  );
};
