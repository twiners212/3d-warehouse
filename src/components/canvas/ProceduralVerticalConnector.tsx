'use client';

// R3F Component for Vertical Connectors (Cargo Lift, Ramp, Industrial Stairs)
// Provides procedural 3D meshes, realistic industrial materials, raycasting, selection,
// and direct dragging integration across multi-tier building levels.

import { useMemo } from 'react';
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { Html } from '@react-three/drei';
import type { VerticalConnector } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { useDirectEntityDrag } from '@/hooks/useDirectEntityDrag';

const STEEL_POST_MATERIAL = new MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.6 });
const LIFT_CAGE_MATERIAL = new MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.35, roughness: 0.3, metalness: 0.5 });
const MOTOR_BOX_MATERIAL = new MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.4 });
const RAMP_DECK_MATERIAL = new MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
const RAMP_RAIL_MATERIAL = new MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.3 });
const STAIRS_TREAD_MATERIAL = new MeshStandardMaterial({ color: 0x64748b, roughness: 0.7, metalness: 0.5 });
const STAIRS_RAIL_MATERIAL = new MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.4 });

const EDGE_LINE_MATERIAL = new LineBasicMaterial({ color: 0x64748b });
const SELECTED_EDGE_MATERIAL = new LineBasicMaterial({ color: 0xf59e0b, linewidth: 2.5 });
const HOVER_EDGE_MATERIAL = new LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });

interface ProceduralVerticalConnectorProps {
  connector: VerticalConnector;
  selected?: boolean;
}

export function ProceduralVerticalConnector({
  connector,
  selected = false,
}: ProceduralVerticalConnectorProps) {
  const setHoveredEntity = useEditorStore((s) => s.setHoveredEntity);
  const hoveredEntityId = useEditorStore((s) => s.hoveredEntityId);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  const isHovered = hoveredEntityId === connector.id && editorViewMode === 'LAYOUT';
  const { width, height, depth } = connector.dimensions;

  // Resolve levels
  const fromLevel = buildingLevels.find((l) => l.id === connector.fromLevelId);
  const toLevel = buildingLevels.find((l) => l.id === connector.toLevelId);
  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;

  const minElev = Math.min(
    fromLevel?.elevationY ?? connector.position.y,
    toLevel?.elevationY ?? connector.position.y + height
  );
  const maxElev = Math.max(
    fromLevel?.elevationY ?? connector.position.y,
    toLevel?.elevationY ?? connector.position.y + height
  );

  const touchesActiveLevel =
    activeLevelId === 'ALL' ||
    connector.fromLevelId === activeLevelId ||
    connector.toLevelId === activeLevelId ||
    (activeElevation >= minElev - 0.1 && activeElevation <= maxElev + 0.1);

  const isUpperLevel = activeLevelId !== 'ALL' && minElev > activeElevation + 0.1;

  const isHidden =
    activeLevelId !== 'ALL' &&
    (floorSliceMode === 'ISOLATE' ? !touchesActiveLevel : isUpperLevel);
  const isGhosted = isUpperLevel && floorSliceMode === 'GHOST_UPPER';

  const boxGeometry = useMemo(() => new BoxGeometry(width, height, depth), [width, height, depth]);
  const boxEdges = useMemo(() => new EdgesGeometry(boxGeometry), [boxGeometry]);

  const activeEdgeMaterial =
    selected && editorViewMode === 'LAYOUT'
      ? SELECTED_EDGE_MATERIAL
      : isHovered
        ? HOVER_EDGE_MATERIAL
        : EDGE_LINE_MATERIAL;

  const dragHandlers = useDirectEntityDrag({
    entityId: connector.id,
    entityType: 'connector',
    position: connector.position,
    dimensions: connector.dimensions,
    rotationY: connector.rotationY,
    disabled: editorViewMode !== 'LAYOUT' || isHidden,
  });

  if (isHidden) return null;

  const renderVisual = () => {
    switch (connector.type) {
      case 'cargo_lift':
      case 'lift': {
        const postRadius = 0.08;
        const halfW = width / 2 - postRadius;
        const halfD = depth / 2 - postRadius;
        return (
          <group position={[0, height / 2, 0]}>
            {/* 4 Corner Upright Posts */}
            {[
              [-halfW, -halfD],
              [halfW, -halfD],
              [-halfW, halfD],
              [halfW, halfD],
            ].map(([px, pz], idx) => (
              <mesh key={idx} position={[px, 0, pz]} material={STEEL_POST_MATERIAL}>
                <boxGeometry args={[postRadius * 2, height, postRadius * 2]} />
              </mesh>
            ))}

            {/* Top Motor Box */}
            <mesh position={[0, height / 2 - 0.2, 0]} material={MOTOR_BOX_MATERIAL}>
              <boxGeometry args={[width * 0.9, 0.4, depth * 0.9]} />
            </mesh>

            {/* Elevator Cabin Box (Translucent Glass / Wire Cage) */}
            <mesh material={LIFT_CAGE_MATERIAL}>
              <boxGeometry args={[width * 0.85, height * 0.75, depth * 0.85]} />
            </mesh>

            {/* Base Floor Slab with Hazard Border */}
            <mesh position={[0, -height / 2 + 0.1, 0]} material={RAMP_RAIL_MATERIAL}>
              <boxGeometry args={[width * 0.95, 0.15, depth * 0.95]} />
            </mesh>

            <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
          </group>
        );
      }

      case 'ramp': {
        // Ramp incline wedge/slab
        const slopeLength = Math.hypot(depth, height);
        const angle = Math.atan2(height, depth);

        return (
          <group position={[0, height / 2, 0]}>
            {/* Inclined Ramp Deck */}
            <group rotation={[-angle, 0, 0]}>
              <mesh material={RAMP_DECK_MATERIAL} receiveShadow castShadow>
                <boxGeometry args={[width, 0.2, slopeLength]} />
              </mesh>
              {/* Left & Right Guardrails */}
              <mesh position={[-width / 2 + 0.05, 0.5, 0]} material={RAMP_RAIL_MATERIAL}>
                <boxGeometry args={[0.08, 0.8, slopeLength]} />
              </mesh>
              <mesh position={[width / 2 - 0.05, 0.5, 0]} material={RAMP_RAIL_MATERIAL}>
                <boxGeometry args={[0.08, 0.8, slopeLength]} />
              </mesh>
            </group>

            <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
          </group>
        );
      }

      case 'stairs': {
        const stepCount = 14;
        const stepHeight = height / stepCount;
        const stepDepth = depth / stepCount;

        return (
          <group position={[0, 0, 0]}>
            {/* Stair Treads */}
            {Array.from({ length: stepCount }).map((_, i) => {
              const y = (i + 0.5) * stepHeight;
              const z = (i + 0.5) * stepDepth - depth / 2;
              return (
                <mesh key={i} position={[0, y, z]} material={STAIRS_TREAD_MATERIAL}>
                  <boxGeometry args={[width * 0.9, stepHeight * 0.95, stepDepth * 1.05]} />
                </mesh>
              );
            })}

            {/* Handrails (Left & Right) */}
            <group position={[0, height / 2, 0]}>
              <mesh position={[-width / 2 + 0.05, 0.5, 0]} material={STAIRS_RAIL_MATERIAL}>
                <boxGeometry args={[0.05, 0.8, depth]} />
              </mesh>
              <mesh position={[width / 2 - 0.05, 0.5, 0]} material={STAIRS_RAIL_MATERIAL}>
                <boxGeometry args={[0.05, 0.8, depth]} />
              </mesh>
              <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
            </group>
          </group>
        );
      }
    }
  };

  return (
    <group
      name={`connector-${connector.id}`}
      position={[connector.position.x, connector.position.y, connector.position.z]}
      rotation={[0, connector.rotationY, 0]}
      userData={{ entityId: connector.id, selected }}
      onPointerDown={dragHandlers.onPointerDown}
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={dragHandlers.onPointerUp}
      onClick={(e) => {
        if (editorViewMode === 'LAYOUT') {
          dragHandlers.onClick(e);
        }
      }}
      onPointerOver={(event) => {
        if (editorViewMode === 'LAYOUT') {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
          setHoveredEntity(connector.id);
        }
      }}
      onPointerOut={() => {
        if (editorViewMode === 'LAYOUT') {
          document.body.style.cursor = 'auto';
          setHoveredEntity(null);
        }
      }}
    >
      {/* Visual geometry */}
      <group>{renderVisual()}</group>

      {/* Invisible volumetric hitbox collider for 100% reliable raycasting */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width + 0.4, height + 0.2, depth + 0.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Floating 3D Badge Indicator */}
      {(selected || isHovered) && (
        <Html
          position={[0, height + 0.6, 0]}
          center
          distanceFactor={40}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-500/50 bg-slate-950/90 px-2.5 py-1 text-[11px] font-semibold text-amber-300 shadow-xl backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{connector.name}</span>
            <span className="text-slate-400 text-[10px]">
              ({fromLevel?.name || 'L1'} ➔ {toLevel?.name || 'L2'})
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
