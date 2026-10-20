'use client';

// Fulfills Phase 22: Visual Heatmap & WMS Analytics Layer.
// Floating HUD providing analytical mode switching ([Standard] | [Occupancy] | [Weight Stress] | [ABC Velocity]),
// live warehouse KPI telemetry, and a collapsible color gradient legend.

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import type { HeatmapMetric } from '@/types/layout';
import { HEATMAP_COLORS } from '@/lib/constants/warehouse-defaults';
import { Boxes, Activity, Scale, Zap, AlertTriangle, Minus, Plus } from 'lucide-react';

function renderMetricIcon(id: HeatmapMetric, className = 'h-3.5 w-3.5') {
  switch (id) {
    case 'NONE':
      return <Boxes className={className} strokeWidth={1.75} />;
    case 'OCCUPANCY':
      return <Activity className={className} strokeWidth={1.75} />;
    case 'WEIGHT_STRESS':
      return <Scale className={className} strokeWidth={1.75} />;
    case 'ABC_VELOCITY':
      return <Zap className={className} strokeWidth={1.75} />;
  }
}

const METRIC_OPTIONS: { id: HeatmapMetric; label: string; title: string }[] = [
  { id: 'NONE', label: 'Standard Cargo', title: 'Realistic wood pallets and kraft cardboard' },
  { id: 'OCCUPANCY', label: 'Occupancy %', title: 'Slot density gradient across rack bays' },
  { id: 'WEIGHT_STRESS', label: 'Weight Stress', title: 'Structural load capacity ratio and overload detection' },
  { id: 'ABC_VELOCITY', label: 'ABC Velocity', title: 'Fast (A), Medium (B), and Slow (C) turnover movers' },
];

export function HeatmapLegendHUD() {
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const heatmapMetric = useEditorStore((s) => s.heatmapMetric);
  const setHeatmapMetric = useEditorStore((s) => s.setHeatmapMetric);
  const racks = useEditorStore((s) => s.racks);

  const [isLegendExpanded, setIsLegendExpanded] = useState(true);

  // Compute live warehouse WMS metrics
  const stats = useMemo(() => {
    let totalBins = 0;
    let occupiedBins = 0;
    let totalWeightKg = 0;
    let countA = 0;
    let countB = 0;
    let countC = 0;
    let overloadedBins = 0;

    for (const rack of racks) {
      totalBins += rack.bins.length;
      for (const bin of rack.bins) {
        if (bin.isOccupied) {
          occupiedBins++;
          const weight = bin.skuData?.weightKg ?? 0;
          totalWeightKg += weight;
          if (weight > bin.maxWeightKg) {
            overloadedBins++;
          }
          const vel = bin.skuData?.velocityClass ?? 'C';
          if (vel === 'A') countA++;
          else if (vel === 'B') countB++;
          else countC++;
        }
      }
    }

    const utilizationPct = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0;
    const totalTonnes = (totalWeightKg / 1000).toFixed(1);

    return {
      totalBins,
      occupiedBins,
      utilizationPct,
      totalTonnes,
      countA,
      countB,
      countC,
      overloadedBins,
    };
  }, [racks]);

  // Only visible in WMS mode
  if (editorViewMode !== 'WMS') return null;

  return (
    <>
      {/* Bottom-Center Floating Analytics Mode Switcher */}
      <div className="pointer-events-auto absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 animate-fade-in select-none">
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200/90 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/90 p-1.5 shadow-2xl backdrop-blur-md">
          {METRIC_OPTIONS.map((opt) => {
            const isActive = heatmapMetric === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHeatmapMetric(opt.id)}
                title={opt.title}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {renderMetricIcon(opt.id, 'h-3.5 w-3.5')}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Telemetry Pill */}
        <div className="flex items-center gap-3 rounded-full border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/85 px-3.5 py-1 text-[11px] text-slate-600 dark:text-neutral-400 backdrop-blur-sm shadow-md">
          <span>
            Total Payload:{' '}
            <strong className="font-mono text-slate-900 dark:text-neutral-200">{stats.totalTonnes} tonnes</strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-700">•</span>
          <span>
            Utilization:{' '}
            <strong className="font-mono text-amber-600 dark:text-amber-300">{stats.utilizationPct}%</strong>
          </span>
          {stats.overloadedBins > 0 && (
            <>
              <span className="text-slate-300 dark:text-neutral-700">•</span>
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold animate-pulse">
                <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
                <span>{stats.overloadedBins} Overloaded</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Floating Collapsible Heatmap Legend (Bottom Right) */}
      {heatmapMetric !== 'NONE' && (
        <div className="pointer-events-auto absolute bottom-20 right-4 z-30 flex flex-col items-end gap-1.5 animate-fade-in select-none">
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-md w-60 text-slate-800 dark:text-neutral-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-neutral-200 flex items-center gap-1.5">
                {renderMetricIcon(heatmapMetric, 'h-3.5 w-3.5 text-amber-500')}
                <span>
                  {heatmapMetric === 'WEIGHT_STRESS' && 'Weight Stress Scale'}
                  {heatmapMetric === 'ABC_VELOCITY' && 'ABC Velocity Spectrum'}
                  {heatmapMetric === 'OCCUPANCY' && 'Occupancy Density'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                {isLegendExpanded ? (
                  <Minus className="h-3 w-3" strokeWidth={2} />
                ) : (
                  <Plus className="h-3 w-3" strokeWidth={2} />
                )}
              </button>
            </div>

            {isLegendExpanded && (
              <div className="mt-2.5 flex flex-col gap-1.5 text-[11px]">
                {heatmapMetric === 'WEIGHT_STRESS' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.WEIGHT.SAFE }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Safe Load</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">&lt; 50%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.WEIGHT.MODERATE }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Moderate</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">50% - 75%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.WEIGHT.WARNING }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Heavy</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">75% - 90%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.WEIGHT.CRITICAL }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Near Limit</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">90% - 100%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full animate-pulse"
                          style={{ backgroundColor: HEATMAP_COLORS.WEIGHT.OVERLOAD }}
                        />
                        <span className="text-purple-600 dark:text-purple-300 font-semibold">Overload Alert</span>
                      </span>
                      <span className="font-mono text-purple-600 dark:text-purple-300 font-bold">&gt; 100%</span>
                    </div>
                  </>
                )}

                {heatmapMetric === 'ABC_VELOCITY' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.ABC.A }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Class A (Fast Mover)</span>
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{stats.countA}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.ABC.B }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Class B (Medium Mover)</span>
                      </span>
                      <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{stats.countB}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.ABC.C }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Class C (Slow / Deadstock)</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">{stats.countC}</span>
                    </div>
                  </>
                )}

                {heatmapMetric === 'OCCUPANCY' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.OCCUPANCY.LOW }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Low Utilization</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">&lt; 40%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.OCCUPANCY.MEDIUM }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">Balanced Density</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">40% - 75%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: HEATMAP_COLORS.OCCUPANCY.HIGH }}
                        />
                        <span className="text-slate-700 dark:text-neutral-300">High Density</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-neutral-400">&gt; 75%</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
