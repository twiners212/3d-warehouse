// Telemetry event bus for reporting real-time cursor coordinates and floor metrics
// Decoupled from React render cycle to prevent 60Hz re-renders across the full tree.

export interface CursorPosition {
  x: number;
  z: number;
}

type TelemetryListener = (pos: CursorPosition | null) => void;

class TelemetryBus {
  private currentPos: CursorPosition | null = null;
  private listeners = new Set<TelemetryListener>();

  public setCursorPos(x: number, z: number): void {
    const roundedX = Math.round(x * 10) / 10;
    const roundedZ = Math.round(z * 10) / 10;
    if (this.currentPos && this.currentPos.x === roundedX && this.currentPos.z === roundedZ) {
      return;
    }
    this.currentPos = { x: roundedX, z: roundedZ };
    this.notify();
  }

  public clearCursorPos(): void {
    if (this.currentPos === null) return;
    this.currentPos = null;
    this.notify();
  }

  public getCursorPos(): CursorPosition | null {
    return this.currentPos;
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.currentPos);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentPos);
    }
  }
}

export const telemetryBus = new TelemetryBus();
