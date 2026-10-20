'use client';

// Fulfills Phase 38: Modal Confirmation for Clearing Active Picking Route
// Summarizes current route stats and informs user of Ctrl+Z undo restoration

import React from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTranslation } from '@/lib/i18n';

interface ClearRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClearRouteModal: React.FC<ClearRouteModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const pickList = useEditorStore((s) => s.pickList);
  const customWaypoints = useEditorStore((s) => s.customWaypoints);
  const routeResult = useEditorStore((s) => s.routeResult);
  const clearRouteWithCommand = useEditorStore((s) => s.clearRouteWithCommand);

  if (!isOpen) return null;

  const handleConfirm = () => {
    clearRouteWithCommand();
    onClose();
  };

  const totalStops = pickList.length;
  const waypointCount = customWaypoints.length;
  const distance = routeResult?.metrics.totalDistanceMeters
    ? Math.round(routeResult.metrics.totalDistanceMeters)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {t.picking.clearRouteConfirmTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.picking.clearRouteConfirmDesc}
            </p>
          </div>
        </div>

        {/* Route Snapshot Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 my-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              Stops
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {totalStops}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              Waypoints
            </div>
            <div className="text-base font-bold text-purple-600 dark:text-purple-400">
              {waypointCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              Distance
            </div>
            <div className="text-base font-bold text-sky-600 dark:text-sky-400">
              {distance}m
            </div>
          </div>
        </div>

        {/* Undo tip alert */}
        <div className="flex items-start gap-2 p-3 mb-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs">
          <RotateCcw className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <span>{t.picking.clearRouteUndoNotice}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition"
          >
            {t.picking.clearRouteCancelBtn}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 transition active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.picking.clearRouteConfirmBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
