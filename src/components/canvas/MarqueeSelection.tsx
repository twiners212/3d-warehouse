'use client';

// 2D Marquee (Box Drag) Selection for 3D Warehouse Entities.
// Triggered when user holds Shift and drags across the floor/canvas.
// Projects entity coordinates to screen space and selects all enclosed items.

import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/useEditorStore';

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function MarqueeSelection() {
  const { camera, gl } = useThree();
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const isSelectingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvasEl = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      // Only trigger in LAYOUT mode when Shift is held and Left Mouse Button is pressed
      if (useEditorStore.getState().editorViewMode !== 'LAYOUT') return;
      if (!e.shiftKey || e.button !== 0) return;

      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      isSelectingRef.current = true;
      startPosRef.current = { x, y };
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y });

      // Pause OrbitControls so camera does not rotate while drawing marquee
      useEditorStore.getState().setIsDirectDragging(true);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isSelectingRef.current) return;

      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMarquee((prev) =>
        prev
          ? {
              ...prev,
              currentX: x,
              currentY: y,
            }
          : null
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      useEditorStore.getState().setIsDirectDragging(false);

      const rect = canvasEl.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;

      setMarquee(null);

      const dragDistance = Math.hypot(endX - startX, endY - startY);
      // Ignore tiny jitter/clicks
      if (dragDistance < 8) return;

      const boxLeft = Math.min(startX, endX);
      const boxRight = Math.max(startX, endX);
      const boxTop = Math.min(startY, endY);
      const boxBottom = Math.max(startY, endY);

      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      const state = useEditorStore.getState();
      const matchedIds: string[] = [];

      const tempVec = new THREE.Vector3();

      const isPointInBox = (worldX: number, worldY: number, worldZ: number) => {
        tempVec.set(worldX, worldY, worldZ).project(camera);
        // If point is behind camera, discard
        if (tempVec.z > 1) return false;

        const screenX = (tempVec.x * 0.5 + 0.5) * canvasWidth;
        const screenY = (-tempVec.y * 0.5 + 0.5) * canvasHeight;

        return (
          screenX >= boxLeft &&
          screenX <= boxRight &&
          screenY >= boxTop &&
          screenY <= boxBottom
        );
      };

      // Check Racks
      for (const rack of state.racks) {
        const hw = rack.dimensions.width / 2;
        const hd = rack.dimensions.depth / 2;
        // Check center or any 4 footprint corners
        if (
          isPointInBox(rack.position.x, 0, rack.position.z) ||
          isPointInBox(rack.position.x - hw, 0, rack.position.z - hd) ||
          isPointInBox(rack.position.x + hw, 0, rack.position.z + hd) ||
          isPointInBox(rack.position.x - hw, 0, rack.position.z + hd) ||
          isPointInBox(rack.position.x + hw, 0, rack.position.z - hd)
        ) {
          matchedIds.push(rack.id);
        }
      }

      // Check Structural Elements
      for (const struct of state.structuralElements) {
        const hw = struct.dimensions.width / 2;
        const hd = struct.dimensions.depth / 2;
        if (
          isPointInBox(struct.position.x, 0, struct.position.z) ||
          isPointInBox(struct.position.x - hw, 0, struct.position.z - hd) ||
          isPointInBox(struct.position.x + hw, 0, struct.position.z + hd)
        ) {
          matchedIds.push(struct.id);
        }
      }

      // Check Operational Zones
      for (const zone of state.zones) {
        const hw = zone.dimensions.width / 2;
        const hd = zone.dimensions.depth / 2;
        if (
          isPointInBox(zone.position.x, 0, zone.position.z) ||
          isPointInBox(zone.position.x - hw, 0, zone.position.z - hd) ||
          isPointInBox(zone.position.x + hw, 0, zone.position.z + hd)
        ) {
          matchedIds.push(zone.id);
        }
      }

      if (matchedIds.length > 0) {
        state.setMultipleSelection(matchedIds);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [camera, gl]);

  if (!marquee) return null;

  const left = Math.min(marquee.startX, marquee.currentX);
  const top = Math.min(marquee.startY, marquee.currentY);
  const width = Math.abs(marquee.currentX - marquee.startX);
  const height = Math.abs(marquee.currentY - marquee.startY);

  // Render DOM marquee overlay directly via Portal or Html from drei
  return null;
}

export function MarqueeOverlayDOM() {
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey || e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      setRect({ left: startX, top: startY, width: 0, height: 0 });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const curX = e.clientX;
      const curY = e.clientY;
      const left = Math.min(startX, curX);
      const top = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);
      setRect({ left, top, width, height });
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        setRect(null);
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (!rect || rect.width < 4 || rect.height < 4) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 border-2 border-sky-400 bg-sky-500/15 border-dashed rounded backdrop-blur-[0.5px] shadow-[0_0_15px_rgba(56,189,248,0.25)]"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    />
  );
}
