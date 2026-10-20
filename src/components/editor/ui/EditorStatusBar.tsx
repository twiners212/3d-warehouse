'use client';

// Viewport Telemetry Status Bar docked at the bottom of the canvas.
// Provides live floor coordinates (X, Z), active snapping step,
// camera mode telemetry, scene entity counter, and shortcuts modal launcher.

import { useEffect, useState } from 'react';
import { telemetryBus, type CursorPosition } from '@/lib/telemetry/telemetry-bus';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatDistance } from '@/lib/i18n';
import { GraduationCap, Settings, Keyboard } from 'lucide-react';

interface EditorStatusBarProps {
  onOpenControls?: () => void;
  onOpenTour?: () => void;
  onOpenSettings?: () => void;
}

export function EditorStatusBar({ onOpenControls, onOpenTour, onOpenSettings }: EditorStatusBarProps) {
  const [cursorPos, setCursorPos] = useState<CursorPosition | null>(null);

  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const gridSnapStep = useEditorStore((s) => s.gridSnapStep);
  const isSnappingEnabled = useEditorStore((s) => s.isSnappingEnabled);
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const racksCount = useEditorStore((s) => s.racks.length);
  const structuresCount = useEditorStore((s) => s.structuralElements.length);
  const zonesCount = useEditorStore((s) => s.zones.length);

  const totalBins = useEditorStore((s) =>
    s.racks.reduce((acc, r) => acc + r.bins.length, 0)
  );

  useEffect(() => {
    return telemetryBus.subscribe((pos) => {
      setCursorPos(pos);
    });
  }, []);

  return (
    <div
      data-tour="telemetry-bar"
      className="flex h-7 items-center justify-between border-t border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-950/90 px-3 text-[11px] font-mono text-slate-600 dark:text-neutral-400 select-none backdrop-blur-md z-20"
    >
      {/* Left Group: Live Cursor Telemetry & Grid Snapping */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
          <span className="text-slate-500 dark:text-neutral-500 font-sans">Cursor:</span>
          {cursorPos ? (
            <span className="text-sky-600 dark:text-sky-300 font-semibold">
              X: {formatDistance(cursorPos.x, unitSystem)} <span className="text-slate-400 dark:text-neutral-600">|</span> Z: {formatDistance(cursorPos.z, unitSystem)}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-neutral-600 italic font-sans">Floor Hover Idle</span>
          )}
        </div>

        <div className="h-3 w-px bg-slate-200 dark:bg-neutral-800" />

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-neutral-500 font-sans">Snap:</span>
          <span
            className={`font-semibold ${
              isSnappingEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-neutral-500 line-through'
            }`}
          >
            {isSnappingEnabled ? `${gridSnapStep}m` : 'OFF'}
          </span>
        </div>

        <div className="h-3 w-px bg-slate-200 dark:bg-neutral-800" />

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-neutral-500 font-sans">Camera:</span>
          <span className="text-slate-800 dark:text-neutral-200">
            {cameraMode === 'PERSP_3D' ? '3D Perspective' : '2D Top-Down'}
          </span>
        </div>
      </div>

      {/* Right Group: Scene Entity Stats & Controls Modal Launcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-neutral-400">
          <span className="text-slate-500 dark:text-neutral-500 font-sans">Scene:</span>
          <span className="text-sky-600 dark:text-sky-400">{racksCount} Racks</span>
          <span className="text-slate-300 dark:text-neutral-700">·</span>
          <span className="text-amber-600 dark:text-amber-400">{totalBins} Bins</span>
          {structuresCount > 0 && (
            <>
              <span className="text-slate-300 dark:text-neutral-700">·</span>
              <span className="text-purple-600 dark:text-purple-400">{structuresCount} Structs</span>
            </>
          )}
          {zonesCount > 0 && (
            <>
              <span className="text-slate-300 dark:text-neutral-700">·</span>
              <span className="text-emerald-600 dark:text-emerald-400">{zonesCount} Zones</span>
            </>
          )}
        </div>

        <div className="h-3 w-px bg-slate-200 dark:bg-neutral-800" />

        {onOpenTour && (
          <button
            type="button"
            onClick={onOpenTour}
            className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition font-sans hover:bg-slate-100 dark:hover:bg-neutral-800/80 px-2 py-0.5 rounded"
            title="Mulai Panduan Langkah demi Langkah"
          >
            <GraduationCap className="h-3 w-3" strokeWidth={1.75} />
            <span className="text-[10px]">Panduan</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-sky-300 transition font-sans hover:bg-slate-100 dark:hover:bg-neutral-800/80 px-2 py-0.5 rounded"
            title="Pengaturan Sistem & Preferensi"
          >
            <Settings className="h-3 w-3" strokeWidth={1.75} />
            <span className="text-[10px]">Settings</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenControls}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-sky-300 transition font-sans hover:bg-slate-100 dark:hover:bg-neutral-800/80 px-2 py-0.5 rounded"
          title="Open Moveset & Keyboard Shortcuts (Press ? or H)"
        >
          <Keyboard className="h-3 w-3" strokeWidth={1.75} />
          <span className="text-[10px]">Shortcuts [?]</span>
        </button>
      </div>
    </div>
  );
}
