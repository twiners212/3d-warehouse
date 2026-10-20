import { useRef, useLayoutEffect, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import type { Group } from 'three';
import { createMoveRackCommand } from '@/engine/commands/MoveEntityCommand';
import { createMoveStructuralElementCommand } from '@/engine/commands/StructuralCommands';
import { createMoveZoneCommand } from '@/engine/commands/ZoneCommands';
import { createMoveVerticalConnectorCommand } from '@/engine/commands/VerticalConnectorCommands';
import { snapToGrid } from '@/engine/spatial/spatial-math';
import { isPlacementValid, resolvePlacementPosition } from '@/engine/spatial/snapping';
import { useEditorStore } from '@/stores/useEditorStore';

type TransformControlsInstance = ComponentRef<typeof TransformControls>;
type PatchedTransformControls = TransformControlsInstance & { __safeMatrixPatched?: boolean };

export function TransformGizmo() {
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId);
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const isDirectDragging = useEditorStore((s) => s.isDirectDragging);
  const mode = useEditorStore((s) => s.mode);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const scene = useThree((state) => state.scene);

  const target = selectedEntityId
    ? ((scene.getObjectByProperty('name', `rack-root-${selectedEntityId}`) as Group) ??
       (scene.getObjectByProperty('name', `structure-${selectedEntityId}`) as Group) ??
       (scene.getObjectByProperty('name', `zone-${selectedEntityId}`) as Group) ??
       (scene.getObjectByProperty('name', `connector-${selectedEntityId}`) as Group) ??
       null)
    : null;

  const transformRef = useRef<PatchedTransformControls | null>(null);
  const draggingRef = useRef(false);
  const originRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const lastValidRef = useRef<{ x: number; z: number } | null>(null);

  // Safely detach controls on target change or unmount
  useLayoutEffect(() => {
    return () => {
      if (transformRef.current) {
        try {
          transformRef.current.detach();
        } catch {}
      }
    };
  }, [target]);

  // Ensure target exists, has a valid parent in the scene graph, and direct dragging is inactive
  const isTargetInScene = !!(target && target.parent);

  if (
    !isTargetInScene ||
    !target ||
    isDirectDragging ||
    mode === 'PREVIEW_PLACEMENT' ||
    editorViewMode !== 'LAYOUT' ||
    (selectedEntityIds && selectedEntityIds.length > 1)
  ) {
    return null;
  }

  const handleObjectChange = () => {
    const state = useEditorStore.getState();
    const rack = state.racks.find((r) => r.id === selectedEntityId);
    const structure = state.structuralElements.find((e) => e.id === selectedEntityId);
    const zone = state.zones.find((z) => z.id === selectedEntityId);
    const connector = state.verticalConnectors.find((c) => c.id === selectedEntityId);

    if (rack) {
      if (!draggingRef.current) {
        draggingRef.current = true;
        originRef.current = { ...rack.position };
        state.setActiveTransformOrigin({ ...rack.position });
      }

      const neighbors = state.racks.filter((r) => r.id !== rack.id);

      const snapped = resolvePlacementPosition({
        rawX: target.position.x,
        rawZ: target.position.z,
        entityWidth: rack.dimensions.width,
        entityDepth: rack.dimensions.depth,
        entityRotationY: rack.rotationY,
        gridStep: state.gridSnapStep,
        isSnapEnabled: state.isSnappingEnabled,
        neighbors,
        floorWidth: state.floorDimensions.width,
        floorDepth: state.floorDimensions.depth,
      });

      const valid = isPlacementValid({
        x: snapped.x,
        z: snapped.z,
        width: rack.dimensions.width,
        depth: rack.dimensions.depth,
        rotationY: rack.rotationY,
        neighbors,
        floorWidth: state.floorDimensions.width,
        floorDepth: state.floorDimensions.depth,
      });

      if (valid) lastValidRef.current = snapped;
      state.setCollisionValid(valid);
      state.moveRack(rack.id, { x: snapped.x, y: rack.position.y, z: snapped.z });
    } else if (structure) {
      if (!draggingRef.current) {
        draggingRef.current = true;
        originRef.current = { ...structure.position };
        state.setActiveTransformOrigin({ ...structure.position });
      }
      const gridStep = state.gridSnapStep;
      const snappedX = state.isSnappingEnabled ? snapToGrid(target.position.x, gridStep) : target.position.x;
      const snappedZ = state.isSnappingEnabled ? snapToGrid(target.position.z, gridStep) : target.position.z;
      state.moveStructuralElement(structure.id, { x: snappedX, y: structure.position.y, z: snappedZ });
    } else if (zone) {
      if (!draggingRef.current) {
        draggingRef.current = true;
        originRef.current = { ...zone.position };
        state.setActiveTransformOrigin({ ...zone.position });
      }
      const gridStep = state.gridSnapStep;
      const snappedX = state.isSnappingEnabled ? snapToGrid(target.position.x, gridStep) : target.position.x;
      const snappedZ = state.isSnappingEnabled ? snapToGrid(target.position.z, gridStep) : target.position.z;
      state.moveZone(zone.id, { x: snappedX, y: zone.position.y, z: snappedZ });
    } else if (connector) {
      if (!draggingRef.current) {
        draggingRef.current = true;
        originRef.current = { ...connector.position };
        state.setActiveTransformOrigin({ ...connector.position });
      }
      const gridStep = state.gridSnapStep;
      const snappedX = state.isSnappingEnabled ? snapToGrid(target.position.x, gridStep) : target.position.x;
      const snappedZ = state.isSnappingEnabled ? snapToGrid(target.position.z, gridStep) : target.position.z;
      state.moveVerticalConnector(connector.id, { x: snappedX, y: connector.position.y, z: snappedZ });
    }
  };

  const handleMouseUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const state = useEditorStore.getState();
    const rack = state.racks.find((r) => r.id === selectedEntityId);
    const structure = state.structuralElements.find((e) => e.id === selectedEntityId);
    const zone = state.zones.find((z) => z.id === selectedEntityId);
    const connector = state.verticalConnectors.find((c) => c.id === selectedEntityId);
    const origin = originRef.current;

    if (rack && origin) {
      const finalValid =
        !!lastValidRef.current &&
        isPlacementValid({
          x: rack.position.x,
          z: rack.position.z,
          width: rack.dimensions.width,
          depth: rack.dimensions.depth,
          rotationY: rack.rotationY,
          neighbors: state.racks.filter((r) => r.id !== rack.id),
          floorWidth: state.floorDimensions.width,
          floorDepth: state.floorDimensions.depth,
        });

      if (!finalValid) {
        state.moveRack(rack.id, origin);
      } else if (
        Math.abs(rack.position.x - origin.x) > 1e-6 ||
        Math.abs(rack.position.z - origin.z) > 1e-6
      ) {
        state.executeCommand(
          createMoveRackCommand(rack.id, origin, { ...rack.position })
        );
      }
    } else if (structure && origin) {
      if (
        Math.abs(structure.position.x - origin.x) > 1e-6 ||
        Math.abs(structure.position.z - origin.z) > 1e-6
      ) {
        state.executeCommand(
          createMoveStructuralElementCommand(structure.id, origin, { ...structure.position })
        );
      }
    } else if (zone && origin) {
      if (
        Math.abs(zone.position.x - origin.x) > 1e-6 ||
        Math.abs(zone.position.z - origin.z) > 1e-6
      ) {
        state.executeCommand(
          createMoveZoneCommand(zone.id, origin, { ...zone.position })
        );
      }
    } else if (connector && origin) {
      if (
        Math.abs(connector.position.x - origin.x) > 1e-6 ||
        Math.abs(connector.position.z - origin.z) > 1e-6
      ) {
        state.executeCommand(
          createMoveVerticalConnectorCommand(connector.id, origin, { ...connector.position })
        );
      }
    }

    originRef.current = null;
    lastValidRef.current = null;
    state.setCollisionValid(true);
    state.setActiveTransformOrigin(null);
  };

  const handleRef = (controls: TransformControlsInstance | null) => {
    const patched = controls as PatchedTransformControls | null;
    transformRef.current = patched;
    if (patched && !patched.__safeMatrixPatched) {
      patched.__safeMatrixPatched = true;
      const originalUpdate = patched.updateMatrixWorld.bind(patched);
      patched.updateMatrixWorld = () => {
        const attachedObj = (patched as unknown as { object?: { parent: unknown } | null }).object;
        if (attachedObj && attachedObj.parent === null) {
          patched.detach();
          return;
        }
        originalUpdate();
      };
    }
  };

  return (
    <TransformControls
      ref={handleRef}
      key={target.uuid}
      object={target}
      mode="translate"
      showY={false}
      showX
      showZ
      onObjectChange={handleObjectChange}
      onMouseUp={handleMouseUp}
    />
  );
}

