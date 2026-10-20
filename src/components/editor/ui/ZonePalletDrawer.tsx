'use client';

// Fulfills Phase 39: WMS Zone Pallet Staging Drawer HUD.
// Slide-over drawer for inspecting, stocking, editing, and unstocking
// individual operational zone staging pallets. All actions are undoable via ICommand.

import { useEffect, useState } from 'react';
import {
  createUpdateZonePalletCommand,
} from '@/engine/commands/ZonePalletCommands';
import {
  generateMockZonePalletSku,
  calculateZonePalletSlots,
} from '@/engine/procedural/zone-pallet-generator';
import { useEditorStore } from '@/stores/useEditorStore';
import type { BinSkuData, WarehouseZone, ZonePalletSlot } from '@/types/layout';
import {
  PackageCheck,
  PackageX,
  Shuffle,
  X,
  Plus,
  Boxes,
  Weight,
  Layers,
  Sparkles,
} from 'lucide-react';

export function ZonePalletDrawer() {
  const selectedZonePallet = useEditorStore((s) => s.selectedZonePallet);
  const deselectZonePallet = useEditorStore((s) => s.deselectZonePallet);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const zones = useEditorStore((s) => s.zones);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);

  // Only active in WMS mode with a valid selected zone pallet
  if (!selectedZonePallet || editorViewMode !== 'WMS') {
    return null;
  }

  const { zoneId, palletId } = selectedZonePallet;
  const foundZone: WarehouseZone | undefined = zones.find((z) => z.id === zoneId);
  if (!foundZone) {
    return null;
  }

  // Find the target slot either in persisted slots or procedural slots
  const slots = foundZone.stagingConfig?.slots ?? calculateZonePalletSlots(foundZone);
  const foundSlot: ZonePalletSlot | undefined = slots.find((s) => s.id === palletId);
  if (!foundSlot) {
    return null;
  }

  return (
    <ZonePalletDrawerContent
      key={foundSlot.id}
      zone={foundZone}
      slot={foundSlot}
      onClose={deselectZonePallet}
      onExecute={executeCommand}
    />
  );
}

interface ZonePalletDrawerContentProps {
  zone: WarehouseZone;
  slot: ZonePalletSlot;
  onClose: () => void;
  onExecute: (command: ReturnType<typeof createUpdateZonePalletCommand>) => void;
}

function ZonePalletDrawerContent({
  zone,
  slot,
  onClose,
  onExecute,
}: ZonePalletDrawerContentProps) {
  const isOccupied = slot.isOccupied;
  const maxWeight = 1000; // Euro-pallet nominal standard dynamic payload (kg)
  const currentWeight = slot.skuData?.weightKg ?? 0;
  const weightPercent = maxWeight > 0 ? Math.min(Math.round((currentWeight / maxWeight) * 100), 100) : 0;
  const isOverloaded = currentWeight > maxWeight;

  // Local draft state for editing SKU information (remounted cleanly per slot via key)
  const [skuDraft, setSkuDraft] = useState(slot.skuData?.sku ?? '');
  const [nameDraft, setNameDraft] = useState(slot.skuData?.productName ?? '');
  const [qtyDraft, setQtyDraft] = useState(String(slot.skuData?.quantity ?? 0));
  const [unitDraft, setUnitDraft] = useState(slot.skuData?.unit ?? 'crates');
  const [lotDraft, setLotDraft] = useState(slot.skuData?.lotNumber ?? '');
  const [weightDraft, setWeightDraft] = useState(String(slot.skuData?.weightKg ?? 0));
  const [velocityDraft, setVelocityDraft] = useState<'A' | 'B' | 'C'>(slot.skuData?.velocityClass ?? 'B');

  const handleStockPallet = () => {
    const mock = generateMockZonePalletSku(zone.type, slot.slotIndex);
    onExecute(
      createUpdateZonePalletCommand(zone.id, slot.id, {
        isOccupied: true,
        skuData: mock,
      })
    );
  };

  const handleClearPallet = () => {
    onExecute(
      createUpdateZonePalletCommand(zone.id, slot.id, {
        isOccupied: false,
        skuData: undefined,
      })
    );
  };

  const handleRandomizePallet = () => {
    const mock = generateMockZonePalletSku(zone.type, Math.floor(Math.random() * 100) + 1);
    onExecute(
      createUpdateZonePalletCommand(zone.id, slot.id, {
        isOccupied: true,
        skuData: mock,
      })
    );
  };

  const handleCommitSkuForm = (overrideVelocity?: 'A' | 'B' | 'C') => {
    const updatedSku: BinSkuData = {
      sku: skuDraft.trim() || 'SKU-UNKNOWN',
      productName: nameDraft.trim() || 'General Freight Cargo',
      quantity: Math.max(0, parseInt(qtyDraft, 10) || 0),
      unit: unitDraft.trim() || 'crates',
      lotNumber: lotDraft.trim() || `LOT-${slot.id}`,
      weightKg: Math.max(0, parseFloat(weightDraft) || 0),
      velocityClass: overrideVelocity ?? velocityDraft,
    };

    onExecute(
      createUpdateZonePalletCommand(zone.id, slot.id, {
        isOccupied: true,
        skuData: updatedSku,
      })
    );
  };

  const getZoneCategoryBadge = () => {
    switch (zone.type) {
      case 'receiving':
        return { label: 'Inbound Staging', color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      case 'shipping':
        return { label: 'Outbound Dispatch', color: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30' };
      case 'picking':
        return { label: 'Picking Staging', color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      case 'quarantine':
        return { label: 'QC Quarantine', color: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      default:
        return { label: 'Operational Floor', color: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    }
  };

  const catBadge = getZoneCategoryBadge();

  return (
    <aside className="absolute right-0 top-12 bottom-8 z-30 flex w-88 flex-col border-l border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-200 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-amber-500" strokeWidth={2} />
            <h2 className="text-sm font-bold text-slate-900 dark:text-neutral-100 font-mono">
              {slot.id}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            {zone.name} · Row {slot.gridRow}, Col {slot.gridCol}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-600 dark:hover:text-neutral-200 transition"
          title="Tutup (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Badge & Actions */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400">Status Palet</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isOccupied ? 'bg-amber-400 animate-pulse' : 'bg-neutral-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-900 dark:text-neutral-200">
                {isOccupied ? 'Kargo Terisi' : 'Slot Kosong'}
              </span>
            </div>
          </div>
          <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${catBadge.color}`}>
            {catBadge.label}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {isOccupied ? (
            <button
              type="button"
              onClick={handleClearPallet}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shadow-sm"
            >
              <PackageX className="h-3.5 w-3.5 text-rose-500" />
              <span>Kosongkan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStockPallet}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-900/80 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-500" />
              <span>Isi Kargo</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRandomizePallet}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition shadow-sm"
          >
            <Shuffle className="h-3.5 w-3.5 text-amber-500" />
            <span>Acak Demo</span>
          </button>
        </div>

        {/* Pallet Payload & Weight Stress Meter */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-neutral-400">
              <Weight className="h-3.5 w-3.5 text-amber-500" />
              <span>Beban Muatan</span>
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-neutral-100">
              {currentWeight} / {maxWeight} kg ({weightPercent}%)
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                isOverloaded
                  ? 'bg-rose-500'
                  : weightPercent > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(weightPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-500">
            <span>Dimensi Palet: 1.2m × 1.0m</span>
            <span>Standar Euro/ISO</span>
          </div>
          {isOverloaded && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/60 p-2 text-[11px] text-red-600 dark:text-red-300 font-medium flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Peringatan: Muatan kargo melebihi kapasitas standar palet!</span>
            </div>
          )}
        </div>

        {/* SKU Cargo Information */}
        {isOccupied ? (
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                Detail SKU & Manifest
              </h3>
              <span className="rounded bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/50 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300">
                Staging Aktif
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                  Nama Barang / Material
                </label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => handleCommitSkuForm()}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                  placeholder="Nama Barang"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                    Kode SKU
                  </label>
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
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                    Nomor Lot
                  </label>
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
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                    Jumlah / Kuantitas
                  </label>
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
                    <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                      {unitDraft}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                    Berat Total (kg)
                  </label>
                  <input
                    type="number"
                    value={weightDraft}
                    min={0}
                    step={10}
                    onChange={(e) => setWeightDraft(e.target.value)}
                    onBlur={() => handleCommitSkuForm()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-neutral-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* ABC Velocity Classification */}
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                  Klasifikasi ABC Velocity
                </label>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {(['A', 'B', 'C'] as const).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        setVelocityDraft(cls);
                        handleCommitSkuForm(cls);
                      }}
                      className={`rounded-lg py-1.5 text-xs font-bold transition ${
                        velocityDraft === cls
                          ? cls === 'A'
                            ? 'bg-rose-500 text-white shadow'
                            : cls === 'B'
                            ? 'bg-amber-500 text-white shadow'
                            : 'bg-emerald-500 text-white shadow'
                          : 'border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      Class {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-neutral-800 p-6 text-center space-y-2">
            <PackageCheck className="h-8 w-8 text-slate-400 dark:text-neutral-600" />
            <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
              Palet Kosong
            </p>
            <p className="text-[11px] text-slate-500 dark:text-neutral-500 max-w-[200px]">
              Klik tombol &quot;Isi Kargo&quot; atau &quot;Acak Demo&quot; di atas untuk mengisi data kargo staging.
            </p>
          </div>
        )}

        {/* Footer Hint */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 text-[11px] text-slate-500 dark:text-neutral-400">
          <p className="font-semibold text-slate-700 dark:text-neutral-300 mb-1">
            Tips WMS Staging
          </p>
          Semua perubahan data kargo dan status palet tersimpan otomatis dan mendukung Undo/Redo (Ctrl+Z / Ctrl+Y).
        </div>
      </div>
    </aside>
  );
}
