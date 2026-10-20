'use client';

// Scene Outliner / Hierarchy Inspector
// Displays a structured hierarchical tree of all placed entities (Racks, Structures, Zones)
// with live search filtering, click-to-select with 3D camera auto-framing, and quick actions.

import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { cameraBus } from '@/lib/camera/camera-bus';
import { createRemoveRackCommand } from '@/engine/commands/RemoveEntityCommand';
import { createRemoveStructuralElementCommand } from '@/engine/commands/StructuralCommands';
import { createRemoveZoneCommand } from '@/engine/commands/ZoneCommands';
import { createRemoveVerticalConnectorCommand } from '@/engine/commands/VerticalConnectorCommands';
import type { RackEntity, StructuralElement, WarehouseZone, VerticalConnector } from '@/types/layout';
import {
  Search,
  X,
  Boxes,
  Building2,
  Layers,
  DoorClosed,
  BrickWall,
  ShieldAlert,
  Columns,
  Trash2,
  ArrowUpDown,
  Zap,
} from 'lucide-react';

export function SceneOutliner() {
  const [filterQuery, setFilterQuery] = useState<string>('');

  const racks = useEditorStore((s) => s.racks);
  const structures = useEditorStore((s) => s.structuralElements);
  const zones = useEditorStore((s) => s.zones);
  const connectors = useEditorStore((s) => s.verticalConnectors ?? []);
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId);
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);

  const selectEntity = useEditorStore((s) => s.selectEntity);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);

  const query = filterQuery.toLowerCase().trim();

  const filteredRacks = racks.filter(
    (r) => r.name.toLowerCase().includes(query) || r.type.toLowerCase().includes(query)
  );

  const filteredStructures = structures.filter(
    (st) => st.name.toLowerCase().includes(query) || st.type.toLowerCase().includes(query)
  );

  const filteredZones = zones.filter(
    (z) => z.name.toLowerCase().includes(query) || z.type.toLowerCase().includes(query)
  );

  const filteredConnectors = connectors.filter(
    (c) => c.name.toLowerCase().includes(query) || c.type.toLowerCase().includes(query)
  );

  const totalEntities = racks.length + structures.length + zones.length + connectors.length;

  const handleSelectItem = (id: string) => {
    if (editorViewMode !== 'LAYOUT') return;
    selectEntity(id);
    // Smooth camera framing on the selected item
    setTimeout(() => {
      cameraBus.focusSelected();
    }, 50);
  };

  const handleDeleteRack = (e: React.MouseEvent, rack: RackEntity) => {
    e.stopPropagation();
    if (editorViewMode !== 'LAYOUT') return;
    executeCommand(createRemoveRackCommand(rack));
  };

  const handleDeleteStructure = (e: React.MouseEvent, el: StructuralElement) => {
    e.stopPropagation();
    if (editorViewMode !== 'LAYOUT') return;
    executeCommand(createRemoveStructuralElementCommand(el));
  };

  const handleDeleteZone = (e: React.MouseEvent, z: WarehouseZone) => {
    e.stopPropagation();
    if (editorViewMode !== 'LAYOUT') return;
    executeCommand(createRemoveZoneCommand(z));
  };

  const handleDeleteConnector = (e: React.MouseEvent, c: VerticalConnector) => {
    e.stopPropagation();
    if (editorViewMode !== 'LAYOUT') return;
    executeCommand(createRemoveVerticalConnectorCommand(c));
  };

  return (
    <div
      data-tour="scene-outliner"
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
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter scene objects…"
            className="w-full rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-950/80 py-1.5 pl-8 pr-6 text-xs text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Picking Mode Selection Lock Notice */}
      {editorViewMode === 'PICKING' && (
        <div className="mx-3 mt-2.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-2">
          <span className="text-sm">🔒</span>
          <span>Seleksi objek layout dikunci selama simulasi Picking Route aktif.</span>
        </div>
      )}

      {/* Entity Tree Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {totalEntities === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-neutral-500 space-y-2">
            <Boxes className="h-8 w-8 text-slate-300 dark:text-neutral-700" strokeWidth={1.5} />
            <p className="text-xs font-medium text-slate-700 dark:text-neutral-400">Scene is Empty</p>
            <p className="text-[11px] text-slate-500 dark:text-neutral-600">
              Drag or click items from the Asset Catalogue to populate your warehouse.
            </p>
          </div>
        ) : (
          <>
            {/* Storage Racks Section */}
            <div>
              <div className="flex items-center justify-between pb-1.5 text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.75} />
                  <span>Racking Units</span>
                </span>
                <span className="rounded-full bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-300 font-mono font-semibold">
                  {filteredRacks.length}
                </span>
              </div>

              <div className="space-y-1">
                {filteredRacks.length === 0 && query ? (
                  <p className="text-[11px] text-slate-400 dark:text-neutral-600 italic px-2 py-1">No racks match</p>
                ) : (
                  filteredRacks.map((rack) => {
                    const isSelected =
                      selectedEntityId === rack.id || selectedEntityIds.includes(rack.id);
                    return (
                      <div
                        key={rack.id}
                        onClick={() => handleSelectItem(rack.id)}
                        className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition cursor-pointer ${
                          isSelected
                            ? 'border border-sky-500/70 bg-sky-50 dark:bg-sky-950/50 text-slate-900 dark:text-white shadow-sm ring-1 ring-sky-500/30'
                            : 'border border-transparent bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-200 dark:hover:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <Boxes className="h-3.5 w-3.5 text-sky-500 shrink-0" strokeWidth={1.75} />
                          <div className="truncate">
                            <span className="font-bold text-slate-900 dark:text-neutral-100">{rack.name}</span>
                            <span className="ml-1.5 text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                              ({rack.bays}b × {rack.levels}l · {rack.bins.length} bins)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRack(e, rack)}
                            className="p-1 text-slate-400 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition rounded"
                            title="Remove Rack"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Facility Structures Section */}
            {structures.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-1.5 text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-purple-500" strokeWidth={1.75} />
                    <span>Facility Structures</span>
                  </span>
                  <span className="rounded-full bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 text-[10px] text-purple-700 dark:text-purple-300 font-mono font-semibold">
                    {filteredStructures.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredStructures.length === 0 && query ? (
                    <p className="text-[11px] text-slate-400 dark:text-neutral-600 italic px-2 py-1">No structures match</p>
                  ) : (
                    filteredStructures.map((el) => {
                      const isSelected =
                        selectedEntityId === el.id || selectedEntityIds.includes(el.id);
                      return (
                        <div
                          key={el.id}
                          onClick={() => handleSelectItem(el.id)}
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition cursor-pointer ${
                            isSelected
                              ? 'border border-purple-500/70 bg-purple-50 dark:bg-purple-950/50 text-slate-900 dark:text-white shadow-sm ring-1 ring-purple-500/30'
                              : 'border border-transparent bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-200 dark:hover:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            {el.type === 'dock_door' ? (
                              <DoorClosed className="h-3.5 w-3.5 text-purple-500 shrink-0" strokeWidth={1.75} />
                            ) : el.type === 'wall' ? (
                              <BrickWall className="h-3.5 w-3.5 text-purple-500 shrink-0" strokeWidth={1.75} />
                            ) : el.type === 'bollard' ? (
                              <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={1.75} />
                            ) : el.type === 'charging_dock' ? (
                              <Zap className="h-3.5 w-3.5 text-cyan-500 shrink-0" strokeWidth={1.75} />
                            ) : (
                              <Columns className="h-3.5 w-3.5 text-purple-500 shrink-0" strokeWidth={1.75} />
                            )}
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-neutral-100">{el.name}</span>
                              <span className="ml-1.5 text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                                ({el.dimensions.width}×{el.dimensions.depth}m)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteStructure(e, el)}
                              className="p-1 text-slate-400 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition rounded"
                              title="Remove Structure"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Operational Zones Section */}
            {zones.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-1.5 text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.75} />
                    <span>Floor Zones</span>
                  </span>
                  <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-semibold">
                    {filteredZones.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredZones.length === 0 && query ? (
                    <p className="text-[11px] text-slate-400 dark:text-neutral-600 italic px-2 py-1">No zones match</p>
                  ) : (
                    filteredZones.map((z) => {
                      const isSelected =
                        selectedEntityId === z.id || selectedEntityIds.includes(z.id);
                      return (
                        <div
                          key={z.id}
                          onClick={() => handleSelectItem(z.id)}
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition cursor-pointer ${
                            isSelected
                              ? 'border border-emerald-500/70 bg-emerald-50 dark:bg-emerald-950/50 text-slate-900 dark:text-white shadow-sm ring-1 ring-emerald-500/30'
                              : 'border border-transparent bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-200 dark:hover:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: z.colorHex }}
                            />
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-neutral-100">{z.name}</span>
                              <span className="ml-1.5 text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                                ({z.dimensions.width}×{z.dimensions.depth}m)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteZone(e, z)}
                              className="p-1 text-slate-400 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition rounded"
                              title="Remove Zone"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Vertical Connectors Section */}
            {connectors.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-1.5 text-[11px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-indigo-500" strokeWidth={1.75} />
                    <span>Vertical Connectors</span>
                  </span>
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 font-mono font-semibold">
                    {filteredConnectors.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredConnectors.length === 0 && query ? (
                    <p className="text-[11px] text-slate-400 dark:text-neutral-600 italic px-2 py-1">
                      No connectors match
                    </p>
                  ) : (
                    filteredConnectors.map((c) => {
                      const isSelected =
                        selectedEntityId === c.id || selectedEntityIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectItem(c.id)}
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition cursor-pointer ${
                            isSelected
                              ? 'border border-indigo-500/70 bg-indigo-50 dark:bg-indigo-950/50 text-slate-900 dark:text-white shadow-sm ring-1 ring-indigo-500/30'
                              : 'border border-transparent bg-slate-50 dark:bg-neutral-900/40 text-slate-700 dark:text-neutral-300 hover:border-slate-200 dark:hover:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <ArrowUpDown className="h-3.5 w-3.5 text-indigo-500 shrink-0" strokeWidth={1.75} />
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-neutral-100">{c.name}</span>
                              <span className="ml-1.5 text-[10px] text-slate-500 dark:text-neutral-400 font-mono uppercase">
                                ({c.type} · {c.dimensions.width}×{c.dimensions.depth}m)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteConnector(e, c)}
                              className="p-1 text-slate-400 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition rounded"
                              title="Remove Connector"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/60 text-[10px] text-slate-500 dark:text-neutral-500 text-center font-mono">
        Click an item to inspect & frame camera in 3D
      </div>
    </div>
  );
}
