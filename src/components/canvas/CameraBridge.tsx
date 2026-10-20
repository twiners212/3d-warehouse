'use client';

// Registers the live camera and canvas rect onto the placement bus so DOM
// drag events outside the Canvas can be raycast against the floor plane.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { registerCameraBridge, unregisterCameraBridge } from '@/lib/placement/placement-bus';

export function CameraBridge() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    registerCameraBridge(camera, () => gl.domElement.getBoundingClientRect());
    return () => {
      unregisterCameraBridge();
    };
  }, [camera, gl]);

  return null;
}
