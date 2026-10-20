'use client';

// Fulfills PRD.md Phase 4 & Section 6.1: right-sidebar Properties Inspector.
// Contextually detects active selection:
// 1. Rack -> parametric controls (bays, levels, dimensions, rotation, delete).
// 2. Structural Element -> dimensions, position, rotation, type, delete.
// 3. Operational Zone -> name, type, color, dimensions, delete.
// 4. Deselected (Default) -> Warehouse Room & Floor Settings (Dimensions, Presets, Grid Snap, Name).
// All mutations execute via ICommand for Undo/Redo support.

import { useEffect, useMemo, useState } from 'react';
import { createUpdateRackConfigCommand } from '@/engine/commands/UpdateRackConfigCommand';
import { createRotateRackCommand } from '@/engine/commands/RotateEntityCommand';
import { createRemoveRackCommand } from '@/engine/commands/RemoveEntityCommand';
import {
  createBatchUpdateRackBinsCommand,
  createBatchUpdateAllBinsCommand,
} from '@/engine/commands/BinCommands';
import {
  createRemoveStructuralElementCommand,
  createRotateStructuralElementCommand,
  createUpdateStructuralElementCommand,
} from '@/engine/commands/StructuralCommands';
import {
  createRemoveZoneCommand,
  createUpdateZoneCommand,
} from '@/engine/commands/ZoneCommands';
import {
  createBatchUpdateZonePalletsCommand,
  createUpdateZoneStagingConfigCommand,
} from '@/engine/commands/ZonePalletCommands';
import {
  calculateZonePalletSlots,
  isZoneStagingEligible,
} from '@/engine/procedural/zone-pallet-generator';
import { getSlotsPerBayLevel } from '@/engine/procedural/bin-generator';
import {
  createUpdateBlueprintMetaCommand,
  createUpdateFloorDimensionsCommand,
} from '@/engine/commands/UpdateFloorDimensionsCommand';
import { deriveRackDimensions } from '@/engine/procedural/bin-generator';
import {
  getWarehouseOccupiedBounds,
  isPlacementValid,
} from '@/engine/spatial/snapping';
import { getEffectiveDimensions, nextRotationStep } from '@/engine/spatial/spatial-math';
import {
  RACK_PARAM_CLAMPS,
  STRUCTURE_PARAM_CLAMPS,
  WAREHOUSE_DIMENSION_LIMITS,
  ZONE_PARAM_CLAMPS,
  FIRE_SPRINKLER_CLEARANCE,
  MAX_BUILDING_LEVELS,
  DEFAULT_LEVEL_HEIGHT,
  calculateMaxZoneDimensions,
  calculateMaxRackLevels,
  calculateMaxRackLevelHeight,
} from '@/lib/constants/warehouse-defaults';
import {
  createAddBuildingLevelCommand,
  createRemoveBuildingLevelCommand,
  createUpdateBuildingLevelCommand,
} from '@/engine/commands/BuildingLevelCommands';
import {
  createRemoveVerticalConnectorCommand,
  createRotateVerticalConnectorCommand,
  createUpdateVerticalConnectorCommand,
} from '@/engine/commands/VerticalConnectorCommands';
import { nextLevelId, nextLevelName } from '@/engine/procedural/naming';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTranslation } from '@/lib/i18n';
import { MultiSelectionInspector } from './MultiSelectionInspector';
import type {
  BuildingLevel,
  RackEntity,
  StructuralElement,
  VerticalConnector,
  VerticalConnectorType,
  WarehouseZone,
  ZoneType,
} from '@/types/layout';
import {
  RotateCw,
  Trash2,
  Boxes,
  CheckCircle2,
  XCircle,
  Grid,
  X,
  Target,
  Sliders,
  Ruler,
  Sparkles,
  PackageCheck,
  PackageX,
  ArrowUpDown,
  Layers,
  Plus,
  Database,
} from 'lucide-react';

const CLAMPS = RACK_PARAM_CLAMPS;

const ZONE_COLOR_PALETTE = [
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Teal', hex: '#14b8a6' },
];

interface FloorPreset {
  name: string;
  width: number;
  depth: number;
  height: number;
}

const FLOOR_PRESETS: FloorPreset[] = [
  { name: 'Small', width: 30, depth: 20, height: 6 },
  { name: 'Medium', width: 60, depth: 40, height: 10 },
  { name: 'Large', width: 120, depth: 80, height: 12 },
  { name: 'Mega', width: 200, depth: 120, height: 15 },
];

interface NumericFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
  onClamp?: (original: number, clamped: number) => void;
}

function NumericField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'm',
  disabled,
  onCommit,
  onClamp,
}: NumericFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(String(value));
  }

  function commit(): void {
    const parsed = Number.parseFloat(draft);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(Math.max(parsed, min), max);
    setDraft(String(clamped));
    if (parsed !== clamped && onClamp) {
      onClamp(parsed, clamped);
    }
    if (clamped !== value) {
      onCommit(clamped);
    }
  }

  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-600 dark:text-neutral-400">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          className="w-20 rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-right text-xs text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none disabled:opacity-40"
        />
        <span className="w-5 text-[10px] text-slate-400 dark:text-neutral-500">{unit}</span>
      </span>
    </label>
  );
}

function RoomSettingsInspector({
  onShowWarning,
}: {
  onShowWarning: (msg: string) => void;
}) {
  const blueprintName = useEditorStore((s) => s.blueprintName);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const gridSnapStep = useEditorStore((s) => s.gridSnapStep);
  const racks = useEditorStore((s) => s.racks);
  const structuralElements = useEditorStore((s) => s.structuralElements);
  const zones = useEditorStore((s) => s.zones);
  const buildingLevels = useEditorStore((s) => s.buildingLevels ?? []);
  const verticalConnectors = useEditorStore((s) => s.verticalConnectors ?? []);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const { t } = useTranslation();

  const [pendingLevelToAdd, setPendingLevelToAdd] = useState<{
    level: BuildingLevel;
    requiredHeight: number;
  } | null>(null);

  const handleAddLevel = () => {
    if (buildingLevels.length >= MAX_BUILDING_LEVELS) {
      onShowWarning(
        t.editor.inspector.maxLevelsReached.replace('{max}', MAX_BUILDING_LEVELS.toString())
      );
      return;
    }

    const lastLevel = buildingLevels[buildingLevels.length - 1];
    const prevElevation = lastLevel ? lastLevel.elevationY : 0;
    const prevHeight = lastLevel ? lastLevel.height : DEFAULT_LEVEL_HEIGHT;
    const newElevation = prevElevation + prevHeight;
    const levelHeight = DEFAULT_LEVEL_HEIGHT;
    const requiredHeight = Math.ceil((newElevation + levelHeight + FIRE_SPRINKLER_CLEARANCE) * 10) / 10;

    const newLevel: BuildingLevel = {
      id: nextLevelId(),
      name: nextLevelName(buildingLevels),
      elevationY: newElevation,
      height: levelHeight,
      orderIndex: buildingLevels.length,
      type: 'UPPER',
    };

    if (requiredHeight > floorDimensions.height) {
      if (requiredHeight > WAREHOUSE_DIMENSION_LIMITS.maxHeight) {
        onShowWarning(
          t.editor.inspector.maxRoofHeightReached.replace(
            '{max}',
            WAREHOUSE_DIMENSION_LIMITS.maxHeight.toString()
          )
        );
        return;
      }
      setPendingLevelToAdd({ level: newLevel, requiredHeight });
      return;
    }

    executeCommand(createAddBuildingLevelCommand(newLevel));
  };

  const handleConfirmAutoExpandAndAdd = () => {
    if (!pendingLevelToAdd) return;
    executeCommand(
      createUpdateFloorDimensionsCommand({
        ...floorDimensions,
        height: pendingLevelToAdd.requiredHeight,
      })
    );
    executeCommand(createAddBuildingLevelCommand(pendingLevelToAdd.level));
    setPendingLevelToAdd(null);
  };

  const handleRemoveLevel = (lvl: BuildingLevel) => {
    if (lvl.id === 'level-1' || lvl.id === 'level-ground' || lvl.isDefault || lvl.elevationY === 0) {
      onShowWarning('Lantai dasar (Ground) tidak dapat dihapus');
      return;
    }
    executeCommand(createRemoveBuildingLevelCommand(lvl));
  };

  const [nameDraft, setNameDraft] = useState(blueprintName);
  const [prevName, setPrevName] = useState(blueprintName);
  if (prevName !== blueprintName) {
    setPrevName(blueprintName);
    setNameDraft(blueprintName);
  }

  const occupiedBounds = useMemo(
    () => getWarehouseOccupiedBounds(racks, structuralElements, zones, buildingLevels),
    [racks, structuralElements, zones, buildingLevels]
  );

  const totalBins = useMemo(
    () => racks.reduce((acc, r) => acc + r.bins.length, 0),
    [racks]
  );

  const handleNameCommit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== blueprintName) {
      executeCommand(createUpdateBlueprintMetaCommand({ name: trimmed }));
    } else {
      setNameDraft(blueprintName);
    }
  };

  const handleDimensionCommit = (axis: 'width' | 'depth' | 'height', val: number) => {
    if (axis === 'width') {
      const minW = Math.max(WAREHOUSE_DIMENSION_LIMITS.minWidth, occupiedBounds.minWidth);
      if (val < minW && occupiedBounds.furthestRackX) {
        onShowWarning(
          `Lebar gudang minimal ${minW}m: Objek ${occupiedBounds.furthestRackX.name} menempati hingga ${occupiedBounds.furthestRackX.requiredWidth}m`
        );
        return;
      }
      if (val > WAREHOUSE_DIMENSION_LIMITS.maxWidth) {
        onShowWarning(`Lebar gudang dibatasi maksimal ${WAREHOUSE_DIMENSION_LIMITS.maxWidth}m`);
        return;
      }
      executeCommand(
        createUpdateFloorDimensionsCommand({ ...floorDimensions, width: val })
      );
    } else if (axis === 'depth') {
      const minD = Math.max(WAREHOUSE_DIMENSION_LIMITS.minDepth, occupiedBounds.minDepth);
      if (val < minD && occupiedBounds.furthestRackZ) {
        onShowWarning(
          `Panjang gudang minimal ${minD}m: Objek ${occupiedBounds.furthestRackZ.name} menempati hingga ${occupiedBounds.furthestRackZ.requiredDepth}m`
        );
        return;
      }
      if (val > WAREHOUSE_DIMENSION_LIMITS.maxDepth) {
        onShowWarning(`Panjang gudang dibatasi maksimal ${WAREHOUSE_DIMENSION_LIMITS.maxDepth}m`);
        return;
      }
      executeCommand(
        createUpdateFloorDimensionsCommand({ ...floorDimensions, depth: val })
      );
    } else if (axis === 'height') {
      const minH = Math.max(WAREHOUSE_DIMENSION_LIMITS.minHeight, occupiedBounds.minHeight);
      if (val < minH && occupiedBounds.tallestRackY) {
        onShowWarning(
          `Tinggi atap minimal ${minH}m: Objek ${occupiedBounds.tallestRackY.name} memerlukan ${occupiedBounds.tallestRackY.requiredHeight - FIRE_SPRINKLER_CLEARANCE}m + ${FIRE_SPRINKLER_CLEARANCE}m sprinkler clearance`
        );
        return;
      }
      if (val > WAREHOUSE_DIMENSION_LIMITS.maxHeight) {
        onShowWarning(`Tinggi atap dibatasi maksimal ${WAREHOUSE_DIMENSION_LIMITS.maxHeight}m`);
        return;
      }
      executeCommand(
        createUpdateFloorDimensionsCommand({ ...floorDimensions, height: val })
      );
    }
  };

  const handlePresetSelect = (preset: FloorPreset) => {
    if (preset.width < occupiedBounds.minWidth && occupiedBounds.furthestRackX) {
      onShowWarning(
        `Preset '${preset.name}' terlalu kecil: Objek ${occupiedBounds.furthestRackX.name} menempati hingga ${occupiedBounds.furthestRackX.requiredWidth}m (lebar: ${preset.width}m)`
      );
      return;
    }
    if (preset.depth < occupiedBounds.minDepth && occupiedBounds.furthestRackZ) {
      onShowWarning(
        `Preset '${preset.name}' terlalu kecil: Objek ${occupiedBounds.furthestRackZ.name} menempati hingga ${occupiedBounds.furthestRackZ.requiredDepth}m (panjang: ${preset.depth}m)`
      );
      return;
    }
    if (preset.height < occupiedBounds.minHeight && occupiedBounds.tallestRackY) {
      onShowWarning(
        `Preset '${preset.name}' terlalu rendah: Objek ${occupiedBounds.tallestRackY.name} memerlukan ${occupiedBounds.tallestRackY.requiredHeight}m (tinggi: ${preset.height}m)`
      );
      return;
    }
    executeCommand(
      createUpdateFloorDimensionsCommand({
        width: preset.width,
        depth: preset.depth,
        height: preset.height,
      })
    );
  };

  const handleGridSnapChange = (step: number) => {
    executeCommand(createUpdateBlueprintMetaCommand({ gridSnapStep: step }));
  };

  const floorArea = floorDimensions.width * floorDimensions.depth;
  const roomVolume = floorArea * floorDimensions.height;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 select-none">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
            Room Settings
          </h2>
          <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40">
            Facility
          </span>
        </div>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleNameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="mt-2 w-full rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          placeholder="Warehouse Name"
          title="Click to rename facility"
        />
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Room Dimensions
        </h3>
        <NumericField
          label="Width (X)"
          value={floorDimensions.width}
          min={Math.max(WAREHOUSE_DIMENSION_LIMITS.minWidth, occupiedBounds.minWidth)}
          max={WAREHOUSE_DIMENSION_LIMITS.maxWidth}
          step={1}
          onCommit={(v) => handleDimensionCommit('width', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Lebar gudang disesuaikan ke ${clamped}m (Batas: ${WAREHOUSE_DIMENSION_LIMITS.minWidth}m - ${WAREHOUSE_DIMENSION_LIMITS.maxWidth}m)`);
          }}
        />
        <NumericField
          label="Length (Z)"
          value={floorDimensions.depth}
          min={Math.max(WAREHOUSE_DIMENSION_LIMITS.minDepth, occupiedBounds.minDepth)}
          max={WAREHOUSE_DIMENSION_LIMITS.maxDepth}
          step={1}
          onCommit={(v) => handleDimensionCommit('depth', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Panjang gudang disesuaikan ke ${clamped}m (Batas: ${WAREHOUSE_DIMENSION_LIMITS.minDepth}m - ${WAREHOUSE_DIMENSION_LIMITS.maxDepth}m)`);
          }}
        />
        <NumericField
          label="Ceiling Height (Y)"
          value={floorDimensions.height}
          min={Math.max(WAREHOUSE_DIMENSION_LIMITS.minHeight, occupiedBounds.minHeight)}
          max={WAREHOUSE_DIMENSION_LIMITS.maxHeight}
          step={0.5}
          onCommit={(v) => handleDimensionCommit('height', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Tinggi atap disesuaikan ke ${clamped}m (Batas: ${WAREHOUSE_DIMENSION_LIMITS.minHeight}m - ${WAREHOUSE_DIMENSION_LIMITS.maxHeight}m)`);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Size Presets
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {FLOOR_PRESETS.map((preset) => {
            const isCurrent =
              floorDimensions.width === preset.width &&
              floorDimensions.depth === preset.depth &&
              floorDimensions.height === preset.height;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition ${
                  isCurrent
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-200 shadow-sm'
                    : 'border-slate-200 dark:border-neutral-700/80 bg-slate-50 dark:bg-neutral-800/60 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span className="text-xs font-semibold">{preset.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                  {preset.width}×{preset.depth}m
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Grid Snap Resolution
        </h3>
        <div className="flex gap-1.5">
          {[0.25, 0.5, 1.0].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => handleGridSnapChange(step)}
              className={`flex-1 rounded border py-1 text-xs font-medium transition ${
                gridSnapStep === step
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-200 shadow-sm'
                  : 'border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600'
              }`}
            >
              {step}m
            </button>
          ))}
        </div>
      </div>

      {/* Building Levels Management */}
      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.75} />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
              Building Levels
            </h3>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                buildingLevels.length >= MAX_BUILDING_LEVELS
                  ? 'border border-amber-300 dark:border-amber-800/60 bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
              }`}
            >
              {buildingLevels.length} / {MAX_BUILDING_LEVELS}
            </span>
          </div>
          <button
            type="button"
            disabled={buildingLevels.length >= MAX_BUILDING_LEVELS}
            onClick={handleAddLevel}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition ${
              buildingLevels.length >= MAX_BUILDING_LEVELS
                ? 'cursor-not-allowed border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 opacity-75'
                : 'border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900'
            }`}
            title={
              buildingLevels.length >= MAX_BUILDING_LEVELS
                ? t.editor.inspector.limitReached
                : t.editor.inspector.addLevel
            }
          >
            <Plus className="h-3 w-3" />
            <span>
              {buildingLevels.length >= MAX_BUILDING_LEVELS ? t.editor.inspector.limitReached : t.editor.inspector.addLevel}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {buildingLevels.map((lvl, idx) => (
            <div
              key={lvl.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-800/50 p-2 text-xs"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-slate-800 dark:text-neutral-200">{lvl.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                  Elev: {lvl.elevationY.toFixed(1)}m · Tinggi: {lvl.height.toFixed(1)}m
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 uppercase">
                  {lvl.type || (idx === 0 ? 'GROUND' : 'UPPER')}
                </span>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLevel(lvl)}
                    className="rounded p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition"
                    title="Delete Level"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-xs">
        <div className="flex justify-between text-slate-600 dark:text-neutral-400">
          <span>Floor Area:</span>
          <span className="font-semibold text-slate-900 dark:text-neutral-200">{floorArea.toLocaleString()} m²</span>
        </div>
        <div className="mt-1 flex justify-between text-slate-600 dark:text-neutral-400">
          <span>Total Volume:</span>
          <span className="font-semibold text-slate-900 dark:text-neutral-200">{roomVolume.toLocaleString()} m³</span>
        </div>
        <div className="mt-1 flex justify-between text-slate-600 dark:text-neutral-400 border-t border-slate-200 dark:border-neutral-800/80 pt-1">
          <span>Placed Objects:</span>
          <span className="font-semibold text-sky-600 dark:text-sky-300">
            {racks.length} Racks · {structuralElements.length} Structs · {verticalConnectors.length} Connectors · {zones.length} Zones
          </span>
        </div>
      </div>

      {/* Auto-Expand Roof Height Confirmation Dialog */}
      {pendingLevelToAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-950/70 p-2.5 text-amber-600 dark:text-amber-400 shrink-0">
                <ArrowUpDown className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                  Ketinggian Atap Perlu Disesuaikan
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-neutral-400">
                  Tingkat lantai baru (<span className="font-semibold text-slate-800 dark:text-neutral-200">{pendingLevelToAdd.level.name}</span> pada elevasi {pendingLevelToAdd.level.elevationY.toFixed(1)}m) membutuhkan tinggi atap minimal <span className="font-semibold text-sky-600 dark:text-sky-400">{pendingLevelToAdd.requiredHeight}m</span> (termasuk clearance sprinkler {FIRE_SPRINKLER_CLEARANCE}m).
                </p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-500">
                  Tinggi atap saat ini adalah {floorDimensions.height}m.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setPendingLevelToAdd(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAutoExpandAndAdd}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Auto-Expand & Tambah Lantai</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function StructurePropertiesInspector({
  element,
  onShowWarning,
}: {
  element: StructuralElement;
  onShowWarning: (msg: string) => void;
}) {
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const deselectEntity = useEditorStore((s) => s.deselectEntity);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const buildingLevels = useEditorStore((s) => s.buildingLevels ?? []);

  const handleLevelChange = (targetLevelId: string) => {
    const targetLvl = buildingLevels.find((l) => l.id === targetLevelId);
    if (!targetLvl) return;
    executeCommand(
      createUpdateStructuralElementCommand(element.id, {
        levelId: targetLevelId,
        position: { ...element.position, y: targetLvl.elevationY },
      })
    );
  };

  const clamps =
    STRUCTURE_PARAM_CLAMPS[element.type as keyof typeof STRUCTURE_PARAM_CLAMPS] ??
    STRUCTURE_PARAM_CLAMPS.wall;

  const maxHeight =
    element.type === 'column' || element.type === 'wall'
      ? Math.min(clamps.maxHeight, floorDimensions.height)
      : clamps.maxHeight;

  const maxWidth =
    element.type === 'wall'
      ? Math.min(clamps.maxWidth, floorDimensions.width)
      : clamps.maxWidth;

  const [nameDraft, setNameDraft] = useState(element.name || 'Structure');
  const [prevName, setPrevName] = useState(element.name);
  if (prevName !== element.name) {
    setPrevName(element.name);
    setNameDraft(element.name || 'Structure');
  }

  const handleNameCommit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== element.name) {
      executeCommand(createUpdateStructuralElementCommand(element.id, { name: trimmed }));
    }
  };

  const handleDimensionChange = (axis: 'width' | 'height' | 'depth', val: number) => {
    const limit = axis === 'height' ? maxHeight : axis === 'width' ? maxWidth : clamps.maxDepth;
    const minLimit = axis === 'height' ? clamps.minHeight : axis === 'width' ? clamps.minWidth : clamps.minDepth;
    const clampedVal = Math.min(Math.max(val, minLimit), limit);

    if (clampedVal < val) {
      onShowWarning(
        `Dimensi ${axis} untuk ${element.type.replace('_', ' ')} dibatasi maksimal ${limit}m`
      );
    }

    const nextDims = { ...element.dimensions, [axis]: clampedVal };

    // Check perimeter boundaries
    const halfW = nextDims.width / 2;
    const halfD = nextDims.depth / 2;
    if (
      element.position.x - halfW < 0 ||
      element.position.x + halfW > floorDimensions.width ||
      element.position.z - halfD < 0 ||
      element.position.z + halfD > floorDimensions.depth
    ) {
      onShowWarning(
        `Dimensi ${axis} membuat struktur melebihi perimeter dinding luar gudang`
      );
      return;
    }

    executeCommand(
      createUpdateStructuralElementCommand(element.id, {
        dimensions: nextDims,
      })
    );
  };

  const handleRotate = () => {
    const nextRot = nextRotationStep(element.rotationY);
    executeCommand(createRotateStructuralElementCommand(element.id, element.rotationY, nextRot));
  };

  const handleDelete = () => {
    executeCommand(createRemoveStructuralElementCommand(element));
    deselectEntity();
  };

  return (
    <aside className="relative flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 select-none">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
            Structure Properties
          </h2>
          <button
            type="button"
            onClick={deselectEntity}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400 hover:underline"
            title="Deselect to view Room Settings"
          >
            <X className="h-3 w-3" strokeWidth={1.75} />
            <span>Room Settings</span>
          </button>
        </div>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleNameCommit}
          className="mt-2 w-full rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
        />
        <span className="mt-1 inline-block rounded bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
          {element.type.replace('_', ' ')}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Dimensions
        </h3>
        <NumericField
          label="Width (X)"
          value={element.dimensions.width}
          min={clamps.minWidth}
          max={maxWidth}
          step={clamps.step}
          onCommit={(v) => handleDimensionChange('width', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Lebar disesuaikan ke ${clamped}m (Batas: ${clamps.minWidth}m - ${maxWidth}m)`);
          }}
        />
        <NumericField
          label="Depth / Thickness (Z)"
          value={element.dimensions.depth}
          min={clamps.minDepth}
          max={clamps.maxDepth}
          step={clamps.step}
          onCommit={(v) => handleDimensionChange('depth', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Ketebalan disesuaikan ke ${clamped}m (Batas: ${clamps.minDepth}m - ${clamps.maxDepth}m)`);
          }}
        />
        <NumericField
          label="Height (Y)"
          value={element.dimensions.height}
          min={clamps.minHeight}
          max={maxHeight}
          step={clamps.step}
          onCommit={(v) => handleDimensionChange('height', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Tinggi disesuaikan ke ${clamped}m (Batas: ${clamps.minHeight}m - ${maxHeight}m)`);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <button
          type="button"
          onClick={handleRotate}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-neutral-200 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-slate-900 dark:hover:text-white transition"
        >
          <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Rotate 90° (R)</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-100 dark:hover:bg-red-950/80 hover:text-red-700 dark:hover:text-white transition"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Delete Structure</span>
        </button>
      </div>

      {/* Floor Level Assignment */}
      <div className="flex flex-col gap-1.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-400">Tingkat Lantai</span>
          <select
            value={element.levelId || 'level-ground'}
            onChange={(e) => handleLevelChange(e.target.value)}
            className="rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-xs text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          >
            {buildingLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.name} ({lvl.elevationY.toFixed(1)}m)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-[11px] text-slate-600 dark:text-neutral-400">
        <p>Position: ({element.position.x.toFixed(1)}m, {element.position.z.toFixed(1)}m)</p>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-neutral-500">All edits are undoable (Ctrl+Z).</p>
      </div>
    </aside>
  );
}

function ZonePropertiesInspector({
  zone,
  onShowWarning,
}: {
  zone: WarehouseZone;
  onShowWarning: (msg: string) => void;
}) {
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const deselectEntity = useEditorStore((s) => s.deselectEntity);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const buildingLevels = useEditorStore((s) => s.buildingLevels ?? []);

  const handleLevelChange = (targetLevelId: string) => {
    const targetLvl = buildingLevels.find((l) => l.id === targetLevelId);
    if (!targetLvl) return;
    executeCommand(
      createUpdateZoneCommand(zone.id, {
        levelId: targetLevelId,
        position: { ...zone.position, y: targetLvl.elevationY },
      })
    );
  };

  const { maxWidth, maxDepth } = calculateMaxZoneDimensions(zone.position, floorDimensions);

  const [nameDraft, setNameDraft] = useState(zone.name || 'Zone');
  const [prevName, setPrevName] = useState(zone.name);
  if (prevName !== zone.name) {
    setPrevName(zone.name);
    setNameDraft(zone.name || 'Zone');
  }

  const handleNameCommit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== zone.name) {
      executeCommand(createUpdateZoneCommand(zone.id, { name: trimmed }));
    }
  };

  const handleTypeChange = (newType: ZoneType) => {
    executeCommand(createUpdateZoneCommand(zone.id, { type: newType }));
  };

  const handleColorChange = (hex: string) => {
    executeCommand(createUpdateZoneCommand(zone.id, { colorHex: hex }));
  };

  const handleDimensionChange = (axis: 'width' | 'depth', val: number) => {
    const limit = axis === 'width' ? maxWidth : maxDepth;
    const minLimit = axis === 'width' ? ZONE_PARAM_CLAMPS.minWidth : ZONE_PARAM_CLAMPS.minDepth;
    const clamped = Math.min(Math.max(val, minLimit), limit);

    if (clamped < val) {
      onShowWarning(
        `Dimensi ${axis === 'width' ? 'lebar' : 'panjang'} zona dibatasi maksimal ${limit}m agar tidak keluar dari batas dinding gudang`
      );
    }

    executeCommand(
      createUpdateZoneCommand(zone.id, {
        dimensions: { ...zone.dimensions, [axis]: clamped },
      })
    );
  };

  const handleDelete = () => {
    executeCommand(createRemoveZoneCommand(zone));
    deselectEntity();
  };

  const zoneArea = (zone.dimensions?.width ?? 10) * (zone.dimensions?.depth ?? 10);
  const isStaging = isZoneStagingEligible(zone);
  const palletSlots = isStaging ? calculateZonePalletSlots(zone) : [];
  const totalSlots = palletSlots.length;
  const currentSlots = zone.stagingConfig?.slots ?? palletSlots;
  const occupiedCount = currentSlots.filter((s) => s.isOccupied).length;

  return (
    <aside className="relative flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 select-none">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
            Zone Properties
          </h2>
          <button
            type="button"
            onClick={deselectEntity}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400 hover:underline"
            title="Deselect to view Room Settings"
          >
            <X className="h-3 w-3" strokeWidth={1.75} />
            <span>Room Settings</span>
          </button>
        </div>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleNameCommit}
          className="mt-2 w-full rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Zone Category
        </h3>
        <select
          value={zone.type}
          onChange={(e) => handleTypeChange(e.target.value as ZoneType)}
          className="rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-neutral-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="receiving">Receiving (Inbound)</option>
          <option value="shipping">Shipping (Outbound)</option>
          <option value="picking">Staging / Picking Lane</option>
          <option value="quarantine">Quarantine / QC</option>
          <option value="storage">Bulk Storage Area</option>
        </select>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Zone Color Tint
        </h3>
        <div className="flex items-center gap-2">
          {ZONE_COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => handleColorChange(c.hex)}
              className={`h-6 w-6 rounded-full border transition-all ${
                zone.colorHex === c.hex
                  ? 'border-white scale-110 shadow-md ring-2 ring-sky-500'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Footprint Dimensions
        </h3>
        <NumericField
          label="Width (X)"
          value={zone.dimensions?.width ?? 10}
          min={ZONE_PARAM_CLAMPS.minWidth}
          max={maxWidth}
          step={1}
          onCommit={(v) => handleDimensionChange('width', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Lebar zona disesuaikan ke ${clamped}m (Batas: ${ZONE_PARAM_CLAMPS.minWidth}m - ${maxWidth}m)`);
          }}
        />
        <NumericField
          label="Depth (Z)"
          value={zone.dimensions?.depth ?? 10}
          min={ZONE_PARAM_CLAMPS.minDepth}
          max={maxDepth}
          step={1}
          onCommit={(v) => handleDimensionChange('depth', v)}
          onClamp={(orig, clamped) => {
            onShowWarning(`Panjang zona disesuaikan ke ${clamped}m (Batas: ${ZONE_PARAM_CLAMPS.minDepth}m - ${maxDepth}m)`);
          }}
        />
      </div>

      {/* Staging Pallet Grid Controls */}
      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400 flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5 text-amber-500" />
            <span>Staging Pallet Grid</span>
          </h3>
          <span className="rounded bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-neutral-300">
            {totalSlots} Slots
          </span>
        </div>

        {/* Toggle Staging Pallets */}
        <label className="flex items-center justify-between cursor-pointer rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-2 text-xs">
          <span className="text-slate-700 dark:text-neutral-300 font-medium">Tampilkan Palet Staging</span>
          <input
            type="checkbox"
            checked={isStaging}
            onChange={(e) =>
              executeCommand(
                createUpdateZoneStagingConfigCommand(zone.id, {
                  enabled: e.target.checked,
                })
              )
            }
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
        </label>

        {isStaging && totalSlots > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
              <span>Status Okupansi:</span>
              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                {occupiedCount} / {totalSlots} Terisi ({totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0}%)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => executeCommand(createBatchUpdateZonePalletsCommand(zone.id, true))}
                className="flex items-center justify-center gap-1 rounded border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-neutral-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-300 transition"
                title="Isi kargo ke semua palet di zona ini"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={1.75} />
                <span>Isi Semua</span>
              </button>
              <button
                type="button"
                onClick={() => executeCommand(createBatchUpdateZonePalletsCommand(zone.id, false))}
                className="flex items-center justify-center gap-1 rounded border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-neutral-300 hover:border-red-500 hover:text-red-600 dark:hover:text-red-300 transition"
                title="Kosongkan semua palet di zona ini"
              >
                <XCircle className="h-3 w-3 text-red-500" strokeWidth={1.75} />
                <span>Kosongkan</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-100 dark:hover:bg-red-950/80 hover:text-red-700 dark:hover:text-white transition"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Delete Zone</span>
        </button>
      </div>

      {/* Floor Level Assignment */}
      <div className="flex flex-col gap-1.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-400">Tingkat Lantai</span>
          <select
            value={zone.levelId || 'level-ground'}
            onChange={(e) => handleLevelChange(e.target.value)}
            className="rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-xs text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          >
            {buildingLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.name} ({lvl.elevationY.toFixed(1)}m)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-[11px] text-slate-600 dark:text-neutral-400">
        <div className="flex justify-between">
          <span>Zone Area:</span>
          <span className="font-semibold text-slate-900 dark:text-neutral-200">{zoneArea.toFixed(1)} m²</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-neutral-500">All edits are undoable (Ctrl+Z).</p>
      </div>
    </aside>
  );
}

function useConfigurationValidator(rack: RackEntity | undefined) {
  const floorWidth = useEditorStore((s) => s.floorDimensions.width);
  const floorDepth = useEditorStore((s) => s.floorDimensions.depth);

  return useMemo(() => {
    if (!rack) return null;
    return {
      isValidPatch: (patch: Partial<RackEntity>): boolean => {
        const state = useEditorStore.getState();
        const merged = { ...rack, ...patch };
        const dims =
          'dimensions' in patch && patch.dimensions
            ? patch.dimensions
            : deriveRackDimensions(merged);
        return isPlacementValid({
          x: rack.position.x,
          z: rack.position.z,
          width: dims.width,
          depth: dims.depth,
          rotationY: rack.rotationY,
          neighbors: state.racks.filter((r) => r.id !== rack.id),
          floorWidth,
          floorDepth,
        });
      },
      isValidRotation: (): boolean => {
        const state = useEditorStore.getState();
        const theta = nextRotationStep(rack.rotationY);
        const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
          rack.dimensions.width,
          rack.dimensions.depth,
          theta
        );
        return isPlacementValid({
          x: rack.position.x,
          z: rack.position.z,
          width: effectiveWidth,
          depth: effectiveDepth,
          rotationY: theta,
          neighbors: state.racks.filter((r) => r.id !== rack.id),
          floorWidth,
          floorDepth,
        });
      },
    };
  }, [rack, floorWidth, floorDepth]);
}

function RackPropertiesInspector({
  rack,
  onShowWarning,
  onOpenAisleGenerator,
}: {
  rack: RackEntity;
  onShowWarning: (msg: string) => void;
  onOpenAisleGenerator?: (rack: RackEntity) => void;
}) {
  const { t } = useTranslation();
  const deselectEntity = useEditorStore((s) => s.deselectEntity);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const buildingLevels = useEditorStore((s) => s.buildingLevels ?? []);
  const validator = useConfigurationValidator(rack);

  const handleLevelChange = (targetLevelId: string) => {
    const targetLvl = buildingLevels.find((l) => l.id === targetLevelId);
    if (!targetLvl) return;
    executeCommand(
      createUpdateRackConfigCommand(rack.id, {
        levelId: targetLevelId,
        position: { ...rack.position, y: targetLvl.elevationY },
      })
    );
  };

  const maxAllowableLevels = calculateMaxRackLevels(floorDimensions.height, rack.levelHeight);
  const maxAllowableLevelHeight = calculateMaxRackLevelHeight(floorDimensions.height, rack.levels);

  const isDoubleDeep = rack.type === 'double_deep';
  const minBayDepth = isDoubleDeep ? CLAMPS.minDoubleDeepBayDepth : CLAMPS.minBayDepth;
  const maxBayDepth = isDoubleDeep ? CLAMPS.maxDoubleDeepBayDepth : CLAMPS.maxBayDepth;

  function commitPatch(
    patch: Parameters<typeof createUpdateRackConfigCommand>[1],
    label: string
  ): void {
    if (!rack || !validator) return;

    // Check ceiling clearance if levels or levelHeight is being patched
    const nextLevels = patch.levels ?? rack.levels;
    const nextLevelHeight = patch.levelHeight ?? rack.levelHeight;
    const nextTotalHeight = nextLevels * nextLevelHeight;
    const maxPermittedHeight = floorDimensions.height - FIRE_SPRINKLER_CLEARANCE;

    if (nextTotalHeight > maxPermittedHeight) {
      onShowWarning(
        `Tinggi rak (${nextTotalHeight.toFixed(1)}m) melebihi batas aman plafon ${floorDimensions.height}m minus ${FIRE_SPRINKLER_CLEARANCE}m sprinkler clearance`
      );
      return;
    }

    if (!validator.isValidPatch(patch as Partial<RackEntity>)) {
      onShowWarning(`Tidak dapat ${label}: ruang terhalang atau berada di luar batas dinding gudang`);
      return;
    }
    executeCommand(createUpdateRackConfigCommand(rack.id, patch));
  }

  function handleRotate(): void {
    if (!rack || !validator) return;
    if (!validator.isValidRotation()) {
      onShowWarning('Cannot rotate: space obstructed or outside boundary');
      return;
    }
    executeCommand(createRotateRackCommand(rack.id));
  }

  function handleDelete(): void {
    if (!rack) return;
    executeCommand(createRemoveRackCommand(rack));
    deselectEntity();
  }

  return (
    <aside className="relative flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 select-none">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
            Rack Properties
          </h2>
          <button
            type="button"
            onClick={deselectEntity}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400 hover:underline"
            title="Deselect to view Room Settings"
          >
            <X className="h-3 w-3" strokeWidth={1.75} />
            <span>Room Settings</span>
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-neutral-100">{rack.name}</span>
          <span className="rounded bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            {rack.type.replace('_', ' ')}
          </span>
        </div>

        {/* WMS Bin Inspection & Batch Controls */}
        <div className="mt-2.5 flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-2">
          <button
            type="button"
            onClick={() => {
              useEditorStore.getState().setEditorViewMode('WMS');
              if (rack.bins.length > 0) {
                useEditorStore.getState().selectBin(rack.bins[0].id);
              }
            }}
            className="flex items-center justify-between rounded-lg border border-amber-400/60 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:text-amber-900 dark:hover:text-white transition shadow-sm"
          >
            <span className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
              <span>Inspect Bins</span>
            </span>
            <span className="rounded bg-amber-200/80 dark:bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-mono text-amber-900 dark:text-amber-200">
              {rack.bins.filter((b) => b.isOccupied).length} / {rack.bins.length} occupied
            </span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => executeCommand(createBatchUpdateRackBinsCommand(rack.id, true))}
              className="flex items-center justify-center gap-1 rounded border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-neutral-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-300 transition"
              title="Stock all bins in this rack"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={1.75} />
              <span>Fill Rack</span>
            </button>
            <button
              type="button"
              onClick={() => executeCommand(createBatchUpdateRackBinsCommand(rack.id, false))}
              className="flex items-center justify-center gap-1 rounded border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-neutral-300 hover:border-red-500 hover:text-red-600 dark:hover:text-red-300 transition"
              title="Empty all bins in this rack"
            >
              <XCircle className="h-3 w-3 text-red-500" strokeWidth={1.75} />
              <span>Empty Rack</span>
            </button>
          </div>

          {/* Aisle Array Generator Trigger */}
          {onOpenAisleGenerator && (
            <button
              type="button"
              onClick={() => onOpenAisleGenerator(rack)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-400/50 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:border-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/60 hover:text-sky-900 dark:hover:text-white transition shadow-sm"
              title={t.aisleGenerator.modalTitle}
            >
              <Grid className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.75} />
              <span>{t.aisleGenerator.inspectorBtn}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <NumericField
          label="Bays"
          value={rack.bays}
          min={CLAMPS.minBays}
          max={CLAMPS.maxBays}
          unit="#"
          onCommit={(v) => commitPatch({ bays: v }, 'resize bays')}
          onClamp={(orig, clamped) => {
            onShowWarning(`Jumlah bay disesuaikan ke ${clamped} (Batas: ${CLAMPS.minBays} - ${CLAMPS.maxBays})`);
          }}
        />
        <NumericField
          label="Levels"
          value={rack.levels}
          min={CLAMPS.minLevels}
          max={maxAllowableLevels}
          unit="#"
          onCommit={(v) => commitPatch({ levels: v }, 'resize levels')}
          onClamp={(orig, clamped) => {
            onShowWarning(`Jumlah level disesuaikan ke ${clamped} agar tidak menembus atap gudang (Maks: ${maxAllowableLevels})`);
          }}
        />
        <NumericField
          label="Bay Width"
          value={rack.bayWidth}
          min={CLAMPS.minBayWidth}
          max={CLAMPS.maxBayWidth}
          step={0.1}
          onCommit={(v) => commitPatch({ bayWidth: v }, 'change bay width')}
          onClamp={(orig, clamped) => {
            onShowWarning(`Lebar bay disesuaikan ke ${clamped}m (Batas: ${CLAMPS.minBayWidth}m - ${CLAMPS.maxBayWidth}m)`);
          }}
        />
        <NumericField
          label="Bay Depth"
          value={rack.bayDepth}
          min={minBayDepth}
          max={maxBayDepth}
          step={0.1}
          onCommit={(v) => commitPatch({ bayDepth: v }, 'change bay depth')}
          onClamp={(orig, clamped) => {
            onShowWarning(`Kedalaman bay disesuaikan ke ${clamped}m (Batas: ${minBayDepth}m - ${maxBayDepth}m)`);
          }}
        />
        <NumericField
          label="Level Height"
          value={rack.levelHeight}
          min={CLAMPS.minLevelHeight}
          max={maxAllowableLevelHeight}
          step={0.1}
          onCommit={(v) => commitPatch({ levelHeight: v }, 'change level height')}
          onClamp={(orig, clamped) => {
            onShowWarning(`Tinggi per level disesuaikan ke ${clamped}m agar total tinggi rak aman di bawah atap (Maks: ${maxAllowableLevelHeight}m)`);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <button
          type="button"
          onClick={handleRotate}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-neutral-200 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-slate-900 dark:hover:text-white transition"
        >
          <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Rotate 90° (R)</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-100 dark:hover:bg-red-950/80 hover:text-red-700 dark:hover:text-white transition"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Delete Rack</span>
        </button>
      </div>

      {/* Floor Level Assignment */}
      <div className="flex flex-col gap-1.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-400">Tingkat Lantai</span>
          <select
            value={rack.levelId || 'level-ground'}
            onChange={(e) => handleLevelChange(e.target.value)}
            className="rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-xs text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          >
            {buildingLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.name} ({lvl.elevationY.toFixed(1)}m)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-[11px] leading-relaxed text-slate-600 dark:text-neutral-400">
        Bins regenerate automatically:{' '}
        <span className="font-semibold text-slate-900 dark:text-neutral-200">
          {(() => {
            const mult = getSlotsPerBayLevel(rack.type);
            if (mult > 1) {
              return `${rack.bays} × ${rack.levels} × ${mult} = ${rack.bins.length} slots`;
            }
            return `${rack.bays} × ${rack.levels} = ${rack.bins.length} slots`;
          })()}
        </span>
        .
        <p className="mt-1 text-[10px] text-slate-500 dark:text-neutral-500">All edits are undoable (Ctrl+Z).</p>
      </div>
    </aside>
  );
}

function WmsCapacityOverviewInspector({
  onOpenWmsHub,
}: {
  onOpenWmsHub?: () => void;
}) {
  const racks = useEditorStore((s) => s.racks);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const executeCommand = useEditorStore((s) => s.executeCommand);

  const [scope, setScope] = useState<'LEVEL' | 'ALL'>('LEVEL');

  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const isAllFloors = activeLevelId === 'ALL';
  const effectiveScope = isAllFloors ? 'ALL' : scope;

  const filteredRacks =
    effectiveScope === 'LEVEL' && activeLevelId !== 'ALL'
      ? racks.filter((r) => (r.levelId ?? 'level-1') === activeLevelId)
      : racks;

  let totalBins = 0;
  let occupiedBins = 0;
  for (const r of filteredRacks) {
    totalBins += r.bins.length;
    for (const b of r.bins) {
      if (b.isOccupied) occupiedBins++;
    }
  }
  const pct = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0;
  const freeBins = totalBins - occupiedBins;

  const targetLevelId =
    effectiveScope === 'LEVEL' && activeLevelId !== 'ALL' ? activeLevelId : undefined;

  const scopeLabel =
    effectiveScope === 'LEVEL' && activeLevel
      ? activeLevel.name
      : 'Seluruh Gudang';

  return (
    <div className="flex h-full flex-col gap-4 p-4 select-none overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Boxes className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-200">
              WMS Inventory Overview
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400">
              {filteredRacks.length} Rak • {totalBins} Total Bins
            </p>
          </div>
        </div>
      </div>

      {/* Scope Selector: Level vs All */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-neutral-800/80 p-1 text-xs">
        <button
          type="button"
          disabled={isAllFloors}
          onClick={() => setScope('LEVEL')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition text-center text-[11px] ${
            effectiveScope === 'LEVEL'
              ? 'bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-sm font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200 disabled:opacity-50'
          }`}
          title={isAllFloors ? 'Pilih lantai spesifik di HUD untuk memfilter per lantai' : `Filter ke ${activeLevel?.name ?? 'Lantai Aktif'}`}
        >
          {activeLevel ? activeLevel.name : 'Lantai Aktif'}
        </button>
        <button
          type="button"
          onClick={() => setScope('ALL')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition text-center text-[11px] ${
            effectiveScope === 'ALL'
              ? 'bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-sm font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          Seluruh Gudang
        </button>
      </div>

      {/* Capacity Overview Card */}
      <div className="rounded-2xl border border-amber-200/80 dark:border-neutral-800 bg-amber-50/40 dark:bg-neutral-900/60 p-3.5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 dark:text-neutral-300">
            Okupansi ({scopeLabel})
          </span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{pct}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
          <div
            className="h-full bg-amber-500 transition-all duration-300 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl border border-slate-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-2.5">
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 block">Terisi (Occupied)</span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {occupiedBins}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-2.5">
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 block">Kosong (Available)</span>
            <span className="text-sm font-bold font-mono text-slate-600 dark:text-neutral-400">
              {freeBins}
            </span>
          </div>
        </div>
      </div>

      {/* Batch Actions Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            Aksi Batch ({scopeLabel})
          </span>
          {targetLevelId && (
            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold px-1.5 py-0.5 rounded">
              Lantai Aktif
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => executeCommand(createBatchUpdateAllBinsCommand('random', 0.7, targetLevelId))}
          className="flex items-center justify-between w-full rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition shadow-sm"
          title={`Isi ~70% bin di rak (${scopeLabel}) dengan kargo demo acak`}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Randomize 70% Stock</span>
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">Demo</span>
        </button>

        <button
          type="button"
          onClick={() => executeCommand(createBatchUpdateAllBinsCommand(true, undefined, targetLevelId))}
          className="flex items-center justify-between w-full rounded-xl border border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shadow-sm"
          title={`Isi 100% bin di rak (${scopeLabel}) dengan stok penuh`}
        >
          <span className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-emerald-500" />
            <span>Stock All ({scopeLabel})</span>
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">100%</span>
        </button>

        <button
          type="button"
          onClick={() => executeCommand(createBatchUpdateAllBinsCommand(false, undefined, targetLevelId))}
          className="flex items-center justify-between w-full rounded-xl border border-rose-300/60 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shadow-sm"
          title={`Kosongkan seluruh bin di (${scopeLabel})`}
        >
          <span className="flex items-center gap-2">
            <PackageX className="h-4 w-4 text-rose-500" />
            <span>Empty All ({scopeLabel})</span>
          </span>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">0%</span>
        </button>
      </div>

      {/* Enterprise WMS Data Hub & Slotting Optimizer Button */}
      {onOpenWmsHub && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-gradient-to-tr from-amber-500/10 via-amber-500/5 to-transparent p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>WMS Data Hub & Slotting</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-neutral-400 leading-snug">
            Impor CSV/Excel, optimasi penempatan ABC Velocity ke rak, & sinkronisasi ERP via Webhook.
          </p>
          <button
            type="button"
            onClick={onOpenWmsHub}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-2 text-xs shadow-md shadow-amber-500/20 transition"
          >
            <Database className="h-3.5 w-3.5" />
            <span>Buka WMS Data Hub</span>
          </button>
        </div>
      )}

      {/* Helpful Hint */}
      <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-[11px] leading-relaxed text-slate-500 dark:text-neutral-400">
        <p className="font-semibold text-slate-700 dark:text-neutral-300 mb-1">
          Inspeksi Bin Individual
        </p>
        Klik rak manapun pada lantai gudang 3D untuk melihat susunan slot bin, SKU, status okupansi, dan kargo pallet.
      </div>
    </div>
  );
}

function ConnectorPropertiesInspector({
  connector,
  onShowWarning,
}: {
  connector: VerticalConnector;
  onShowWarning: (msg: string) => void;
}) {
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const deselectEntity = useEditorStore((s) => s.deselectEntity);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const buildingLevels = useEditorStore((s) => s.buildingLevels ?? []);
  const { t } = useTranslation();
  const [nameDraft, setNameDraft] = useState(connector.name || 'Connector');
  const [prevName, setPrevName] = useState(connector.name);
  if (prevName !== connector.name) {
    setPrevName(connector.name);
    setNameDraft(connector.name || 'Connector');
  }

  const handleNameCommit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== connector.name) {
      executeCommand(createUpdateVerticalConnectorCommand(connector.id, { name: trimmed }));
    }
  };

  const handleRotate = () => {
    const nextRot = nextRotationStep(connector.rotationY);
    executeCommand(
      createRotateVerticalConnectorCommand(connector.id, connector.rotationY, nextRot)
    );
  };

  const handleDelete = () => {
    executeCommand(createRemoveVerticalConnectorCommand(connector));
    deselectEntity();
  };

  const handleLevelChange = (field: 'fromLevelId' | 'toLevelId', levelId: string) => {
    const targetLvl = buildingLevels.find((l) => l.id === levelId);
    if (!targetLvl) return;

    if (field === 'fromLevelId') {
      const toLvl = buildingLevels.find((l) => l.id === connector.toLevelId);
      const newHeight = toLvl
        ? Math.max(1, Math.abs(toLvl.elevationY - targetLvl.elevationY))
        : connector.dimensions.height;
      executeCommand(
        createUpdateVerticalConnectorCommand(connector.id, {
          fromLevelId: levelId,
          position: { ...connector.position, y: targetLvl.elevationY },
          dimensions: { ...connector.dimensions, height: newHeight },
        })
      );
    } else {
      const fromLvl = buildingLevels.find((l) => l.id === connector.fromLevelId);
      const newHeight = fromLvl
        ? Math.max(1, Math.abs(targetLvl.elevationY - fromLvl.elevationY))
        : connector.dimensions.height;
      executeCommand(
        createUpdateVerticalConnectorCommand(connector.id, {
          toLevelId: levelId,
          dimensions: { ...connector.dimensions, height: newHeight },
        })
      );
    }
  };

  const handleDimensionChange = (axis: 'width' | 'depth' | 'height', val: number) => {
    const nextDims = { ...connector.dimensions, [axis]: val };
    executeCommand(createUpdateVerticalConnectorCommand(connector.id, { dimensions: nextDims }));
  };

  const handleQuickAddMezzanine = () => {
    if (buildingLevels.length >= MAX_BUILDING_LEVELS) {
      onShowWarning(
        t.editor.inspector.maxLevelsReached.replace('{max}', MAX_BUILDING_LEVELS.toString())
      );
      return;
    }
    const lastLevel = buildingLevels[buildingLevels.length - 1];
    const prevElevation = lastLevel ? lastLevel.elevationY : 0;
    const prevHeight = lastLevel ? lastLevel.height : DEFAULT_LEVEL_HEIGHT;
    const newElevation = prevElevation + prevHeight;
    const requiredHeight = Math.ceil((newElevation + DEFAULT_LEVEL_HEIGHT + FIRE_SPRINKLER_CLEARANCE) * 10) / 10;
    if (requiredHeight > floorDimensions.height) {
      if (requiredHeight > WAREHOUSE_DIMENSION_LIMITS.maxHeight) {
        onShowWarning(
          t.editor.inspector.maxRoofHeightReached.replace(
            '{max}',
            WAREHOUSE_DIMENSION_LIMITS.maxHeight.toString()
          )
        );
        return;
      }
      executeCommand(
        createUpdateFloorDimensionsCommand({
          ...floorDimensions,
          height: requiredHeight,
        })
      );
    }
    const newLevel: BuildingLevel = {
      id: nextLevelId(),
      name: t.editor.inspector.mezzanineFloor,
      elevationY: newElevation,
      height: DEFAULT_LEVEL_HEIGHT,
      orderIndex: buildingLevels.length,
      type: 'MEZZANINE',
      colorHex: '#a855f7',
    };
    executeCommand(createAddBuildingLevelCommand(newLevel));

    const sourceLevel = buildingLevels.find((l) => l.id === connector.fromLevelId);
    const sourceElevation = sourceLevel ? sourceLevel.elevationY : 0;
    const connectorHeight = Math.max(1, newElevation - sourceElevation);

    executeCommand(
      createUpdateVerticalConnectorCommand(connector.id, {
        toLevelId: newLevel.id,
        position: {
          ...connector.position,
          y: sourceElevation,
        },
        dimensions: {
          ...connector.dimensions,
          height: connectorHeight,
        },
      })
    );
  };

  const isRestrictedForHeavyVehicles = connector.type === 'stairs';

  return (
    <aside className="relative flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 select-none">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
            {t.editor.inspector.connectorProperties}
          </h2>
          <span className="rounded bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 uppercase">
            {connector.type}
          </span>
        </div>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleNameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="mt-2 w-full rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          placeholder="Connector Name"
        />
      </div>

      {/* Connected Levels Selection */}
      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Connected Floor Levels
        </h3>
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-400">{t.editor.inspector.startFloorBottom}</span>
          <select
            value={connector.fromLevelId}
            onChange={(e) => handleLevelChange('fromLevelId', e.target.value)}
            className="rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-xs text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          >
            {buildingLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.name} ({lvl.elevationY.toFixed(1)}m)
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-400">{t.editor.inspector.targetFloorTop}</span>
          <select
            value={connector.toLevelId}
            onChange={(e) => handleLevelChange('toLevelId', e.target.value)}
            className="rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-xs text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
          >
            {buildingLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.name} ({lvl.elevationY.toFixed(1)}m)
              </option>
            ))}
          </select>
        </label>

        {buildingLevels.length < 2 && (
          <div className="mt-1 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 flex flex-col gap-1.5">
            <p>{t.editor.inspector.singleFloorPrompt}</p>
            <button
              type="button"
              onClick={handleQuickAddMezzanine}
              className="flex items-center justify-center gap-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold py-1.5 px-2 text-[11px] transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.editor.inspector.addMezzanine}</span>
            </button>
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className="flex flex-col gap-2.5 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          {t.editor.inspector.dimensionsElevation}
        </h3>
        <NumericField
          label={t.editor.inspector.width}
          value={connector.dimensions.width}
          min={1}
          max={20}
          step={0.5}
          onCommit={(v) => handleDimensionChange('width', v)}
        />
        <NumericField
          label={t.editor.inspector.depth}
          value={connector.dimensions.depth}
          min={1}
          max={30}
          step={0.5}
          onCommit={(v) => handleDimensionChange('depth', v)}
        />
        <NumericField
          label={t.editor.inspector.height}
          value={connector.dimensions.height}
          min={1}
          max={30}
          step={0.5}
          onCommit={(v) => handleDimensionChange('height', v)}
        />
      </div>

      {/* Orientation & Actions */}
      <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-neutral-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
          Orientation
        </h3>
        <button
          type="button"
          onClick={handleRotate}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700/80 bg-slate-50 dark:bg-neutral-800/80 px-3 py-2 text-xs font-medium text-slate-700 dark:text-neutral-200 hover:border-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
        >
          <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Rotate 90° ({Math.round((connector.rotationY * 180) / Math.PI)}°)</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 hover:border-red-400 hover:bg-red-100 transition"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Delete Connector</span>
        </button>
      </div>

      {/* Equipment Constraint & Transit Delay Notice */}
      <div className="mt-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-[11px] text-slate-600 dark:text-neutral-400">
        <div className="font-semibold text-slate-800 dark:text-neutral-200 mb-1">
          {connector.type === 'stairs' ? '🚶 Personil & Troli Saja' : '🚜 Bebas Alat Angkut'}
        </div>
        <p className="text-[10px] text-slate-500 dark:text-neutral-400 leading-relaxed">
          {isRestrictedForHeavyVehicles
            ? 'Tangga akses hanya dapat dilalui oleh manual trolley & personil. Forklift dan AGV otomatis menghindari rute tangga.'
            : 'Mendukung transit forklift, robot AGV, dan kargo berat antar tingkat lantai.'}
        </p>
      </div>
    </aside>
  );
}

export function PropertiesInspector({
  onOpenAisleGenerator,
  onOpenWmsHub,
}: {
  onOpenAisleGenerator?: (rack?: RackEntity) => void;
  onOpenWmsHub?: () => void;
} = {}) {
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId);
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const rack = useEditorStore((s) => s.racks.find((r) => r.id === s.selectedEntityId));
  const structure = useEditorStore((s) =>
    s.structuralElements.find((e) => e.id === s.selectedEntityId)
  );
  const zone = useEditorStore((s) => s.zones.find((z) => z.id === s.selectedEntityId));
  const connector = useEditorStore((s) =>
    (s.verticalConnectors ?? []).find((c) => c.id === s.selectedEntityId)
  );

  const [activeTab, setActiveTab] = useState<'properties' | 'facility'>('properties');
  const [warning, setWarning] = useState<string | null>(null);

  const hasSelection = selectedEntityIds.length > 1 || !!rack || !!structure || !!zone || !!connector;

  // Auto-switch to properties tab when an object is selected
  const [prevSelectedEntityId, setPrevSelectedEntityId] = useState(selectedEntityId);
  if (prevSelectedEntityId !== selectedEntityId) {
    setPrevSelectedEntityId(selectedEntityId);
    if (hasSelection) {
      setActiveTab('properties');
    }
  }

  useEffect(() => {
    if (!warning) return;
    const timer = setTimeout(() => setWarning(null), 3200);
    return () => clearTimeout(timer);
  }, [warning]);

  const renderContent = () => {
    if (activeTab === 'facility') {
      return <RoomSettingsInspector onShowWarning={(msg) => setWarning(msg)} />;
    }

    if (selectedEntityIds.length > 1) {
      return <MultiSelectionInspector />;
    }
    if (rack) {
      return (
        <RackPropertiesInspector
          rack={rack}
          onShowWarning={(msg) => setWarning(msg)}
          onOpenAisleGenerator={onOpenAisleGenerator}
        />
      );
    }
    if (structure) {
      return (
        <StructurePropertiesInspector
          element={structure}
          onShowWarning={(msg) => setWarning(msg)}
        />
      );
    }
    if (zone) {
      return <ZonePropertiesInspector zone={zone} onShowWarning={(msg) => setWarning(msg)} />;
    }
    if (connector) {
      return (
        <ConnectorPropertiesInspector
          connector={connector}
          onShowWarning={(msg) => setWarning(msg)}
        />
      );
    }

    // Contextual WMS Overview when no individual object is selected
    if (editorViewMode === 'WMS') {
      return <WmsCapacityOverviewInspector onOpenWmsHub={onOpenWmsHub} />;
    }

    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-neutral-500 space-y-3 select-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-900/90 border border-slate-200 dark:border-neutral-800 shadow-inner">
          <Target className="h-6 w-6 text-slate-400 dark:text-neutral-500" strokeWidth={1.5} />
        </div>
        <p className="text-xs font-bold text-slate-900 dark:text-neutral-200">No Object Selected</p>
        <p className="text-[11px] text-slate-500 dark:text-neutral-400 max-w-[210px] leading-relaxed">
          Click any rack, structural unit, or zone on the 3D floor or in the Scene Outliner to adjust its parameters.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-[210px]">
          {onOpenAisleGenerator && (
            <button
              type="button"
              onClick={() => onOpenAisleGenerator()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition shadow-sm"
            >
              <Grid className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Array Lorong</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('facility')}
            className="rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-100 dark:bg-neutral-800/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
          >
            Configure Facility Bounds →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      data-tour="properties-inspector"
      className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 select-none"
    >
      {/* Top Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/80 px-2 pt-2 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('properties')}
          className={`flex-1 rounded-t-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'properties'
              ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60'
              : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Properties</span>
          {hasSelection && (
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('facility')}
          className={`flex-1 rounded-t-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'facility'
              ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60'
              : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
          }`}
        >
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Facility & Grid</span>
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {renderContent()}
        {warning && (
          <div className="absolute bottom-4 left-4 right-4 z-20 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/95 dark:bg-red-950/95 p-3 text-xs text-red-700 dark:text-red-200 shadow-xl backdrop-blur-md animate-fade-in">
            {warning}
          </div>
        )}
      </div>
    </div>
  );
}


