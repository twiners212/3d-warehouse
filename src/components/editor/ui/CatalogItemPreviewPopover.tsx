'use client';

// Popover card component providing high-fidelity 3D isometric SVG blueprint
// illustrations, parametric dimensions, and capacity specifications for catalog items on hover.

import React from 'react';
import type { PaletteEntry } from './SidebarPalette';
import type { RackType } from '@/types/layout';
import { getSlotsPerBayLevel } from '@/engine/procedural/bin-generator';
import {
  Boxes,
  DoorClosed,
  BrickWall,
  ShieldAlert,
  Columns,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  TrendingUp,
  Footprints,
  Zap,
} from 'lucide-react';

interface CatalogItemPreviewPopoverProps {
  entry: PaletteEntry;
  topPos: number;
}

export function CatalogItemPreviewPopover({ entry, topPos }: CatalogItemPreviewPopoverProps) {
  const { item, label, category, description, dimensions } = entry;
  const config = item.defaultConfig;

  return (
    <div
      style={{ top: `${Math.max(12, Math.min(topPos - 20, window.innerHeight - 380))}px` }}
      className="fixed left-[295px] z-50 w-72 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-150 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl text-slate-800 dark:text-neutral-100"
    >
      {/* Header with Category Badge and Label */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          {renderItemIcon(item.type, item.subType)}
          <span className="text-xs font-bold truncate max-w-[150px]">{label}</span>
        </div>
        <span className="rounded-full border border-sky-200 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[9px] font-mono font-semibold text-sky-700 dark:text-sky-300 uppercase">
          {category}
        </span>
      </div>

      {/* 3D Isometric Blueprint Illustration Area */}
      <div className="relative w-full h-36 rounded-xl border border-slate-200 dark:border-neutral-800/80 bg-slate-900/95 flex items-center justify-center overflow-hidden shadow-inner">
        <svg
          viewBox="0 0 240 140"
          className="w-full h-full p-2"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {renderIsometricIllustration(item.type, item.subType)}
        </svg>

        {/* 3D Perspective Tag */}
        <div className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[8px] font-mono text-slate-400">
          3D ISO PROJECTION
        </div>
      </div>

      {/* Technical Dimensions and Specs Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/50 p-2">
          <span className="text-slate-400 dark:text-neutral-500 block uppercase text-[8px] font-bold">
            Dimensions
          </span>
          <span className="font-mono font-semibold text-slate-800 dark:text-neutral-200 text-[11px]">
            {dimensions}
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/50 p-2">
          <span className="text-slate-400 dark:text-neutral-500 block uppercase text-[8px] font-bold">
            {item.type === 'rack' ? 'Capacity Slots' : item.type === 'zone' ? 'Floor Area' : 'Structural Role'}
          </span>
          <span className="font-mono font-semibold text-sky-600 dark:text-sky-400 text-[11px]">
            {getCapacityOrSpec(item.type, item.subType, config)}
          </span>
        </div>
      </div>

      {/* Description & Placement Tip */}
      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
        <span className="truncate max-w-[170px]">{description}</span>
        <span className="font-semibold text-sky-600 dark:text-sky-400">Drag or [+ Add]</span>
      </div>
    </div>
  );
}

function renderItemIcon(type: string, subType: string) {
  if (type === 'rack') {
    return <Boxes className="h-4 w-4 text-sky-500" strokeWidth={1.75} />;
  }
  if (type === 'structural') {
    if (subType === 'dock_door') return <DoorClosed className="h-4 w-4 text-purple-500" strokeWidth={1.75} />;
    if (subType === 'wall') return <BrickWall className="h-4 w-4 text-purple-500" strokeWidth={1.75} />;
    if (subType === 'bollard') return <ShieldAlert className="h-4 w-4 text-amber-500" strokeWidth={1.75} />;
    if (subType === 'charging_dock') return <Zap className="h-4 w-4 text-cyan-500" strokeWidth={1.75} />;
    return <Columns className="h-4 w-4 text-purple-500" strokeWidth={1.75} />;
  }
  if (type === 'zone') {
    if (subType === 'receiving') return <ArrowDownToLine className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />;
    if (subType === 'shipping') return <ArrowUpFromLine className="h-4 w-4 text-sky-500" strokeWidth={1.75} />;
    if (subType === 'picking') return <ArrowLeftRight className="h-4 w-4 text-amber-500" strokeWidth={1.75} />;
    if (subType === 'quarantine') return <AlertTriangle className="h-4 w-4 text-rose-500" strokeWidth={1.75} />;
    return <Layers className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />;
  }
  if (type === 'connector') {
    if (subType === 'lift') return <ArrowUpDown className="h-4 w-4 text-indigo-500" strokeWidth={1.75} />;
    if (subType === 'ramp') return <TrendingUp className="h-4 w-4 text-purple-500" strokeWidth={1.75} />;
    if (subType === 'stairs') return <Footprints className="h-4 w-4 text-pink-500" strokeWidth={1.75} />;
    return <ArrowUpDown className="h-4 w-4 text-indigo-500" strokeWidth={1.75} />;
  }
  return <Layers className="h-4 w-4 text-slate-500" strokeWidth={1.75} />;
}

function getCapacityOrSpec(
  type: string,
  subType: string,
  config: Record<string, unknown> & {
    bays?: number;
    levels?: number;
    width?: number;
    depth?: number;
  }
): string {
  if (type === 'connector') {
    if (subType === 'lift') return 'Heavy Cargo / AGV';
    if (subType === 'ramp') return 'Vehicles & Carts';
    if (subType === 'stairs') return 'Personnel & Carts';
    return 'Vertical Access';
  }
  if (type === 'rack') {
    const bays = config.bays ?? 3;
    const levels = config.levels ?? 4;
    const multiplier = getSlotsPerBayLevel(subType as RackType);
    const totalSlots = bays * levels * multiplier;
    if (subType === 'shelving') return `${totalSlots} Small-Parts Bins`;
    if (subType === 'cantilever') return `${totalSlots} Long Goods Tiers`;
    if (subType === 'mezzanine') return 'Platform Deck Area';
    return `${totalSlots} Pallet Bins`;
  }
  if (type === 'structural') {
    if (subType === 'wall') return 'Divider / Perimeter';
    if (subType === 'column') return '8m Load Support';
    if (subType === 'dock_door') return 'Freight Loading';
    if (subType === 'bollard') return 'Collision Guard';
    if (subType === 'charging_dock') return 'Automated AGV/Forklift Charger';
  }
  if (type === 'zone') {
    const area = (config.width ?? 10) * (config.depth ?? 8);
    return `${area} m² Footprint`;
  }
  return 'Standard';
}

function renderIsometricIllustration(type: string, subType: string) {
  if (type === 'rack') {
    switch (subType) {
      case 'double_deep':
        return (
          <g transform="translate(14, 8)">
            {/* Deep Rear Uprights (Deep Blue #1d4ed8) */}
            <line x1="75" y1="16" x2="75" y2="100" stroke="#1e3a8a" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="115" y1="16" x2="115" y2="100" stroke="#1e3a8a" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="155" y1="16" x2="155" y2="100" stroke="#1e3a8a" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="195" y1="16" x2="195" y2="100" stroke="#1e3a8a" strokeWidth="2" strokeDasharray="3 2" />

            {/* Rear Amber Beams */}
            <line x1="75" y1="42" x2="195" y2="42" stroke="#b45309" strokeWidth="1.8" strokeDasharray="3 2" />
            <line x1="75" y1="68" x2="195" y2="68" stroke="#b45309" strokeWidth="1.8" strokeDasharray="3 2" />

            {/* Mid Uprights (2-Deep Intermediate Frame) */}
            <line x1="45" y1="28" x2="45" y2="112" stroke="#1d4ed8" strokeWidth="2.5" />
            <line x1="85" y1="28" x2="85" y2="112" stroke="#1d4ed8" strokeWidth="2.5" />
            <line x1="125" y1="28" x2="125" y2="112" stroke="#1d4ed8" strokeWidth="2.5" />
            <line x1="165" y1="28" x2="165" y2="112" stroke="#1d4ed8" strokeWidth="2.5" />

            {/* Intermediate Amber Beams */}
            <line x1="45" y1="54" x2="165" y2="54" stroke="#d97706" strokeWidth="2" />
            <line x1="45" y1="80" x2="165" y2="80" stroke="#d97706" strokeWidth="2" />

            {/* Wire Decks 2-Deep */}
            <polygon points="15,66 135,66 195,42 75,42" fill="#64748b" fillOpacity="0.2" stroke="#94a3b8" strokeWidth="0.8" />
            <polygon points="15,92 135,92 195,68 75,68" fill="#64748b" fillOpacity="0.2" stroke="#94a3b8" strokeWidth="0.8" />

            {/* Stored Pallets Rear Row (Deep Position) */}
            <rect x="80" y="30" width="28" height="11" rx="1" fill="#92400e" stroke="#b45309" strokeWidth="0.8" />
            <rect x="82" y="19" width="24" height="11" rx="1" fill="#a16207" stroke="#92400e" strokeWidth="0.8" />
            <rect x="120" y="30" width="28" height="11" rx="1" fill="#92400e" stroke="#b45309" strokeWidth="0.8" />
            <rect x="122" y="19" width="24" height="11" rx="1" fill="#a16207" stroke="#92400e" strokeWidth="0.8" />

            {/* Stored Pallets Front Row (Front Position - 2 Deep Visualized) */}
            <rect x="50" y="44" width="28" height="11" rx="1" fill="#b45309" stroke="#d97706" strokeWidth="0.8" />
            <rect x="52" y="32" width="24" height="12" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />
            <rect x="90" y="44" width="28" height="11" rx="1" fill="#b45309" stroke="#d97706" strokeWidth="0.8" />
            <rect x="92" y="32" width="24" height="12" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />

            {/* Front Uprights (Deep Blue #1d4ed8) */}
            <line x1="15" y1="40" x2="15" y2="124" stroke="#1d4ed8" strokeWidth="3" />
            <line x1="55" y1="40" x2="55" y2="124" stroke="#1d4ed8" strokeWidth="3" />
            <line x1="95" y1="40" x2="95" y2="124" stroke="#1d4ed8" strokeWidth="3" />
            <line x1="135" y1="40" x2="135" y2="124" stroke="#1d4ed8" strokeWidth="3" />

            {/* Front Amber Beams (#d97706) */}
            <line x1="15" y1="66" x2="135" y2="66" stroke="#d97706" strokeWidth="2.8" />
            <line x1="15" y1="92" x2="135" y2="92" stroke="#d97706" strokeWidth="2.8" />

            {/* Depth Tie Struts */}
            <line x1="15" y1="40" x2="75" y2="16" stroke="#2563eb" strokeWidth="1.2" />
            <line x1="135" y1="40" x2="195" y2="16" stroke="#2563eb" strokeWidth="1.2" />
            <line x1="15" y1="124" x2="75" y2="100" stroke="#2563eb" strokeWidth="1.2" />
          </g>
        );

      case 'drive_in':
        return (
          <g transform="translate(16, 8)">
            {/* Deep Ruby Red Uprights (#dc2626) forming drive-through tunnel */}
            {/* Rear Frame */}
            <line x1="70" y1="16" x2="70" y2="105" stroke="#7f1d1d" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="110" y1="16" x2="110" y2="105" stroke="#7f1d1d" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="150" y1="16" x2="150" y2="105" stroke="#7f1d1d" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="190" y1="16" x2="190" y2="105" stroke="#7f1d1d" strokeWidth="2" strokeDasharray="3 2" />

            {/* Top Tie Beams (Header Clearance) */}
            <line x1="70" y1="16" x2="190" y2="16" stroke="#b91c1c" strokeWidth="2" />
            <line x1="20" y1="36" x2="140" y2="36" stroke="#dc2626" strokeWidth="2.5" />
            <line x1="20" y1="36" x2="70" y2="16" stroke="#991b1b" strokeWidth="1.5" />
            <line x1="140" y1="36" x2="190" y2="16" stroke="#991b1b" strokeWidth="1.5" />

            {/* Continuous Pallet Guide Rails (Coral Red #f87171) along depth */}
            <line x1="20" y1="62" x2="70" y2="42" stroke="#f87171" strokeWidth="2.2" />
            <line x1="60" y1="62" x2="110" y2="42" stroke="#f87171" strokeWidth="2.2" />
            <line x1="100" y1="62" x2="150" y2="42" stroke="#f87171" strokeWidth="2.2" />
            <line x1="140" y1="62" x2="190" y2="42" stroke="#f87171" strokeWidth="2.2" />

            <line x1="20" y1="88" x2="70" y2="68" stroke="#f87171" strokeWidth="2.2" />
            <line x1="60" y1="88" x2="110" y2="68" stroke="#f87171" strokeWidth="2.2" />
            <line x1="100" y1="88" x2="150" y2="68" stroke="#f87171" strokeWidth="2.2" />
            <line x1="140" y1="88" x2="190" y2="68" stroke="#f87171" strokeWidth="2.2" />

            {/* Front Upright Pillars (Ruby Red #dc2626) */}
            <line x1="20" y1="36" x2="20" y2="124" stroke="#dc2626" strokeWidth="3" />
            <line x1="60" y1="36" x2="60" y2="124" stroke="#dc2626" strokeWidth="3" />
            <line x1="100" y1="36" x2="100" y2="124" stroke="#dc2626" strokeWidth="3" />
            <line x1="140" y1="36" x2="140" y2="124" stroke="#dc2626" strokeWidth="3" />

            {/* Open Forklift Drive-Through Tunnel Floor Lane */}
            <polygon points="60,124 100,124 150,105 110,105" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" />
            <text x="105" y="118" fill="#fca5a5" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">LIFO TUNNEL</text>
          </g>
        );

      case 'push_back':
        return (
          <g transform="translate(18, 8)">
            {/* Teal Upright Posts (#0d9488) */}
            <line x1="65" y1="18" x2="65" y2="105" stroke="#115e59" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="125" y1="18" x2="125" y2="105" stroke="#115e59" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="185" y1="18" x2="185" y2="105" stroke="#115e59" strokeWidth="2" strokeDasharray="3 2" />

            {/* Slanted Gravity Rails (sloping down to picking face) */}
            <line x1="25" y1="68" x2="85" y2="44" stroke="#06b6d4" strokeWidth="2.5" />
            <line x1="85" y1="68" x2="145" y2="44" stroke="#06b6d4" strokeWidth="2.5" />
            <line x1="145" y1="68" x2="205" y2="44" stroke="#06b6d4" strokeWidth="2.5" />

            <line x1="25" y1="96" x2="85" y2="72" stroke="#06b6d4" strokeWidth="2.5" />
            <line x1="85" y1="96" x2="145" y2="72" stroke="#06b6d4" strokeWidth="2.5" />
            <line x1="145" y1="96" x2="205" y2="72" stroke="#06b6d4" strokeWidth="2.5" />

            {/* Front Uprights (Teal #0d9488) */}
            <line x1="25" y1="38" x2="25" y2="124" stroke="#0d9488" strokeWidth="3" />
            <line x1="85" y1="38" x2="85" y2="124" stroke="#0d9488" strokeWidth="3" />
            <line x1="145" y1="38" x2="145" y2="124" stroke="#0d9488" strokeWidth="3" />

            {/* Front Beams (Cyan #06b6d4) */}
            <line x1="25" y1="68" x2="145" y2="68" stroke="#06b6d4" strokeWidth="3" />
            <line x1="25" y1="96" x2="145" y2="96" stroke="#06b6d4" strokeWidth="3" />

            {/* Nested Sliding Push-Back Carts with Pallet */}
            <polygon points="35,66 75,66 90,58 50,58" fill="#14b8a6" stroke="#22d3ee" strokeWidth="1" />
            <rect x="38" y="52" width="34" height="13" rx="1" fill="#b45309" stroke="#38bdf8" strokeWidth="0.8" />
            <polygon points="95,66 135,66 150,58 110,58" fill="#14b8a6" stroke="#22d3ee" strokeWidth="1" />
            <rect x="98" y="52" width="34" height="13" rx="1" fill="#b45309" stroke="#38bdf8" strokeWidth="0.8" />
          </g>
        );

      case 'cantilever':
        return (
          <g transform="translate(18, 8)">
            {/* Rear Cross Bracing X-Truss (#ca8a04) */}
            <line x1="60" y1="28" x2="140" y2="110" stroke="#854d0e" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1="140" y1="28" x2="60" y2="110" stroke="#854d0e" strokeWidth="1.5" strokeDasharray="3 2" />

            {/* Heavy Vertical Column Masts (Industrial Yellow #eab308) */}
            {/* Mast 1 */}
            <rect x="55" y="20" width="12" height="96" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" rx="1" />
            {/* Base Foot 1 extending along floor */}
            <polygon points="35,122 75,122 85,116 45,116" fill="#713f12" stroke="#ca8a04" strokeWidth="1.2" />

            {/* Mast 2 */}
            <rect x="135" y="20" width="12" height="96" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" rx="1" />
            {/* Base Foot 2 extending along floor */}
            <polygon points="115,122 155,122 165,116 125,116" fill="#713f12" stroke="#ca8a04" strokeWidth="1.2" />

            {/* Cantilever Arms Level 1 (Forward Projecting Arms) */}
            <polygon points="67,52 105,44 105,49 67,58" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
            <polygon points="147,52 185,44 185,49 147,58" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
            {/* Long Pipe / Timber Load on Level 1 */}
            <rect x="60" y="38" width="128" height="9" rx="4" fill="#64748b" stroke="#cbd5e1" strokeWidth="0.8" />

            {/* Cantilever Arms Level 2 */}
            <polygon points="67,82 105,74 105,79 67,88" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
            <polygon points="147,82 185,74 185,79 147,88" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
            {/* Long Steel Beam Load on Level 2 */}
            <rect x="60" y="68" width="128" height="9" rx="2" fill="#d97706" stroke="#fde047" strokeWidth="0.8" />
          </g>
        );

      case 'shelving':
        return (
          <g transform="translate(20, 8)">
            {/* Galvanized Zinc Posts (Front & Back - 0x64748b) */}
            {/* Rear Posts */}
            <line x1="55" y1="26" x2="55" y2="108" stroke="#475569" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="110" y1="26" x2="110" y2="108" stroke="#475569" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="165" y1="26" x2="165" y2="108" stroke="#475569" strokeWidth="2" strokeDasharray="2 2" />

            {/* Solid Light Zinc Shelf Decks (3 Levels) */}
            <polygon points="35,58 145,58 165,48 55,48" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            <polygon points="35,84 145,84 165,74 55,74" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            <polygon points="35,110 145,110 165,100 55,100" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

            {/* Front Posts (Galvanized Zinc #64748b) */}
            <line x1="35" y1="36" x2="35" y2="120" stroke="#64748b" strokeWidth="2.5" />
            <line x1="90" y1="36" x2="90" y2="120" stroke="#64748b" strokeWidth="2.5" />
            <line x1="145" y1="36" x2="145" y2="120" stroke="#64748b" strokeWidth="2.5" />

            {/* Compact Parts Storage Bins on Level 1 */}
            <rect x="42" y="44" width="18" height="12" rx="1" fill="#3b82f6" />
            <rect x="64" y="44" width="18" height="12" rx="1" fill="#ef4444" />
            <rect x="98" y="44" width="18" height="12" rx="1" fill="#10b981" />
            <rect x="120" y="44" width="18" height="12" rx="1" fill="#f59e0b" />

            {/* Cartons on Level 2 */}
            <rect x="45" y="70" width="38" height="12" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />
            <rect x="98" y="70" width="38" height="12" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />
          </g>
        );

      case 'mezzanine':
        return (
          <g transform="translate(18, 8)">
            {/* 4 Heavy Structural Steel Base Columns (Charcoal Steel 0x1e293b) */}
            <rect x="35" y="60" width="8" height="60" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
            <rect x="85" y="45" width="7" height="55" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
            <rect x="135" y="60" width="8" height="60" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
            <rect x="175" y="45" width="7" height="55" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />

            {/* Elevated Heavy Diamond-Tread Steel Floor Deck Platform at height 3.2m (0x475569) */}
            <polygon points="30,60 135,60 185,45 80,45" fill="#475569" stroke="#3b82f6" strokeWidth="2" />
            <polygon points="30,60 135,60 135,64 30,64" fill="#334155" stroke="#3b82f6" strokeWidth="1" />

            {/* Perimeter Yellow Safety Railing & Mid-Rail (#eab308) */}
            <line x1="30" y1="38" x2="135" y2="38" stroke="#eab308" strokeWidth="2" />
            <line x1="30" y1="48" x2="135" y2="48" stroke="#eab308" strokeWidth="1.2" />
            <line x1="30" y1="60" x2="30" y2="38" stroke="#eab308" strokeWidth="2" />
            <line x1="82" y1="60" x2="82" y2="38" stroke="#eab308" strokeWidth="2" />
            <line x1="135" y1="60" x2="135" y2="38" stroke="#eab308" strokeWidth="2" />

            {/* Storage Pallet on Elevated Platform */}
            <rect x="55" y="46" width="26" height="12" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />
            <rect x="90" y="46" width="22" height="12" rx="1" fill="#38bdf8" stroke="#0284c7" strokeWidth="0.8" />
          </g>
        );

      default: // selective_pallet
        return (
          <g transform="translate(18, 8)">
            {/* Rear Upright Frame (Royal Blue #1d4ed8) */}
            <line x1="55" y1="20" x2="55" y2="105" stroke="#1d4ed8" strokeWidth="2.5" />
            <line x1="95" y1="20" x2="95" y2="105" stroke="#1d4ed8" strokeWidth="2.5" />
            <line x1="135" y1="20" x2="135" y2="105" stroke="#1d4ed8" strokeWidth="2.5" />
            <line x1="175" y1="20" x2="175" y2="105" stroke="#1d4ed8" strokeWidth="2.5" />

            {/* Rear Beams */}
            <line x1="55" y1="42" x2="175" y2="42" stroke="#ea580c" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="55" y1="64" x2="175" y2="64" stroke="#ea580c" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="55" y1="86" x2="175" y2="86" stroke="#ea580c" strokeWidth="2" strokeDasharray="3 2" />

            {/* Depth Tie Struts & Wire Decks */}
            <line x1="30" y1="35" x2="55" y2="20" stroke="#3b82f6" strokeWidth="1.5" />
            <line x1="30" y1="120" x2="55" y2="105" stroke="#3b82f6" strokeWidth="1.5" />
            <line x1="150" y1="35" x2="175" y2="20" stroke="#3b82f6" strokeWidth="1.5" />
            <line x1="150" y1="120" x2="175" y2="105" stroke="#3b82f6" strokeWidth="1.5" />

            {/* Pallet Wire Decks (Grey 0x94a3b8) */}
            <polygon points="30,57 150,57 175,42 55,42" fill="#64748b" fillOpacity="0.25" stroke="#94a3b8" strokeWidth="0.8" />
            <polygon points="30,79 150,79 175,64 55,64" fill="#64748b" fillOpacity="0.25" stroke="#94a3b8" strokeWidth="0.8" />
            <polygon points="30,101 150,101 175,86 55,86" fill="#64748b" fillOpacity="0.25" stroke="#94a3b8" strokeWidth="0.8" />

            {/* Euro Pallets & Kraft Cartons (Levels 2 & 3) */}
            <polygon points="35,76 65,76 75,69 45,69" fill="#b48a56" stroke="#d97706" strokeWidth="0.8" />
            <rect x="37" y="62" width="26" height="13" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />
            <polygon points="75,76 105,76 115,69 85,69" fill="#b48a56" stroke="#d97706" strokeWidth="0.8" />
            <rect x="77" y="62" width="26" height="13" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />
            <polygon points="115,76 145,76 155,69 125,69" fill="#b48a56" stroke="#d97706" strokeWidth="0.8" />
            <rect x="117" y="60" width="26" height="15" rx="1" fill="#cd9f6c" stroke="#b48a56" strokeWidth="0.8" />

            {/* Front Uprights (Royal Blue 0x2563eb) */}
            <line x1="30" y1="35" x2="30" y2="120" stroke="#2563eb" strokeWidth="3" />
            <line x1="70" y1="35" x2="70" y2="120" stroke="#2563eb" strokeWidth="3" />
            <line x1="110" y1="35" x2="110" y2="120" stroke="#2563eb" strokeWidth="3" />
            <line x1="150" y1="35" x2="150" y2="120" stroke="#2563eb" strokeWidth="3" />

            {/* Front Beams (Safety Orange 0xf97316) */}
            <line x1="30" y1="57" x2="150" y2="57" stroke="#f97316" strokeWidth="3" />
            <line x1="30" y1="79" x2="150" y2="79" stroke="#f97316" strokeWidth="3" />
            <line x1="30" y1="101" x2="150" y2="101" stroke="#f97316" strokeWidth="3" />

            {/* Diagonal Cross-Bracing on End Frame */}
            <line x1="30" y1="57" x2="55" y2="42" stroke="#1d4ed8" strokeWidth="1.2" />
            <line x1="30" y1="79" x2="55" y2="64" stroke="#1d4ed8" strokeWidth="1.2" />
            <line x1="30" y1="101" x2="55" y2="86" stroke="#1d4ed8" strokeWidth="1.2" />
          </g>
        );
    }
  }

  if (type === 'structural') {
    switch (subType) {
      case 'column':
        return (
          <g transform="translate(65, 8)">
            {/* Base Flange Mounting Plate (0.75m x 0.75m x 0.1m - 0x1e293b) */}
            <polygon points="20,118 80,118 95,110 35,110" fill="#020617" fillOpacity="0.5" />
            <polygon points="25,114 75,114 90,107 40,107" fill="#334155" stroke="#64748b" strokeWidth="1" />
            <polygon points="25,114 75,114 75,118 25,118" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
            <polygon points="75,114 90,107 90,111 75,118" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
            <circle cx="35" cy="111" r="1.5" fill="#94a3b8" />
            <circle cx="75" cy="111" r="1.5" fill="#94a3b8" />

            {/* 8-Meter Tall Slender Structural Column (0x64748b) */}
            {/* Side face */}
            <polygon points="65,15 80,8 80,107 65,114" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
            {/* Top face */}
            <polygon points="35,15 65,15 80,8 50,8" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="1.2" />
            {/* Front face */}
            <polygon points="35,15 65,15 65,114 35,114" fill="#64748b" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Chamfer edge line */}
            <line x1="65" y1="15" x2="65" y2="114" stroke="#cbd5e1" strokeWidth="1.2" />

            {/* Height indicator badge */}
            <line x1="22" y1="15" x2="22" y2="114" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="18" y1="15" x2="26" y2="15" stroke="#38bdf8" strokeWidth="1" />
            <line x1="18" y1="114" x2="26" y2="114" stroke="#38bdf8" strokeWidth="1" />
            <text x="12" y="68" fill="#38bdf8" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle" transform="rotate(-90 12 68)">8.0m HIGH</text>
          </g>
        );

      case 'dock_door':
        return (
          <g transform="translate(35, 10)">
            {/* Outer Safety Yellow Portal Frame (0xeab308) */}
            {/* Side depth */}
            <polygon points="135,18 150,10 150,110 135,118" fill="#ca8a04" stroke="#eab308" strokeWidth="1.2" />
            <polygon points="15,18 135,18 150,10 30,10" fill="#facc15" stroke="#eab308" strokeWidth="1.2" />

            {/* Left Yellow Jamb */}
            <rect x="15" y="18" width="14" height="100" fill="#eab308" stroke="#facc15" strokeWidth="1" />
            {/* Right Yellow Jamb */}
            <rect x="121" y="18" width="14" height="100" fill="#eab308" stroke="#facc15" strokeWidth="1" />
            {/* Top Yellow Header Lintel */}
            <rect x="15" y="18" width="120" height="16" fill="#facc15" stroke="#eab308" strokeWidth="1" />

            {/* Inner Recessed Roll-Up Shutter Panel (0x334155 Slate) */}
            <rect x="29" y="34" width="92" height="84" fill="#334155" stroke="#1e293b" strokeWidth="1.2" />

            {/* Horizontal Rolling Slats */}
            <line x1="29" y1="44" x2="121" y2="44" stroke="#475569" strokeWidth="1.5" />
            <line x1="29" y1="54" x2="121" y2="54" stroke="#475569" strokeWidth="1.5" />
            <line x1="29" y1="64" x2="121" y2="64" stroke="#475569" strokeWidth="1.5" />
            <line x1="29" y1="74" x2="121" y2="74" stroke="#475569" strokeWidth="1.5" />
            <line x1="29" y1="84" x2="121" y2="84" stroke="#475569" strokeWidth="1.5" />
            <line x1="29" y1="94" x2="121" y2="94" stroke="#475569" strokeWidth="1.5" />
            <line x1="29" y1="104" x2="121" y2="104" stroke="#475569" strokeWidth="1.5" />

            {/* Bottom Weather Seal & Lift Handle */}
            <rect x="29" y="114" width="92" height="4" fill="#0f172a" />
            <rect x="68" y="108" width="14" height="3" rx="1" fill="#94a3b8" />

            {/* Caution Stripes on Top Header */}
            <line x1="22" y1="18" x2="32" y2="34" stroke="#0f172a" strokeWidth="2.5" />
            <line x1="42" y1="18" x2="52" y2="34" stroke="#0f172a" strokeWidth="2.5" />
            <line x1="62" y1="18" x2="72" y2="34" stroke="#0f172a" strokeWidth="2.5" />
            <line x1="82" y1="18" x2="92" y2="34" stroke="#0f172a" strokeWidth="2.5" />
            <line x1="102" y1="18" x2="112" y2="34" stroke="#0f172a" strokeWidth="2.5" />
            <line x1="122" y1="18" x2="132" y2="34" stroke="#0f172a" strokeWidth="2.5" />
          </g>
        );

      case 'bollard':
        return (
          <g transform="translate(75, 10)">
            {/* Floor shadow */}
            <ellipse cx="45" cy="116" rx="35" ry="9" fill="#020617" fillOpacity="0.5" />

            {/* Circular Dark Steel Base Flange Plate (0x1e293b) */}
            <ellipse cx="45" cy="112" rx="28" ry="7" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
            <path d="M17,112 C17,115 73,115 73,112 L73,115 C73,118 17,118 17,115 Z" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
            <circle cx="28" cy="112" r="1.5" fill="#94a3b8" />
            <circle cx="62" cy="112" r="1.5" fill="#94a3b8" />

            {/* Cylindrical Yellow Post (0xfacc15) */}
            <path d="M30,30 L60,30 L60,110 L30,110 Z" fill="#facc15" stroke="#eab308" strokeWidth="1.2" />
            <path d="M45,30 L60,30 L60,110 L45,110 Z" fill="#ca8a04" fillOpacity="0.35" />

            {/* UPPER Black Caution Stripe Band (at height * 0.2) */}
            <path d="M30,48 L60,48 L60,62 L30,62 Z" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
            <ellipse cx="45" cy="48" rx="15" ry="3.5" fill="#1e293b" />
            <ellipse cx="45" cy="62" rx="15" ry="3.5" fill="#0f172a" />

            {/* LOWER Black Caution Stripe Band (at height * -0.1) */}
            <path d="M30,76 L60,76 L60,90 L30,90 Z" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
            <ellipse cx="45" cy="76" rx="15" ry="3.5" fill="#1e293b" />
            <ellipse cx="45" cy="90" rx="15" ry="3.5" fill="#0f172a" />

            {/* Beveled / Dome Yellow Top Cap */}
            <ellipse cx="45" cy="30" rx="15" ry="4.5" fill="#fef08a" stroke="#eab308" strokeWidth="1" />
            <ellipse cx="45" cy="28" rx="8" ry="2.5" fill="#ffffff" fillOpacity="0.5" />
          </g>
        );

      case 'charging_dock':
        return (
          <g transform="translate(30, 15)">
            {/* Base platform */}
            <polygon points="10,95 80,95 110,80 40,80" fill="#1e293b" stroke="#eab308" strokeWidth="1.5" />
            {/* Charging contact strips */}
            <polygon points="25,90 45,90 60,82 40,82" fill="#94a3b8" />
            <polygon points="55,90 75,90 90,82 70,82" fill="#94a3b8" />
            {/* Charger power kiosk pillar */}
            <rect x="75" y="30" width="30" height="55" rx="2" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
            {/* Screen with lightning bolt */}
            <rect x="80" y="38" width="20" height="16" rx="2" fill="#06b6d4" />
            <polygon points="91,40 85,47 89,47 87,52 95,45 91,45" fill="#ffffff" />
            {/* Top green beacon */}
            <circle cx="90" cy="27" r="4" fill="#10b981" />
          </g>
        );

      default: // wall
        return (
          <g transform="translate(15, 12)">
            {/* Floor shadow */}
            <polygon points="25,100 175,100 195,90 45,90" fill="#020617" fillOpacity="0.4" />

            {/* Left / Side end face (0.3m thickness) */}
            <polygon points="25,45 45,35 45,90 25,100" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Top edge face (0.3m thickness across 6m width) */}
            <polygon points="25,45 175,45 195,35 45,35" fill="#64748b" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Front main concrete face (6m wide x 4m high - 0x475569) */}
            <polygon points="25,45 175,45 175,100 25,100" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />

            {/* Formwork grooves & expansion joint */}
            <line x1="100" y1="45" x2="100" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
            <line x1="25" y1="72" x2="175" y2="72" stroke="#334155" strokeWidth="0.8" strokeOpacity="0.6" />

            {/* Dimensions label in CAD blueprint style */}
            <rect x="75" y="66" width="50" height="13" rx="2" fill="#0f172a" fillOpacity="0.75" />
            <text x="100" y="76" fill="#cbd5e1" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">6.0m × 4.0m</text>
          </g>
        );
    }
  }

  if (type === 'connector') {
    if (subType === 'lift') {
      return (
        <g transform="translate(30, 8)">
          {/* Lift Tower Frame */}
          <rect x="50" y="15" width="80" height="105" rx="3" fill="#1e1b4b" fillOpacity="0.5" stroke="#6366f1" strokeWidth="2" />
          {/* Tower vertical rails */}
          <line x1="56" y1="15" x2="56" y2="120" stroke="#818cf8" strokeWidth="1.5" />
          <line x1="124" y1="15" x2="124" y2="120" stroke="#818cf8" strokeWidth="1.5" />
          {/* Internal elevator car box */}
          <rect x="62" y="45" width="56" height="50" rx="2" fill="#312e81" stroke="#a5b4fc" strokeWidth="2" />
          <line x1="90" y1="45" x2="90" y2="95" stroke="#6366f1" strokeWidth="1.5" />
          {/* Suspension cables */}
          <line x1="72" y1="15" x2="72" y2="45" stroke="#e0e7ff" strokeWidth="1.2" strokeDasharray="2 2" />
          <line x1="108" y1="15" x2="108" y2="45" stroke="#e0e7ff" strokeWidth="1.2" strokeDasharray="2 2" />
          {/* Direction indicator */}
          <path d="M90,30 L85,38 L95,38 Z" fill="#38bdf8" />
          <text x="90" y="114" fill="#a5b4fc" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">CARGO LIFT</text>
        </g>
      );
    }
    if (subType === 'ramp') {
      return (
        <g transform="translate(20, 15)">
          {/* Inclined ramp surface */}
          <polygon points="30,95 150,95 180,35 60,35" fill="#4c1d95" fillOpacity="0.4" stroke="#8b5cf6" strokeWidth="2" />
          {/* Side wedge slope */}
          <polygon points="30,95 60,35 60,50 30,110" fill="#2e1065" stroke="#7c3aed" strokeWidth="1.5" />
          {/* Center lane dash striping */}
          <line x1="45" y1="95" x2="120" y2="35" stroke="#facc15" strokeWidth="2" strokeDasharray="6 4" />
          {/* Side safety curb rail */}
          <line x1="30" y1="92" x2="60" y2="32" stroke="#a78bfa" strokeWidth="2" />
          <line x1="150" y1="92" x2="180" y2="32" stroke="#a78bfa" strokeWidth="2" />
          <text x="105" y="112" fill="#c4b5fd" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">RAMP SLOPE</text>
        </g>
      );
    }
    // Industrial stairs
    return (
      <g transform="translate(30, 10)">
        {/* Stair steps profile */}
        <path
          d="M40,105 L55,105 L55,90 L70,90 L70,75 L85,75 L85,60 L100,60 L100,45 L115,45 L115,30 L130,30"
          fill="none"
          stroke="#ec4899"
          strokeWidth="3"
        />
        {/* Handrail */}
        <line x1="38" y1="85" x2="128" y2="10" stroke="#f472b6" strokeWidth="2" />
        <line x1="55" y1="90" x2="55" y2="70" stroke="#f472b6" strokeWidth="1.5" />
        <line x1="85" y1="60" x2="85" y2="40" stroke="#f472b6" strokeWidth="1.5" />
        <line x1="115" y1="30" x2="115" y2="20" stroke="#f472b6" strokeWidth="1.5" />
        <text x="85" y="118" fill="#fbcfe8" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">STAIR ACCESS</text>
      </g>
    );
  }

  // Operational Zones
  let zoneColor = '#10b981';
  let zoneTitle = 'RECEIVING';
  if (subType === 'shipping') {
    zoneColor = '#0284c7';
    zoneTitle = 'SHIPPING';
  } else if (subType === 'picking') {
    zoneColor = '#f59e0b';
    zoneTitle = 'STAGING';
  } else if (subType === 'quarantine') {
    zoneColor = '#f43f5e';
    zoneTitle = 'QUARANTINE';
  }

  return (
    <g transform="translate(20, 10)">
      {/* 3D Isometric Floor Slab */}
      <polygon
        points="30,80 130,80 175,40 75,40"
        fill={zoneColor}
        fillOpacity="0.25"
        stroke={zoneColor}
        strokeWidth="2.5"
      />
      {/* Dashed Perimeter Safety Border */}
      <polygon
        points="38,75 124,75 163,45 77,45"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <text x="102" y="64" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="1">
        {zoneTitle} ZONE
      </text>
    </g>
  );
}
