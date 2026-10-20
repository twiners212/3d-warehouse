'use client';

// Floating glassmorphic Viewport HUD Toolbar placed over the 3D Canvas.
// Provides direct access to zoom, camera presets, focus framing, and snapping.

import { cameraBus } from '@/lib/camera/camera-bus';
import { useEditorStore } from '@/stores/useEditorStore';
import { Plus, Minus, Target, Home, Box, Compass, Magnet } from 'lucide-react';

export function ViewportToolbar() {
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId);
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const isSnappingEnabled = useEditorStore((s) => s.isSnappingEnabled);
  const toggleSnapping = useEditorStore((s) => s.toggleSnapping);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const setActiveLevelId = useEditorStore((s) => s.setActiveLevelId);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);
  const setFloorSliceMode = useEditorStore((s) => s.setFloorSliceMode);

  return (
    <div
      data-tour="viewport-controls"
      className="absolute top-4 right-4 z-20 flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/85 p-1.5 shadow-2xl backdrop-blur-md select-none text-slate-700 dark:text-neutral-100"
    >
      {/* Zoom Controls */}
      <button
        type="button"
        onClick={() => cameraBus.zoomIn()}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
        title="Zoom In (+ / Scroll)"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        onClick={() => cameraBus.zoomOut()}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
        title="Zoom Out (- / Scroll)"
      >
        <Minus className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-neutral-800" />

      {/* Focus Selected */}
      <button
        type="button"
        onClick={() => cameraBus.focusSelected()}
        disabled={!selectedEntityId}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
          selectedEntityId
            ? 'bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-600/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/80 hover:text-sky-900 dark:hover:text-white'
            : 'text-slate-400 dark:text-neutral-500 opacity-40 cursor-not-allowed'
        }`}
        title={selectedEntityId ? 'Focus Selected Object [F]' : 'Select an object to focus [F]'}
      >
        <Target className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Focus</span>
      </button>

      {/* Reset Overview */}
      <button
        type="button"
        onClick={() => cameraBus.resetOverview()}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
        title="Reset Warehouse Overview [Space / Home]"
      >
        <Home className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Overview</span>
      </button>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-neutral-800" />

      {/* Camera Presets */}
      <button
        type="button"
        onClick={() => cameraBus.setPreset('PERSP_3D')}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
          cameraMode === 'PERSP_3D'
            ? 'bg-slate-100 dark:bg-neutral-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-neutral-700'
            : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="3D Perspective View [3]"
      >
        <Box className="h-4 w-4" strokeWidth={1.75} />
        <span>3D</span>
      </button>

      <button
        type="button"
        onClick={() => cameraBus.setPreset('ORTHO_2D')}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
          cameraMode === 'ORTHO_2D'
            ? 'bg-slate-100 dark:bg-neutral-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-neutral-700'
            : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="2D Top-Down View [2]"
      >
        <Compass className="h-4 w-4" strokeWidth={1.75} />
        <span>2D</span>
      </button>

      <button
        type="button"
        onClick={() => cameraBus.setPreset('FRONT')}
        className="flex h-8 items-center rounded-lg px-2 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
        title="Front Ortho View [4]"
      >
        Front
      </button>

      <button
        type="button"
        onClick={() => cameraBus.setPreset('SIDE')}
        className="flex h-8 items-center rounded-lg px-2 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
        title="Side Ortho View [5]"
      >
        Side
      </button>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-neutral-800" />

      {/* Grid Snapping Toggle */}
      <button
        type="button"
        onClick={() => toggleSnapping()}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
          isSnappingEnabled
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
            : 'bg-slate-100 dark:bg-neutral-800/60 text-slate-600 dark:text-neutral-400 border border-slate-300 dark:border-neutral-700/40 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Toggle Grid Snapping [G]"
      >
        <Magnet className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Snap: {isSnappingEnabled ? 'ON' : 'OFF'}</span>
      </button>

      {/* Floor / Level Switcher */}
      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-neutral-800" />
      <div data-tour="level-selector" className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-neutral-800/80 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveLevelId('ALL')}
          className={`h-7 rounded-md px-2 font-medium transition ${
            activeLevelId === 'ALL'
              ? 'bg-white dark:bg-neutral-700 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Tampilkan Semua Lantai"
        >
          Semua
        </button>
        {buildingLevels.map((lvl, idx) => (
          <button
            key={lvl.id}
            type="button"
            onClick={() => setActiveLevelId(lvl.id)}
            className={`h-7 rounded-md px-2 font-medium transition ${
              activeLevelId === lvl.id
                ? 'bg-white dark:bg-neutral-700 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={`${lvl.name} (Y = ${lvl.elevationY}m)`}
          >
            {`L${idx + 1}`}
          </button>
        ))}
      </div>

      {activeLevelId !== 'ALL' && (
        <button
          type="button"
          onClick={() =>
            setFloorSliceMode(floorSliceMode === 'GHOST_UPPER' ? 'ISOLATE' : 'GHOST_UPPER')
          }
          className={`flex h-7 items-center rounded-md px-1.5 text-[10px] font-semibold transition border ${
            floorSliceMode === 'ISOLATE'
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
              : 'border-slate-300 dark:border-neutral-700 text-slate-500 dark:text-neutral-400'
          }`}
          title={
            floorSliceMode === 'ISOLATE'
              ? 'Mode Isolasi Lantai Aktif (Lantai lain disembunyikan)'
              : 'Mode Ghost Lantai Atas (Lantai atas transparan)'
          }
        >
          {floorSliceMode === 'ISOLATE' ? 'Isolate' : 'Ghost'}
        </button>
      )}
    </div>
  );
}

