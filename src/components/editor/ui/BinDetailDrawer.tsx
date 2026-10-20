'use client';

// Fulfills Phase 21 WMS Bin Inspection & Detail HUD.
// Slide-over drawer for inspecting, stocking, editing, and unstocking
// individual 3D bin compartments. All actions are undoable via ICommand.

import { useState } from 'react';
import {
  createUpdateBinOccupancyCommand,
  createUpdateBinSkuDataCommand,
} from '@/engine/commands/BinCommands';
import { generateMockSkuData } from '@/lib/constants/warehouse-defaults';
import { useEditorStore } from '@/stores/useEditorStore';
import type { BinSkuData, BinSlot, RackEntity } from '@/types/layout';
import { PackageCheck, PackageX, Shuffle, X, Plus } from 'lucide-react';

export function BinDetailDrawer() {
  const selectedBinId = useEditorStore((s) => s.selectedBinId);
  const racks = useEditorStore((s) => s.racks);

  if (!selectedBinId) return null;

  let foundRack: RackEntity | null = null;
  let foundBin: BinSlot | null = null;

  for (const r of racks) {
    const b = r.bins.find((slot) => slot.id === selectedBinId);
    if (b) {
      foundRack = r;
      foundBin = b;
      break;
    }
  }

  if (!foundBin || !foundRack) {
    return null;
  }

  return <BinDetailDrawerContent key={foundBin.id} foundBin={foundBin} foundRack={foundRack} />;
}

function BinDetailDrawerContent({
  foundBin,
  foundRack,
}: {
  foundBin: BinSlot;
  foundRack: RackEntity;
}) {
  const deselectBin = useEditorStore((s) => s.deselectBin);
  const executeCommand = useEditorStore((s) => s.executeCommand);

  // Local draft state for form fields
  const [prevSkuData, setPrevSkuData] = useState(foundBin.skuData);
  const [skuDraft, setSkuDraft] = useState(foundBin.skuData?.sku ?? '');
  const [nameDraft, setNameDraft] = useState(foundBin.skuData?.productName ?? '');
  const [qtyDraft, setQtyDraft] = useState(String(foundBin.skuData?.quantity ?? 0));
  const [unitDraft, setUnitDraft] = useState(foundBin.skuData?.unit ?? 'units');
  const [lotDraft, setLotDraft] = useState(foundBin.skuData?.lotNumber ?? '');
  const [weightDraft, setWeightDraft] = useState(String(foundBin.skuData?.weightKg ?? 0));
  const [maxWeightDraft, setMaxWeightDraft] = useState(String(foundBin.maxWeightKg ?? 1000));
  const [velocityDraft, setVelocityDraft] = useState<'A' | 'B' | 'C'>(
    foundBin.skuData?.velocityClass ?? 'B'
  );

  // Sync draft state during render if store updates for the same bin
  if (prevSkuData !== foundBin.skuData) {
    setPrevSkuData(foundBin.skuData);
    setSkuDraft(foundBin.skuData?.sku ?? '');
    setNameDraft(foundBin.skuData?.productName ?? '');
    setQtyDraft(String(foundBin.skuData?.quantity ?? 0));
    setUnitDraft(foundBin.skuData?.unit ?? 'units');
    setLotDraft(foundBin.skuData?.lotNumber ?? '');
    setWeightDraft(String(foundBin.skuData?.weightKg ?? 0));
    setMaxWeightDraft(String(foundBin.maxWeightKg ?? 1000));
    setVelocityDraft(foundBin.skuData?.velocityClass ?? 'B');
  }

  const isOccupied = foundBin.isOccupied;
  const currentWeight = foundBin.skuData?.weightKg ?? 0;
  const maxWeight = foundBin.maxWeightKg ?? 1000;
  const weightPercent = maxWeight > 0 ? Math.min(Math.round((currentWeight / maxWeight) * 100), 100) : 0;
  const isOverloaded = currentWeight > maxWeight;

  const handleToggleOccupancy = () => {
    if (!foundRack || !foundBin) return;
    if (isOccupied) {
      // Clear bin
      executeCommand(createUpdateBinOccupancyCommand(foundRack.id, foundBin.id, false));
    } else {
      // Stock bin with mock data
      const mock = generateMockSkuData(foundBin.id);
      executeCommand(createUpdateBinOccupancyCommand(foundRack.id, foundBin.id, true, mock));
    }
  };

  const handleStockPallet = () => {
    if (!foundRack || !foundBin) return;
    const mock = generateMockSkuData(foundBin.id);
    executeCommand(createUpdateBinOccupancyCommand(foundRack.id, foundBin.id, true, mock));
  };

  const handleClearBin = () => {
    if (!foundRack || !foundBin) return;
    executeCommand(createUpdateBinOccupancyCommand(foundRack.id, foundBin.id, false));
  };

  const handleCommitSkuForm = (overrideVelocity?: 'A' | 'B' | 'C') => {
    if (!foundRack || !foundBin) return;
    const updatedSku: BinSkuData = {
      sku: skuDraft.trim() || 'SKU-UNKNOWN',
      productName: nameDraft.trim() || 'General Cargo Material',
      quantity: Math.max(0, parseInt(qtyDraft, 10) || 0),
      unit: unitDraft.trim() || 'units',
      lotNumber: lotDraft.trim() || 'LOT-2026-01',
      weightKg: Math.max(0, parseFloat(weightDraft) || 0),
      velocityClass: overrideVelocity ?? velocityDraft,
    };
    const updatedMaxWeight = Math.max(10, parseFloat(maxWeightDraft) || 1000);

    executeCommand(
      createUpdateBinSkuDataCommand(foundRack.id, foundBin.id, updatedSku, updatedMaxWeight)
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-2xl backdrop-blur-xl animate-slide-left select-none text-slate-800 dark:text-neutral-100">
      {/* Drawer Header */}
      <div className="border-b border-slate-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <PackageCheck className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-neutral-100">
                {foundBin.id}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                Bay {foundBin.bayIndex} · Level {foundBin.levelIndex} ({foundRack.name})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={deselectBin}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:border-slate-300 hover:text-slate-900 dark:hover:border-neutral-600 dark:hover:text-white transition"
            title="Close Drawer (Esc)"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Occupancy Status Switch */}
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOccupied ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-neutral-600'
              }`}
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200">
              {isOccupied ? 'Slot Occupied' : 'Slot Empty / Available'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleOccupancy}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isOccupied ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-neutral-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isOccupied ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Weight & Capacity Gauge */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3.5 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-600 dark:text-neutral-400">Payload Utilization</span>
            <span
              className={`font-semibold ${
                isOverloaded
                  ? 'text-red-600 dark:text-red-400'
                  : weightPercent > 80
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isOccupied ? `${currentWeight.toFixed(1)} kg (${weightPercent}%)` : '0 kg (0%)'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                isOverloaded
                  ? 'bg-red-500'
                  : weightPercent > 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${isOccupied ? Math.min(weightPercent, 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 dark:text-neutral-500 pt-0.5">
            <span>Max Rating: {maxWeight} kg</span>
            <span>Volume: {(foundBin.dimension.width * foundBin.dimension.height * foundBin.dimension.depth).toFixed(2)} m³</span>
          </div>
          {isOverloaded && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/60 p-2 text-[11px] text-red-600 dark:text-red-300 font-medium flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Warning: Payload exceeds bin weight capacity rating!</span>
            </div>
          )}
        </div>

        {/* SKU Cargo Information */}
        {isOccupied ? (
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                Cargo & SKU Details
              </h3>
              <span className="rounded bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/50 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300">
                Active Pallet
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">Product Name</label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => handleCommitSkuForm()}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                  placeholder="Product Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">SKU Code</label>
                  <input
                    type="text"
                    value={skuDraft}
                    onChange={(e) => setSkuDraft(e.target.value)}
                    onBlur={() => handleCommitSkuForm()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">Lot Number</label>
                  <input
                    type="text"
                    value={lotDraft}
                    onChange={(e) => setLotDraft(e.target.value)}
                    onBlur={() => handleCommitSkuForm()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">Quantity</label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="number"
                      value={qtyDraft}
                      min={1}
                      max={10000}
                      onChange={(e) => setQtyDraft(e.target.value)}
                      onBlur={() => handleCommitSkuForm()}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-neutral-400">{unitDraft}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">Total Weight (kg)</label>
                  <input
                    type="number"
                    value={weightDraft}
                    min={0}
                    step={0.5}
                    onChange={(e) => setWeightDraft(e.target.value)}
                    onBlur={() => handleCommitSkuForm()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">ABC Turnover Velocity</label>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {(['A', 'B', 'C'] as const).map((cls) => {
                    const isSelected = velocityDraft === cls;
                    const label = cls === 'A' ? 'A (Fast)' : cls === 'B' ? 'B (Med)' : 'C (Slow)';
                    const activeStyle =
                      cls === 'A'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm'
                        : cls === 'B'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shadow-sm'
                        : 'border-slate-400 bg-slate-200 dark:border-slate-500 dark:bg-slate-800/80 text-slate-800 dark:text-slate-300 shadow-sm';
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          setVelocityDraft(cls);
                          handleCommitSkuForm(cls);
                        }}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                          isSelected
                            ? activeStyle
                            : 'border-slate-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800/60 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleStockPallet}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-white transition"
              >
                <Shuffle className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                <span>Re-randomize SKU</span>
              </button>
              <button
                type="button"
                onClick={handleClearBin}
                className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-300 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-100 dark:hover:bg-red-950/80 hover:text-red-700 dark:hover:text-white transition"
              >
                Clear Bin
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/30 p-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-neutral-800/80 text-slate-400 dark:text-neutral-500">
              <PackageX className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-800 dark:text-neutral-300">Compartment Currently Empty</h3>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-500 leading-relaxed">
                This bin slot is ready for pallet intake. Click below to stock a pallet with cargo.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStockPallet}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition shadow-lg shadow-sky-600/20"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Stock Pallet (EUR)</span>
            </button>
          </div>
        )}

        {/* Spatial Slot Specification */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3 text-xs space-y-1.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-500">
            Spatial Specifications
          </h4>
          <div className="flex justify-between text-slate-600 dark:text-neutral-400">
            <span>Dimensions (W×H×D):</span>
            <span className="font-semibold text-slate-800 dark:text-neutral-200">
              {foundBin.dimension.width.toFixed(2)}m × {foundBin.dimension.height.toFixed(2)}m × {foundBin.dimension.depth.toFixed(2)}m
            </span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-neutral-400">
            <span>Local Offset:</span>
            <span className="font-mono text-slate-700 dark:text-neutral-300 text-[11px]">
              ({foundBin.relativePosition.x.toFixed(2)}, {foundBin.relativePosition.y.toFixed(2)}, {foundBin.relativePosition.z.toFixed(2)})
            </span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-neutral-400">
            <span>Rack Type:</span>
            <span className="font-medium text-slate-700 dark:text-neutral-300">
              {foundRack.type.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="border-t border-slate-200 dark:border-neutral-800 p-3 bg-slate-50 dark:bg-neutral-950/60 text-center">
        <p className="text-[10px] text-slate-500 dark:text-neutral-500">
          Press <kbd className="rounded border border-slate-300 dark:border-neutral-700 bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 text-slate-700 dark:text-neutral-300 font-mono text-[9px]">Esc</kbd> to deselect bin · Undo with <kbd className="rounded border border-slate-300 dark:border-neutral-700 bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 text-slate-700 dark:text-neutral-300 font-mono text-[9px]">Ctrl+Z</kbd>
        </p>
      </div>
    </div>
  );
}
