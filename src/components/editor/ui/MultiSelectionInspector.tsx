'use client';

// Multi-Selection Inspector panel.
// Rendered in the right sidebar when 2 or more entities are selected.
// Provides bulk actions (delete, duplicate, rotate 90°) and spatial alignment tools.

import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  createBulkDeleteCommand,
  createBulkDuplicateCommand,
  createBulkRotateCommand,
  createBulkMoveCommand,
  type EntityMoveRecord,
  type EntityRotationRecord,
  type BulkEntitiesPayload,
} from '@/engine/commands/BulkCommands';
import type { Vector3D } from '@/types/spatial';
import {
  Boxes,
  Building2,
  Layers,
  Copy,
  RotateCw,
  Trash2,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  Lightbulb,
} from 'lucide-react';

export function MultiSelectionInspector() {
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const racks = useEditorStore((s) => s.racks);
  const structuralElements = useEditorStore((s) => s.structuralElements);
  const zones = useEditorStore((s) => s.zones);
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const deselectEntity = useEditorStore((s) => s.deselectEntity);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter selected entities
  const selectedRacks = racks.filter((r) => selectedEntityIds.includes(r.id));
  const selectedStructures = structuralElements.filter((s) => selectedEntityIds.includes(s.id));
  const selectedZones = zones.filter((z) => selectedEntityIds.includes(z.id));

  const totalCount = selectedRacks.length + selectedStructures.length + selectedZones.length;

  const payload: BulkEntitiesPayload = {
    racks: selectedRacks,
    structures: selectedStructures,
    zones: selectedZones,
  };

  // 1. Bulk Delete Action
  const handleDeleteAll = () => {
    executeCommand(createBulkDeleteCommand(payload));
    setShowDeleteConfirm(false);
  };

  // 2. Bulk Duplicate Action
  const handleDuplicate = () => {
    executeCommand(createBulkDuplicateCommand(payload, { x: 2, z: 2 }));
  };

  // 3. Bulk Rotate 90° Action
  const handleRotate90 = () => {
    const rotations: EntityRotationRecord[] = [];
    for (const r of selectedRacks) {
      rotations.push({
        id: r.id,
        type: 'rack',
        fromRotation: r.rotationY,
        toRotation: (r.rotationY + Math.PI / 2) % (Math.PI * 2),
      });
    }
    for (const s of selectedStructures) {
      rotations.push({
        id: s.id,
        type: 'structure',
        fromRotation: s.rotationY,
        toRotation: (s.rotationY + Math.PI / 2) % (Math.PI * 2),
      });
    }
    if (rotations.length > 0) {
      executeCommand(createBulkRotateCommand(rotations));
    }
  };

  // Helper: Get list of all selected items with bounds
  const getSelectedItemsBounds = () => {
    const items: Array<{
      id: string;
      type: 'rack' | 'structure' | 'zone';
      pos: Vector3D;
      width: number;
      depth: number;
    }> = [];

    for (const r of selectedRacks) {
      items.push({ id: r.id, type: 'rack', pos: r.position, width: r.dimensions.width, depth: r.dimensions.depth });
    }
    for (const s of selectedStructures) {
      items.push({ id: s.id, type: 'structure', pos: s.position, width: s.dimensions.width, depth: s.dimensions.depth });
    }
    for (const z of selectedZones) {
      items.push({ id: z.id, type: 'zone', pos: z.position, width: z.dimensions.width, depth: z.dimensions.depth });
    }
    return items;
  };

  // 4. Align Left (Min X edge)
  const handleAlignLeft = () => {
    const items = getSelectedItemsBounds();
    if (items.length < 2) return;

    const minXEdge = Math.min(...items.map((it) => it.pos.x - it.width / 2));
    const moves: EntityMoveRecord[] = [];

    for (const it of items) {
      const targetX = minXEdge + it.width / 2;
      if (Math.abs(it.pos.x - targetX) > 0.01) {
        moves.push({
          id: it.id,
          type: it.type,
          from: it.pos,
          to: { x: targetX, y: it.pos.y, z: it.pos.z },
        });
      }
    }
    if (moves.length > 0) executeCommand(createBulkMoveCommand(moves));
  };

  // 5. Align Right (Max X edge)
  const handleAlignRight = () => {
    const items = getSelectedItemsBounds();
    if (items.length < 2) return;

    const maxXEdge = Math.max(...items.map((it) => it.pos.x + it.width / 2));
    const moves: EntityMoveRecord[] = [];

    for (const it of items) {
      const targetX = maxXEdge - it.width / 2;
      if (Math.abs(it.pos.x - targetX) > 0.01) {
        moves.push({
          id: it.id,
          type: it.type,
          from: it.pos,
          to: { x: targetX, y: it.pos.y, z: it.pos.z },
        });
      }
    }
    if (moves.length > 0) executeCommand(createBulkMoveCommand(moves));
  };

  // 6. Align Top (Min Z edge)
  const handleAlignTop = () => {
    const items = getSelectedItemsBounds();
    if (items.length < 2) return;

    const minZEdge = Math.min(...items.map((it) => it.pos.z - it.depth / 2));
    const moves: EntityMoveRecord[] = [];

    for (const it of items) {
      const targetZ = minZEdge + it.depth / 2;
      if (Math.abs(it.pos.z - targetZ) > 0.01) {
        moves.push({
          id: it.id,
          type: it.type,
          from: it.pos,
          to: { x: it.pos.x, y: it.pos.y, z: targetZ },
        });
      }
    }
    if (moves.length > 0) executeCommand(createBulkMoveCommand(moves));
  };

  // 7. Align Bottom (Max Z edge)
  const handleAlignBottom = () => {
    const items = getSelectedItemsBounds();
    if (items.length < 2) return;

    const maxZEdge = Math.max(...items.map((it) => it.pos.z + it.depth / 2));
    const moves: EntityMoveRecord[] = [];

    for (const it of items) {
      const targetZ = maxZEdge - it.depth / 2;
      if (Math.abs(it.pos.z - targetZ) > 0.01) {
        moves.push({
          id: it.id,
          type: it.type,
          from: it.pos,
          to: { x: it.pos.x, y: it.pos.y, z: targetZ },
        });
      }
    }
    if (moves.length > 0) executeCommand(createBulkMoveCommand(moves));
  };

  // 8. Distribute Evenly (X Axis)
  const handleDistributeX = () => {
    const items = getSelectedItemsBounds();
    if (items.length < 3) return;

    const sorted = [...items].sort((a, b) => a.pos.x - b.pos.x);
    const minX = sorted[0].pos.x;
    const maxX = sorted[sorted.length - 1].pos.x;
    const step = (maxX - minX) / (sorted.length - 1);

    const moves: EntityMoveRecord[] = [];
    for (let i = 1; i < sorted.length - 1; i++) {
      const targetX = minX + i * step;
      if (Math.abs(sorted[i].pos.x - targetX) > 0.01) {
        moves.push({
          id: sorted[i].id,
          type: sorted[i].type,
          from: sorted[i].pos,
          to: { x: targetX, y: sorted[i].pos.y, z: sorted[i].pos.z },
        });
      }
    }
    if (moves.length > 0) executeCommand(createBulkMoveCommand(moves));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-800">
      {/* Header Banner */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase">
              Multi-Selection
            </h2>
          </div>
          <button
            onClick={() => deselectEntity()}
            className="text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition"
            title="Deselect All (Esc)"
          >
            Clear (Esc)
          </button>
        </div>
        <p className="text-xs text-sky-600 dark:text-sky-400 font-semibold mt-1.5">
          {totalCount} Objek Terpilih
        </p>
      </div>

      {/* Breakdown Breakdown List */}
      <div className="p-4 space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Komposisi Grup
        </h3>
        <div className="space-y-1.5 text-xs">
          {selectedRacks.length > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Boxes className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.75} />
                <span>Storage Racks</span>
              </span>
              <span className="font-bold text-sky-600 dark:text-sky-300">{selectedRacks.length}</span>
            </div>
          )}
          {selectedStructures.length > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Building2 className="h-3.5 w-3.5 text-purple-500" strokeWidth={1.75} />
                <span>Fasilitas / Struktur</span>
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-300">{selectedStructures.length}</span>
            </div>
          )}
          {selectedZones.length > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Layers className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.75} />
                <span>Zona Operasional</span>
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-300">{selectedZones.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Aksi Massal
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDuplicate}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95 shadow-sm"
            title="Duplikasi seluruh grup (Ctrl+D)"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Duplikasi (Ctrl+D)</span>
          </button>

          <button
            onClick={handleRotate90}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95 shadow-sm"
            title="Putar semua objek 90° (R)"
          >
            <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Putar 90° (R)</span>
          </button>
        </div>

        {/* Delete button or confirmation */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-300 hover:text-white bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-600 border border-rose-200 dark:border-rose-500/30 hover:border-rose-500 rounded-lg transition active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Hapus Semua ({totalCount} Item)</span>
          </button>
        ) : (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 space-y-2">
            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium text-center">
              Yakin hapus {totalCount} objek terpilih?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spatial Alignment Toolbar */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Perataan Posisi (Alignment)
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAlignLeft}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95"
            title="Sejajarkan sisi kiri objek"
          >
            <AlignLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Rata Kiri</span>
          </button>
          <button
            onClick={handleAlignRight}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95"
            title="Sejajarkan sisi kanan objek"
          >
            <AlignRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Rata Kanan</span>
          </button>
          <button
            onClick={handleAlignTop}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95"
            title="Sejajarkan sisi atas (Z min)"
          >
            <AlignStartVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Rata Atas</span>
          </button>
          <button
            onClick={handleAlignBottom}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95"
            title="Sejajarkan sisi bawah (Z max)"
          >
            <AlignEndVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Rata Bawah</span>
          </button>
        </div>

        <button
          onClick={handleDistributeX}
          disabled={totalCount < 3}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Ratakan jarak horizontal (butuh min 3 objek)"
        >
          <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Ratakan Spasi Horizontal</span>
        </button>
      </div>

      {/* Usage Quick Tips */}
      <div className="p-4 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 bg-slate-50 dark:bg-slate-900/40">
        <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
          <span>Tips Multi-Seleksi:</span>
        </p>
        <p>• Klik & seret salah satu objek di 3D canvas untuk memindahkan seluruh grup secara bersamaan.</p>
        <p>• Tahan <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[10px] text-slate-800 dark:text-slate-200">Shift</kbd> + Klik untuk menambah/mengurangi objek.</p>
        <p>• Tahan <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[10px] text-slate-800 dark:text-slate-200">Shift</kbd> + Drag di lantai kosong untuk membuat kotak seleksi.</p>
      </div>
    </div>
  );
}
