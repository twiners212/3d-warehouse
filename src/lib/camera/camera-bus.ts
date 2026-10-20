// Event bus for camera navigation, preset transitions, and zoom actions.

export type CameraPreset = 'PERSP_3D' | 'ORTHO_2D' | 'FRONT' | 'SIDE';

export interface CameraTransitionRequest {
  type: 'preset' | 'focus' | 'reset' | 'zoomIn' | 'zoomOut';
  preset?: CameraPreset;
  target?: { x: number; y: number; z: number };
  distance?: number;
}

type CameraListener = (req: CameraTransitionRequest) => void;

class CameraEventBus {
  private listeners = new Set<CameraListener>();
  public currentFocusTarget: { x: number; z: number } | null = null;

  getCurrentFocus(): { x: number; z: number } | null {
    return this.currentFocusTarget;
  }

  setCurrentFocus(target: { x: number; z: number }): void {
    this.currentFocusTarget = target;
  }

  subscribe(listener: CameraListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(req: CameraTransitionRequest): void {
    for (const listener of this.listeners) {
      listener(req);
    }
  }

  resetOverview(): void {
    this.dispatch({ type: 'reset' });
  }

  focusSelected(): void {
    this.dispatch({ type: 'focus' });
  }

  setPreset(preset: CameraPreset): void {
    this.dispatch({ type: 'preset', preset });
  }

  zoomIn(): void {
    this.dispatch({ type: 'zoomIn' });
  }

  zoomOut(): void {
    this.dispatch({ type: 'zoomOut' });
  }
}

export const cameraBus = new CameraEventBus();
