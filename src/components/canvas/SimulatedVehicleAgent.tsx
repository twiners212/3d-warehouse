'use client';

// Fulfills Phase 36: 3D Simulated Vehicle Agent (Forklift, AGV, Trolley)
// Animates vehicle movement along the A* polyline path with heading interpolation and real-time playback updates

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import { VEHICLE_CONFIGS } from '@/types/routing';

export const SimulatedVehicleAgent: React.FC = () => {
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const routeResult = useEditorStore((s) => s.routeResult);
  const vehicleType = useEditorStore((s) => s.selectedVehicleType);
  const playbackState = useEditorStore((s) => s.playbackState);
  const setPlaybackProgress = useEditorStore((s) => s.setPlaybackProgress);
  const setPlaybackState = useEditorStore((s) => s.setPlaybackState);

  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const lidarRef = useRef<THREE.Mesh>(null);

  const vehicleConfig = VEHICLE_CONFIGS[vehicleType];

  // Pre-calculate cumulative segment lengths along polyline
  const { segments, totalLength } = useMemo(() => {
    if (!routeResult || routeResult.polylinePoints.length < 2) {
      return { segments: [], totalLength: 0 };
    }

    const pts = routeResult.polylinePoints;
    const segs: Array<{
      p1: { x: number; y?: number; z: number };
      p2: { x: number; y?: number; z: number };
      len: number;
      cumStart: number;
      cumEnd: number;
    }> = [];

    let cum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = (pts[i + 1].y || 0) - (pts[i].y || 0);
      const dz = pts[i + 1].z - pts[i].z;
      const d = Math.hypot(dx, dy, dz);
      segs.push({
        p1: pts[i],
        p2: pts[i + 1],
        len: d,
        cumStart: cum,
        cumEnd: cum + d,
      });
      cum += d;
    }

    return { segments: segs, totalLength: Math.max(0.001, cum) };
  }, [routeResult]);

  // Compute current position & heading based on progress
  useFrame((_, delta) => {
    if (!routeResult || segments.length === 0 || !groupRef.current) return;

    // Advance playback if playing
    if (playbackState.isPlaying) {
      const stepDistance = vehicleConfig.speedMps * playbackState.playbackSpeed * delta;
      const progressDelta = stepDistance / totalLength;
      const nextProgress = playbackState.progress + progressDelta;

      if (nextProgress >= 1.0) {
        setPlaybackState({ isPlaying: false, progress: 1.0 });
      } else {
        setPlaybackProgress(nextProgress);
      }
    }

    // Flash beacon or rotate lidar
    if (beaconRef.current) {
      const time = performance.now() * 0.008;
      beaconRef.current.visible = Math.sin(time) > 0;
    }
    if (lidarRef.current) {
      lidarRef.current.rotation.y += delta * 10;
    }

    // Interpolate 3D position along polyline
    const targetDistance = playbackState.progress * totalLength;
    let activeSeg = segments[0];

    for (let i = 0; i < segments.length; i++) {
      if (
        targetDistance >= segments[i].cumStart &&
        (targetDistance <= segments[i].cumEnd || i === segments.length - 1)
      ) {
        activeSeg = segments[i];
        break;
      }
    }

    const segProgress =
      activeSeg.len > 0
        ? Math.max(0, Math.min(1, (targetDistance - activeSeg.cumStart) / activeSeg.len))
        : 0;

    const posX = activeSeg.p1.x + segProgress * (activeSeg.p2.x - activeSeg.p1.x);
    const y1 = activeSeg.p1.y || 0;
    const y2 = activeSeg.p2.y || 0;
    const posY = y1 + segProgress * (y2 - y1);
    const posZ = activeSeg.p1.z + segProgress * (activeSeg.p2.z - activeSeg.p1.z);

    // Compute target yaw heading angle and pitch
    const dx = activeSeg.p2.x - activeSeg.p1.x;
    const dy = y2 - y1;
    const dz = activeSeg.p2.z - activeSeg.p1.z;
    const horizontalDist = Math.hypot(dx, dz);
    const targetYaw = horizontalDist > 0.01 ? Math.atan2(dx, dz) : groupRef.current.rotation.y;
    const targetPitch = horizontalDist > 0.05 ? -Math.atan2(dy, horizontalDist) : 0;

    // Smooth position and rotation
    groupRef.current.position.x = posX;
    groupRef.current.position.y = posY + 0.05;
    groupRef.current.position.z = posZ;

    // Shortest angular difference lerp for yaw
    let diffYaw = targetYaw - groupRef.current.rotation.y;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    groupRef.current.rotation.y += diffYaw * 0.25;

    // Pitch tilt along slope
    groupRef.current.rotation.x += (targetPitch - groupRef.current.rotation.x) * 0.2;
  });


  if (editorViewMode !== 'PICKING' || !routeResult) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {/* ================= MODEL 1: FORKLIFT ================= */}
      {vehicleType === 'FORKLIFT' && (
        <group>
          {/* Main Chassis / Counterweight */}
          <mesh position={[0, 0.45, -0.2]}>
            <boxGeometry args={[1.2, 0.6, 1.6]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.4} />
          </mesh>

          {/* Engine Hood Grill (Black) */}
          <mesh position={[0, 0.5, -0.9]}>
            <boxGeometry args={[1.0, 0.4, 0.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>

          {/* Overhead Protection Roll Cage */}
          <mesh position={[-0.5, 1.2, -0.1]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.5, 1.2, -0.1]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[-0.5, 1.2, 0.5]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.5, 1.2, 0.5]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {/* Cage Roof Grid */}
          <mesh position={[0, 1.75, 0.2]}>
            <boxGeometry args={[1.15, 0.05, 0.8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>

          {/* Mast Uprights (Front) */}
          <mesh position={[-0.35, 1.1, 0.75]}>
            <boxGeometry args={[0.08, 2.0, 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          <mesh position={[0.35, 1.1, 0.75]}>
            <boxGeometry args={[0.08, 2.0, 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>

          {/* Forks (Carriage & Blades) */}
          <mesh position={[-0.22, 0.08, 1.3]}>
            <boxGeometry args={[0.12, 0.04, 1.0]} />
            <meshStandardMaterial color="#475569" metalness={0.9} />
          </mesh>
          <mesh position={[0.22, 0.08, 1.3]}>
            <boxGeometry args={[0.12, 0.04, 1.0]} />
            <meshStandardMaterial color="#475569" metalness={0.9} />
          </mesh>

          {/* Mini Pallet + Carton on Forks */}
          <mesh position={[0, 0.16, 1.3]}>
            <boxGeometry args={[0.9, 0.1, 0.8]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.45, 1.3]}>
            <boxGeometry args={[0.7, 0.5, 0.6]} />
            <meshStandardMaterial color="#d97706" roughness={0.7} />
          </mesh>

          {/* 4 Heavy Rubber Wheels */}
          <mesh position={[-0.6, 0.25, 0.4]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.25, 0.25, 0.18, 16]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
          <mesh position={[0.6, 0.25, 0.4]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.25, 0.25, 0.18, 16]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
          <mesh position={[-0.6, 0.25, -0.6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.25, 0.25, 0.18, 16]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
          <mesh position={[0.6, 0.25, -0.6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.25, 0.25, 0.18, 16]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>

          {/* Top Amber Flashing Beacon */}
          <mesh ref={beaconRef} position={[0, 1.85, 0.2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 16]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </group>
      )}

      {/* ================= MODEL 2: AGV (ROBOT) ================= */}
      {vehicleType === 'AGV' && (
        <group>
          {/* Circular Puck Body */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.6, 0.65, 0.35, 32]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Glowing LED Circumference Ring */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.66, 0.66, 0.06, 32]} />
            <meshBasicMaterial
              color={playbackState.isPlaying ? '#06b6d4' : '#10b981'}
            />
          </mesh>

          {/* Top Rotating Lidar Scanner */}
          <mesh ref={lidarRef} position={[0, 0.42, 0.2]}>
            <cylinderGeometry args={[0.1, 0.12, 0.1, 16]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.44, 0.2]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>

          {/* Cargo Pallet Deck */}
          <mesh position={[0, 0.45, -0.1]}>
            <boxGeometry args={[0.8, 0.15, 0.8]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.8, -0.1]}>
            <boxGeometry args={[0.65, 0.55, 0.65]} />
            <meshStandardMaterial color="#d97706" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* ================= MODEL 3: PICKING CART / TROLLEY ================= */}
      {vehicleType === 'CART' && (
        <group>
          {/* Base Frame */}
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.8, 0.08, 1.2]} />
            <meshStandardMaterial color="#334155" metalness={0.7} />
          </mesh>

          {/* Wire Mesh Shelves */}
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[0.75, 0.04, 1.15]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <boxGeometry args={[0.75, 0.04, 1.15]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>

          {/* Corner Steel Posts */}
          <mesh position={[-0.38, 0.65, -0.58]}>
            <cylinderGeometry args={[0.02, 0.02, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.38, 0.65, -0.58]}>
            <cylinderGeometry args={[0.02, 0.02, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[-0.38, 0.65, 0.58]}>
            <cylinderGeometry args={[0.02, 0.02, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.38, 0.65, 0.58]}>
            <cylinderGeometry args={[0.02, 0.02, 1.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>

          {/* Rear Push Handle */}
          <mesh position={[0, 1.1, -0.6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.7]} />
            <meshStandardMaterial color="#e11d48" />
          </mesh>

          {/* Plastic Picking Totes on Shelves */}
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.65, 0.28, 0.95]} />
            <meshStandardMaterial color="#0284c7" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[0.65, 0.28, 0.95]} />
            <meshStandardMaterial color="#e11d48" roughness={0.4} />
          </mesh>

          {/* 4 Small Caster Wheels */}
          <mesh position={[-0.35, 0.06, -0.5]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#020617" />
          </mesh>
          <mesh position={[0.35, 0.06, -0.5]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#020617" />
          </mesh>
          <mesh position={[-0.35, 0.06, 0.5]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#020617" />
          </mesh>
          <mesh position={[0.35, 0.06, 0.5]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#020617" />
          </mesh>
        </group>
      )}

      {/* Floating Telemetry Badge above Vehicle (elevated to Y=2.8m and hidden when parked idle at Depot to avoid cluttering DEPOT marker) */}
      {(playbackState.isPlaying || playbackState.progress > 0.01) && (
        <Html
          position={[0, 2.8, 0]}
          center
          distanceFactor={undefined}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border shadow-lg backdrop-blur-md whitespace-nowrap select-none bg-slate-950/90 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>{vehicleConfig.label.split(' ')[0]}</span>
            <span className="text-slate-400 font-normal">|</span>
            <span className="text-emerald-400">{vehicleConfig.speedMps} m/s</span>
          </div>
        </Html>
      )}
    </group>
  );
};
