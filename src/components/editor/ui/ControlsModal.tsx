'use client';

// Full visual Controls and Moveset Cheat Sheet Modal.
// Displays 4-category responsive grid covering Mouse, Camera/Multi-Floor,
// Object/History, and Fleet/WMS Logistics Simulation shortcuts with i18n support.

import { HelpCircle, X, MousePointer, Compass, Wrench, Route } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface ControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ControlsModal({ isOpen, onClose }: ControlsModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const cg = t.controlsGuide;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl text-slate-800 dark:text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-600/40 text-sky-600 dark:text-sky-400">
              <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-neutral-100">
                {cg?.title ?? 'Blueprint Controls & Moveset Guide'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {cg?.subtitle ?? 'Keyboard shortcuts and mouse gestures for rapid layout navigation & simulation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Content Body - 4 Category Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[72vh] overflow-y-auto pr-1">
          {/* Card 1: Mouse Gestures & Selection */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 mb-3">
                <MousePointer className="h-4 w-4" strokeWidth={1.75} />
                <span>{cg?.categoryMouse ?? 'Mouse & Selection'}</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-neutral-300">
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.mouse?.orbit ?? 'Left Click & Drag'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.mouse?.orbitDesc ?? 'Orbit camera / Select object'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.mouse?.pan ?? 'Right Click & Drag'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.mouse?.panDesc ?? 'Pan camera along floor plane'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.mouse?.zoom ?? 'Scroll Wheel'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.mouse?.zoomDesc ?? 'Zoom in and out smoothly'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.mouse?.dragDrop ?? 'Catalogue Drag & Drop'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.mouse?.dragDropDesc ?? 'Drag items directly to floor'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.mouse?.gizmo ?? 'Gizmo Arrows'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.mouse?.gizmoDesc ?? 'Drag Red (X) & Blue (Z)'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.mouse?.marquee ?? 'Shift + Drag'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.mouse?.marqueeDesc ?? 'Marquee box multi-selection'}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2: Camera Navigation & Multi-Floor */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-3">
                <Compass className="h-4 w-4" strokeWidth={1.75} />
                <span>{cg?.categoryCamera ?? 'Camera & Multi-Floor'}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-neutral-300">
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.panKeys ?? 'Pan Camera'}</span>
                  <div className="flex gap-0.5">
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">W</kbd>
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">A</kbd>
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">S</kbd>
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">D</kbd>
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.rotateKeys ?? 'Rotate View'}</span>
                  <div className="flex gap-0.5">
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">Q</kbd>
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">E</kbd>
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.focusKey ?? 'Focus Object'}</span>
                  <kbd className="rounded bg-sky-50 dark:bg-sky-950 px-1.5 py-0.5 font-mono text-[10px] text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">F</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.overviewKey ?? 'Reset View'}</span>
                  <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">Space</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.view2D ?? '2D / 3D'}</span>
                  <div className="flex gap-0.5">
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">2</kbd>
                    <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">3</kbd>
                  </div>
                </li>
                <li className="pt-2 border-t border-slate-200 dark:border-neutral-800 flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.camera?.levelSelect ?? 'Level Switching'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.levelSelectDesc ?? 'L1-L4 buttons in Viewport HUD'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.camera?.sliceMode ?? 'Floor Slicing'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.camera?.sliceModeDesc ?? 'Toggle Isolate vs Ghosting'}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 3: Object Manipulation & History */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-3">
                <Wrench className="h-4 w-4" strokeWidth={1.75} />
                <span>{cg?.categoryObject ?? 'Object & History'}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-neutral-300">
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.object?.rotate ?? 'Rotate 90°'}</span>
                  <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">R</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.object?.delete ?? 'Delete Entity'}</span>
                  <kbd className="rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 font-mono text-[10px] text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">Del</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.object?.snapping ?? 'Toggle Snapping'}</span>
                  <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">G</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.object?.deselect ?? 'Deselect / Cancel'}</span>
                  <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">Esc</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.object?.undo ?? 'Undo Action'}</span>
                  <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">Ctrl+Z</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.object?.redo ?? 'Redo Action'}</span>
                  <kbd className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700">Ctrl+Y</kbd>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 4: Fleet Simulation & Advanced Modules */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 mb-3">
                <Route className="h-4 w-4" strokeWidth={1.75} />
                <span>{cg?.categoryLogistics ?? 'Fleet & Advanced'}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-neutral-300">
                <li className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.logistics?.playPause ?? 'Play/Pause Route'}</span>
                  <kbd className="rounded bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">Space</kbd>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.logistics?.splitRoute ?? 'Split Waypoint'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.logistics?.splitRouteDesc ?? 'Click purple route line to split'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.logistics?.followCam ?? 'Follow-Cam'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.logistics?.followCamDesc ?? 'Lock camera to active fleet unit'}</span>
                </li>
                <li className="pt-2 border-t border-slate-200 dark:border-neutral-800 flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.logistics?.wmsDataHub ?? 'WMS Data Hub'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.logistics?.wmsDataHubDesc ?? 'Bulk sync & slotting optimizer'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-neutral-200">{cg?.logistics?.aisleGen ?? 'Aisle Generator'}</span>
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{cg?.logistics?.aisleGenDesc ?? 'Automated parallel rack runs'}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-200 dark:border-neutral-800 pt-4">
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            {cg?.tipFooter ?? 'Tip: Press ? or H anytime to open this guide'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 px-4 py-1.5 text-xs font-medium text-slate-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-white border border-slate-300 dark:border-transparent transition"
          >
            {cg?.gotIt ?? 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
