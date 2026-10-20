'use client';

// Fulfills Phase 29: Real-time 3D Ghost Preview for Aisle Array Generator
// Renders translucent candidate boxes and bounding wireframes in Three.js
// highlighting valid (green) vs colliding/out-of-bounds (red) positions.

import { useEffect, useState, useMemo } from 'react';
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { aislePreviewBus } from '@/lib/placement/aisle-preview-bus';
import type { CandidateRack } from '@/engine/procedural/aisle-generator';

const VALID_COLOR = '#10b981';
const INVALID_COLOR = '#ef4444';
const SKIPPED_COLOR = '#94a3b8';

export function AisleArrayPreview() {
  const [active, setActive] = useState(aislePreviewBus.isActive);
  const [candidates, setCandidates] = useState<CandidateRack[]>(aislePreviewBus.candidates);
  const [skipColliding, setSkipColliding] = useState(aislePreviewBus.skipColliding);

  useEffect(() => {
    return aislePreviewBus.subscribe(() => {
      setActive(aislePreviewBus.isActive);
      setCandidates(aislePreviewBus.candidates);
      setSkipColliding(aislePreviewBus.skipColliding);
    });
  }, []);

  const materials = useMemo(() => {
    return {
      validMesh: new MeshStandardMaterial({
        color: VALID_COLOR,
        transparent: true,
        opacity: 0.35,
        roughness: 0.4,
      }),
      validEdge: new LineBasicMaterial({ color: VALID_COLOR }),
      invalidMesh: new MeshStandardMaterial({
        color: INVALID_COLOR,
        transparent: true,
        opacity: 0.55,
        roughness: 0.4,
      }),
      invalidEdge: new LineBasicMaterial({ color: INVALID_COLOR }),
      skippedMesh: new MeshStandardMaterial({
        color: SKIPPED_COLOR,
        transparent: true,
        opacity: 0.15,
        roughness: 0.4,
      }),
      skippedEdge: new LineBasicMaterial({ color: SKIPPED_COLOR }),
    };
  }, []);

  if (!active || candidates.length === 0) {
    return null;
  }

  return (
    <group name="aisle-array-preview-group">
      {candidates.map((cand) => {
        const { entity, isValid } = cand;
        const dims = entity.dimensions;
        const isExcluded = !isValid && skipColliding;

        const meshMat = isExcluded
          ? materials.skippedMesh
          : isValid
          ? materials.validMesh
          : materials.invalidMesh;

        const edgeMat = isExcluded
          ? materials.skippedEdge
          : isValid
          ? materials.validEdge
          : materials.invalidEdge;

        return (
          <group
            key={entity.id}
            position={[entity.position.x, entity.position.y || 0, entity.position.z]}
            rotation={[0, entity.rotationY, 0]}
          >
            {/* Translucent bounding ghost box */}
            <mesh position={[0, dims.height / 2, 0]} material={meshMat}>
              <boxGeometry args={[dims.width, dims.height, dims.depth]} />
            </mesh>

            {/* Wireframe edges for crisp industrial look */}
            <lineSegments position={[0, dims.height / 2, 0]} material={edgeMat}>
              <edgesGeometry
                args={[new BoxGeometry(dims.width, dims.height, dims.depth)]}
              />
            </lineSegments>
          </group>
        );
      })}
    </group>
  );
}
