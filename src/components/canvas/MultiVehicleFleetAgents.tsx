'use client';

// Fulfills Phase 41: Multi-Agent Fleet Visualizer & Simulation Controller
// Renders multiple AGVs, Forklifts, and Carts operating simultaneously with independent A* trajectories,
// forward proximity radar, flasher beacons, and real-time battery/traffic status indicators.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import type { FleetAgent } from '@/types/routing';
import { VEHICLE_CONFIGS } from '@/types/routing';

interface SingleFleetAgentProps {
  agent: FleetAgent;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
}

const SingleFleetAgent: React.FC<SingleFleetAgentProps> = ({
  agent,
  isSelected,
  isPlaying,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const lidarRef = useRef<THREE.Mesh>(null);

  const vehicleConfig = VEHICLE_CONFIGS[agent.vehicleType];

  // Pre-calculate cumulative segments for this agent's polyline
  const { segments, totalLength } = useMemo(() => {
    if (!agent.routeResult || agent.routeResult.polylinePoints.length < 2) {
      return { segments: [], totalLength: 0 };
    }

    const pts = agent.routeResult.polylinePoints;
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
  }, [agent.routeResult]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Beacon and lidar animation
    if (beaconRef.current) {
      const time = performance.now() * 0.008;
      beaconRef.current.visible = agent.isYielding ? Math.sin(time * 3) > 0 : Math.sin(time) > 0;
    }
    if (lidarRef.current) {
      lidarRef.current.rotation.y += delta * 10;
    }

    if (segments.length === 0) {
      groupRef.current.position.set(
        agent.position3D.x,
        agent.position3D.y + 0.05,
        agent.position3D.z
      );
      return;
    }

    // Interpolate 3D position along polyline based on agent.progress
    const targetDistance = agent.progress * totalLength;
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

    // Compute heading
    const dx = activeSeg.p2.x - activeSeg.p1.x;
    const dy = y2 - y1;
    const dz = activeSeg.p2.z - activeSeg.p1.z;
    const horizontalDist = Math.hypot(dx, dz);
    const targetYaw = horizontalDist > 0.01 ? Math.atan2(dx, dz) : groupRef.current.rotation.y;
    const targetPitch = horizontalDist > 0.05 ? -Math.atan2(dy, horizontalDist) : 0;

    groupRef.current.position.set(posX, posY + 0.05, posZ);

    let diffYaw = targetYaw - groupRef.current.rotation.y;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    groupRef.current.rotation.y += diffYaw * 0.25;
    groupRef.current.rotation.x += (targetPitch - groupRef.current.rotation.x) * 0.2;
  });

  const batteryColor =
    agent.batteryLevel > 50
      ? 'text-emerald-400'
      : agent.batteryLevel > 20
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Selection Glow Cylinder on Floor */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 0.04, 32]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.4} />
        </mesh>
      )}

      {/* ================= MODEL 1: FORKLIFT ================= */}
      {agent.vehicleType === 'FORKLIFT' && (
        <group>
          {/* Main Chassis / Counterweight */}
          <mesh position={[0, 0.45, -0.2]}>
            <boxGeometry args={[1.2, 0.6, 1.6]} />
            <meshStandardMaterial color={agent.color} roughness={0.3} metalness={0.4} />
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
            <meshBasicMaterial color={agent.isYielding ? '#f43f5e' : '#fbbf24'} />
          </mesh>
        </group>
      )}

      {/* ================= MODEL 2: AGV (ROBOT) ================= */}
      {agent.vehicleType === 'AGV' && (
        <group>
          {/* Circular Puck Body */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.6, 0.65, 0.35, 32]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Glowing LED Circumference Ring */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.66, 0.66, 0.06, 32]} />
            <meshBasicMaterial color={agent.isYielding ? '#f43f5e' : agent.color} />
          </mesh>

          {/* Top Rotating Lidar Scanner */}
          <mesh ref={lidarRef} position={[0, 0.42, 0.2]}>
            <cylinderGeometry args={[0.1, 0.12, 0.1, 16]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.44, 0.2]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={agent.isYielding ? '#f43f5e' : '#38bdf8'} />
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

      {/* ================= MODEL 3: PICKING CART ================= */}
      {agent.vehicleType === 'CART' && (
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
          {/* Posts */}
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
          {/* Handle */}
          <mesh position={[0, 1.1, -0.6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.7]} />
            <meshStandardMaterial color={agent.color} />
          </mesh>
          {/* Totes */}
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.65, 0.28, 0.95]} />
            <meshStandardMaterial color="#0284c7" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[0.65, 0.28, 0.95]} />
            <meshStandardMaterial color={agent.color} roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* Floating Telemetry Badge */}
      <Html
        position={[0, 2.6, 0]}
        center
        distanceFactor={undefined}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border shadow-lg backdrop-blur-md whitespace-nowrap select-none transition-all ${
            isSelected
              ? 'bg-slate-950 text-white border-white ring-2 ring-white/60 scale-105'
              : 'bg-slate-950/85 text-slate-200 border-slate-700 hover:border-slate-400'
          }`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
          <span>{agent.name}</span>
          <span className="text-slate-500">|</span>
          <span className={batteryColor}>⚡{agent.batteryLevel.toFixed(0)}%</span>
          {agent.isYielding && (
            <span className="px-1.5 py-0.2 bg-rose-950/90 text-rose-300 rounded text-[9px] border border-rose-500 animate-pulse">
              YIELD
            </span>
          )}
        </div>
      </Html>
    </group>
  );
};

export const MultiVehicleFleetAgents: React.FC = () => {
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const fleet = useEditorStore((s) => s.fleet);
  const selectedFleetAgentId = useEditorStore((s) => s.selectedFleetAgentId);
  const selectFleetAgent = useEditorStore((s) => s.selectFleetAgent);
  const toggleFollowCam = useEditorStore((s) => s.toggleFollowCam);
  const isPlaying = useEditorStore((s) => s.playbackState.isPlaying);
  const updateFleetSimulationTick = useEditorStore((s) => s.updateFleetSimulationTick);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  // Drive global simulation ticks during playback
  useFrame((_, delta) => {
    if (editorViewMode === 'PICKING' && isPlaying) {
      updateFleetSimulationTick(delta);
    }
  });

  if (editorViewMode !== 'PICKING' || fleet.length === 0) {
    return null;
  }

  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;

  return (
    <group>
      {fleet.map((agent) => {
        const floorY = agent.position3D.y || 0;
        const isUpperLevel = activeLevelId !== 'ALL' && floorY > activeElevation + 0.1;
        const isDifferentLevel =
          activeLevelId !== 'ALL' && (agent.levelId || 'level-1') !== activeLevelId;
        const isHidden = floorSliceMode === 'ISOLATE' ? isDifferentLevel : isUpperLevel;

        if (isHidden) return null;

        return (
          <SingleFleetAgent
            key={agent.id}
            agent={agent}
            isSelected={selectedFleetAgentId === agent.id}
            isPlaying={isPlaying}
            onSelect={() => {
              selectFleetAgent(agent.id);
              toggleFollowCam(true);
            }}
          />
        );
      })}
    </group>
  );
};
