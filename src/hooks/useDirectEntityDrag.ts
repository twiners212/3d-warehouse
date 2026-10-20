'use client';

// Hook for direct click-and-hold drag manipulation on 3D warehouse entities.
// Allows users to drag racks, structural items, and zones across the floor directly,
// with integrated grid snapping, magnetic alignment, boundary clamping, and Undo/Redo commands.

import { useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useEditorStore } from '@/stores/useEditorStore';
import { resolvePlacementPosition } from '@/engine/spatial/snapping';
import { createMoveRackCommand } from '@/engine/commands/MoveEntityCommand';
import { createMoveStructuralElementCommand } from '@/engine/commands/StructuralCommands';
import { createMoveZoneCommand } from '@/engine/commands/ZoneCommands';
import { createMoveVerticalConnectorCommand } from '@/engine/commands/VerticalConnectorCommands';
import { createBulkMoveCommand, type EntityMoveRecord } from '@/engine/commands/BulkCommands';
import type { Vector3D } from '@/types/spatial';

const DRAG_THRESHOLD_PX = 4;

export interface DirectDragOptions {
  entityId: string;
  entityType: 'rack' | 'structure' | 'zone' | 'connector';
  position: Vector3D;
  dimensions: { width: number; height: number; depth: number };
  rotationY: number;
  disabled?: boolean;
}


export function useDirectEntityDrag({
  entityId,
  entityType,
  position,
  dimensions,
  rotationY,
  disabled = false,
}: DirectDragOptions) {
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isShiftDownRef = useRef(false);
  const startClientPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startEntityPosRef = useRef<Vector3D>({ x: 0, y: 0, z: 0 });
  const dragOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(position.y ?? 0)),
    [position.y]
  );

  // Map of all entities in group: id -> { type, pos, dimensions }
  const groupStartPositionsRef = useRef<
    Map<
      string,
      {
        type: 'rack' | 'structure' | 'zone';
        pos: Vector3D;
        dimensions: { width: number; height: number; depth: number };
      }
    >
  >(new Map());

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (disabled || event.button !== 0) return;

      event.stopPropagation();
      isPointerDownRef.current = true;
      isDraggingRef.current = false;
      isShiftDownRef.current = !!event.shiftKey;
      startClientPosRef.current = { x: event.clientX, y: event.clientY };
      startEntityPosRef.current = { ...position };

      const state = useEditorStore.getState();
      groupStartPositionsRef.current.clear();

      // Check if we are dragging a multi-selected group
      if (
        state.selectedEntityIds.includes(entityId) &&
        state.selectedEntityIds.length > 1
      ) {
        for (const id of state.selectedEntityIds) {
          const rack = state.racks.find((r) => r.id === id);
          if (rack) {
            groupStartPositionsRef.current.set(id, {
              type: 'rack',
              pos: { ...rack.position },
              dimensions: rack.dimensions,
            });
            continue;
          }
          const struct = state.structuralElements.find((s) => s.id === id);
          if (struct) {
            groupStartPositionsRef.current.set(id, {
              type: 'structure',
              pos: { ...struct.position },
              dimensions: struct.dimensions,
            });
            continue;
          }
          const zone = state.zones.find((z) => z.id === id);
          if (zone) {
            groupStartPositionsRef.current.set(id, {
              type: 'zone',
              pos: { ...zone.position },
              dimensions: {
                width: zone.dimensions.width,
                height: zone.dimensions.height ?? 0.1,
                depth: zone.dimensions.depth,
              },
            });
          }
        }
      }

      // Calculate initial floor intersection point to determine grab offset
      const hit = new THREE.Vector3();
      if (event.ray.intersectPlane(dragPlane, hit)) {
        dragOffsetRef.current = {
          x: position.x - hit.x,
          z: position.z - hit.z,
        };
      } else {
        dragOffsetRef.current = { x: 0, z: 0 };
      }

      try {
        (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
      } catch {}
    },
    [disabled, position, entityId, dragPlane]
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPointerDownRef.current) return;

      event.stopPropagation();
      const deltaX = event.clientX - startClientPosRef.current.x;
      const deltaY = event.clientY - startClientPosRef.current.y;
      const dist = Math.hypot(deltaX, deltaY);

      if (!isDraggingRef.current && dist > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
        useEditorStore.getState().setIsDirectDragging(true);

        const state = useEditorStore.getState();
        // If entity wasn't in multi-selection, select it singly
        if (!state.selectedEntityIds.includes(entityId)) {
          state.selectEntity(entityId);
        }
      }

      if (isDraggingRef.current) {
        const hit = new THREE.Vector3();
        if (event.ray.intersectPlane(dragPlane, hit)) {
          const rawX = hit.x + dragOffsetRef.current.x;
          const rawZ = hit.z + dragOffsetRef.current.z;

          const state = useEditorStore.getState();
          const neighbors =
            entityType === 'rack'
              ? state.racks.filter((r) => r.id !== entityId && !state.selectedEntityIds.includes(r.id))
              : state.racks.filter((r) => !state.selectedEntityIds.includes(r.id));

          const snapped = resolvePlacementPosition({
            rawX,
            rawZ,
            entityWidth: dimensions.width,
            entityDepth: dimensions.depth,
            entityRotationY: rotationY,
            gridStep: state.gridSnapStep,
            isSnapEnabled: state.isSnappingEnabled,
            neighbors,
            floorWidth: state.floorDimensions.width,
            floorDepth: state.floorDimensions.depth,
          });

          // Check if this is a group move
          const isGroupDrag = groupStartPositionsRef.current.size > 1;

          if (isGroupDrag) {
            const anchorStart = startEntityPosRef.current;
            const dX = snapped.x - anchorStart.x;
            const dZ = snapped.z - anchorStart.z;

            // Move every entity in the group by (dX, dZ)
            groupStartPositionsRef.current.forEach((item, id) => {
              const halfW = item.dimensions.width / 2;
              const halfD = item.dimensions.depth / 2;
              const targetX = Math.max(
                halfW,
                Math.min(state.floorDimensions.width - halfW, item.pos.x + dX)
              );
              const targetZ = Math.max(
                halfD,
                Math.min(state.floorDimensions.depth - halfD, item.pos.z + dZ)
              );

              if (item.type === 'rack') {
                state.moveRack(id, { x: targetX, y: item.pos.y, z: targetZ });
              } else if (item.type === 'structure') {
                state.moveStructuralElement(id, { x: targetX, y: item.pos.y, z: targetZ });
              } else if (item.type === 'zone') {
                state.moveZone(id, { x: targetX, y: item.pos.y, z: targetZ });
              }
            });
          } else {
            // Single entity move
            if (entityType === 'rack') {
              state.moveRack(entityId, { x: snapped.x, y: position.y, z: snapped.z });
            } else if (entityType === 'structure') {
              state.moveStructuralElement(entityId, { x: snapped.x, y: position.y, z: snapped.z });
            } else if (entityType === 'zone') {
              state.moveZone(entityId, { x: snapped.x, y: position.y, z: snapped.z });
            } else if (entityType === 'connector') {
              state.moveVerticalConnector(entityId, { x: snapped.x, y: position.y, z: snapped.z });
            }
          }
        }
      }
    },
    [entityId, entityType, dimensions, rotationY, position.y, dragPlane]
  );

  const onPointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPointerDownRef.current) return;

      event.stopPropagation();
      isPointerDownRef.current = false;

      try {
        (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
      } catch {}

      const state = useEditorStore.getState();

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        state.setIsDirectDragging(false);

        const isGroupDrag = groupStartPositionsRef.current.size > 1;

        if (isGroupDrag) {
          const moves: EntityMoveRecord[] = [];
          groupStartPositionsRef.current.forEach((item, id) => {
            let finalPos: Vector3D | undefined;
            if (item.type === 'rack') {
              finalPos = state.racks.find((r) => r.id === id)?.position;
            } else if (item.type === 'structure') {
              finalPos = state.structuralElements.find((s) => s.id === id)?.position;
            } else if (item.type === 'zone') {
              finalPos = state.zones.find((z) => z.id === id)?.position;
            }

            if (finalPos && (finalPos.x !== item.pos.x || finalPos.z !== item.pos.z)) {
              moves.push({
                id,
                type: item.type,
                from: item.pos,
                to: finalPos,
              });
            }
          });

          if (moves.length > 0) {
            state.executeCommand(createBulkMoveCommand(moves));
          }
        } else {
          // Single entity commit
          const startPos = startEntityPosRef.current;
          const finalPos =
            entityType === 'rack'
              ? state.racks.find((r) => r.id === entityId)?.position
              : entityType === 'structure'
                ? state.structuralElements.find((s) => s.id === entityId)?.position
                : entityType === 'zone'
                  ? state.zones.find((z) => z.id === entityId)?.position
                  : state.verticalConnectors.find((c) => c.id === entityId)?.position;

          if (finalPos && (finalPos.x !== startPos.x || finalPos.z !== startPos.z)) {
            if (entityType === 'rack') {
              state.executeCommand(createMoveRackCommand(entityId, startPos, finalPos));
            } else if (entityType === 'structure') {
              state.executeCommand(createMoveStructuralElementCommand(entityId, startPos, finalPos));
            } else if (entityType === 'zone') {
              state.executeCommand(createMoveZoneCommand(entityId, startPos, finalPos));
            } else if (entityType === 'connector') {
              state.executeCommand(createMoveVerticalConnectorCommand(entityId, startPos, finalPos));
            }
          }
        }
      } else {

        // Pure click without drag
        if (event.shiftKey || isShiftDownRef.current) {
          state.toggleEntitySelection(entityId);
        } else {
          state.selectEntity(entityId);
        }
      }
    },
    [entityId, entityType]
  );

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      // Crucial: Always stop propagation so click never penetrates down to WarehouseFloor.
      // Selection logic is handled in onPointerUp (!isDraggingRef) to avoid duplicate-toggle cancellation.
      event.stopPropagation();
    },
    []
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClick,
  };
}
