'use client';

// R3F Component for Structural Warehouse Elements (Walls, Columns, Dock Doors, Bollards)
// Provides raycasting, selection, and realistic industrial materials.

import { useMemo } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  MeshStandardMaterial,
} from 'three';
import type { StructuralElement } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { useDirectEntityDrag } from '@/hooks/useDirectEntityDrag';

const CONCRETE_MATERIAL = new MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
const COLUMN_MATERIAL = new MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
const DOCK_DOOR_FRAME_MATERIAL = new MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });
const DOCK_DOOR_PANEL_MATERIAL = new MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });
const BOLLARD_YELLOW_MATERIAL = new MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.2 });
const BOLLARD_BLACK_MATERIAL = new MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

const EDGE_LINE_MATERIAL = new LineBasicMaterial({ color: 0x94a3b8 });
const SELECTED_EDGE_MATERIAL = new LineBasicMaterial({ color: 0xf59e0b, linewidth: 2.5 });
const HOVER_EDGE_MATERIAL = new LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });

interface ProceduralStructureProps {
  element: StructuralElement;
  selected?: boolean;
}

export function ProceduralStructure({ element, selected = false }: ProceduralStructureProps) {
  const selectEntity = useEditorStore((s) => s.selectEntity);
  const setHoveredEntity = useEditorStore((s) => s.setHoveredEntity);
  const hoveredEntityId = useEditorStore((s) => s.hoveredEntityId);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;
  const isCurrentLevel =
    activeLevelId === 'ALL' ||
    (element.levelId ? element.levelId === activeLevelId : Math.abs(element.position.y - activeElevation) <= 0.2);
  const isUpperLevel = activeLevelId !== 'ALL' && element.position.y > activeElevation + 0.1;
  const isHidden =
    activeLevelId !== 'ALL' &&
    (floorSliceMode === 'ISOLATE' ? !isCurrentLevel : isUpperLevel);
  const isGhosted = isUpperLevel && floorSliceMode === 'GHOST_UPPER';

  const isHovered = hoveredEntityId === element.id && editorViewMode === 'LAYOUT';

  const { width, height, depth } = element.dimensions;


  const boxGeometry = useMemo(() => new BoxGeometry(width, height, depth), [width, height, depth]);
  const boxEdges = useMemo(() => new EdgesGeometry(boxGeometry), [boxGeometry]);

  const activeEdgeMaterial = (selected && editorViewMode === 'LAYOUT')
    ? SELECTED_EDGE_MATERIAL
    : isHovered
      ? HOVER_EDGE_MATERIAL
      : EDGE_LINE_MATERIAL;

  const renderVisual = () => {
    switch (element.type) {
      case 'wall':
        return (
          <group position={[0, height / 2, 0]}>
            <mesh geometry={boxGeometry} material={CONCRETE_MATERIAL} castShadow receiveShadow />
            <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
            {/* Invisible Hitbox padding (expanded depth by +0.5m for easy edge & side clicking) */}
            <mesh>
              <boxGeometry args={[width + 0.3, height + 0.2, depth + 0.5]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );

      case 'column':
        return (
          <group position={[0, height / 2, 0]}>
            <mesh geometry={boxGeometry} material={COLUMN_MATERIAL} castShadow receiveShadow />
            <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
            {/* Column Base Plate */}
            <mesh position={[0, -height / 2 + 0.05, 0]}>
              <boxGeometry args={[width + 0.15, 0.1, depth + 0.15]} />
              <meshStandardMaterial color={0x1e293b} roughness={0.7} />
            </mesh>
            {/* Expanded Invisible Hitbox (+0.4m padding) */}
            <mesh>
              <boxGeometry args={[width + 0.4, height + 0.2, depth + 0.4]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );

      case 'dock_door':
        return (
          <group position={[0, height / 2, 0]}>
            {/* Outer Caution Frame */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[width, height, depth]} />
              <primitive object={DOCK_DOOR_FRAME_MATERIAL} />
            </mesh>
            {/* Inner Roll-up Panel */}
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[width - 0.4, height - 0.2, depth - 0.05]} />
              <primitive object={DOCK_DOOR_PANEL_MATERIAL} />
            </mesh>
            <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
            {/* Expanded Invisible Hitbox (+0.5m depth padding) */}
            <mesh>
              <boxGeometry args={[width + 0.3, height + 0.2, depth + 0.5]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );

      case 'bollard': {
        const colliderRadius = Math.max(width * 1.2, 0.4);
        return (
          <group position={[0, height / 2, 0]}>
            {/* Main Yellow Cylinder */}
            <mesh castShadow>
              <cylinderGeometry args={[width / 2, width / 2, height, 16]} />
              <primitive object={BOLLARD_YELLOW_MATERIAL} />
            </mesh>
            {/* Black Caution Stripe Band */}
            <mesh position={[0, height * 0.2, 0]}>
              <cylinderGeometry args={[width / 2 + 0.005, width / 2 + 0.005, height * 0.15, 16]} />
              <primitive object={BOLLARD_BLACK_MATERIAL} />
            </mesh>
            <mesh position={[0, height * -0.1, 0]}>
              <cylinderGeometry args={[width / 2 + 0.005, width / 2 + 0.005, height * 0.15, 16]} />
              <primitive object={BOLLARD_BLACK_MATERIAL} />
            </mesh>
            {/* Base Flange */}
            <mesh position={[0, -height / 2 + 0.025, 0]}>
              <cylinderGeometry args={[width * 0.8, width * 0.8, 0.05, 16]} />
              <meshStandardMaterial color={0x1e293b} roughness={0.8} />
            </mesh>
            {/* Hover / Selection Glowing Outline Cage */}
            {(selected || isHovered) && (
              <mesh>
                <cylinderGeometry args={[width / 2 + 0.04, width / 2 + 0.04, height + 0.06, 16]} />
                <meshBasicMaterial
                  color={selected ? 0xf59e0b : 0x38bdf8}
                  wireframe
                  transparent
                  opacity={selected ? 0.85 : 0.6}
                />
              </mesh>
            )}
            {/* Expanded Invisible Click Hitbox (Expanded diameter >= 0.8m) */}
            <mesh>
              <cylinderGeometry args={[colliderRadius, colliderRadius, height + 0.3, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      }

      case 'charging_dock':
        return (
          <group position={[0, height / 2, 0]}>
            {/* Ground Charging Dock Platform */}
            <mesh position={[0, -height / 2 + 0.04, 0]} receiveShadow>
              <boxGeometry args={[width, 0.08, depth]} />
              <meshStandardMaterial color={0x1e293b} roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Yellow-Black Hazard Border Trim */}
            <mesh position={[0, -height / 2 + 0.045, 0]}>
              <boxGeometry args={[width + 0.08, 0.06, depth + 0.08]} />
              <meshStandardMaterial color={0xeab308} roughness={0.5} />
            </mesh>
            {/* Induction Charging Contact Plates on Floor */}
            <mesh position={[-width * 0.2, -height / 2 + 0.085, 0]}>
              <boxGeometry args={[width * 0.22, 0.02, depth * 0.5]} />
              <meshStandardMaterial color={0x94a3b8} metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[width * 0.2, -height / 2 + 0.085, 0]}>
              <boxGeometry args={[width * 0.22, 0.02, depth * 0.5]} />
              <meshStandardMaterial color={0x94a3b8} metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Charging Power Tower Kiosk at Rear */}
            <mesh position={[0, 0, -depth * 0.35]} castShadow>
              <boxGeometry args={[width * 0.45, height - 0.1, depth * 0.25]} />
              <meshStandardMaterial color={0x334155} roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Glowing LED Status Panel */}
            <mesh position={[0, height * 0.25, -depth * 0.22]}>
              <boxGeometry args={[width * 0.35, height * 0.18, 0.02]} />
              <meshStandardMaterial color={0x06b6d4} emissive={0x06b6d4} emissiveIntensity={0.85} />
            </mesh>
            {/* Top Indicator Beacon Light */}
            <mesh position={[0, height / 2 - 0.02, -depth * 0.35]}>
              <cylinderGeometry args={[0.08, 0.08, 0.12, 12]} />
              <meshStandardMaterial color={0x10b981} emissive={0x10b981} emissiveIntensity={1.2} />
            </mesh>

            <lineSegments geometry={boxEdges} material={activeEdgeMaterial} />
            {/* Expanded Invisible Click Hitbox */}
            <mesh>
              <boxGeometry args={[width + 0.3, height + 0.2, depth + 0.3]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );

      default:
        return (
          <group position={[0, height / 2, 0]}>
            <mesh geometry={boxGeometry} material={CONCRETE_MATERIAL} />
          </group>
        );
    }
  };

  const dragHandlers = useDirectEntityDrag({
    entityId: element.id,
    entityType: 'structure',
    position: element.position,
    dimensions: element.dimensions,
    rotationY: element.rotationY,
    disabled: editorViewMode !== 'LAYOUT' || isHidden,
  });

  if (isHidden) return null;

  return (

    <group
      name={`structure-${element.id}`}
      position={[element.position.x, element.position.y, element.position.z]}
      rotation={[0, element.rotationY, 0]}
      userData={{ entityId: element.id, selected }}
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
          setHoveredEntity(element.id);
        }
      }}
      onPointerOut={() => {
        if (editorViewMode === 'LAYOUT') {
          document.body.style.cursor = 'auto';
          setHoveredEntity(null);
        }
      }}
    >
      {renderVisual()}
    </group>
  );
}
