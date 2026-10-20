'use client';

// Fulfills Phase 36 & 37: 3D Picking Route Visualizer with Direct Dragging & Custom Waypoints
// Renders animated flowing neon floor path, draggable stop waypoints, laser beams, custom transit waypoints, and polyline insertion

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/lib/i18n';
import { createWalkabilityGrid, findNearestWalkablePoint } from '@/engine/routing/grid-map';
import { findNearestPolylineSegment } from '@/engine/routing/routing-engine';
import type { CustomWaypoint, PickItem } from '@/types/routing';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

interface StopPinProps {
  pick: PickItem;
  index: number;
  currentStop: number;
  isPlaying: boolean;
  theme: 'light' | 'dark';
  isClustered: boolean;
  elevationY: number;
}

const StopPin: React.FC<StopPinProps> = ({
  pick,
  index,
  currentStop,
  isPlaying,
  theme,
  isClustered,
  elevationY,
}) => {
  const movePickAccessPoint = useEditorStore((s) => s.movePickAccessPoint);
  const setIsDirectDragging = useEditorStore((s) => s.setIsDirectDragging);
  const setActiveDraggingPinId = useEditorStore((s) => s.setActiveDraggingPinId);
  const activeDraggingPinId = useEditorStore((s) => s.activeDraggingPinId);
  const badgeDisplayMode = useEditorStore((s) => s.badgeDisplayMode);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  const floorY = pick.accessPoint3D.y || 0;
  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;
  const isUpperLevel = activeLevelId !== 'ALL' && floorY > activeElevation + 0.1;
  const isHidden = isUpperLevel && floorSliceMode === 'ISOLATE';
  const isGhosted = isUpperLevel && floorSliceMode === 'GHOST_UPPER';

  const [isHovered, setIsHovered] = useState(false);
  const isDraggingThis = activeDraggingPinId === pick.binId;
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; z: number } | null>(null);

  const isPointerDownRef = useRef(false);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const dragOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  const stopNumber = index + 1;
  const isCompleted = currentStop >= stopNumber;
  const isCurrent = currentStop === stopNumber - 1 && isPlaying;

  const showCompact =
    !isHovered &&
    !isCurrent &&
    !isDraggingThis &&
    (badgeDisplayMode === 'COMPACT' || (badgeDisplayMode === 'SMART' && isClustered));

  const pinColor = isDraggingThis
    ? '#f59e0b' // Amber when dragging
    : isCompleted
    ? '#10b981' // Green Completed
    : isCurrent
    ? '#f59e0b' // Amber Active
    : '#38bdf8'; // Cyan Upcoming

  const floorX = dragPreviewPos ? dragPreviewPos.x : pick.accessPoint3D.x;
  const floorZ = dragPreviewPos ? dragPreviewPos.z : pick.accessPoint3D.z;
  const bin3D = pick.position3D;

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0 || isGhosted) return;
      event.stopPropagation();
      isPointerDownRef.current = true;
      startPointerRef.current = { x: event.clientX, y: event.clientY };
      startPosRef.current = { x: pick.accessPoint3D.x, z: pick.accessPoint3D.z };

      const hit = new THREE.Vector3();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
      if (event.ray.intersectPlane(plane, hit)) {
        dragOffsetRef.current = {
          x: pick.accessPoint3D.x - hit.x,
          z: pick.accessPoint3D.z - hit.z,
        };
      } else {
        dragOffsetRef.current = { x: 0, z: 0 };
      }

      try {
        (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
      } catch {}
    },
    [pick.accessPoint3D.x, pick.accessPoint3D.z, floorY, isGhosted]
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
        setActiveDraggingPinId(pick.binId);
        document.body.style.cursor = 'grabbing';

        const hit = new THREE.Vector3();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
        if (event.ray.intersectPlane(plane, hit)) {
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
    [pick.binId, floorY, setIsDirectDragging, setActiveDraggingPinId]
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
          movePickAccessPoint(pick.binId, dragPreviewPos);
        }
        setDragPreviewPos(null);
      }
    },
    [dragPreviewPos, pick.binId, movePickAccessPoint, setIsDirectDragging, setActiveDraggingPinId]
  );

  if (isHidden) {
    return null;
  }

  return (
    <group
      position={[floorX, floorY, floorZ]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => {
        if (isGhosted) return;
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setIsHovered(false);
        if (!isPointerDownRef.current) {
          document.body.style.cursor = 'auto';
        }
      }}
    >
      {/* Ground Ring Marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.4, 0.55, 24]} />
        <meshBasicMaterial color={pinColor} transparent opacity={isGhosted ? 0.25 : 1} />
      </mesh>

      {/* Inner Indicator Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[0.38, 24]} />
        <meshBasicMaterial color={pinColor} transparent opacity={isGhosted ? 0.08 : (isDraggingThis ? 0.6 : 0.25)} />
      </mesh>

      {/* Vertical Laser Beam to Actual Elevated Bin Slot on Rack */}
      <Line
        points={[
          [0, 0.06, 0],
          [bin3D.x - floorX, bin3D.y - floorY, bin3D.z - floorZ],
        ]}
        color={pinColor}
        lineWidth={2}
        dashed
        dashScale={4}
        dashSize={0.2}
        gapSize={0.2}
        transparent
        opacity={isGhosted ? 0.15 : 0.7}
      />

      {/* Highlight Box at the Target Bin Slot */}
      <mesh position={[bin3D.x - floorX, bin3D.y - floorY + 0.3, bin3D.z - floorZ]}>
        <boxGeometry args={[1.1, 0.8, 0.9]} />
        <meshBasicMaterial
          color={pinColor}
          wireframe
          transparent
          opacity={isGhosted ? 0.1 : (isCurrent ? 0.9 : 0.4)}
        />
      </mesh>

      {/* Floating 3D Waypoint Badge with Anti-Collision LOD */}
      <Html
        position={[0, elevationY, 0]}
        center
        distanceFactor={undefined}
        zIndexRange={[15, 0]}
        style={{ pointerEvents: isGhosted ? 'none' : 'auto' }}
      >
        <div
          onMouseEnter={() => !isGhosted && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`cursor-pointer transition-opacity duration-300 ${isGhosted ? 'opacity-30 pointer-events-none' : ''}`}
        >
          {showCompact ? (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shadow-md border backdrop-blur-md select-none transition-all duration-300 hover:scale-110 ${
                isCompleted
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                  : theme === 'light'
                  ? 'bg-white/95 text-slate-800 border-sky-300 shadow-sm'
                  : 'bg-slate-900/90 text-sky-300 border-sky-500/40'
              }`}
              title={`Stop #${stopNumber}: ${pick.binId}`}
            >
              {isCompleted ? '✓' : stopNumber}
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight shadow-md border backdrop-blur-md whitespace-nowrap select-none transition-all duration-300 ${
                isDraggingThis
                  ? 'bg-amber-950/95 text-amber-200 border-amber-400 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                  : isCompleted
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                  : isCurrent
                  ? 'bg-amber-950/90 text-amber-300 border-amber-500/80 animate-bounce scale-110 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : theme === 'light'
                  ? 'bg-white/95 text-slate-800 border-sky-300'
                  : 'bg-slate-900/90 text-sky-300 border-sky-500/40'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${
                  isCompleted
                    ? 'bg-emerald-500 text-slate-950'
                    : isCurrent || isDraggingThis
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-sky-500 text-slate-950'
                }`}
              >
                {isCompleted ? '✓' : stopNumber}
              </span>
              <span>{pick.binId}</span>
              {isDraggingThis && <span className="text-[8px] text-amber-300">(geser...)</span>}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

interface CustomWaypointPinProps {
  waypoint: CustomWaypoint;
  theme: 'light' | 'dark';
}

const CustomWaypointPin: React.FC<CustomWaypointPinProps> = ({ waypoint, theme }) => {
  const diamondRef = useRef<THREE.Mesh>(null);
  const moveCustomWaypoint = useEditorStore((s) => s.moveCustomWaypoint);
  const removeCustomWaypoint = useEditorStore((s) => s.removeCustomWaypoint);
  const setIsDirectDragging = useEditorStore((s) => s.setIsDirectDragging);
  const setActiveDraggingPinId = useEditorStore((s) => s.setActiveDraggingPinId);
  const activeDraggingPinId = useEditorStore((s) => s.activeDraggingPinId);
  const routeResult = useEditorStore((s) => s.routeResult);

  const isDraggingThis = activeDraggingPinId === waypoint.id;
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; z: number } | null>(null);

  const isPointerDownRef = useRef(false);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const dragOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  useFrame((_, delta) => {
    if (diamondRef.current) {
      diamondRef.current.rotation.y += delta * 1.5;
    }
  });

  const posX = dragPreviewPos ? dragPreviewPos.x : waypoint.x;
  const posZ = dragPreviewPos ? dragPreviewPos.z : waypoint.z;

  // Immediate topological neighbors for clean zero-stray-lines rubber-band preview
  const neighborPoints = useMemo(() => {
    if (!routeResult || !routeResult.waypoints) return null;
    const idx = routeResult.waypoints.findIndex(
      (w) => w.customWaypointId === waypoint.id || w.id === waypoint.id
    );
    if (idx === -1) return null;
    const prev = routeResult.waypoints[idx - 1] || routeResult.waypoints[0];
    const next =
      routeResult.waypoints[idx + 1] ||
      routeResult.waypoints[routeResult.waypoints.length - 1];
    return {
      prev: { x: prev.x, y: prev.y || 0, z: prev.z },
      next: { x: next.x, y: next.y || 0, z: next.z },
    };
  }, [routeResult, waypoint.id]);

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      isPointerDownRef.current = true;
      startPointerRef.current = { x: event.clientX, y: event.clientY };
      startPosRef.current = { x: waypoint.x, z: waypoint.z };

      const hit = new THREE.Vector3();
      if (event.ray.intersectPlane(GROUND_PLANE, hit)) {
        dragOffsetRef.current = {
          x: waypoint.x - hit.x,
          z: waypoint.z - hit.z,
        };
      } else {
        dragOffsetRef.current = { x: 0, z: 0 };
      }

      try {
        (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
      } catch {}
    },
    [waypoint.x, waypoint.z]
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
        setActiveDraggingPinId(waypoint.id);
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

          // Walkability corridor snapping: automatically snaps to valid corridor cell
          const grid = createWalkabilityGrid(bounds, state.racks, state.structuralElements);
          const validPoint = findNearestWalkablePoint(grid, clampedX, clampedZ);

          setDragPreviewPos(validPoint);
        }
      }
    },
    [waypoint.id, setIsDirectDragging, setActiveDraggingPinId]
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
          moveCustomWaypoint(waypoint.id, dragPreviewPos);
        }
        setDragPreviewPos(null);
      }
    },
    [dragPreviewPos, waypoint.id, moveCustomWaypoint, setIsDirectDragging, setActiveDraggingPinId]
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent> | React.MouseEvent) => {
      e.stopPropagation();
      removeCustomWaypoint(waypoint.id);
    },
    [waypoint.id, removeCustomWaypoint]
  );

  const rubberBandPoints = useMemo(() => {
    if (!isDraggingThis || !dragPreviewPos || !neighborPoints) return null;
    return [
      [neighborPoints.prev.x, (neighborPoints.prev.y || 0) + 0.1, neighborPoints.prev.z] as [
        number,
        number,
        number,
      ],
      [dragPreviewPos.x, 0.1, dragPreviewPos.z] as [number, number, number],
      [neighborPoints.next.x, (neighborPoints.next.y || 0) + 0.1, neighborPoints.next.z] as [
        number,
        number,
        number,
      ],
    ];
  }, [isDraggingThis, dragPreviewPos, neighborPoints]);

  return (
    <group>
      {/* Dynamic Drag Rubber-Band Line Preview between immediate topological neighbors */}
      {rubberBandPoints && (
        <Line
          points={rubberBandPoints}
          color="#c084fc"
          lineWidth={4.5}
          dashed
          dashScale={2.5}
          dashSize={0.6}
          gapSize={0.3}
        />
      )}

      <group
        position={[posX, 0, posZ]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={handleDoubleClick}
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
        {/* Ground Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.3, 0.45, 24]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.8} />
        </mesh>

        {/* Floating Violet Diamond Beacon */}
        <mesh ref={diamondRef} position={[0, 0.45, 0]}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color="#c084fc"
            emissive="#7e22ce"
            emissiveIntensity={0.6}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>

        {/* Floating 3D Badge */}
        <Html
          position={[0, 0.95, 0]}
          center
          distanceFactor={undefined}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'auto' }}
        >
          <div
            onDoubleClick={handleDoubleClick}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight shadow-lg border backdrop-blur-md whitespace-nowrap select-none transition-all cursor-grab active:cursor-grabbing ${
              isDraggingThis
                ? 'bg-purple-950/95 text-purple-200 border-purple-400 scale-110 shadow-[0_0_15px_rgba(168,85,247,0.6)]'
                : theme === 'light'
                ? 'bg-purple-50/95 text-purple-900 border-purple-300'
                : 'bg-purple-950/90 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
            }`}
            title="Geser untuk ubah posisi • Double-click atau × untuk hapus"
          >
            <span>🔷</span>
            <span>{waypoint.name || 'Waypoint'}</span>
            {isDraggingThis ? (
              <span className="text-[8px] text-purple-300">(geser...)</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomWaypoint(waypoint.id);
                }}
                className="w-3.5 h-3.5 rounded-full bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white flex items-center justify-center text-[9px] ml-1 transition"
                title="Hapus Waypoint (Double-click juga bisa)"
              >
                ×
              </button>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
};

export const PickingRouteVisualizer: React.FC = () => {
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const routeResult = useEditorStore((s) => s.routeResult);
  const playbackState = useEditorStore((s) => s.playbackState);
  const customWaypoints = useEditorStore((s) => s.customWaypoints);
  const addCustomWaypoint = useEditorStore((s) => s.addCustomWaypoint);
  const theme = useSettingsStore((s) => s.theme);
  const fleet = useEditorStore((s) => s.fleet);
  const selectedFleetAgentId = useEditorStore((s) => s.selectedFleetAgentId);

  const [hoveredGhostPoint, setHoveredGhostPoint] = useState<{
    x: number;
    y: number;
    z: number;
    insertAfterStopIndex: number;
    prevWaypointId?: string;
    nextWaypointId?: string;
  } | null>(null);

  const lastGhostPointRef = useRef<{
    x: number;
    y: number;
    z: number;
    insertAfterStopIndex: number;
    prevWaypointId?: string;
    nextWaypointId?: string;
  } | null>(null);

  const isHoveringGhostPinRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastSplitTimeRef = useRef(0);

  const lineMatRef = useRef<THREE.Material & { dashOffset?: number }>(null);

  // Animate line dash offset for forward flowing electrical pulse effect
  useFrame((_, delta) => {
    if (lineMatRef.current && 'dashOffset' in lineMatRef.current) {
      lineMatRef.current.dashOffset = (lineMatRef.current.dashOffset || 0) - delta * 2;
    }
  });

  // Convert polyline 2D points to 3D vectors slightly above the floor (Y = 0.08m)
  const linePoints = useMemo(() => {
    if (!routeResult || routeResult.polylinePoints.length < 2) return [];
    return routeResult.polylinePoints.map(
      (p) => [p.x, (p.y !== undefined ? p.y + 0.08 : 0.08), p.z] as [number, number, number]
    );
  }, [routeResult]);

  const onPolylinePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (useEditorStore.getState().isDirectDragging) {
      setHoveredGhostPoint(null);
      lastGhostPointRef.current = null;
      isHoveringGhostPinRef.current = false;
      return;
    }
    const hit = new THREE.Vector3();
    if (event.ray.intersectPlane(GROUND_PLANE, hit)) {
      const route = useEditorStore.getState().routeResult;
      if (!route || route.polylinePoints.length < 2) return;
      const nearest = findNearestPolylineSegment(route.polylinePoints, hit.x, hit.z);
      if (nearest && nearest.distance <= 1.5) {
        const pt = {
          x: nearest.projectedPoint.x,
          y: nearest.projectedPoint.y,
          z: nearest.projectedPoint.z,
          insertAfterStopIndex: nearest.insertAfterStopIndex,
          prevWaypointId: nearest.prevWaypointId,
          nextWaypointId: nearest.nextWaypointId,
        };
        lastGhostPointRef.current = pt;
        setHoveredGhostPoint(pt);
        document.body.style.cursor = 'pointer';
        return;
      }
    }
    if (!isHoveringGhostPinRef.current) {
      setHoveredGhostPoint(null);
      lastGhostPointRef.current = null;
      document.body.style.cursor = 'auto';
    }
  }, []);

  const onPolylinePointerOut = useCallback(() => {
    if (isHoveringGhostPinRef.current) return;
    setHoveredGhostPoint(null);
    lastGhostPointRef.current = null;
    document.body.style.cursor = 'auto';
  }, []);

  const handleSplitAction = useCallback(
    (event: ThreeEvent<MouseEvent> | ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const now = Date.now();
      if (now - lastSplitTimeRef.current < 400) return;
      lastSplitTimeRef.current = now;

      const targetPt = lastGhostPointRef.current || hoveredGhostPoint;
      if (targetPt) {
        addCustomWaypoint({
          x: targetPt.x,
          z: targetPt.z,
          insertAfterStopIndex: targetPt.insertAfterStopIndex,
          insertAfterWaypointId: targetPt.prevWaypointId,
        });
        setHoveredGhostPoint(null);
        lastGhostPointRef.current = null;
        isHoveringGhostPinRef.current = false;
        document.body.style.cursor = 'auto';
        return;
      }

      const hit = new THREE.Vector3();
      if (event.ray.intersectPlane(GROUND_PLANE, hit)) {
        const route = useEditorStore.getState().routeResult;
        if (!route || route.polylinePoints.length < 2) return;
        const nearest = findNearestPolylineSegment(route.polylinePoints, hit.x, hit.z);
        if (nearest) {
          addCustomWaypoint({
            x: nearest.projectedPoint.x,
            z: nearest.projectedPoint.z,
            insertAfterStopIndex: nearest.insertAfterStopIndex,
            insertAfterWaypointId: nearest.prevWaypointId,
          });
          setHoveredGhostPoint(null);
          lastGhostPointRef.current = null;
          isHoveringGhostPinRef.current = false;
          document.body.style.cursor = 'auto';
        }
      }
    },
    [hoveredGhostPoint, addCustomWaypoint]
  );

  const onPointerDownHandler = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    pointerDownPosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUpHandler = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0 || !pointerDownPosRef.current) return;
      const dx = Math.abs(event.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(event.clientY - pointerDownPosRef.current.y);
      pointerDownPosRef.current = null;
      if (dx < 6 && dy < 6) {
        handleSplitAction(event);
      }
    },
    [handleSplitAction]
  );

  // Proximity & Clustering Map for Anti-Collision LOD badges
  const proximityMap = useMemo(() => {
    const picks = routeResult?.orderedPicks || [];
    return picks.map((p1, i) => {
      const hasNearby = picks.some(
        (p2, j) =>
          i !== j &&
          (p1.rackId === p2.rackId ||
            Math.hypot(
              p1.accessPoint3D.x - p2.accessPoint3D.x,
              p1.accessPoint3D.z - p2.accessPoint3D.z
            ) <= 3.5)
      );
      return {
        isClustered: hasNearby,
        elevationY: hasNearby ? (i % 2 === 0 ? 0.85 : 1.3) : 0.9,
      };
    });
  }, [routeResult?.orderedPicks]);

  if (editorViewMode !== 'PICKING' || !routeResult || linePoints.length < 2) {
    return null;
  }

  const { orderedPicks } = routeResult;
  const currentStop = playbackState.currentStopIndex;

  return (
    <group>
      {/* 1. Underlying Glow Ribbon */}
      <Line
        points={linePoints}
        color="#0284c7"
        lineWidth={6}
        transparent
        opacity={0.35}
      />

      {/* 2. Flowing Neon Animated Dash Line */}
      <Line
        ref={lineMatRef as never}
        points={linePoints}
        color={theme === 'light' ? '#0284c7' : '#38bdf8'}
        lineWidth={3.5}
        dashed
        dashScale={2.5}
        dashSize={0.8}
        gapSize={0.4}
      />

      {/* 2b. Multi-Agent Fleet Specific Route Ribbons (Phase 41) */}
      {fleet.length > 1 &&
        fleet.map((agent) => {
          if (!agent.routeResult || agent.routeResult.polylinePoints.length < 2) return null;
          const isSelectedAgent = selectedFleetAgentId === agent.id;
          const pts = agent.routeResult.polylinePoints.map(
            (p) => [p.x, (p.y !== undefined ? p.y + 0.09 : 0.09), p.z] as [number, number, number]
          );

          return (
            <group key={`fleet-line-${agent.id}`}>
              <Line
                points={pts}
                color={agent.color}
                lineWidth={isSelectedAgent ? 7 : 4}
                transparent
                opacity={isSelectedAgent ? 0.75 : 0.4}
              />
              <Line
                points={pts}
                color={agent.color}
                lineWidth={isSelectedAgent ? 4.5 : 2.5}
                dashed
                dashScale={2.0}
                dashSize={0.7}
                gapSize={0.3}
              />
            </group>
          );
        })}

      {/* 3. Invisible Hit Box Line for Inserting Waypoints on Click & Hovering Ghost Pin */}
      <Line
        points={linePoints}
        lineWidth={28}
        transparent
        opacity={0.001}
        onPointerMove={onPolylinePointerMove}
        onPointerOut={onPolylinePointerOut}
        onPointerDown={onPointerDownHandler}
        onPointerUp={onPointerUpHandler}
        onClick={handleSplitAction}
      />

      {/* 3b. Interactive Ghost Pin Preview on Polyline Hover (Click-to-Split) */}
      {hoveredGhostPoint && (
        <group
          position={[
            hoveredGhostPoint.x,
            (hoveredGhostPoint.y || 0) + 0.08,
            hoveredGhostPoint.z,
          ]}
          onPointerOver={(e) => {
            e.stopPropagation();
            isHoveringGhostPinRef.current = true;
            document.body.style.cursor = 'pointer';
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            isHoveringGhostPinRef.current = true;
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            isHoveringGhostPinRef.current = false;
            setHoveredGhostPoint(null);
            lastGhostPointRef.current = null;
            document.body.style.cursor = 'auto';
          }}
          onPointerDown={onPointerDownHandler}
          onPointerUp={onPointerUpHandler}
          onClick={handleSplitAction}
        >
          {/* Generous invisible cylinder target for effortless clicking */}
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.65, 0.65, 1.0, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Pulsing Floor Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.42, 24]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.7} />
          </mesh>

          {/* Floating Cyan Diamond */}
          <mesh position={[0, 0.28, 0]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#0891b2"
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Floating Micro Tooltip */}
          <Html position={[0, 0.65, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
            <div className="pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-950/95 text-cyan-300 border border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.6)] backdrop-blur-md whitespace-nowrap select-none animate-pulse">
              <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-[11px] font-extrabold shadow-sm">
                +
              </span>
              <span>Klik untuk tambah waypoint belokan</span>
            </div>
          </Html>
        </group>
      )}

      {/* 4. Waypoint Pins & Vertical Laser Link to Bin 3D Slot */}
      {orderedPicks.map((pick, index) => {
        const clusterInfo = proximityMap[index] || { isClustered: false, elevationY: 0.9 };
        return (
          <StopPin
            key={`pick-stop-${pick.binId}-${index}`}
            pick={pick}
            index={index}
            currentStop={currentStop}
            isPlaying={playbackState.isPlaying}
            theme={theme}
            isClustered={clusterInfo.isClustered}
            elevationY={clusterInfo.elevationY}
          />
        );
      })}

      {/* 5. Custom Transit Waypoint Pins */}
      {customWaypoints.map((wp) => (
        <CustomWaypointPin key={wp.id} waypoint={wp} theme={theme} />
      ))}
    </group>
  );
};

