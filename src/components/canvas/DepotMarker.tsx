'use client';

// Fulfills Phase 36 & 37: 3D Depot / Packing Station Marker with Direct Floor Dragging
// Renders industrial circular base with beacon ring, floating badge, and interactive drag-and-drop repositioning

import React, { useRef, useState, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

interface DepotMarkerProps {
  position: { x: number; z: number };
}

export const DepotMarker: React.FC<DepotMarkerProps> = ({ position }) => {
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const theme = useSettingsStore((s) => s.theme);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const moveDepot = useEditorStore((s) => s.moveDepot);
  const setIsDirectDragging = useEditorStore((s) => s.setIsDirectDragging);
  const setActiveDraggingPinId = useEditorStore((s) => s.setActiveDraggingPinId);
  const activeDraggingPinId = useEditorStore((s) => s.activeDraggingPinId);

  const isDraggingDepot = activeDraggingPinId === 'depot';
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; z: number } | null>(null);

  const isPointerDownRef = useRef(false);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const dragOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  useFrame((state) => {
    if (pulseRingRef.current) {
      const t = state.clock.getElapsedTime();
      const scale = 1 + 0.15 * Math.sin(t * 3);
      pulseRingRef.current.scale.set(scale, 1, scale);
    }
  });

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      isPointerDownRef.current = true;
      startPointerRef.current = { x: event.clientX, y: event.clientY };
      startPosRef.current = { ...position };

      const hit = new THREE.Vector3();
      if (event.ray.intersectPlane(GROUND_PLANE, hit)) {
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
    [position]
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPointerDownRef.current) return;
      event.stopPropagation();

      const dist = Math.hypot(
        event.clientX - startPointerRef.current.x,
        event.clientY - startPointerRef.current.y
      );

      if (dist > 3) {
        setIsDirectDragging(true);
        setActiveDraggingPinId('depot');
        document.body.style.cursor = 'grabbing';

        const hit = new THREE.Vector3();
        if (event.ray.intersectPlane(GROUND_PLANE, hit)) {
          const rawX = hit.x + dragOffsetRef.current.x;
          const rawZ = hit.z + dragOffsetRef.current.z;

          const state = useEditorStore.getState();
          const step = state.isSnappingEnabled ? state.gridSnapStep || 0.5 : 0.1;
          const snappedX = Math.round(rawX / step) * step;
          const snappedZ = Math.round(rawZ / step) * step;

          const bounds = state.floorDimensions;
          const clampedX = Math.max(0.5, Math.min(bounds.width - 0.5, snappedX));
          const clampedZ = Math.max(0.5, Math.min(bounds.depth - 0.5, snappedZ));

          setDragPreviewPos({ x: clampedX, z: clampedZ });
        }
      }
    },
    [setIsDirectDragging, setActiveDraggingPinId]
  );

  const onPointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPointerDownRef.current) return;
      event.stopPropagation();
      isPointerDownRef.current = false;

      try {
        (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
      } catch {}

      setIsDirectDragging(false);
      setActiveDraggingPinId(null);
      document.body.style.cursor = 'auto';

      if (dragPreviewPos) {
        const dx = Math.abs(dragPreviewPos.x - startPosRef.current.x);
        const dz = Math.abs(dragPreviewPos.z - startPosRef.current.z);
        if (dx > 0.05 || dz > 0.05) {
          moveDepot(dragPreviewPos);
        }
        setDragPreviewPos(null);
      }
    },
    [dragPreviewPos, moveDepot, setIsDirectDragging, setActiveDraggingPinId]
  );

  if (editorViewMode !== 'PICKING') return null;

  const currentPos = dragPreviewPos || position;

  return (
    <group
      position={[currentPos.x, 0.05, currentPos.z]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        if (!isPointerDownRef.current) {
          document.body.style.cursor = 'auto';
        }
      }}
    >
      {/* Base Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial
          color={isDraggingDepot ? '#38bdf8' : '#0284c7'}
          roughness={0.4}
          metalness={0.6}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>

      {/* Inner Hazard Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.9, 1.1, 32]} />
        <meshBasicMaterial color={isDraggingDepot ? '#f59e0b' : '#38bdf8'} />
      </mesh>

      {/* Pulsing Outer Neon Ring */}
      <mesh ref={pulseRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.25, 1.35, 32]} />
        <meshBasicMaterial
          color={isDraggingDepot ? '#f59e0b' : '#06b6d4'}
          transparent
          opacity={isDraggingDepot ? 0.9 : 0.6}
        />
      </mesh>

      {/* Center Pillar Beacon */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.4, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={isDraggingDepot ? '#f59e0b' : '#38bdf8'} />
      </mesh>

      {/* Floating 3D Badge */}
      <Html
        position={[0, 1.2, 0]}
        center
        distanceFactor={undefined}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase border shadow-lg backdrop-blur-md whitespace-nowrap select-none transition-all ${
            isDraggingDepot
              ? 'bg-amber-950/90 text-amber-200 border-amber-500 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
              : theme === 'light'
              ? 'bg-sky-50/95 text-sky-900 border-sky-300'
              : 'bg-sky-950/90 text-sky-200 border-sky-500/50 shadow-[0_0_15px_rgba(56,189,248,0.4)]'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isDraggingDepot ? 'bg-amber-400 animate-ping' : 'bg-sky-400 animate-pulse'
            }`}
          />
          <span>DEPOT / PACKING BASE</span>
          <span className="text-[9px] opacity-75 font-normal tracking-normal lowercase ml-1">
            (drag to move)
          </span>
        </div>
      </Html>
    </group>
  );
};
