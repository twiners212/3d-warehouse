// Atomic Commands for Bulk/Multi-Entity Operations.
// Implements ICommand so any multi-entity move, delete, duplicate, or rotate
// is committed as a single undoable action (single Ctrl+Z reverses the whole group).

import type { ICommand } from './Command';
import type { RackEntity, StructuralElement, WarehouseZone } from '@/types/layout';
import type { Vector3D } from '@/types/spatial';
import { useEditorStore } from '@/stores/useEditorStore';
import { nextRackId, nextRackName, nextStructureId, nextStructureName, nextZoneId, nextZoneName } from '../procedural/naming';
import { generateBinsForRack } from '../procedural/bin-generator';
import { calculateZonePalletSlots } from '../procedural/zone-pallet-generator';

export interface EntityMoveRecord {
  id: string;
  type: 'rack' | 'structure' | 'zone';
  from: Vector3D;
  to: Vector3D;
}

export function createBulkMoveCommand(moves: EntityMoveRecord[]): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      for (const m of moves) {
        if (m.type === 'rack') state.moveRack(m.id, m.to);
        else if (m.type === 'structure') state.moveStructuralElement(m.id, m.to);
        else if (m.type === 'zone') state.moveZone(m.id, m.to);
      }
    },
    undo: () => {
      const state = useEditorStore.getState();
      for (const m of moves) {
        if (m.type === 'rack') state.moveRack(m.id, m.from);
        else if (m.type === 'structure') state.moveStructuralElement(m.id, m.from);
        else if (m.type === 'zone') state.moveZone(m.id, m.from);
      }
    },
  };
}

export interface BulkEntitiesPayload {
  racks: RackEntity[];
  structures: StructuralElement[];
  zones: WarehouseZone[];
}

export function createBulkDeleteCommand(snapshot: BulkEntitiesPayload): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      for (const r of snapshot.racks) state.removeRack(r.id);
      for (const s of snapshot.structures) state.removeStructuralElement(s.id);
      for (const z of snapshot.zones) state.removeZone(z.id);
      state.clearSelection();
    },
    undo: () => {
      const state = useEditorStore.getState();
      const restoredIds: string[] = [];
      for (const r of snapshot.racks) {
        state.addRack(r);
        restoredIds.push(r.id);
      }
      for (const s of snapshot.structures) {
        state.addStructuralElement(s);
        restoredIds.push(s.id);
      }
      for (const z of snapshot.zones) {
        state.addZone(z);
        restoredIds.push(z.id);
      }
      state.setMultipleSelection(restoredIds);
    },
  };
}

export function createBulkDuplicateCommand(
  source: BulkEntitiesPayload,
  offset: { x: number; z: number } = { x: 2, z: 2 }
): ICommand {
  let clonedRacks: RackEntity[] = [];
  let clonedStructures: StructuralElement[] = [];
  let clonedZones: WarehouseZone[] = [];
  let generated = false;

  return {
    execute: () => {
      const state = useEditorStore.getState();

      if (!generated) {
        // Clone racks
        clonedRacks = source.racks.map((r) => {
          const newId = nextRackId();
          const clone: RackEntity = {
            ...r,
            id: newId,
            name: nextRackName([...state.racks, ...clonedRacks]),
            position: {
              x: Math.min(state.floorDimensions.width - r.dimensions.width / 2, r.position.x + offset.x),
              y: r.position.y,
              z: Math.min(state.floorDimensions.depth - r.dimensions.depth / 2, r.position.z + offset.z),
            },
            bins: [],
          };
          clone.bins = generateBinsForRack(clone);
          return clone;
        });

        // Clone structures
        clonedStructures = source.structures.map((s) => {
          const newId = nextStructureId();
          return {
            ...s,
            id: newId,
            name: nextStructureName(s.type, [...state.structuralElements, ...clonedStructures]),
            position: {
              x: Math.min(state.floorDimensions.width - s.dimensions.width / 2, s.position.x + offset.x),
              y: s.position.y,
              z: Math.min(state.floorDimensions.depth - s.dimensions.depth / 2, s.position.z + offset.z),
            },
          };
        });

        // Clone zones
        clonedZones = source.zones.map((z) => {
          const newId = nextZoneId();
          const newName = nextZoneName(z.type, [...state.zones, ...clonedZones]);
          const clone: WarehouseZone = {
            ...z,
            id: newId,
            name: newName,
            position: {
              x: Math.min(state.floorDimensions.width - z.dimensions.width / 2, z.position.x + offset.x),
              y: z.position.y,
              z: Math.min(state.floorDimensions.depth - z.dimensions.depth / 2, z.position.z + offset.z),
            },
          };
          if (clone.stagingConfig) {
            // Regenerate staging config slots with unique IDs under the cloned zone
            clone.stagingConfig = {
              ...clone.stagingConfig,
              slots: calculateZonePalletSlots({
                ...clone,
                stagingConfig: {
                  ...clone.stagingConfig,
                  slots: undefined,
                },
              }),
            };
          }
          return clone;
        });

        generated = true;
      }

      const newIds: string[] = [];
      for (const r of clonedRacks) {
        state.addRack(r);
        newIds.push(r.id);
      }
      for (const s of clonedStructures) {
        state.addStructuralElement(s);
        newIds.push(s.id);
      }
      for (const z of clonedZones) {
        state.addZone(z);
        newIds.push(z.id);
      }

      state.setMultipleSelection(newIds);
    },
    undo: () => {
      const state = useEditorStore.getState();
      for (const r of clonedRacks) state.removeRack(r.id);
      for (const s of clonedStructures) state.removeStructuralElement(s.id);
      for (const z of clonedZones) state.removeZone(z.id);
      state.clearSelection();
    },
  };
}

export interface EntityRotationRecord {
  id: string;
  type: 'rack' | 'structure';
  fromRotation: number;
  toRotation: number;
}

export function createBulkRotateCommand(rotations: EntityRotationRecord[]): ICommand {
  return {
    execute: () => {
      const state = useEditorStore.getState();
      for (const r of rotations) {
        if (r.type === 'rack') state.rotateRack(r.id, r.toRotation);
        else if (r.type === 'structure') state.rotateStructuralElement(r.id, r.toRotation);
      }
    },
    undo: () => {
      const state = useEditorStore.getState();
      for (const r of rotations) {
        if (r.type === 'rack') state.rotateRack(r.id, r.fromRotation);
        else if (r.type === 'structure') state.rotateStructuralElement(r.id, r.fromRotation);
      }
    },
  };
}
