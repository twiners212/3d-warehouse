'use client';

// Fulfills Phase 36 & 41: Bottom Playback Controls Dock for Multi-Agent Fleet Simulation
// Provides Play/Pause, Rewind, Scrub Timeline, Speed Multiplier, Follow-Cam toggle, and Fleet Traffic Telemetry

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Navigation,
  Camera,
  AlertTriangle,
  Bot,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';

interface PickingPlaybackDockProps {
  onOpenControls?: () => void;
  onOpenSettings?: () => void;
}

export const PickingPlaybackDock: React.FC<PickingPlaybackDockProps> = ({
  onOpenControls,
}) => {
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const routeResult = useEditorStore((s) => s.routeResult);
  const pickList = useEditorStore((s) => s.pickList);
  const playbackState = useEditorStore((s) => s.playbackState);
  const togglePlayPause = useEditorStore((s) => s.togglePlayPause);
  const setPlaybackProgress = useEditorStore((s) => s.setPlaybackProgress);
  const resetPlayback = useEditorStore((s) => s.resetPlayback);
  const setPlaybackSpeed = useEditorStore((s) => s.setPlaybackSpeed);

  const fleet = useEditorStore((s) => s.fleet);
  const isFollowCamActive = useEditorStore((s) => s.isFollowCamActive);
  const toggleFollowCam = useEditorStore((s) => s.toggleFollowCam);
  const trafficAlerts = useEditorStore((s) => s.trafficAlerts);
  const selectedFleetAgentId = useEditorStore((s) => s.selectedFleetAgentId);

  if (editorViewMode !== 'PICKING') {
    return null;
  }

  // Fallback docked bar when no route is loaded yet
  if (!routeResult || routeResult.orderedPicks.length === 0) {
    return (
      <div className="flex h-9 items-center justify-between border-t border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 px-4 text-xs select-none backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="font-semibold text-purple-600 dark:text-purple-400 font-mono">
            RUTE & ARMADA
          </span>
          <span className="text-slate-300 dark:text-neutral-700">|</span>
          <span className="text-slate-600 dark:text-neutral-300 text-[11px]">
            {pickList.length === 0
              ? `Armada siap (${fleet.length} unit). Klik "Sample (8)" di panel kanan untuk mendispatch pesanan.`
              : `${pickList.length} slot dipilih. Klik "Sample (8)" atau tambah perhentian untuk memperbarui simulasi.`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onOpenControls && (
            <button
              type="button"
              onClick={onOpenControls}
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition"
              title="Panduan Kontrol 3D"
            >
              <Navigation className="h-3 w-3" />
              <span>Kontrol</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const { metrics, orderedPicks } = routeResult;
  const currentDistanceMeters =
    Math.round(playbackState.progress * metrics.totalDistanceMeters * 10) / 10;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const movingCount = fleet.filter((a) => a.status === 'MOVING').length;
  const yieldingCount = fleet.filter((a) => a.status === 'YIELDING').length;
  const chargingCount = fleet.filter((a) => a.status === 'CHARGING').length;

  return (
    <div className="flex h-12 items-center justify-between gap-3 border-t border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 px-3.5 text-xs text-slate-800 dark:text-slate-200 select-none z-20 backdrop-blur-md shrink-0 w-full">
      {/* Left: Play / Pause / Reset Buttons & Fleet Status */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={togglePlayPause}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20 transition active:scale-95"
          title={playbackState.isPlaying ? 'Pause Simulasi (Space)' : 'Mulai Simulasi (Space)'}
        >
          {playbackState.isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-white" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={resetPlayback}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition active:scale-95"
          title="Ulangi simulasi dari awal"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Fleet telemetry strip */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono pl-1 border-l border-slate-200 dark:border-neutral-800">
          <Bot className="h-3.5 w-3.5 text-cyan-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {movingCount} Aktif
          </span>
          {yieldingCount > 0 && (
            <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 font-bold border border-amber-500/40 text-[10px]">
              {yieldingCount} Yield
            </span>
          )}
          {chargingCount > 0 && (
            <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-500 font-bold text-[10px]">
              {chargingCount} Charge
            </span>
          )}
        </div>

        {/* Follow-Cam Toggle */}
        <button
          type="button"
          onClick={() => toggleFollowCam()}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
            isFollowCamActive
              ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
              : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:border-slate-400'
          }`}
          title="Kamera otomatis mengikuti pergerakan kendaraan terpilih"
        >
          <Camera className="h-3 w-3" />
          <span className="hidden sm:inline">Follow-Cam</span>
        </button>
      </div>

      {/* Center: Scrub Timeline Slider & Status Readout */}
      <div className="flex-1 min-w-[120px] max-w-xl flex flex-col justify-center gap-0.5 px-2">
        <div className="flex items-center justify-between text-[11px] font-mono leading-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 dark:text-neutral-400 truncate">
              {currentDistanceMeters}m / {metrics.totalDistanceMeters}m
            </span>
            {trafficAlerts.length > 0 && (
              <span className="hidden lg:flex items-center gap-1 text-[10px] text-amber-500 font-semibold animate-pulse truncate">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[160px]">{trafficAlerts[0].message}</span>
              </span>
            )}
          </div>
          <span className="text-sky-600 dark:text-sky-400 font-bold shrink-0 ml-2">
            {formatTime(playbackState.elapsedSeconds)} / {formatTime(metrics.estimatedDurationSeconds)}
          </span>
        </div>

        {/* Timeline Slider Range */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={playbackState.progress}
          onChange={(e) => setPlaybackProgress(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-lg bg-slate-200 dark:bg-neutral-800 accent-sky-500 cursor-pointer appearance-none"
        />
      </div>

      {/* Right: Speed Multipliers & Saved Metric Chip */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Speed 1x / 2x / 5x */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950 p-0.5">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                playbackState.playbackSpeed === speed
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Efficiency Chip */}
        {metrics.distanceSavedPercent > 0 && (
          <div className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            <Gauge className="h-3 w-3" />
            <span>-{metrics.distanceSavedPercent}% Hemat</span>
          </div>
        )}
      </div>
    </div>
  );
};
