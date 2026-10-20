'use client';

// Fulfills INTERACTION-SPECIFICATION.md Section 3 Drag-and-Drop Placement
// Workflow & Section 5.1 visual feedback: ghost mesh follows the floor raycast
// with live snapping; green when valid, red on collision/out-of-bounds.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  MeshStandardMaterial,
  type Group,
} from 'three';
import { screenToWorldFloor } from '@/engine/spatial/raycasting';
import { isPlacementValid, resolvePlacementPosition } from '@/engine/spatial/snapping';
import { deriveRackDimensions } from '@/engine/procedural/bin-generator';
import { getPlacementBusState } from '@/lib/placement/placement-bus';
import { useEditorStore } from '@/stores/useEditorStore';
import { PLACEMENT_COLORS } from '@/lib/constants/warehouse-defaults';

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const GHOST_EDGES = new EdgesGeometry(UNIT_BOX);
const VALID_MATERIAL = new MeshStandardMaterial({
  color: PLACEMENT_COLORS.valid,
  transparent: true,
  opacity: 0.6,
});
const INVALID_MATERIAL = new MeshStandardMaterial({
  color: PLACEMENT_COLORS.invalid,
  transparent: true,
  opacity: 0.6,
});
const VALID_EDGE_MATERIAL = new LineBasicMaterial({ color: PLACEMENT_COLORS.valid });
const INVALID_EDGE_MATERIAL = new LineBasicMaterial({ color: PLACEMENT_COLORS.invalid });

export function PlacementPreview() {
  const groupRef = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const activeLevel = activeLevelId !== 'ALL' ? buildingLevels.find((l) => l.id === activeLevelId) : undefined;
  const elevationY = activeLevel ? activeLevel.elevationY : 0;

  const ghostMeshRef = useRef<import('three').Mesh>(null);
  const edgeLinesRef = useRef<LineSegments>(null);

  // Latest resolved placement shared with the drop handler via bus mirror
  const resolvedRef = useRef({ x: 0, z: 0, isValid: false });

  useEffect(() => () => {
    GHOST_EDGES.dispose();
    VALID_MATERIAL.dispose();
    INVALID_MATERIAL.dispose();
    VALID_EDGE_MATERIAL.dispose();
    INVALID_EDGE_MATERIAL.dispose();
  }, []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const { isDraggingOver, clientX, clientY, item } = getPlacementBusState();

    if (!isDraggingOver || !item) {
      group.visible = false;
      return;
    }

    const state = useEditorStore.getState();
    const rect = gl.domElement.getBoundingClientRect();
    const rawPoint = screenToWorldFloor(clientX, clientY, camera, rect, elevationY);

    if (!rawPoint) {
      group.visible = false;
      return;
    }

    const config = item.defaultConfig;
    const snapped = resolvePlacementPosition({
      rawX: rawPoint.x,
      rawZ: rawPoint.z,
      entityWidth: config.width,
      entityDepth: config.depth,
      entityRotationY: 0,
      gridStep: state.gridSnapStep,
      isSnapEnabled: state.isSnappingEnabled,
      neighbors: state.racks,
      floorWidth: state.floorDimensions.width,
      floorDepth: state.floorDimensions.depth,
    });

    const isValid = isPlacementValid({
      x: snapped.x,
      z: snapped.z,
      width: config.width,
      depth: config.depth,
      rotationY: 0,
      neighbors: state.racks,
      floorWidth: state.floorDimensions.width,
      floorDepth: state.floorDimensions.depth,
    });

    resolvedRef.current = { x: snapped.x, z: snapped.z, isValid };

    group.visible = true;
    group.position.set(snapped.x, elevationY, snapped.z);

    const dimensions =
      item.type === 'rack'
        ? deriveRackDimensions({
            bays: config.bays ?? 3,
            levels: config.levels ?? 3,
            bayWidth: config.width / (config.bays ?? 3),
            bayDepth: config.depth,
            levelHeight: config.height / (config.levels ?? 3),
          })
        : {
            width: config.width ?? 3,
            height: config.height ?? (item.type === 'zone' ? 0.05 : 3),
            depth: config.depth ?? 3,
          };

    const mesh = ghostMeshRef.current;
    const edges = edgeLinesRef.current;
    if (mesh && edges) {
      mesh.scale.set(dimensions.width, dimensions.height, dimensions.depth);
      mesh.position.y = dimensions.height / 2;
      edges.scale.copy(mesh.scale);
      edges.position.y = mesh.position.y;

      const material = isValid ? VALID_MATERIAL : INVALID_MATERIAL;
      const edgeMaterial = isValid ? VALID_EDGE_MATERIAL : INVALID_EDGE_MATERIAL;
      if (mesh.material !== material) mesh.material = material;
      if (edges.material !== edgeMaterial) edges.material = edgeMaterial;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ghostMeshRef} geometry={UNIT_BOX} material={VALID_MATERIAL} raycast={() => null} />
      <lineSegments ref={edgeLinesRef} geometry={GHOST_EDGES} material={VALID_EDGE_MATERIAL} raycast={() => null} />
      {activeLevel && (
        <Html position={[0, 4, 0]} center distanceFactor={35} style={{ pointerEvents: 'none' }}>
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-sky-500/60 bg-slate-950/90 px-2.5 py-1 text-[11px] font-semibold text-sky-300 shadow-xl backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Target: {activeLevel.name}</span>
            <span className="text-slate-400 text-[10px]">({elevationY.toFixed(1)}m)</span>
          </div>
        </Html>
      )}
    </group>
  );
}
