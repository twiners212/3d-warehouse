'use client';

// Fulfills ARCHITECTURE.md Section 2 (canvas/WarehouseFloor.tsx):
// Ground grid receiver at Y = 0 with boundary outline. Full raycast snapping
// pipeline lands in Phase 3; this component renders the floor + grid visuals.

import { useMemo } from 'react';
import { EdgesGeometry, LineBasicMaterial, LineSegments, PlaneGeometry, MeshStandardMaterial } from 'three';
import type { WarehouseLayoutBlueprint } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';

import { telemetryBus } from '@/lib/telemetry/telemetry-bus';

import { useSettingsStore } from '@/stores/useSettingsStore';

function FloorMesh({
  floorDimensions,
  isLight,
}: {
  floorDimensions: WarehouseLayoutBlueprint['floorDimensions'];
  isLight: boolean;
}) {
  const geometry = useMemo(
    () =>
      new PlaneGeometry(floorDimensions.width, floorDimensions.depth).rotateX(-Math.PI / 2),
    [floorDimensions.width, floorDimensions.depth]
  );
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: isLight ? 0xe2e8f0 : 0x1e293b,
        roughness: 0.95,
      }),
    [isLight]
  );
  const edges = useMemo(
    () =>
      new LineSegments(
        new EdgesGeometry(new PlaneGeometry(floorDimensions.width, floorDimensions.depth)),
        new LineBasicMaterial({ color: isLight ? 0x0284c7 : 0x38bdf8 })
      ).rotateX(-Math.PI / 2),
    [floorDimensions.width, floorDimensions.depth, isLight]
  );

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        position={[floorDimensions.width / 2, 0, floorDimensions.depth / 2]}
        receiveShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          telemetryBus.setCursorPos(e.point.x, e.point.z);
        }}
        onPointerLeave={() => {
          telemetryBus.clearCursorPos();
        }}
      />
      <primitive object={edges} position={[floorDimensions.width / 2, 0.01, floorDimensions.depth / 2]} />
    </>
  );
}

export function WarehouseFloor() {
  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const isGridVisible = useEditorStore((s) => s.isGridVisible);
  const gridSnapStep = useEditorStore((s) => s.gridSnapStep);
  const deselectEntity = useEditorStore((s) => s.deselectEntity);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  const showGridLines = useSettingsStore((s) => s.showGridLines);
  const theme = useSettingsStore((s) => s.theme);
  const isLight = theme === 'light';

  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;

  // Render upper levels (elevationY > 0)
  const upperLevels = buildingLevels.filter((lvl) => lvl.elevationY > 0);

  return (
    <group
      onClick={(event) => {
        // Floor click deselects (INTERACTION-SPECIFICATION.md §2.2)
        event.stopPropagation();
        deselectEntity();
      }}
    >
      {/* Ground Floor (Level 1, Y=0) */}
      <FloorMesh floorDimensions={floorDimensions} isLight={isLight} />
      <gridHelper
        key={`${floorDimensions.width}-${floorDimensions.depth}-${gridSnapStep}-${theme}-${activeElevation}`}
        args={[
          Math.max(floorDimensions.width, floorDimensions.depth),
          Math.max(floorDimensions.width, floorDimensions.depth) / gridSnapStep,
          activeElevation > 0 ? (isLight ? 0x0284c7 : 0x38bdf8) : (isLight ? 0x94a3b8 : 0x334155),
          activeElevation > 0 ? (isLight ? 0xbae6fd : 0x1e3a5f) : (isLight ? 0xcbd5e1 : 0x243044),
        ]}
        position={[floorDimensions.width / 2, activeElevation + 0.005, floorDimensions.depth / 2]}
        visible={isGridVisible && showGridLines}
      />

      {/* Elevated Floors (Mezzanines / Upper Levels) */}
      {upperLevels.map((lvl) => {
        const isThisActive = activeLevelId === lvl.id;
        const isUpper = activeLevelId !== 'ALL' && lvl.elevationY > activeElevation;
        const isLower = activeLevelId !== 'ALL' && lvl.elevationY < activeElevation;

        if (isUpper && floorSliceMode === 'ISOLATE') {
          return null;
        }

        const opacity = isThisActive
          ? 0.95
          : isUpper
            ? 0.12
            : isLower
              ? 0.85
              : 0.45; // 'ALL' mode

        return (
          <group key={lvl.id} position={[floorDimensions.width / 2, lvl.elevationY, floorDimensions.depth / 2]}>
            {/* Slab plane */}
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[floorDimensions.width, floorDimensions.depth]} />
              <meshStandardMaterial
                color={isLight ? (isThisActive ? 0xe2e8f0 : 0xf1f5f9) : (isThisActive ? 0x1e293b : 0x0f172a)}
                roughness={0.9}
                transparent={!isThisActive}
                opacity={opacity}
              />
            </mesh>

            {/* Perimeter Edge */}
            <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
              <edgesGeometry args={[new PlaneGeometry(floorDimensions.width, floorDimensions.depth)]} />
              <lineBasicMaterial
                color={isThisActive ? 0x38bdf8 : (isUpper ? 0x64748b : 0x0284c7)}
                transparent={isUpper}
                opacity={isUpper ? 0.3 : 0.8}
              />
            </lineSegments>

            {/* Grid on active upper floor */}
            {isThisActive && (
              <gridHelper
                args={[
                  Math.max(floorDimensions.width, floorDimensions.depth),
                  Math.max(floorDimensions.width, floorDimensions.depth) / gridSnapStep,
                  isLight ? 0x0284c7 : 0x38bdf8,
                  isLight ? 0x93c5fd : 0x1e3a8a,
                ]}
                position={[0, 0.005, 0]}
                visible={isGridVisible && showGridLines}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

