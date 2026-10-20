'use client';

// Fulfills INTERACTION-SPECIFICATION.md Section 7 Keyboard & Shortcut Bindings:
// R rotate, Delete remove, Esc deselect, Ctrl+Z / Ctrl+Y undo-redo,
// F focus, Space reset, G snap, ?/H moveset guide, 2/3/4/5 camera presets.
// Skips events originating from text inputs.

import { useEffect } from 'react';
import { createRemoveRackCommand } from '@/engine/commands/RemoveEntityCommand';
import { createRotateRackCommand } from '@/engine/commands/RotateEntityCommand';
import {
  createRemoveStructuralElementCommand,
  createRotateStructuralElementCommand,
} from '@/engine/commands/StructuralCommands';
import { createRemoveZoneCommand } from '@/engine/commands/ZoneCommands';
import {
  createBulkDeleteCommand,
  createBulkDuplicateCommand,
  createBulkRotateCommand,
  type EntityRotationRecord,
} from '@/engine/commands/BulkCommands';
import { cameraBus } from '@/lib/camera/camera-bus';
import { useEditorStore } from '@/stores/useEditorStore';

export function useEditorShortcuts(onToggleControls?: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const state = useEditorStore.getState();
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      // History commands (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        state.undo();
        return;
      }
      if ((mod && key === 'y') || (mod && event.shiftKey && key === 'z')) {
        event.preventDefault();
        state.redo();
        return;
      }
      // Bulk Duplicate shortcut (Ctrl+D)
      if (mod && key === 'd') {
        event.preventDefault();
        const ids = state.selectedEntityIds;
        if (ids.length > 0) {
          const selectedRacks = state.racks.filter((r) => ids.includes(r.id));
          const selectedStructures = state.structuralElements.filter((s) => ids.includes(s.id));
          const selectedZones = state.zones.filter((z) => ids.includes(z.id));
          state.executeCommand(
            createBulkDuplicateCommand(
              { racks: selectedRacks, structures: selectedStructures, zones: selectedZones },
              { x: 2, z: 2 }
            )
          );
        }
        return;
      }
      if (mod) return;

      switch (key) {
        case '?':
        case 'h': {
          event.preventDefault();
          onToggleControls?.();
          break;
        }
        case 'f': {
          event.preventDefault();
          cameraBus.focusSelected();
          break;
        }
        case ' ': {
          event.preventDefault();
          cameraBus.resetOverview();
          break;
        }
        case 'g': {
          event.preventDefault();
          state.toggleSnapping();
          break;
        }
        case '2':
        case 'v': {
          event.preventDefault();
          cameraBus.setPreset('ORTHO_2D');
          break;
        }
        case '3':
        case 'b': {
          event.preventDefault();
          cameraBus.setPreset('PERSP_3D');
          break;
        }
        case '4': {
          event.preventDefault();
          cameraBus.setPreset('FRONT');
          break;
        }
        case '5': {
          event.preventDefault();
          cameraBus.setPreset('SIDE');
          break;
        }
        case 'r': {
          // Multi-selection bulk rotate
          if (state.selectedEntityIds.length > 1) {
            const rotations: EntityRotationRecord[] = [];
            for (const r of state.racks) {
              if (state.selectedEntityIds.includes(r.id)) {
                rotations.push({
                  id: r.id,
                  type: 'rack',
                  fromRotation: r.rotationY,
                  toRotation: (r.rotationY + Math.PI / 2) % (Math.PI * 2),
                });
              }
            }
            for (const s of state.structuralElements) {
              if (state.selectedEntityIds.includes(s.id)) {
                rotations.push({
                  id: s.id,
                  type: 'structure',
                  fromRotation: s.rotationY,
                  toRotation: (s.rotationY + Math.PI / 2) % (Math.PI * 2),
                });
              }
            }
            if (rotations.length > 0) {
              state.executeCommand(createBulkRotateCommand(rotations));
              return;
            }
          }

          // Single selection rotate
          if (state.selectedEntityId) {
            const rack = state.racks.find((r) => r.id === state.selectedEntityId);
            if (rack) {
              state.executeCommand(createRotateRackCommand(state.selectedEntityId));
              return;
            }
            const struct = state.structuralElements.find((s) => s.id === state.selectedEntityId);
            if (struct) {
              const nextRot = (struct.rotationY + Math.PI / 2) % (Math.PI * 2);
              state.executeCommand(createRotateStructuralElementCommand(state.selectedEntityId, struct.rotationY, nextRot));
              return;
            }
          }
          break;
        }
        case 'delete':
        case 'backspace': {
          // Multi-selection bulk delete
          if (state.selectedEntityIds.length > 1) {
            const selectedRacks = state.racks.filter((r) => state.selectedEntityIds.includes(r.id));
            const selectedStructures = state.structuralElements.filter((s) => state.selectedEntityIds.includes(s.id));
            const selectedZones = state.zones.filter((z) => state.selectedEntityIds.includes(z.id));
            state.executeCommand(
              createBulkDeleteCommand({
                racks: selectedRacks,
                structures: selectedStructures,
                zones: selectedZones,
              })
            );
            return;
          }

          // Single selection delete
          if (state.selectedEntityId) {
            const rack = state.racks.find((r) => r.id === state.selectedEntityId);
            if (rack) {
              state.executeCommand(createRemoveRackCommand(rack));
              state.deselectEntity();
              return;
            }
            const struct = state.structuralElements.find((s) => s.id === state.selectedEntityId);
            if (struct) {
              state.executeCommand(createRemoveStructuralElementCommand(struct));
              state.deselectEntity();
              return;
            }
            const zone = state.zones.find((z) => z.id === state.selectedEntityId);
            if (zone) {
              state.executeCommand(createRemoveZoneCommand(zone));
              state.deselectEntity();
              return;
            }
          }
          break;
        }
        case 'escape': {
          if (state.selectedBinId) {
            state.deselectBin();
            break;
          }
          if (state.draggedItem) {
            state.setDraggedItem(null);
          }
          state.clearSelection();
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleControls]);
}
