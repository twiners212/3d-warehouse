'use client';

// Adaptive quick navigation and contextual moveset tips bar overlaid at the bottom of the canvas.
// Adapts dynamically to the active EditorViewMode (LAYOUT, WMS, PICKING) with full i18n support.

import { MousePointer, Keyboard, Boxes, Database, Route, Camera } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTranslation } from '@/lib/i18n';

export function CanvasQuickTips({ onOpenControls }: { onOpenControls: () => void }) {
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const { t } = useTranslation();
  const qt = t.quickTips;

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 select-none">
      {/* Quick interaction hints (Adaptive based on active mode) */}
      <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/85 px-3 py-1.5 shadow-xl backdrop-blur-md text-[11px] text-slate-700 dark:text-neutral-300">
        {editorViewMode === 'LAYOUT' && (
          <>
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-neutral-400">
              <MousePointer className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" strokeWidth={1.75} />
              <span>{qt?.layout?.orbit ?? 'Left: Orbit'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-500 dark:text-neutral-400">
              <span>{qt?.layout?.pan ?? 'Right: Pan'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-700 dark:text-neutral-300">
              <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">
                WASD
              </kbd>
              <span className="text-slate-500 dark:text-neutral-400">{qt?.layout?.wasdPan ?? 'Pan'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-700 dark:text-neutral-300">
              <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">
                F
              </kbd>
              <span className="text-slate-500 dark:text-neutral-400">{qt?.layout?.focus ?? 'Focus'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-700 dark:text-neutral-300">
              <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">
                R
              </kbd>
              <span className="text-slate-500 dark:text-neutral-400">{qt?.layout?.rotate ?? 'Rotate'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-700 dark:text-neutral-300">
              <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">
                Shift
              </kbd>
              <span className="text-slate-500 dark:text-neutral-400">{qt?.layout?.marquee ?? 'Multi-Select'}</span>
            </span>
          </>
        )}

        {editorViewMode === 'WMS' && (
          <>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <Boxes className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{qt?.wms?.clickBin ?? 'Click Bin: SKU Detail'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
              <span>{qt?.wms?.randomize ?? '⚡ Randomize'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
              <span>{qt?.wms?.heatmap ?? 'Heatmap Analytics'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-300 font-medium">
              <Database className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{qt?.wms?.dataHub ?? 'WMS Data Hub'}</span>
            </span>
          </>
        )}

        {editorViewMode === 'PICKING' && (
          <>
            <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium">
              <Route className="h-3.5 w-3.5" strokeWidth={1.75} />
              <kbd className="rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 font-mono text-[10px] text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                Space
              </kbd>
              <span>{qt?.picking?.playPause ?? 'Play/Pause'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
              <span>{qt?.picking?.addStop ?? 'Click Bin: Add Stop'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
              <span>{qt?.picking?.splitRoute ?? 'Drag Line: Split Route'}</span>
            </span>
            <span className="text-slate-300 dark:text-neutral-700">·</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
              <Camera className="h-3.5 w-3.5 text-purple-500" strokeWidth={1.75} />
              <span>{qt?.picking?.followCam ?? 'Follow Cam'}</span>
            </span>
          </>
        )}
      </div>

      {/* Button to open full cheat sheet modal */}
      <button
        type="button"
        onClick={onOpenControls}
        className="flex items-center gap-1.5 rounded-xl border border-sky-400/50 dark:border-sky-600/40 bg-white/90 dark:bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 shadow-xl backdrop-blur-md hover:bg-sky-50 dark:hover:bg-sky-950/80 hover:text-sky-900 dark:hover:text-white transition"
        title="Open complete moveset & keyboard shortcuts [? / H]"
      >
        <Keyboard className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>{qt?.movesetBtn ?? 'Moveset Guide'}</span>
        <kbd className="rounded bg-slate-100 dark:bg-neutral-800 px-1 py-0.2 font-mono text-[10px] text-slate-700 dark:text-neutral-300 border border-slate-300 dark:border-neutral-700">
          ?
        </kbd>
      </button>
    </div>
  );
}
