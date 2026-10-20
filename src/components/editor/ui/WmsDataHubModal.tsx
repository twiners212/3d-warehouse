'use client';

// Fulfills Phase 42: Integrated WMS Data Hub & Slotting Optimizer Modal.
// Features 3 Tabs:
// 1. Bulk Importer & Exporter (CSV, TSV, JSON, Direct Excel Paste, Column Mapping, Conflict Strategy)
// 2. Dynamic Slotting Optimizer (Multi-Objective Heuristics, Golden Zone, Heavy Item Clamping, Diff Preview)
// 3. ERP Webhook & REST Simulator (SAP S/4HANA, Odoo, Generic Enterprise REST, Live curl and testing)

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTranslation } from '@/lib/i18n';
import {
  parseSpreadsheetText,
  detectColumnMapping,
  validateAndTransformRows,
  exportFullWmsInventoryCsv,
  exportFullWmsInventoryTsv,
  exportFullWmsInventoryJson,
  triggerFileDownload,
  toBinSkuData,
  type NormalizedInventoryItem,
  type ColumnMapping,
} from '@/lib/io/wms-sync-io';
import {
  runDynamicSlottingOptimizer,
  DEFAULT_SLOTTING_OPTIONS,
  type SlottingResult,
} from '@/engine/slotting/slotting-optimizer';
import {
  createApplyWmsInventorySyncCommand,
  type BinSyncUpdate,
  type ZonePalletSyncUpdate,
} from '@/engine/commands/WmsSyncCommands';
import type { BinSkuData } from '@/types/layout';
import { buildBlueprintFromStore } from './TopNavToolbar';
import {
  X,
  FileSpreadsheet,
  FileJson,
  Upload,
  Copy,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Terminal,
  Send,
  Boxes,
  Zap,
} from 'lucide-react';

interface WmsDataHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

type TabType = 'IMPORT_EXPORT' | 'SLOTTING' | 'ERP_SYNC';

const SAMPLE_SPREADSHEET_DATA = `SKU\tNama Barang\tKuantitas\tSatuan\tNomor Lot\tBerat (kg)\tKelas ABC
SKU-ELEC-001\tSmartphone Flagship Pro\t250\tpcs\tLOT-2026-09A\t0.35\tA
SKU-ELEC-002\tLaptop Ultra 16-inch\t80\tpcs\tLOT-2026-09B\t2.10\tA
SKU-IND-501\tBaja Plat Lembaran\t12\tpcs\tLOT-2026-09C\t48.50\tA
SKU-BEV-102\tAir Mineral Karton (24x)\t50\tbox\tLOT-2026-09D\t14.20\tA
SKU-FASH-301\tKemeja Katun Pria L\t120\tpcs\tLOT-2026-09E\t0.40\tB
SKU-FASH-302\tCelana Jeans Denim\t95\tpcs\tLOT-2026-09F\t0.85\tB
SKU-MED-801\tMasker Medis N95 Box\t300\tbox\tLOT-2026-09G\t1.20\tB
SKU-CHEM-901\tCairan Pembersih Drum\t8\tdrum\tLOT-2026-09H\t32.00\tB
SKU-SPARE-401\tBaut & Mur Baja M12 (Set)\t500\tset\tLOT-2026-09I\t8.50\tC
SKU-TOOL-202\tKunci Pas Set 24pcs\t35\tset\tLOT-2026-09J\t4.80\tC
SKU-ACC-105\tKabel HDMI 2.1 3m\t150\tpcs\tLOT-2026-09K\t0.25\tC
SKU-IND-502\tBlok Motor Diesel Spare\t4\tunit\tLOT-2026-09L\t65.00\tC`;

function buildDefaultWebhookPayload(
  preset: 'SAP' | 'ODOO' | 'GENERIC',
  blueprintId: string
): string {
  if (preset === 'SAP') {
    return JSON.stringify(
      {
        blueprintId,
        syncMode: 'SLOTTING',
        sourceSystem: 'SAP_S4HANA_EWM',
        idocNumber: '000000984129',
        items: [
          { sku: 'SAP-MAT-1001', productName: 'Gearbox Assembly V8', quantity: 24, weightKg: 38.0, velocityClass: 'A' },
          { sku: 'SAP-MAT-2005', productName: 'Sensor Controller IC', quantity: 500, weightKg: 1.2, velocityClass: 'A' },
          { sku: 'SAP-MAT-3011', productName: 'Hydraulic Cylinder Seal', quantity: 120, weightKg: 8.5, velocityClass: 'B' },
          { sku: 'SAP-MAT-9904', productName: 'Heavy Steel Counterweight', quantity: 6, weightKg: 75.0, velocityClass: 'C' },
        ],
      },
      null,
      2
    );
  }
  if (preset === 'ODOO') {
    return JSON.stringify(
      {
        blueprintId,
        syncMode: 'UNALLOCATED',
        sourceSystem: 'ODOO_17_COMMUNITY',
        pickingType: 'incoming',
        items: [
          { sku: 'ODOO-PRD-401', productName: 'Organic Arabica Coffee 1kg', quantity: 150, weightKg: 1.05, velocityClass: 'A' },
          { sku: 'ODOO-PRD-402', productName: 'Robusta Green Beans Bag', quantity: 40, weightKg: 30.0, velocityClass: 'A' },
          { sku: 'ODOO-PRD-808', productName: 'Espresso Grinder Commercial', quantity: 15, weightKg: 18.0, velocityClass: 'B' },
        ],
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      blueprintId,
      syncMode: 'DIRECT',
      conflictStrategy: 'OVERWRITE',
      items: [
        { binId: 'A01-01-01', sku: 'GEN-SKU-001', productName: 'Premium Office Ergonomic Chair', quantity: 20, weightKg: 16.5, velocityClass: 'A' },
        { binId: 'A01-01-02', sku: 'GEN-SKU-002', productName: 'Standing Desk Converter 48"', quantity: 15, weightKg: 28.0, velocityClass: 'A' },
      ],
    },
    null,
    2
  );
}

export function WmsDataHubModal({ isOpen, onClose, onShowToast }: WmsDataHubModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('IMPORT_EXPORT');

  // --- TAB 1: Import/Export State ---
  const [rawInputText, setRawInputText] = useState<string>('');
  const [conflictStrategy, setConflictStrategy] = useState<'OVERWRITE' | 'SKIP'>('OVERWRITE');
  const [unallocatedPool, setUnallocatedPool] = useState<BinSkuData[]>([]);

  // --- TAB 2: Slotting Optimizer State ---
  const [slottingOptions, setSlottingOptions] = useState(DEFAULT_SLOTTING_OPTIONS);
  const [slottingResult, setSlottingResult] = useState<SlottingResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // --- TAB 3: ERP Webhook Simulator State ---
  const [erpPreset, setErpPreset] = useState<'SAP' | 'ODOO' | 'GENERIC'>('SAP');
  const [webhookPayloadJson, setWebhookPayloadJson] = useState<string>(() => {
    const bpId = useEditorStore.getState().blueprintId || 'warehouse-blueprint-01';
    return buildDefaultWebhookPayload('SAP', bpId);
  });

  const handleSelectErpPreset = (preset: 'SAP' | 'ODOO' | 'GENERIC') => {
    setErpPreset(preset);
    const bpId = useEditorStore.getState().blueprintId || 'warehouse-blueprint-01';
    setWebhookPayloadJson(buildDefaultWebhookPayload(preset, bpId));
  };

  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<{
    status: number;
    body: unknown;
    timestamp: string;
  } | null>(null);

  // Parse raw text reactively
  const parseResult = useMemo(() => {
    if (!rawInputText.trim()) return null;
    const { headers, rows } = parseSpreadsheetText(rawInputText);
    const mapping: ColumnMapping = detectColumnMapping(headers);
    return validateAndTransformRows(rows, mapping, headers);
  }, [rawInputText]);

  // Handle Load Sample Data
  const handleLoadSample = () => {
    setRawInputText(SAMPLE_SPREADSHEET_DATA);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        if (file.name.endsWith('.json')) {
          try {
            const parsedJson = JSON.parse(content);
            const items = Array.isArray(parsedJson) ? parsedJson : parsedJson.items || [];
            if (Array.isArray(items)) {
              // Convert JSON array to TSV representation
              const headers = ['sku', 'product_name', 'quantity', 'unit', 'lot_number', 'weight_kg', 'velocity_class'];
              const lines = [headers.join('\t')];
              items.forEach((it: Record<string, unknown>) => {
                lines.push([
                  it.sku || it.item || '',
                  it.productName || it.product_name || it.name || '',
                  it.quantity || it.qty || 1,
                  it.unit || 'pcs',
                  it.lotNumber || it.lot_number || '',
                  it.weightKg || it.weight_kg || 10,
                  it.velocityClass || it.velocity_class || 'B',
                ].join('\t'));
              });
              setRawInputText(lines.join('\n'));
              return;
            }
          } catch {
            // fall through to raw string
          }
        }
        setRawInputText(content);
      }
    };
    reader.readAsText(file);
  };

  // Apply Direct Mapping Sync
  const handleApplyDirectSync = () => {
    if (!parseResult) return;
    const state = useEditorStore.getState();
    const binUpdates: BinSyncUpdate[] = [];
    const palletUpdates: ZonePalletSyncUpdate[] = [];

    // Map direct items to bins
    parseResult.directItems.forEach((item) => {
      if (!item.binId) return;

      // Check racks
      for (const rack of state.racks) {
        const bin = rack.bins.find((b) => b.id === item.binId);
        if (bin) {
          if (conflictStrategy === 'SKIP' && bin.isOccupied) {
            return;
          }
          binUpdates.push({
            rackId: rack.id,
            binId: bin.id,
            isOccupied: true,
            skuData: toBinSkuData(item),
          });
          return;
        }
      }

      // Check operational zone pallets
      for (const zone of state.zones) {
        const slot = zone.stagingConfig?.slots?.find((s) => s.id === item.binId);
        if (slot) {
          if (conflictStrategy === 'SKIP' && slot.isOccupied) {
            return;
          }
          palletUpdates.push({
            zoneId: zone.id,
            palletId: slot.id,
            isOccupied: true,
            skuData: toBinSkuData(item),
          });
          return;
        }
      }
    });

    // Feed unallocated items into Intake Pool
    if (parseResult.unallocatedItems.length > 0) {
      setUnallocatedPool((prev) => [
        ...prev,
        ...parseResult.unallocatedItems.map(toBinSkuData),
      ]);
    }

    if (binUpdates.length > 0 || palletUpdates.length > 0) {
      const cmd = createApplyWmsInventorySyncCommand(binUpdates, palletUpdates, {
        activateHeatmap: true,
        heatmapMetric: 'ABC_VELOCITY',
      });
      state.executeCommand(cmd);

      const msg = t.wmsHub.syncSuccessToast
        .replace('{bins}', binUpdates.length.toString())
        .replace('{pallets}', palletUpdates.length.toString());
      onShowToast?.(msg);
    } else if (parseResult.unallocatedItems.length > 0) {
      onShowToast?.(`${parseResult.unallocatedItems.length} barang masuk antrean alokasi lepas. Beralih ke Tab Slotting.`);
      setActiveTab('SLOTTING');
    }
  };

  // Run Slotting Optimizer
  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const state = useEditorStore.getState();
      const blueprint = buildBlueprintFromStore(state, state.blueprintId || 'wms-active');

      // Use either unallocated pool from Tab 1, or sample dataset if empty
      let targetSkus = unallocatedPool;
      if (targetSkus.length === 0 && parseResult && parseResult.unallocatedItems.length > 0) {
        targetSkus = parseResult.unallocatedItems.map(toBinSkuData);
      }
      if (targetSkus.length === 0) {
        // Fallback to sample items for rich demonstration
        const { rows } = parseSpreadsheetText(SAMPLE_SPREADSHEET_DATA);
        const validated = validateAndTransformRows(rows, detectColumnMapping(rows[0]?.raw || []));
        targetSkus = validated.unallocatedItems.map(toBinSkuData);
      }

      const res = runDynamicSlottingOptimizer(blueprint, targetSkus, slottingOptions);
      setSlottingResult(res);
      setIsOptimizing(false);
    }, 200);
  };

  // Apply Slotting Allocations to 3D Canvas
  const handleApplySlotting = () => {
    if (!slottingResult || slottingResult.allocations.length === 0) return;
    const state = useEditorStore.getState();

    const binUpdates: BinSyncUpdate[] = [];
    const palletUpdates: ZonePalletSyncUpdate[] = [];

    slottingResult.allocations.forEach((alloc) => {
      if (alloc.type === 'RACK_BIN') {
        binUpdates.push({
          rackId: alloc.entityId,
          binId: alloc.slotId,
          isOccupied: true,
          skuData: alloc.skuData,
        });
      } else {
        palletUpdates.push({
          zoneId: alloc.entityId,
          palletId: alloc.slotId,
          isOccupied: true,
          skuData: alloc.skuData,
        });
      }
    });

    const cmd = createApplyWmsInventorySyncCommand(binUpdates, palletUpdates, {
      activateHeatmap: true,
      heatmapMetric: 'ABC_VELOCITY',
    });
    state.executeCommand(cmd);

    // Clear allocated items from pool
    setUnallocatedPool([]);

    const msg = t.wmsHub.slottingSuccessToast
      .replace('{count}', slottingResult.allocations.length.toString())
      .replace('{pct}', slottingResult.metrics.estimatedEfficiencyGainPct.toString());
    onShowToast?.(msg);
    onClose();
  };

  // Send Test Webhook
  const handleSendTestWebhook = async () => {
    setIsSendingWebhook(true);
    try {
      const parsed = JSON.parse(webhookPayloadJson);
      const res = await fetch('/api/wms/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wms-demo-secret-key',
        },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setWebhookResponse({
        status: res.status,
        body: data,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setWebhookResponse({
        status: 500,
        body: { error: err instanceof Error ? err.message : 'Network error' },
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Copy cURL Snippet
  const handleCopyCurl = () => {
    const curl = `curl -X POST "${window.location.origin}/api/wms/sync" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer wms-demo-secret-key" \\
  -d '${webhookPayloadJson.replace(/'/g, "'\\''")}'`;
    navigator.clipboard.writeText(curl);
    onShowToast?.(t.wmsHub.copiedToast);
  };

  // Handle Full Facility Inventory Exports
  const handleExportCsv = () => {
    const state = useEditorStore.getState();
    const blueprint = buildBlueprintFromStore(state, state.blueprintId || 'wms-export');
    const csv = exportFullWmsInventoryCsv(blueprint);
    triggerFileDownload(csv, `${blueprint.name.toLowerCase().replace(/\s+/g, '-')}-full-inventory.csv`, 'text/csv');
  };

  const handleExportTsv = () => {
    const state = useEditorStore.getState();
    const blueprint = buildBlueprintFromStore(state, state.blueprintId || 'wms-export');
    const tsv = exportFullWmsInventoryTsv(blueprint);
    triggerFileDownload(tsv, `${blueprint.name.toLowerCase().replace(/\s+/g, '-')}-inventory-excel.tsv`, 'text/tab-separated-values');
  };

  const handleExportJson = () => {
    const state = useEditorStore.getState();
    const blueprint = buildBlueprintFromStore(state, state.blueprintId || 'wms-export');
    const json = exportFullWmsInventoryJson(blueprint);
    triggerFileDownload(json, `${blueprint.name.toLowerCase().replace(/\s+/g, '-')}-inventory.json`, 'application/json');
  };

  const handleCopyTsv = () => {
    const state = useEditorStore.getState();
    const blueprint = buildBlueprintFromStore(state, state.blueprintId || 'wms-export');
    const tsv = exportFullWmsInventoryTsv(blueprint);
    navigator.clipboard.writeText(tsv);
    onShowToast?.(t.wmsHub.copiedToast);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative flex flex-col h-[90vh] w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 px-6 py-4 bg-slate-50/80 dark:bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20">
              <Database className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                {t.wmsHub.title}
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Phase 42 ERP
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {t.wmsHub.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-neutral-800 px-6 pt-3 bg-slate-50/50 dark:bg-neutral-900/50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('IMPORT_EXPORT')}
            className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition ${
              activeTab === 'IMPORT_EXPORT'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t.wmsHub.tabImportExport}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SLOTTING')}
            className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition ${
              activeTab === 'SLOTTING'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>{t.wmsHub.tabSlotting}</span>
            {unallocatedPool.length > 0 && (
              <span className="rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-mono">
                {unallocatedPool.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ERP_SYNC')}
            className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition ${
              activeTab === 'ERP_SYNC'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>{t.wmsHub.tabErpSync}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ======================================================== */}
          {/* TAB 1: BULK IMPORT & EXPORT */}
          {/* ======================================================== */}
          {activeTab === 'IMPORT_EXPORT' && (
            <div className="space-y-5">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-500 transition shadow-sm">
                    <Upload className="h-3.5 w-3.5 text-amber-500" />
                    <span>{t.wmsHub.uploadBtn}</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t.wmsHub.sampleBtn}</span>
                  </button>

                  {rawInputText && (
                    <button
                      type="button"
                      onClick={() => setRawInputText('')}
                      className="text-xs text-slate-400 hover:text-rose-500 transition px-2"
                    >
                      {t.wmsHub.clearBtn}
                    </button>
                  )}
                </div>

                {/* Conflict Resolution Strategy */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-neutral-400 font-medium">
                    {t.wmsHub.conflictStrategy}:
                  </span>
                  <div className="flex rounded-xl bg-slate-100 dark:bg-neutral-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setConflictStrategy('OVERWRITE')}
                      className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition ${
                        conflictStrategy === 'OVERWRITE'
                          ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm font-semibold'
                          : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {t.wmsHub.overwriteOption}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflictStrategy('SKIP')}
                      className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition ${
                        conflictStrategy === 'SKIP'
                          ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm font-semibold'
                          : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {t.wmsHub.skipOption}
                    </button>
                  </div>
                </div>
              </div>

              {/* Paste Textarea */}
              <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-3 shadow-inner">
                <textarea
                  rows={5}
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder={t.wmsHub.pastePlaceholder}
                  className="w-full bg-transparent text-xs font-mono text-slate-800 dark:text-neutral-200 focus:outline-none resize-none"
                />
              </div>

              {/* Parsing & Validation Summary Banner */}
              {parseResult && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3.5 shadow-sm text-xs">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Baris</span>
                        <span className="font-bold font-mono text-slate-800 dark:text-neutral-100">
                          {parseResult.totalRows}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-200 dark:border-neutral-800" />
                      <div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                          {t.wmsHub.directMappedCount}
                        </span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {parseResult.directItems.length}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-200 dark:border-neutral-800" />
                      <div>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                          {t.wmsHub.unallocatedCount}
                        </span>
                        <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                          {parseResult.unallocatedItems.length}
                        </span>
                      </div>
                      {parseResult.errors.length > 0 && (
                        <>
                          <div className="h-6 w-px bg-slate-200 dark:border-neutral-800" />
                          <div>
                            <span className="text-[10px] text-rose-500 uppercase tracking-wider block">
                              {t.wmsHub.errorsFound}
                            </span>
                            <span className="font-bold font-mono text-rose-500">
                              {parseResult.errors.length}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyDirectSync}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 text-xs shadow-md shadow-amber-500/20 transition"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{t.wmsHub.applySyncBtn}</span>
                    </button>
                  </div>

                  {/* Preview Table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 dark:bg-neutral-800/80 sticky top-0 border-b border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 font-semibold">
                          <tr>
                            <th className="py-2 px-3">Tipe</th>
                            <th className="py-2 px-3">Lokasi (Bin)</th>
                            <th className="py-2 px-3">SKU</th>
                            <th className="py-2 px-3">Nama Barang</th>
                            <th className="py-2 px-3">Qty</th>
                            <th className="py-2 px-3">Berat (kg)</th>
                            <th className="py-2 px-3">Kelas ABC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 font-mono text-slate-700 dark:text-neutral-300">
                          {[...parseResult.directItems, ...parseResult.unallocatedItems].map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/40">
                              <td className="py-1.5 px-3">
                                {item.binId ? (
                                  <span className="rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                                    Direct
                                  </span>
                                ) : (
                                  <span className="rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                                    Intake
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-3 text-slate-500">{item.binId || '—'}</td>
                              <td className="py-1.5 px-3 font-semibold text-slate-900 dark:text-neutral-100">{item.sku}</td>
                              <td className="py-1.5 px-3 font-sans truncate max-w-[150px]">{item.productName}</td>
                              <td className="py-1.5 px-3">{item.quantity} {item.unit}</td>
                              <td className="py-1.5 px-3">{item.weightKg} kg</td>
                              <td className="py-1.5 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    item.velocityClass === 'A'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : item.velocityClass === 'B'
                                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {item.velocityClass}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Facility Export Tools */}
              <div className="border-t border-slate-200 dark:border-neutral-800 pt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-neutral-400">
                  Ekspor inventaris gudang saat ini (Rak & Zona Staging):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-500 transition shadow-sm"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{t.wmsHub.exportCsvBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportTsv}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-500 transition shadow-sm"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-sky-500" />
                    <span>{t.wmsHub.exportTsvBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-500 transition shadow-sm"
                  >
                    <FileJson className="h-3.5 w-3.5 text-amber-500" />
                    <span>{t.wmsHub.exportJsonBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTsv}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-500 transition shadow-sm"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t.wmsHub.copyClipboardBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: DYNAMIC SLOTTING OPTIMIZER */}
          {/* ======================================================== */}
          {activeTab === 'SLOTTING' && (
            <div className="space-y-5">
              {/* Heuristics Configuration Card */}
              <div className="rounded-2xl border border-amber-200/80 dark:border-neutral-800 bg-amber-50/40 dark:bg-neutral-900/60 p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-200">
                      Parameter Heuristik Slotting Cerdas
                    </h3>
                  </div>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                    {unallocatedPool.length} Barang Siap Dialokasikan
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  {/* Golden Zone */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">
                      {t.wmsHub.goldenZoneToggle}
                    </span>
                    <input
                      type="checkbox"
                      checked={slottingOptions.goldenZoneLevels.length > 0}
                      onChange={(e) =>
                        setSlottingOptions((prev) => ({
                          ...prev,
                          goldenZoneLevels: e.target.checked ? [1, 2] : [],
                        }))
                      }
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                  </label>

                  {/* Heavy Clamping */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">
                      {t.wmsHub.heavyClampingToggle}
                    </span>
                    <input
                      type="checkbox"
                      checked={slottingOptions.heavyThresholdKg <= 25}
                      onChange={(e) =>
                        setSlottingOptions((prev) => ({
                          ...prev,
                          heavyThresholdKg: e.target.checked ? 25 : 1000,
                        }))
                      }
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                  </label>

                  {/* Mezzanine Limits */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">
                      {t.wmsHub.mezzanineSafetyToggle}
                    </span>
                    <input
                      type="checkbox"
                      checked={slottingOptions.respectMezzanineLimits}
                      onChange={(e) =>
                        setSlottingOptions((prev) => ({
                          ...prev,
                          respectMezzanineLimits: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                  </label>

                  {/* Proximity Slider */}
                  <div className="flex flex-col justify-center p-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-neutral-300">
                      <span>{t.wmsHub.proximityWeightLabel}</span>
                      <span className="font-mono text-amber-600">{Math.round(slottingOptions.proximityWeight * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.1}
                      value={slottingOptions.proximityWeight}
                      onChange={(e) =>
                        setSlottingOptions((prev) => ({
                          ...prev,
                          proximityWeight: parseFloat(e.target.value),
                        }))
                      }
                      className="h-1.5 w-full rounded bg-slate-200 dark:bg-neutral-800 accent-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={isOptimizing}
                    onClick={handleRunOptimizer}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 text-xs shadow-md shadow-amber-500/20 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
                    <span>{t.wmsHub.runOptimizerBtn}</span>
                  </button>
                </div>
              </div>

              {/* Slotting Result Metrics */}
              {slottingResult && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-sm">
                      <span className="text-[10px] text-slate-400 block">{t.wmsHub.allocatedMetric}</span>
                      <span className="text-lg font-bold font-mono text-slate-900 dark:text-neutral-100">
                        {slottingResult.metrics.allocatedCount} / {slottingResult.metrics.allocatedCount + slottingResult.metrics.unallocatedCount}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 dark:border-neutral-800 bg-emerald-50/30 dark:bg-neutral-900 p-3 shadow-sm">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">{t.wmsHub.goldenZoneMetric}</span>
                      <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {slottingResult.metrics.classACount} SKU
                      </span>
                    </div>
                    <div className="rounded-2xl border border-sky-200 dark:border-neutral-800 bg-sky-50/30 dark:bg-neutral-900 p-3 shadow-sm">
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 block">{t.wmsHub.heavyClampedMetric}</span>
                      <span className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400">
                        {slottingResult.metrics.heavyClampedCount} Slot
                      </span>
                    </div>
                    <div className="rounded-2xl border border-amber-200 dark:border-neutral-800 bg-amber-50/30 dark:bg-neutral-900 p-3 shadow-sm">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block">{t.wmsHub.efficiencyGainMetric}</span>
                      <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                        +{slottingResult.metrics.estimatedEfficiencyGainPct}%
                      </span>
                    </div>
                  </div>

                  {/* Proposed Allocations Table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 dark:bg-neutral-800/80 sticky top-0 border-b border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 font-semibold">
                          <tr>
                            <th className="py-2 px-3">Slot Ditugaskan</th>
                            <th className="py-2 px-3">Kelas</th>
                            <th className="py-2 px-3">SKU & Barang</th>
                            <th className="py-2 px-3">Jarak ke Dock</th>
                            <th className="py-2 px-3">Alasan Penempatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 font-mono text-slate-700 dark:text-neutral-300">
                          {slottingResult.allocations.map((a, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/40">
                              <td className="py-1.5 px-3 font-semibold text-slate-900 dark:text-neutral-100">
                                {a.slotId}
                              </td>
                              <td className="py-1.5 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    a.skuData.velocityClass === 'A'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : a.skuData.velocityClass === 'B'
                                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {a.skuData.velocityClass}
                                </span>
                              </td>
                              <td className="py-1.5 px-3">
                                <div>{a.skuData.sku}</div>
                                <div className="text-[10px] font-sans text-slate-500 truncate max-w-[140px]">
                                  {a.skuData.productName} ({a.skuData.weightKg}kg)
                                </div>
                              </td>
                              <td className="py-1.5 px-3">{a.distanceM} m</td>
                              <td className="py-1.5 px-3 font-sans text-slate-600 dark:text-neutral-400 text-[10px]">
                                {a.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplySlotting}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold px-5 py-2.5 text-xs shadow-lg shadow-amber-500/25 transition"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{t.wmsHub.applySlottingBtn}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ERP WEBHOOK & REST SIMULATOR */}
          {/* ======================================================== */}
          {activeTab === 'ERP_SYNC' && (
            <div className="space-y-4">
              {/* Preset Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-neutral-400 font-medium">{t.wmsHub.presetLabel}:</span>
                  <div className="flex rounded-xl bg-slate-100 dark:bg-neutral-800 p-0.5 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSelectErpPreset('SAP')}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        erpPreset === 'SAP'
                          ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {t.wmsHub.sapPreset}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectErpPreset('ODOO')}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        erpPreset === 'ODOO'
                          ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {t.wmsHub.odooPreset}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectErpPreset('GENERIC')}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        erpPreset === 'GENERIC'
                          ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {t.wmsHub.genericPreset}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-amber-500 transition shadow-sm"
                >
                  <Terminal className="h-3.5 w-3.5 text-amber-500" />
                  <span>{t.wmsHub.copyCurlBtn}</span>
                </button>
              </div>

              {/* Endpoint Documentation Pill */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/40 p-2.5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500 text-white px-1.5 py-0.5 text-[10px] font-bold">
                    POST
                  </span>
                  <span className="text-slate-700 dark:text-neutral-300">/api/wms/sync</span>
                </div>
                <span className="text-[11px] text-slate-400">Header: Authorization: Bearer wms-demo-secret-key</span>
              </div>

              {/* JSON Payload Textarea */}
              <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-900 text-slate-100 p-3 shadow-inner">
                <textarea
                  rows={8}
                  value={webhookPayloadJson}
                  onChange={(e) => setWebhookPayloadJson(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono focus:outline-none resize-none text-emerald-400"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isSendingWebhook}
                  onClick={handleSendTestWebhook}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 text-xs shadow-md shadow-amber-500/20 transition"
                >
                  <Send className={`h-3.5 w-3.5 ${isSendingWebhook ? 'animate-pulse' : ''}`} />
                  <span>{t.wmsHub.testWebhookBtn}</span>
                </button>
              </div>

              {/* Live Webhook Response Log */}
              {webhookResponse && (
                <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-2 shadow-sm animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          webhookResponse.status === 200
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {webhookResponse.status} {webhookResponse.status === 200 ? 'OK' : 'ERROR'}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-neutral-200">
                        {t.wmsHub.webhookResponseTitle}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{webhookResponse.timestamp}</span>
                  </div>
                  <pre className="rounded-xl bg-slate-50 dark:bg-neutral-950/80 p-3 text-[11px] font-mono text-slate-700 dark:text-neutral-300 overflow-x-auto border border-slate-200/80 dark:border-neutral-800">
                    {JSON.stringify(webhookResponse.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
