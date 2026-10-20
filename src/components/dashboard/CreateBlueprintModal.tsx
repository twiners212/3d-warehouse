'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { persistWarehouseLayout } from '@/app/actions/layout-actions';
import { WAREHOUSE_TEMPLATES, type WarehouseTemplateDefinition } from '@/lib/templates/warehouse-templates';
import {
  Warehouse,
  X,
  Sparkles,
  Ruler,
  SquareDashed,
  Boxes,
  Snowflake,
  Building2,
} from 'lucide-react';

function renderTemplateIcon(id: string) {
  switch (id) {
    case 'blank':
      return <SquareDashed className="h-6 w-6 text-slate-500" strokeWidth={1.75} />;
    case 'ecommerce_hub':
      return <Boxes className="h-6 w-6 text-sky-500" strokeWidth={1.75} />;
    case 'cold_storage':
      return <Snowflake className="h-6 w-6 text-teal-500" strokeWidth={1.75} />;
    case 'heavy_industrial':
      return <Building2 className="h-6 w-6 text-amber-500" strokeWidth={1.75} />;
    default:
      return <Warehouse className="h-6 w-6 text-sky-500" strokeWidth={1.75} />;
  }
}

function newBlueprintId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface CreateBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBlueprintModal({ isOpen, onClose }: CreateBlueprintModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'templates' | 'custom'>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ecommerce_hub');
  const [facilityName, setFacilityName] = useState<string>('');
  const [customWidth, setCustomWidth] = useState<number>(60);
  const [customDepth, setCustomDepth] = useState<number>(40);
  const [customHeight, setCustomHeight] = useState<number>(10);
  const [customSnap, setCustomSnap] = useState<number>(0.5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedTemplate = WAREHOUSE_TEMPLATES.find((t) => t.id === selectedTemplateId) || WAREHOUSE_TEMPLATES[0];

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);
    const id = newBlueprintId();

    try {
      let blueprint;
      if (activeTab === 'templates') {
        blueprint = selectedTemplate.createBlueprint(id, facilityName.trim() || undefined);
      } else {
        const now = new Date().toISOString();
        blueprint = {
          id,
          name: facilityName.trim() || 'Custom Facility',
          gridSnapStep: customSnap,
          floorDimensions: {
            width: Math.max(10, Math.min(300, customWidth)),
            height: Math.max(4, Math.min(30, customHeight)),
            depth: Math.max(10, Math.min(300, customDepth)),
          },
          zones: [],
          structuralElements: [],
          racks: [],
          createdAt: now,
          updatedAt: now,
        };
      }

      const res = await persistWarehouseLayout(blueprint);
      if (res.success) {
        router.push(`/editor/${id}`);
      } else {
        setError(res.error || 'Failed to create layout');
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-4 backdrop-blur-md animate-fade-in select-none">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/95 shadow-2xl shadow-slate-900/20 dark:shadow-sky-950/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 px-6 py-4 bg-slate-50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/40">
              <Warehouse className="h-5 w-5 text-sky-600 dark:text-sky-400" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-neutral-100">Create New Warehouse Blueprint</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">Choose a pre-configured industrial template or specify custom bounds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-neutral-800 px-6 pt-3 bg-slate-50/50 dark:bg-neutral-950/20 gap-2">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'templates'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Starter Templates (4)</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'custom'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Custom Dimensions</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/60 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Facility Name Input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Facility / Blueprint Name
            </label>
            <input
              type="text"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder={
                activeTab === 'templates'
                  ? selectedTemplate.name
                  : 'Distribution Center 01'
              }
              className="w-full rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-50 dark:bg-neutral-950/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
            />
          </div>

          {activeTab === 'templates' ? (
            <div className="space-y-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300">
                Select Layout Template
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WAREHOUSE_TEMPLATES.map((tmpl) => {
                  const isSelected = tmpl.id === selectedTemplateId;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition text-left flex flex-col justify-between ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 shadow-md shadow-sky-950/40 ring-1 ring-sky-500/50'
                          : 'border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/40 hover:border-slate-300 dark:hover:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                            {renderTemplateIcon(tmpl.id)}
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tmpl.badgeColor}`}>
                            {tmpl.badge}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-neutral-100">{tmpl.name}</h4>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                          {tmpl.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                        <span className="font-mono text-slate-700 dark:text-neutral-300">
                          {tmpl.floorDimensions.width}×{tmpl.floorDimensions.depth}m
                        </span>
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">
                          {tmpl.estimatedRacks > 0 ? `${tmpl.estimatedRacks} Racks · ${tmpl.estimatedBins} Bins` : '0 Objects'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Template Detail Pill */}
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950/50 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-300 font-medium">
                  <span className="text-sky-600 dark:text-sky-400 font-bold">Includes:</span>
                  <span>{selectedTemplate.highlightSpecs.join(' · ')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-neutral-400 mb-1">
                    Floor Width (X)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={300}
                      step={1}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950/60 px-3 py-2 text-xs text-slate-900 dark:text-neutral-100 pr-8 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 dark:text-neutral-500 font-mono">m</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-neutral-400 mb-1">
                    Floor Depth (Z)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={300}
                      step={1}
                      value={customDepth}
                      onChange={(e) => setCustomDepth(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950/60 px-3 py-2 text-xs text-slate-900 dark:text-neutral-100 pr-8 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 dark:text-neutral-500 font-mono">m</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-neutral-400 mb-1">
                    Ceiling Height (Y)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={4}
                      max={30}
                      step={0.5}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950/60 px-3 py-2 text-xs text-slate-900 dark:text-neutral-100 pr-8 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 dark:text-neutral-500 font-mono">m</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-neutral-400 mb-1">
                  Grid Snapping Interval
                </label>
                <div className="flex gap-2">
                  {[0.25, 0.5, 1.0].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setCustomSnap(step)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-medium transition ${
                        customSnap === step
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 font-bold'
                          : 'border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950/40 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {step} meter
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-100 dark:bg-neutral-950/40 p-3 text-[11px] text-slate-600 dark:text-neutral-400">
                Total Operational Footprint:{' '}
                <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                  {(customWidth * customDepth).toLocaleString()} m²
                </span>{' '}
                · Clearance Volume:{' '}
                <span className="font-bold text-slate-800 dark:text-neutral-200 font-mono">
                  {(customWidth * customDepth * customHeight).toLocaleString()} m³
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-neutral-800 px-6 py-4 bg-slate-50 dark:bg-neutral-950/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800/80 px-4 py-2 text-xs font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-600/30 hover:from-sky-500 hover:to-blue-500 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Initializing Layout…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                <span>Create & Open 3D Editor</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
