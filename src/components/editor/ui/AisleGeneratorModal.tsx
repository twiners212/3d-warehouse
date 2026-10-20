'use client';

// Fulfills Phase 29: Aisle Auto-Spanning & Array Generator Modal Dialog
// Interactive glassmorphic wizard for configuring structured rack arrays.
// Live 3D ghost preview, equipment presets, collision skip filter,
// auto-expanding floor, and atomic undo/redo transaction execution.

import { useEffect, useMemo, useState } from 'react';
import {
  planAisleArray,
  EQUIPMENT_PRESETS,
  type AisleArrayConfig,
  type AisleOrientation,
  type AisleTopology,
  type RackTemplateConfig,
} from '@/engine/procedural/aisle-generator';
import { createGenerateAisleArrayCommand } from '@/engine/commands/GenerateAisleArrayCommand';
import { createUpdateFloorDimensionsCommand } from '@/engine/commands/UpdateFloorDimensionsCommand';
import { aislePreviewBus } from '@/lib/placement/aisle-preview-bus';
import { useTranslation, formatDistance } from '@/lib/i18n';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { RackEntity, RackType } from '@/types/layout';
import {
  Grid,
  X,
  ArrowLeftRight,
  ArrowUpDown,
  AlertTriangle,
  Check,
  Maximize2,
  Sparkles,
} from 'lucide-react';

interface AisleGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRack?: RackEntity | null;
}

const RACK_TYPES: { type: RackType; label: string }[] = [
  { type: 'selective_pallet', label: 'Selective Pallet Rack' },
  { type: 'double_deep', label: 'Double-Deep Pallet Rack' },
  { type: 'cantilever', label: 'Cantilever Industrial Rack' },
  { type: 'shelving', label: 'Heavy-Duty Steel Shelving' },
  { type: 'drive_in', label: 'Drive-In High Density Rack' },
  { type: 'push_back', label: 'Push-Back Dynamic Rack' },
  { type: 'mezzanine', label: 'Mezzanine Storage System' },
];

export function AisleGeneratorModal({
  isOpen,
  onClose,
  initialRack,
}: AisleGeneratorModalProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const racks = useEditorStore((s) => s.racks);
  const structuralElements = useEditorStore((s) => s.structuralElements);
  const executeCommand = useEditorStore((s) => s.executeCommand);

  // Configuration state
  const [topology, setTopology] = useState<AisleTopology>(
    initialRack?.type === 'double_deep' ? 'back_to_back' : 'back_to_back'
  );
  const [orientation, setOrientation] = useState<AisleOrientation>('along_x');
  const [aisleCount, setAisleCount] = useState<number>(3);
  const [racksPerRun, setRacksPerRun] = useState<number>(2);
  const [aisleWidth, setAisleWidth] = useState<number>(3.0);
  const [flueSpace, setFlueSpace] = useState<number>(0.2);
  const [anchorMode, setAnchorMode] = useState<'center' | 'selected'>(
    initialRack ? 'selected' : 'center'
  );
  const [namingPrefix, setNamingPrefix] = useState<string>('A');
  const [skipColliding, setSkipColliding] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>('reach_truck');

  // Rack template state
  const [rackTemplate, setRackTemplate] = useState<RackTemplateConfig>(() => {
    if (initialRack) {
      return {
        type: initialRack.type,
        bays: initialRack.bays,
        levels: initialRack.levels,
        bayWidth: initialRack.bayWidth,
        levelHeight: initialRack.levelHeight,
        depth: initialRack.dimensions.depth,
      };
    }
    return {
      type: 'selective_pallet',
      bays: 3,
      levels: 4,
      bayWidth: 2.7,
      levelHeight: 1.8,
      depth: 1.1,
    };
  });

  // When initialRack changes (e.g. opened for a different rack), re-sync template during render
  const [prevRackId, setPrevRackId] = useState<string | null>(initialRack?.id ?? null);
  if (prevRackId !== (initialRack?.id ?? null)) {
    setPrevRackId(initialRack?.id ?? null);
    if (initialRack) {
      setRackTemplate({
        type: initialRack.type,
        bays: initialRack.bays,
        levels: initialRack.levels,
        bayWidth: initialRack.bayWidth,
        levelHeight: initialRack.levelHeight,
        depth: initialRack.dimensions.depth,
      });
      setAnchorMode('selected');
    } else {
      setAnchorMode('center');
    }
  }

  // Compute live plan and candidate racks
  const plan = useMemo(() => {
    const config: AisleArrayConfig = {
      topology,
      orientation,
      aisleCount,
      racksPerRun,
      aisleWidth,
      flueSpace,
      anchorMode,
      rackTemplate,
      namingPrefix,
      skipColliding,
    };

    return planAisleArray(config, {
      floorDimensions,
      existingRacks: racks,
      existingStructures: structuralElements,
      selectedRack: initialRack,
    });
  }, [
    topology,
    orientation,
    aisleCount,
    racksPerRun,
    aisleWidth,
    flueSpace,
    anchorMode,
    rackTemplate,
    namingPrefix,
    skipColliding,
    floorDimensions,
    racks,
    structuralElements,
    initialRack,
  ]);

  // Sync with live 3D preview bus
  useEffect(() => {
    if (isOpen) {
      aislePreviewBus.setPreview(plan.candidateRacks, skipColliding);
    } else {
      aislePreviewBus.clearPreview();
    }
    return () => {
      aislePreviewBus.clearPreview();
    };
  }, [isOpen, plan, skipColliding]);

  if (!isOpen) return null;

  // Equipment preset selector
  const handleSelectPreset = (preset: (typeof EQUIPMENT_PRESETS)[0]) => {
    setActivePresetId(preset.id);
    setAisleWidth(preset.aisleWidth);
  };

  // Auto-expand floor action
  const handleAutoExpandFloor = () => {
    executeCommand(
      createUpdateFloorDimensionsCommand({
        width: Math.max(floorDimensions.width, plan.requiredFloor.width),
        depth: Math.max(floorDimensions.depth, plan.requiredFloor.depth),
        height: floorDimensions.height,
      })
    );
  };

  // Commit generation
  const handleGenerate = () => {
    const candidatesToGenerate = skipColliding
      ? plan.candidateRacks.filter((c) => c.isValid)
      : plan.candidateRacks;

    if (candidatesToGenerate.length === 0) {
      return;
    }

    const entities = candidatesToGenerate.map((c) => c.entity);
    executeCommand(createGenerateAisleArrayCommand(entities));
    aislePreviewBus.clearPreview();
    onClose();
  };

  const hasCollisions = plan.collidingCandidates > 0;
  const canGenerate =
    plan.totalCandidates > 0 &&
    (!hasCollisions || skipColliding || plan.validCandidates > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/95 text-slate-800 dark:text-neutral-100 shadow-2xl backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 px-6 py-4 bg-slate-50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30">
              <Grid className="h-5 w-5 text-sky-500" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                {t.aisleGenerator.modalTitle}
                {initialRack && (
                  <span className="rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    {t.aisleGenerator.entryFromSelected}: {initialRack.name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {t.aisleGenerator.modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Section: Topology & Orientation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Topology Toggle */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/50 p-3.5 space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                {t.aisleGenerator.topologyLabel}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTopology('back_to_back')}
                  className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition ${
                    topology === 'back_to_back'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-100 shadow-sm'
                      : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {t.aisleGenerator.topologyBackToBack}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {t.aisleGenerator.topologyBackToBackDesc}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTopology('single')}
                  className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition ${
                    topology === 'single'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-100 shadow-sm'
                      : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {t.aisleGenerator.topologySingle}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {t.aisleGenerator.topologySingleDesc}
                  </span>
                </button>
              </div>
            </div>

            {/* Orientation Toggle */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/50 p-3.5 space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                {t.aisleGenerator.orientationLabel}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('along_x')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition ${
                    orientation === 'along_x'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-100 shadow-sm'
                      : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <ArrowLeftRight className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
                  <span>{t.aisleGenerator.orientationAlongX}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrientation('along_z')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition ${
                    orientation === 'along_z'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-100 shadow-sm'
                      : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <ArrowUpDown className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
                  <span>{t.aisleGenerator.orientationAlongZ}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Equipment Presets Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                {t.aisleGenerator.equipmentPresetsLabel}
              </label>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                {formatDistance(aisleWidth, unitSystem)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EQUIPMENT_PRESETS.map((preset) => {
                const isSelected = activePresetId === preset.id && aisleWidth === preset.aisleWidth;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex flex-col items-start rounded-lg border p-2 text-left transition ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/80 text-sky-800 dark:text-sky-100 ring-1 ring-sky-500 shadow-sm'
                        : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{preset.name}</span>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono mt-0.5">
                      {formatDistance(preset.aisleWidth, unitSystem)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spacing and Quantity Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            {/* Number of Aisles / Pairs */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.aisleCountLabel}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-neutral-200">{aisleCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={aisleCount}
                onChange={(e) => setAisleCount(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* Racks per Run */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.racksPerRunLabel}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-neutral-200">{racksPerRun}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={racksPerRun}
                onChange={(e) => setRacksPerRun(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* Aisle Clearance */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.aisleWidthLabel}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-neutral-200">
                  {formatDistance(aisleWidth, unitSystem)}
                </span>
              </div>
              <input
                type="range"
                min={1.2}
                max={5.0}
                step={0.1}
                value={aisleWidth}
                onChange={(e) => {
                  setActivePresetId('');
                  setAisleWidth(Number(e.target.value));
                }}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* Flue Space (Back to Back only) */}
            <div
              className={`rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3 space-y-1.5 ${
                topology !== 'back_to_back' ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.flueSpaceLabel}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-neutral-200">
                  {formatDistance(flueSpace, unitSystem)}
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.5}
                step={0.05}
                value={flueSpace}
                onChange={(e) => setFlueSpace(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
                disabled={topology !== 'back_to_back'}
              />
            </div>
          </div>

          {/* Parametric Rack Configuration */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
              {t.aisleGenerator.rackSpecsTitle}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              {/* Rack Type */}
              <div className="col-span-2 space-y-1">
                <label className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.rackTypeLabel}</label>
                <select
                  value={rackTemplate.type}
                  onChange={(e) =>
                    setRackTemplate((prev) => ({
                      ...prev,
                      type: e.target.value as RackType,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-slate-900 dark:text-neutral-200 focus:border-sky-500 focus:outline-none"
                >
                  {RACK_TYPES.map((rt) => (
                    <option key={rt.type} value={rt.type}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bays */}
              <div className="space-y-1">
                <label className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.baysLabel}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rackTemplate.bays}
                  onChange={(e) =>
                    setRackTemplate((prev) => ({
                      ...prev,
                      bays: Math.max(1, Number.parseInt(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-slate-900 dark:text-neutral-200 focus:border-sky-500 focus:outline-none font-mono"
                />
              </div>

              {/* Levels */}
              <div className="space-y-1">
                <label className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.levelsLabel}</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={rackTemplate.levels}
                  onChange={(e) =>
                    setRackTemplate((prev) => ({
                      ...prev,
                      levels: Math.max(1, Number.parseInt(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-slate-900 dark:text-neutral-200 focus:border-sky-500 focus:outline-none font-mono"
                />
              </div>

              {/* Bay Width */}
              <div className="space-y-1">
                <label className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.bayWidthLabel}</label>
                <input
                  type="number"
                  step={0.1}
                  min={1.0}
                  max={5.0}
                  value={rackTemplate.bayWidth}
                  onChange={(e) =>
                    setRackTemplate((prev) => ({
                      ...prev,
                      bayWidth: Math.max(1.0, Number.parseFloat(e.target.value) || 1.0),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-slate-900 dark:text-neutral-200 focus:border-sky-500 focus:outline-none font-mono"
                />
              </div>

              {/* Depth */}
              <div className="space-y-1">
                <label className="text-slate-600 dark:text-neutral-400">{t.aisleGenerator.depthLabel}</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.8}
                  max={3.0}
                  value={rackTemplate.depth}
                  onChange={(e) =>
                    setRackTemplate((prev) => ({
                      ...prev,
                      depth: Math.max(0.8, Number.parseFloat(e.target.value) || 0.8),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-slate-900 dark:text-neutral-200 focus:border-sky-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Positioning, Prefix & Skip Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Addressing Prefix */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3.5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                {t.aisleGenerator.prefixLabel}
              </label>
              <input
                type="text"
                maxLength={4}
                value={namingPrefix}
                onChange={(e) =>
                  setNamingPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                placeholder={t.aisleGenerator.prefixPlaceholder}
                className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-neutral-100 font-mono font-bold focus:border-sky-500 focus:outline-none uppercase"
              />
              <p className="text-[10px] text-slate-500 dark:text-neutral-500">
                Bin IDs: {namingPrefix || 'A'}01A01-01-01
              </p>
            </div>

            {/* Positioning Anchor */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3.5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                {t.aisleGenerator.positioningTitle}
              </label>
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-neutral-300">
                  <input
                    type="radio"
                    name="anchorMode"
                    checked={anchorMode === 'center'}
                    onChange={() => setAnchorMode('center')}
                    className="accent-sky-500"
                  />
                  <span>{t.aisleGenerator.anchorCenter}</span>
                </label>
                {initialRack && (
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-neutral-300">
                    <input
                      type="radio"
                      name="anchorMode"
                      checked={anchorMode === 'selected'}
                      onChange={() => setAnchorMode('selected')}
                      className="accent-sky-500"
                    />
                    <span>{t.aisleGenerator.anchorSelected}</span>
                  </label>
                )}
              </div>
            </div>

            {/* Collision Skip Option */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3.5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                {t.aisleGenerator.skipColliding}
              </label>
              <label className="flex items-start gap-2.5 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipColliding}
                  onChange={(e) => setSkipColliding(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs text-slate-700 dark:text-neutral-300 leading-snug">
                  {skipColliding
                    ? 'Only unobstructed racks will be created.'
                    : 'All proposed positions are checked against obstacles.'}
                </span>
              </label>
            </div>
          </div>

          {/* Telemetry and Footprint Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                {t.aisleGenerator.telemetryTitle}
              </span>
              {hasCollisions ? (
                <span className="rounded-full bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />
                  <span>
                    {plan.collidingCandidates} {t.aisleGenerator.collisionsDetected}
                  </span>
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.75} />
                  <span>{t.aisleGenerator.noCollisions}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-white dark:bg-neutral-900/80 p-2.5 border border-slate-200 dark:border-neutral-800/80">
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 block">{t.aisleGenerator.totalRacks}</span>
                <span className="text-base font-mono font-bold text-slate-900 dark:text-white">
                  {skipColliding ? plan.validCandidates : plan.totalCandidates}
                  <span className="text-[10px] font-normal text-slate-500 dark:text-neutral-400 ml-1">
                    ({plan.candidateRacks.length} total)
                  </span>
                </span>
              </div>

              <div className="rounded-lg bg-white dark:bg-neutral-900/80 p-2.5 border border-slate-200 dark:border-neutral-800/80">
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 block">{t.aisleGenerator.totalCapacity}</span>
                <span className="text-base font-mono font-bold text-amber-600 dark:text-amber-300">
                  {(skipColliding ? plan.validCandidates : plan.totalCandidates) *
                    rackTemplate.bays *
                    rackTemplate.levels}
                  <span className="text-[10px] font-normal text-slate-500 dark:text-neutral-400 ml-1">slots</span>
                </span>
              </div>

              <div className="rounded-lg bg-white dark:bg-neutral-900/80 p-2.5 border border-slate-200 dark:border-neutral-800/80">
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 block">{t.aisleGenerator.footprint}</span>
                <span className="text-base font-mono font-bold text-sky-600 dark:text-sky-300">
                  {formatDistance(plan.boundingFootprint.width, unitSystem)} ×{' '}
                  {formatDistance(plan.boundingFootprint.depth, unitSystem)}
                </span>
              </div>

              <div className="rounded-lg bg-white dark:bg-neutral-900/80 p-2.5 border border-slate-200 dark:border-neutral-800/80">
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 block">Warehouse Room</span>
                <span className="text-base font-mono font-bold text-slate-800 dark:text-neutral-200">
                  {formatDistance(floorDimensions.width, unitSystem)} ×{' '}
                  {formatDistance(floorDimensions.depth, unitSystem)}
                </span>
              </div>
            </div>

            {/* Auto-Expand Warning Card if Array Exceeds Floor */}
            {plan.requiredFloor.requiresExpansion && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-300 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" strokeWidth={1.75} />
                  <span>
                    Array extends past current floor boundaries. Expand floor to{' '}
                    <strong className="font-mono text-amber-950 dark:text-white">
                      {formatDistance(plan.requiredFloor.width, unitSystem)} ×{' '}
                      {formatDistance(plan.requiredFloor.depth, unitSystem)}
                    </strong>
                    ?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoExpandFloor}
                  className="shrink-0 rounded-lg border border-amber-400 dark:border-amber-500/80 bg-amber-200 hover:bg-amber-300 dark:bg-amber-600/30 dark:hover:bg-amber-600/50 px-3 py-1.5 font-semibold text-amber-900 dark:text-amber-100 transition shadow-sm"
                >
                  {t.aisleGenerator.autoExpandFloor}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-neutral-800 px-6 py-4 bg-slate-50 dark:bg-neutral-950/60">
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            Preview is active in 3D canvas • All generated items are multi-selected & undoable (Ctrl+Z)
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`rounded-lg px-5 py-2 text-xs font-bold transition flex items-center gap-2 ${
                canGenerate
                  ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20 active:scale-95'
                  : 'bg-slate-200 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 cursor-not-allowed border border-slate-300 dark:border-neutral-700'
              }`}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              <span>
                {t.aisleGenerator.generateBtn} (
                {skipColliding ? plan.validCandidates : plan.totalCandidates})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
