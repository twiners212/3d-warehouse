'use client';

// Fulfills ARCHITECTURE.md Section 2 (canvas/CameraController.tsx):
// Advanced camera navigation controller supporting:
// - Smooth transitions for Presets (3D, 2D Top-Down, Front, Side, Reset Overview)
// - Smart Bounding Box Focus on Selected Entities [F]
// - Continuous Keyboard Panning (WASD / Arrows) & Rotation (Q/E)
// - Zoom In/Out actions via event bus and UI toolbar

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { cameraBus } from '@/lib/camera/camera-bus';
import { useEditorStore } from '@/stores/useEditorStore';

const KEY_MOVE_SPEED = 24; // meters per second
const KEY_ROTATE_SPEED = 1.8; // radians per second
const LERP_SPEED = 6.0; // interpolation factor

export function CameraController() {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const floorDimensions = useEditorStore((s) => s.floorDimensions);
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const isFollowCamActive = useEditorStore((s) => s.isFollowCamActive);
  const selectedFleetAgentId = useEditorStore((s) => s.selectedFleetAgentId);
  const fleet = useEditorStore((s) => s.fleet);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const toggleFollowCam = useEditorStore((s) => s.toggleFollowCam);

  // Transition animation state
  const isTransitioningRef = useRef(false);
  const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(45, 35, 45));
  const targetOrbitRef = useRef<THREE.Vector3>(
    new THREE.Vector3(floorDimensions.width / 2, 0, floorDimensions.depth / 2)
  );

  // Active keyboard keys state
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});

  // Helper to trigger smooth camera transition
  const triggerTransition = (camPos: THREE.Vector3, orbitTarget: THREE.Vector3) => {
    targetCamPosRef.current.copy(camPos);
    targetOrbitRef.current.copy(orbitTarget);
    isTransitioningRef.current = true;
  };

  // Subscribe to camera bus events
  useEffect(() => {
    const unsubscribe = cameraBus.subscribe((req) => {
      const state = useEditorStore.getState();
      const floor = state.floorDimensions;
      const floorCenter = new THREE.Vector3(floor.width / 2, 0, floor.depth / 2);
      const maxDim = Math.max(floor.width, floor.depth);

      if (req.type === 'reset') {
        const camPos = new THREE.Vector3(
          floorCenter.x + floor.width * 0.55,
          maxDim * 0.65,
          floorCenter.z + floor.depth * 0.75
        );
        triggerTransition(camPos, floorCenter);
      } else if (req.type === 'zoomIn') {
        if (controlsRef.current) {
          const dir = new THREE.Vector3().subVectors(controlsRef.current.target, camera.position);
          if (dir.length() > 6) {
            const newPos = camera.position.clone().add(dir.multiplyScalar(0.25));
            triggerTransition(newPos, controlsRef.current.target.clone());
          }
        }
      } else if (req.type === 'zoomOut') {
        if (controlsRef.current) {
          const dir = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target);
          if (dir.length() < 250) {
            const newPos = camera.position.clone().add(dir.multiplyScalar(0.25));
            triggerTransition(newPos, controlsRef.current.target.clone());
          }
        }
      } else if (req.type === 'preset') {
        if (req.preset === 'ORTHO_2D') {
          state.setCameraMode('ORTHO_2D');
          const camPos = new THREE.Vector3(floorCenter.x, maxDim * 1.3, floorCenter.z + 0.001);
          triggerTransition(camPos, floorCenter);
        } else if (req.preset === 'PERSP_3D') {
          state.setCameraMode('PERSP_3D');
          const camPos = new THREE.Vector3(
            floorCenter.x + floor.width * 0.55,
            maxDim * 0.65,
            floorCenter.z + floor.depth * 0.75
          );
          triggerTransition(camPos, floorCenter);
        } else if (req.preset === 'FRONT') {
          state.setCameraMode('PERSP_3D');
          const camPos = new THREE.Vector3(
            floorCenter.x,
            floor.height * 0.8,
            floorCenter.z + floor.depth * 0.95
          );
          triggerTransition(camPos, new THREE.Vector3(floorCenter.x, floor.height * 0.35, floorCenter.z));
        } else if (req.preset === 'SIDE') {
          state.setCameraMode('PERSP_3D');
          const camPos = new THREE.Vector3(
            floorCenter.x + floor.width * 0.95,
            floor.height * 0.8,
            floorCenter.z
          );
          triggerTransition(camPos, new THREE.Vector3(floorCenter.x, floor.height * 0.35, floorCenter.z));
        }
      } else if (req.type === 'focus') {
        const selectedId = state.selectedEntityId;
        if (!selectedId) {
          // If no entity is selected, center onto floor overview
          cameraBus.resetOverview();
          return;
        }

        // 1. Check racks
        const rack = state.racks.find((r) => r.id === selectedId);
        if (rack) {
          const rx = rack.position.x;
          const ry = rack.dimensions.height / 2;
          const rz = rack.position.z;
          const entityCenter = new THREE.Vector3(rx, ry, rz);
          const maxEntityDim = Math.max(
            rack.dimensions.width,
            rack.dimensions.height,
            rack.dimensions.depth
          );
          const dist = Math.max(10, maxEntityDim * 1.6);
          const camPos = new THREE.Vector3(rx + dist * 0.6, ry + dist * 0.65, rz + dist * 0.75);
          triggerTransition(camPos, entityCenter);
          return;
        }

        // 2. Check structures
        const structure = state.structuralElements.find((s) => s.id === selectedId);
        if (structure) {
          const sx = structure.position.x;
          const sy = structure.dimensions.height / 2;
          const sz = structure.position.z;
          const entityCenter = new THREE.Vector3(sx, sy, sz);
          const maxEntityDim = Math.max(
            structure.dimensions.width,
            structure.dimensions.height,
            structure.dimensions.depth
          );
          const dist = Math.max(8, maxEntityDim * 1.6);
          const camPos = new THREE.Vector3(sx + dist * 0.6, sy + dist * 0.65, sz + dist * 0.75);
          triggerTransition(camPos, entityCenter);
          return;
        }

        // 3. Check zones
        const zone = state.zones.find((z) => z.id === selectedId);
        if (zone) {
          const zx = zone.position.x;
          const zy = 0.5;
          const zz = zone.position.z;
          const entityCenter = new THREE.Vector3(zx, zy, zz);
          const maxEntityDim = Math.max(zone.dimensions.width, zone.dimensions.depth);
          const dist = Math.max(12, maxEntityDim * 1.3);
          const camPos = new THREE.Vector3(zx + dist * 0.5, dist * 0.8, zz + dist * 0.65);
          triggerTransition(camPos, entityCenter);
          return;
        }
      }
    });

    return unsubscribe;
  }, [camera]);

  // Keyboard navigation event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      activeKeysRef.current[key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      activeKeysRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Frame update: handles smooth transitions & WASD/Arrows/QE camera controls
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // 1. Process smooth camera animation when transition is active
    if (isTransitioningRef.current) {
      const t = Math.min(1, delta * LERP_SPEED);
      camera.position.lerp(targetCamPosRef.current, t);
      controls.target.lerp(targetOrbitRef.current, t);
      controls.update();

      if (
        camera.position.distanceTo(targetCamPosRef.current) < 0.05 &&
        controls.target.distanceTo(targetOrbitRef.current) < 0.05
      ) {
        camera.position.copy(targetCamPosRef.current);
        controls.target.copy(targetOrbitRef.current);
        controls.update();
        isTransitioningRef.current = false;
      }
      return;
    }

    // 2. Continuous Keyboard Navigation
    const keys = activeKeysRef.current;
    const isMovingForward = keys['w'] || keys['arrowup'];
    const isMovingBackward = keys['s'] || keys['arrowdown'];
    const isMovingLeft = keys['a'] || keys['arrowleft'];
    const isMovingRight = keys['d'] || keys['arrowright'];
    const isRotatingLeft = keys['q'];
    const isRotatingRight = keys['e'];

    // Process Follow-Cam tracking for active vehicle in Picking mode
    if (
      editorViewMode === 'PICKING' &&
      isFollowCamActive &&
      selectedFleetAgentId &&
      !isTransitioningRef.current
    ) {
      const activeAgent = fleet.find((a) => a.id === selectedFleetAgentId);
      if (activeAgent) {
        const targetTarget = new THREE.Vector3(
          activeAgent.position3D.x,
          activeAgent.position3D.y + 0.8,
          activeAgent.position3D.z
        );
        const desiredCamPos = new THREE.Vector3(
          activeAgent.position3D.x + 8.0,
          activeAgent.position3D.y + 8.0,
          activeAgent.position3D.z + 8.0
        );

        controls.target.lerp(targetTarget, 0.1);
        camera.position.lerp(desiredCamPos, 0.08);
        controls.update();
        cameraBus.setCurrentFocus({ x: controls.target.x, z: controls.target.z });
        return;
      }
    }

    const hasNavInput =
      isMovingForward ||
      isMovingBackward ||
      isMovingLeft ||
      isMovingRight ||
      isRotatingLeft ||
      isRotatingRight;

    if (!hasNavInput) return;

    // Disengage follow cam if user initiates manual keyboard navigation
    if (isFollowCamActive) {
      toggleFollowCam(false);
    }

    // Calculate camera direction on the horizontal plane (XZ)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    const moveVector = new THREE.Vector3();
    if (isMovingForward) moveVector.add(forward);
    if (isMovingBackward) moveVector.sub(forward);
    if (isMovingRight) moveVector.add(right);
    if (isMovingLeft) moveVector.sub(right);

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(KEY_MOVE_SPEED * delta);
      camera.position.add(moveVector);
      controls.target.add(moveVector);
      controls.update();
    }

    // Process Q/E azimuth camera rotation
    if (isRotatingLeft || isRotatingRight) {
      const rotAngle =
        (isRotatingLeft ? KEY_ROTATE_SPEED : -KEY_ROTATE_SPEED) * delta;
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotAngle);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    }

    // Keep cameraBus focus target updated with current orbit center
    cameraBus.setCurrentFocus({ x: controls.target.x, z: controls.target.z });
  });

  const isDirectDragging = useEditorStore((s) => s.isDirectDragging);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isDirectDragging}
      target={[floorDimensions.width / 2, 0, floorDimensions.depth / 2]}
      maxPolarAngle={cameraMode === 'ORTHO_2D' ? 0.01 : Math.PI / 2.05}
      minDistance={3}
      maxDistance={220}
      enableRotate={cameraMode !== 'ORTHO_2D'}
      dampingFactor={0.08}
      enableDamping
      onStart={() => {
        if (isFollowCamActive) {
          toggleFollowCam(false);
        }
      }}
    />
  );
}
