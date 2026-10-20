'use client';

// Fulfills ARCHITECTURE.md Section 2 (editor/ui/SidebarPalette.tsx):
// Collapsible Accordion Asset Catalogue supporting 15 asset types across:
// 1. Storage Racks (7 types)
// 2. Facility Structures (4 types)
// 3. Operational Floor Zones (4 types)

import { useState, useRef } from 'react';
import type { DraggedPaletteItem } from '@/types/interaction';
import { useEditorStore } from '@/stores/useEditorStore';
import { setPlacementItem, resetPlacementBus } from '@/lib/placement/placement-bus';
import { CatalogItemPreviewPopover } from './CatalogItemPreviewPopover';
import {
  Boxes,
  Building2,
  Layers,
  Search,
  X,
  ChevronDown,
  Plus,
  Lightbulb,
  Grid,
  ArrowUpDown,
} from 'lucide-react';

export interface PaletteEntry {
  id: string;
  label: string;
  category: string;
  description: string;
  dimensions: string;
  badgeColor?: string;
  item: DraggedPaletteItem;
}

interface PaletteSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  count: number;
  entries: PaletteEntry[];
}

const PALETTE_SECTIONS: PaletteSection[] = [
  {
    id: 'storage-racks',
    title: 'Storage Racking',
    icon: Boxes,
    count: 7,
    entries: [
      {
        id: 'rack-selective',
        label: 'Selective Pallet Rack',
        category: 'Standard',
        description: '3 bays · 4 levels · 1.5m bay',
        dimensions: '4.5m × 1.1m × 6.0m',
        item: {
          type: 'rack',
          subType: 'selective_pallet',
          defaultConfig: { width: 4.5, depth: 1.1, height: 6.0, bays: 3, levels: 4 },
        },
      },
      {
        id: 'rack-double-deep',
        label: 'Double-Deep Pallet Rack',
        category: 'High Density',
        description: '3 bays · 4 levels · 2-deep storage',
        dimensions: '4.5m × 2.2m × 6.0m',
        item: {
          type: 'rack',
          subType: 'double_deep',
          defaultConfig: { width: 4.5, depth: 2.2, height: 6.0, bays: 3, levels: 4 },
        },
      },
      {
        id: 'rack-drive-in',
        label: 'Drive-In Bulk Rack',
        category: 'Dense LIFO',
        description: '3 bays · 4 levels · deep-lane entry',
        dimensions: '4.5m × 4.0m × 6.5m',
        item: {
          type: 'rack',
          subType: 'drive_in',
          defaultConfig: { width: 4.5, depth: 4.0, height: 6.5, bays: 3, levels: 4 },
        },
      },
      {
        id: 'rack-push-back',
        label: 'Push-Back Gravity Rack',
        category: 'Gravity Flow',
        description: '2 bays · 3 levels · nested carts',
        dimensions: '3.2m × 3.5m × 5.0m',
        item: {
          type: 'rack',
          subType: 'push_back',
          defaultConfig: { width: 3.2, depth: 3.5, height: 5.0, bays: 2, levels: 3 },
        },
      },
      {
        id: 'rack-cantilever',
        label: 'Cantilever Rack',
        category: 'Long Goods',
        description: '2 bays · 2 levels · open arms',
        dimensions: '4.0m × 1.2m × 4.0m',
        item: {
          type: 'rack',
          subType: 'cantilever',
          defaultConfig: { width: 4.0, depth: 1.2, height: 4.0, bays: 2, levels: 2 },
        },
      },
      {
        id: 'rack-shelving',
        label: 'Multi-Tier Shelving',
        category: 'Hand Loaded',
        description: '2 bays · 3 levels · small parts',
        dimensions: '2.0m × 0.6m × 2.4m',
        item: {
          type: 'rack',
          subType: 'shelving',
          defaultConfig: { width: 2.0, depth: 0.6, height: 2.4, bays: 2, levels: 3 },
        },
      },
      {
        id: 'rack-mezzanine',
        label: 'Mezzanine Platform Deck',
        category: 'Platform',
        description: 'Heavy steel deck with posts',
        dimensions: '6.0m × 6.0m × 3.2m',
        item: {
          type: 'rack',
          subType: 'mezzanine',
          defaultConfig: { width: 6.0, depth: 6.0, height: 3.2, bays: 1, levels: 1 },
        },
      },
    ],
  },
  {
    id: 'facility-structures',
    title: 'Facility Structures',
    icon: Building2,
    count: 5,
    entries: [
      {
        id: 'struct-wall',
        label: 'Concrete Wall Segment',
        category: 'Perimeter',
        description: 'Solid reinforced divider wall',
        dimensions: '6.0m × 0.3m × 4.0m',
        item: {
          type: 'structural',
          subType: 'wall',
          defaultConfig: { width: 6.0, depth: 0.3, height: 4.0 },
        },
      },
      {
        id: 'struct-column',
        label: 'Structural Pillar Column',
        category: 'Support',
        description: 'Square concrete support column',
        dimensions: '0.6m × 0.6m × 8.0m',
        item: {
          type: 'structural',
          subType: 'column',
          defaultConfig: { width: 0.6, depth: 0.6, height: 8.0 },
        },
      },
      {
        id: 'struct-dock-door',
        label: 'Overhead Dock Door',
        category: 'Loading Bay',
        description: 'Roll-up door with yellow frame',
        dimensions: '3.2m × 0.2m × 3.8m',
        item: {
          type: 'structural',
          subType: 'dock_door',
          defaultConfig: { width: 3.2, depth: 0.2, height: 3.8 },
        },
      },
      {
        id: 'struct-bollard',
        label: 'Safety Bollard',
        category: 'Protection',
        description: 'Yellow & black caution bollard',
        dimensions: '0.3m × 0.3m × 1.1m',
        item: {
          type: 'structural',
          subType: 'bollard',
          defaultConfig: { width: 0.3, depth: 0.3, height: 1.1 },
        },
      },
      {
        id: 'struct-charging-dock',
        label: 'Battery Charging Dock',
        category: 'Fleet Power',
        description: 'Automated dock for AGV & Forklifts',
        dimensions: '1.6m × 1.6m × 1.5m',
        item: {
          type: 'structural',
          subType: 'charging_dock',
          defaultConfig: { width: 1.6, depth: 1.6, height: 1.5 },
        },
      },
    ],
  },
  {
    id: 'operational-zones',
    title: 'Operational Floor Zones',
    icon: Layers,
    count: 4,
    entries: [
      {
        id: 'zone-receiving',
        label: 'Receiving Inbound Zone',
        category: 'Inbound',
        description: 'Unloading & staging area',
        dimensions: '12.0m × 8.0m',
        badgeColor: '#10b981',
        item: {
          type: 'zone',
          subType: 'receiving',
          defaultConfig: { width: 12.0, depth: 8.0, height: 0.05 },
        },
      },
      {
        id: 'zone-shipping',
        label: 'Shipping Outbound Zone',
        category: 'Outbound',
        description: 'Marshalling & dispatch dock',
        dimensions: '12.0m × 8.0m',
        badgeColor: '#0284c7',
        item: {
          type: 'zone',
          subType: 'shipping',
          defaultConfig: { width: 12.0, depth: 8.0, height: 0.05 },
        },
      },
      {
        id: 'zone-picking',
        label: 'Staging & Picking Lane',
        category: 'Operations',
        description: 'Buffer & order sorting lane',
        dimensions: '10.0m × 6.0m',
        badgeColor: '#f59e0b',
        item: {
          type: 'zone',
          subType: 'picking',
          defaultConfig: { width: 10.0, depth: 6.0, height: 0.05 },
        },
      },
      {
        id: 'zone-quarantine',
        label: 'Quarantine & QC Area',
        category: 'Inspection',
        description: 'Hold & inspection station',
        dimensions: '8.0m × 6.0m',
        badgeColor: '#f43f5e',
        item: {
          type: 'zone',
          subType: 'quarantine',
          defaultConfig: { width: 8.0, depth: 6.0, height: 0.05 },
        },
      },
    ],
  },
  {
    id: 'vertical-access',
    title: 'Vertical Access',
    icon: ArrowUpDown,
    count: 3,
    entries: [
      {
        id: 'connector-lift',
        label: 'Cargo Elevator / Lift',
        category: 'Elevator',
        description: 'Heavy cargo & AGV vertical lift',
        dimensions: '3.5m × 3.5m',
        badgeColor: '#6366f1',
        item: {
          type: 'connector',
          subType: 'lift',
          defaultConfig: { width: 3.5, depth: 3.5, height: 4.0 },
        },
      },
      {
        id: 'connector-ramp',
        label: 'Inclined Access Ramp',
        category: 'Ramp',
        description: 'Drivable ramp for forklifts & AGVs',
        dimensions: '3.2m × 10.0m',
        badgeColor: '#8b5cf6',
        item: {
          type: 'connector',
          subType: 'ramp',
          defaultConfig: { width: 3.2, depth: 10.0, height: 4.0 },
        },
      },
      {
        id: 'connector-stairs',
        label: 'Industrial Access Stairs',
        category: 'Stairs',
        description: 'Personnel & manual trolley stairs',
        dimensions: '1.6m × 4.5m',
        badgeColor: '#ec4899',
        item: {
          type: 'connector',
          subType: 'stairs',
          defaultConfig: { width: 1.6, depth: 4.5, height: 4.0 },
        },
      },
    ],
  },
];

function getEntryBadgeClasses(entry: PaletteEntry): string {
  if (entry.item.type === 'connector') {
    return 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300';
  }
  if (entry.item.type === 'rack') {
    return 'border-sky-200 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300';
  }
  if (entry.item.type === 'structural') {
    return 'border-purple-200 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300';
  }
  if (entry.item.type === 'zone') {
    switch (entry.item.subType) {
      case 'receiving':
        return 'border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
      case 'shipping':
        return 'border-sky-200 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300';
      case 'picking':
        return 'border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
      case 'quarantine':
        return 'border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300';
      default:
        return 'border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
    }
  }
  return 'border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300';
}

function PaletteCard({
  entry,
  onAddItem,
  onHover,
  onLeave,
}: {
  entry: PaletteEntry;
  onAddItem?: (item: DraggedPaletteItem) => void;
  onHover?: (entry: PaletteEntry, topPos: number) => void;
  onLeave?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const setDraggedItem = useEditorStore((s) => s.setDraggedItem);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    onLeave?.();
    event.dataTransfer.setData('application/x-warehouse-item', entry.id);
    event.dataTransfer.effectAllowed = 'copy';
    setPlacementItem(entry.item);
    setDraggedItem(entry.item);
  };

  const handleDragEnd = () => {
    resetPlacementBus();
    setDraggedItem(null);
  };

  const handlePointerEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onHover?.(entry, rect.top);
    }
  };

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={onLeave}
      onClick={() => onAddItem?.(entry.item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAddItem?.(entry.item);
        }
      }}
      className="group relative flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/90 p-3 transition-all duration-150 hover:border-sky-400 hover:bg-slate-50 dark:hover:bg-neutral-850 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-0.5 active:scale-[0.98] cursor-grab active:cursor-grabbing select-none shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getEntryBadgeClasses(
            entry
          )}`}
        >
          {entry.category}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddItem?.(entry.item);
          }}
          className="flex items-center gap-1 rounded bg-sky-600/20 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400 opacity-80 transition hover:bg-sky-600 hover:text-white group-hover:opacity-100"
          title="Click to place on floor"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          <span>Add</span>
        </button>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-200 transition-colors">
          {entry.label}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">{entry.description}</p>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 dark:border-neutral-800/80 pt-1.5 text-[10px] text-slate-500 dark:text-neutral-500">
        <span>Dim: {entry.dimensions}</span>
        <span className="text-slate-500 group-hover:text-slate-700 dark:text-neutral-400 dark:group-hover:text-neutral-300">Drag / Click</span>
      </div>
    </div>
  );
}

export function SidebarPalette({
  onAddItem,
  onOpenAisleGenerator,
}: {
  onAddItem?: (item: DraggedPaletteItem) => void;
  onOpenAisleGenerator?: () => void;
}) {
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const setActiveLevelId = useEditorStore((s) => s.setActiveLevelId);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'storage-racks': true,
    'facility-structures': true,
    'operational-zones': true,
  });

  const [hoveredEntry, setHoveredEntry] = useState<{ entry: PaletteEntry; topPos: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCardHover = (entry: PaletteEntry, topPos: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEntry({ entry, topPos });
    }, 150);
  };

  const handleCardLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEntry(null);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const query = searchQuery.trim().toLowerCase();

  return (
    <div
      data-tour="asset-catalogue"
      className="flex h-full flex-col select-none text-xs"
    >
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/40">
        <div className="relative">
          <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-400 dark:text-neutral-500">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 15 asset types…"
            className="w-full rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-950/80 py-1.5 pl-8 pr-6 text-xs text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Active Floor Target Indicator Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100/90 dark:bg-neutral-900/95 border-b border-slate-200 dark:border-neutral-800 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-neutral-400">
          <Layers className="h-3.5 w-3.5 text-sky-500" strokeWidth={2} />
          <span className="text-[11px] font-medium">Target Lantai:</span>
        </div>
        <select
          value={activeLevelId}
          onChange={(e) => setActiveLevelId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-neutral-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="ALL">Semua Lantai (Auto)</option>
          {buildingLevels.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.name} ({lvl.elevationY.toFixed(1)}m)
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {PALETTE_SECTIONS.map((section) => {
          const matchingEntries = section.entries.filter(
            (e) =>
              !query ||
              e.label.toLowerCase().includes(query) ||
              e.category.toLowerCase().includes(query) ||
              e.description.toLowerCase().includes(query)
          );

          if (query && matchingEntries.length === 0) return null;

          const isOpen = query ? true : !!openSections[section.id];
          const SectionIcon = section.icon;

          return (
            <div
              key={section.id}
              className="rounded-2xl border border-slate-200 dark:border-neutral-800/90 bg-white dark:bg-neutral-900/60 overflow-hidden backdrop-blur-sm shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between bg-slate-50 dark:bg-neutral-900/90 px-3.5 py-2.5 text-left text-xs font-bold text-slate-800 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800/80 transition"
              >
                <div className="flex items-center gap-2">
                  <SectionIcon className="h-4 w-4 text-slate-600 dark:text-neutral-300" strokeWidth={1.75} />
                  <span>{section.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border ${
                      section.id === 'storage-racks'
                        ? 'border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300'
                        : section.id === 'facility-structures'
                        ? 'border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                        : 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {matchingEntries.length}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={1.75}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2 p-2.5 border-t border-slate-200 dark:border-neutral-800/60 bg-slate-50/50 dark:bg-neutral-950/40">
                  {section.id === 'storage-racks' && onOpenAisleGenerator && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAisleGenerator();
                      }}
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-sky-400/40 bg-sky-50 dark:bg-sky-950/50 py-2 px-3 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 hover:border-sky-500 transition shadow-sm mb-1"
                      title="Generate array of parallel rack aisles with corridor spacing"
                    >
                      <Grid className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" strokeWidth={1.75} />
                      <span>Array Lorong (Aisle Generator)</span>
                    </button>
                  )}
                  {matchingEntries.map((entry) => (
                    <PaletteCard
                      key={entry.id}
                      entry={entry}
                      onAddItem={onAddItem}
                      onHover={handleCardHover}
                      onLeave={handleCardLeave}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/60 text-[11px] text-slate-600 dark:text-neutral-400">
        <p className="font-semibold text-slate-800 dark:text-neutral-300 mb-0.5 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
          <span>Placement Controls</span>
        </p>
        <p className="text-[10px] text-slate-500 dark:text-neutral-500 leading-normal">
          Click <span className="text-sky-600 dark:text-sky-400 font-semibold">+ Add</span> to spawn in camera view, or drag onto floor.
        </p>
      </div>

      {/* Floating 3D Isometric Shape & Specs Popover Preview */}
      {hoveredEntry && (
        <CatalogItemPreviewPopover
          entry={hoveredEntry.entry}
          topPos={hoveredEntry.topPos}
        />
      )}
    </div>
  );
}


