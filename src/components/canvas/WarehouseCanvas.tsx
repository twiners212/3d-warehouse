'use client';

// Fulfills ARCHITECTURE.md Section 2 (canvas/WarehouseCanvas.tsx):
// R3F Canvas root wiring lights, floor, racks, ghost placement, gizmo,
// and camera controller, plus floating Viewport HUD Toolbar & Quick-Tips.

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ProceduralRack } from './ProceduralRack';
import { ProceduralStructure } from './ProceduralStructure';
import { ZoneFootprint } from './ZoneFootprint';
import { WarehouseFloor } from './WarehouseFloor';
import { CameraController } from './CameraController';
import { CameraBridge } from './CameraBridge';
import { PlacementPreview } from './PlacementPreview';
import { AisleArrayPreview } from './AisleArrayPreview';
import { TransformGizmo } from './TransformGizmo';
import { ViewportToolbar } from './ViewportToolbar';
import { CanvasQuickTips } from '../editor/ui/CanvasQuickTips';
import { MarqueeSelection, MarqueeOverlayDOM } from './MarqueeSelection';
import { DepotMarker } from './DepotMarker';
import { PickingRouteVisualizer } from './PickingRouteVisualizer';
import { MultiVehicleFleetAgents } from './MultiVehicleFleetAgents';
import { ProceduralVerticalConnector } from './ProceduralVerticalConnector';
import { useEditorStore } from '@/stores/useEditorStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

function SceneContent() {
  const racks = useEditorStore((s) => s.racks);
  const structuralElements = useEditorStore((s) => s.structuralElements);
  const zones = useEditorStore((s) => s.zones);
  const verticalConnectors = useEditorStore((s) => s.verticalConnectors);
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const depotPosition = useEditorStore((s) => s.depotPosition);

  const theme = useSettingsStore((s) => s.theme);
  const graphicsQuality = useSettingsStore((s) => s.graphicsQuality);
  const isLight = theme === 'light';

  return (
    <>
      <color attach="background" args={[isLight ? 0xf1f5f9 : 0x0b1120]} />
      <hemisphereLight
        intensity={isLight ? 1.0 : 0.7}
        groundColor={isLight ? 0x94a3b8 : 0x1e293b}
        color={isLight ? 0xffffff : 0xffffff}
      />
      <directionalLight
        position={[30, 50, 20]}
        intensity={isLight ? 1.6 : 1.4}
        castShadow={graphicsQuality.shadows}
      />

      <WarehouseFloor />

      {/* Operational Floor Zones */}
      {zones.map((zone) => (
        <ZoneFootprint
          key={zone.id}
          zone={zone}
          selected={selectedEntityIds.includes(zone.id)}
        />
      ))}

      {/* Facility Structural Elements (Walls, Columns, Doors, Bollards) */}
      {structuralElements.map((elem) => (
        <ProceduralStructure
          key={elem.id}
          element={elem}
          selected={selectedEntityIds.includes(elem.id)}
        />
      ))}

      {/* Vertical Connectors (Cargo Lift, Ramp, Stairs) */}
      {verticalConnectors.map((connector) => (
        <ProceduralVerticalConnector
          key={connector.id}
          connector={connector}
          selected={selectedEntityIds.includes(connector.id)}
        />
      ))}

      {/* Storage Racks */}
      {racks.map((rack) => (
        <ProceduralRack
          key={rack.id}
          rack={rack}
          selected={selectedEntityIds.includes(rack.id)}
        />
      ))}

      {/* Picking Path & Simulated Logistics Agent */}
      <DepotMarker position={depotPosition} />
      <PickingRouteVisualizer />
      <MultiVehicleFleetAgents />


      <PlacementPreview />
      <AisleArrayPreview />
      <TransformGizmo />
      <CameraController />
      <CameraBridge />
      <MarqueeSelection />
    </>
  );
}

export function WarehouseCanvas({ onOpenControls }: { onOpenControls?: () => void }) {
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const deselectEntity = useEditorStore((s) => s.deselectEntity);
  const graphicsQuality = useSettingsStore((s) => s.graphicsQuality);

  return (
    <div data-tour="3d-canvas" className="relative h-full w-full overflow-hidden">
      <Canvas
        shadows={graphicsQuality.shadows}
        gl={{ antialias: graphicsQuality.antialias }}
        dpr={[1, 2]}
        camera={{ position: [40, 35, 45], fov: 55, near: 0.1, far: 500 }}
        className="touch-none"
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>

      {/* 2D Marquee Selection Box Overlay */}
      <MarqueeOverlayDOM />

      {/* Floating Multi-Selection HUD Banner */}
      {selectedEntityIds.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-white/95 dark:bg-slate-900/95 border border-sky-500/50 rounded-xl shadow-2xl backdrop-blur-md text-xs text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="flex h-2.5 w-2.5 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
          <span className="font-semibold text-slate-900 dark:text-white">
            {selectedEntityIds.length} Objek Terpilih
          </span>
          <span className="text-slate-300 dark:text-slate-500">|</span>
          <span className="text-slate-600 dark:text-slate-300">Geser salah satu untuk memindahkan grup</span>
          <button
            onClick={() => deselectEntity()}
            className="ml-2 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition active:scale-95 text-xs font-medium"
            title="Bersihkan seleksi (Esc)"
          >
            Esc / Batal
          </button>
        </div>
      )}

      {/* Floating HUD Viewport Toolbar */}
      <ViewportToolbar />

      {/* Floating Quick-Tips & Moveset Button */}
      <CanvasQuickTips onOpenControls={onOpenControls ?? (() => {})} />
    </div>
  );
}
