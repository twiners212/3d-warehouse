'use client';

// Fulfills ARCHITECTURE.md Section 4.1: a rack is NOT a composite of individual
// <mesh> elements. Structural parts render as 3 shared THREE.InstancedMesh
// nodes (uprights / beams / decks) with matrices written via setMatrixAt.

import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshStandardMaterial,
  type InstancedMesh,
} from 'three';
import { Html } from '@react-three/drei';
import { Boxes } from 'lucide-react';
import type { BinSlot, HeatmapMetric, RackEntity, RackType } from '@/types/layout';
import { generateCargoInstances, generateRackInstances } from '@/engine/procedural/rack-geometry';
import {
  HEATMAP_COLORS,
  resolveAbcVelocityColor,
  resolveOccupancyColor,
  resolveWeightStressColor,
} from '@/lib/constants/warehouse-defaults';
import { useEditorStore } from '@/stores/useEditorStore';
import { useDirectEntityDrag } from '@/hooks/useDirectEntityDrag';

const UNIT_BOX_GEOMETRY = new BoxGeometry(1, 1, 1);

interface RackTheme {
  upright: MeshStandardMaterial;
  beam: MeshStandardMaterial;
  deck: MeshStandardMaterial;
}

const RACK_THEMES: Record<RackType, RackTheme> = {
  selective_pallet: {
    upright: new MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 }), // Royal Blue
    beam: new MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 }), // Safety Orange
    deck: new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }),
  },
  double_deep: {
    upright: new MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 }), // Deep Blue
    beam: new MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }), // Amber
    deck: new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }),
  },
  drive_in: {
    upright: new MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 }), // Ruby Red
    beam: new MeshStandardMaterial({ color: 0xf87171, roughness: 0.5 }), // Coral Red
    deck: new MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 }),
  },
  push_back: {
    upright: new MeshStandardMaterial({ color: 0x0d9488, roughness: 0.55 }), // Teal
    beam: new MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.5 }), // Cyan
    deck: new MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 }),
  },
  cantilever: {
    upright: new MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 }), // Industrial Yellow
    beam: new MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5 }), // Dark Gold
    deck: new MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }),
  },
  shelving: {
    upright: new MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 }), // Galvanized Zinc
    beam: new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 }), // Light Zinc
    deck: new MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 }),
  },
  mezzanine: {
    upright: new MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }), // Charcoal Steel
    beam: new MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 }), // Steel Blue
    deck: new MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.3 }),
  },
};

const PALLET_MATERIAL = new MeshStandardMaterial({
  color: 0xb48a56, // European Pine/Oak wood
  roughness: 0.7,
  metalness: 0.05,
});

const CARTON_MATERIAL = new MeshStandardMaterial({
  color: 0xcd9f6c, // Kraft corrugated cardboard
  roughness: 0.85,
  metalness: 0.0,
});

const SELECTED_LINE_MATERIAL = new LineBasicMaterial({ color: 0xf59e0b, linewidth: 2.5 });
const HOVER_RACK_LINE_MATERIAL = new LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
const BIN_SELECTED_LINE_MATERIAL = new LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
const BIN_HOVER_LINE_MATERIAL = new LineBasicMaterial({ color: 0x38bdf8, linewidth: 1.5 });
const BIN_EMPTY_LINE_MATERIAL = new LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.4 });
const BIN_PICK_TARGET_LINE_MATERIAL = new LineBasicMaterial({ color: 0xa855f7, linewidth: 2.5 });

function InstanceGroup({
  matrices,
  material,
  name,
}: {
  matrices: Matrix4[];
  material: MeshStandardMaterial;
  name: string;
}) {
  const meshRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[UNIT_BOX_GEOMETRY, material, Math.max(matrices.length, 1)]}
      name={name}
      frustumCulled
    />
  );
}

function CargoCartonInstanceGroup({
  matrices,
  bins,
  rack,
  heatmapMetric,
  name,
}: {
  matrices: Matrix4[];
  bins: BinSlot[];
  rack: RackEntity;
  heatmapMetric: HeatmapMetric;
  name: string;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const colorHelper = useMemo(() => new Color(), []);

  const rackOccupancyRatio = useMemo(() => {
    if (rack.bins.length === 0) return 0;
    return rack.bins.filter((b) => b.isOccupied).length / rack.bins.length;
  }, [rack.bins]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);

      const bin = bins[i];
      let hexColor: string = HEATMAP_COLORS.DEFAULT_CARTON;

      if (heatmapMetric === 'WEIGHT_STRESS') {
        const weight = bin?.skuData?.weightKg ?? 0;
        const maxWeight = bin?.maxWeightKg ?? 1000;
        hexColor = resolveWeightStressColor(weight, maxWeight);
      } else if (heatmapMetric === 'ABC_VELOCITY') {
        const vel = bin?.skuData?.velocityClass ?? 'C';
        hexColor = resolveAbcVelocityColor(vel);
      } else if (heatmapMetric === 'OCCUPANCY') {
        hexColor = resolveOccupancyColor(rackOccupancyRatio);
      } else if (rack.type === 'shelving' || bin?.containerType === 'tote') {
        // Diverse colorful plastic tote boxes (Industrial Blue, Signal Red, Forest Green, Goldenrod, Slate)
        const toteColors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#0284c7'];
        let h = 0;
        const idStr = bin?.id ?? String(i);
        for (let j = 0; j < idStr.length; j++) h = (h << 5) - h + idStr.charCodeAt(j);
        hexColor = toteColors[Math.abs(h) % toteColors.length];
      } else if (rack.type === 'cantilever' || bin?.containerType === 'long_goods') {
        hexColor = '#475569';
      }

      colorHelper.set(hexColor);
      mesh.setColorAt(i, colorHelper);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [matrices, bins, rackOccupancyRatio, heatmapMetric, colorHelper, rack.type]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[UNIT_BOX_GEOMETRY, CARTON_MATERIAL, Math.max(matrices.length, 1)]}
      name={name}
      frustumCulled
    />
  );
}

interface InteractiveBinSlotProps {
  bin: BinSlot;
  rack: RackEntity;
  isSelected: boolean;
  isHovered: boolean;
  isPickTarget?: boolean;
  isPickingMode?: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onTogglePick?: () => void;
}

function InteractiveBinSlot({
  bin,
  rack,
  isSelected,
  isHovered,
  isPickTarget = false,
  isPickingMode = false,
  onSelect,
  onHover,
  onTogglePick,
}: InteractiveBinSlotProps) {
  const slotW = Math.max(0.15, (bin.dimension?.width ?? rack.bayWidth) - 0.04);
  const slotH = Math.max(0.15, (bin.dimension?.height ?? rack.levelHeight) - 0.04);
  const slotD = Math.max(0.15, (bin.dimension?.depth ?? rack.bayDepth) - 0.02);

  const halfW = rack.dimensions.width / 2;
  const xPos = bin.relativePosition?.x ?? ((bin.bayIndex - 1) * rack.bayWidth - halfW + rack.bayWidth / 2);
  const baseFloorY = bin.relativePosition?.y ?? (rack.type === 'mezzanine' ? rack.dimensions.height : ((bin.levelIndex - 1) * rack.levelHeight));
  const yPos = baseFloorY + slotH / 2;
  const zPos = bin.relativePosition?.z ?? 0;

  const slotEdgesGeo = useMemo(() => new EdgesGeometry(new BoxGeometry(slotW, slotH, slotD)), [slotW, slotH, slotD]);

  const lineMat = isPickTarget
    ? BIN_PICK_TARGET_LINE_MATERIAL
    : isSelected
    ? BIN_SELECTED_LINE_MATERIAL
    : isHovered
      ? BIN_HOVER_LINE_MATERIAL
      : BIN_EMPTY_LINE_MATERIAL;

  return (
    <group position={[xPos, yPos, zPos]}>
      {/* Invisible interactive raycasting box */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (isPickingMode && onTogglePick) {
            onTogglePick();
          } else {
            onSelect();
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(false);
        }}
      >
        <boxGeometry args={[slotW, slotH, slotD]} />
        <meshBasicMaterial
          transparent
          opacity={isPickTarget ? 0.35 : isSelected ? 0.22 : isHovered ? 0.12 : 0}
          color={isPickTarget ? 0xa855f7 : isSelected ? 0xf59e0b : 0x38bdf8}
        />
      </mesh>

      {/* Wireframe indicator */}
      {(isPickTarget || isSelected || isHovered || !bin.isOccupied) && (
        <primitive object={new LineSegments(slotEdgesGeo, lineMat)} />
      )}
    </group>
  );
}

interface ProceduralRackProps {
  rack: RackEntity;
  selected?: boolean;
}

export function ProceduralRack({ rack, selected = false }: ProceduralRackProps) {
  const selectEntity = useEditorStore((s) => s.selectEntity);
  const setHoveredEntity = useEditorStore((s) => s.setHoveredEntity);
  const hoveredEntityId = useEditorStore((s) => s.hoveredEntityId);
  const isHovered = hoveredEntityId === rack.id;

  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const heatmapMetric = useEditorStore((s) => s.heatmapMetric);
  const selectedBinId = useEditorStore((s) => s.selectedBinId);
  const hoveredBinId = useEditorStore((s) => s.hoveredBinId);
  const selectBin = useEditorStore((s) => s.selectBin);
  const setHoveredBin = useEditorStore((s) => s.setHoveredBin);
  const pickList = useEditorStore((s) => s.pickList);
  const addBinToPickList = useEditorStore((s) => s.addBinToPickList);
  const removeBinFromPickList = useEditorStore((s) => s.removeBinFromPickList);
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;
  const isCurrentLevel =
    activeLevelId === 'ALL' ||
    (rack.levelId ? rack.levelId === activeLevelId : Math.abs(rack.position.y - activeElevation) <= 0.2);
  const isUpperLevel = activeLevelId !== 'ALL' && rack.position.y > activeElevation + 0.1;
  const isHidden =
    activeLevelId !== 'ALL' &&
    (floorSliceMode === 'ISOLATE' ? !isCurrentLevel : isUpperLevel);
  const isGhosted = isUpperLevel && floorSliceMode === 'GHOST_UPPER';

  const theme = RACK_THEMES[rack.type] || RACK_THEMES.selective_pallet;

  const instances = useMemo(
    () => generateRackInstances(rack),
    [
      rack.id,
      rack.type,
      rack.bays,
      rack.levels,
      rack.bayWidth,
      rack.bayDepth,
      rack.levelHeight,
      rack.dimensions.width,
      rack.dimensions.height,
      rack.dimensions.depth,
    ]
  );

  const cargoInstances = useMemo(
    () => generateCargoInstances(rack),
    [
      rack.id,
      rack.type,
      rack.bays,
      rack.levels,
      rack.bayWidth,
      rack.bayDepth,
      rack.levelHeight,
      rack.dimensions.width,
      rack.dimensions.height,
      rack.dimensions.depth,
      rack.bins,
    ]
  );

  const boundBox = useMemo(
    () => new BoxGeometry(rack.dimensions.width, rack.dimensions.height, rack.dimensions.depth),
    [rack.dimensions.width, rack.dimensions.height, rack.dimensions.depth]
  );
  const boundEdges = useMemo(() => new EdgesGeometry(boundBox), [boundBox]);

  const dragHandlers = useDirectEntityDrag({
    entityId: rack.id,
    entityType: 'rack',
    position: rack.position,
    dimensions: rack.dimensions,
    rotationY: rack.rotationY,
    disabled: editorViewMode !== 'LAYOUT' || isHidden,
  });

  if (isHidden) return null;

  return (
    <group
      name={`rack-root-${rack.id}`}
      position={[rack.position.x, rack.position.y, rack.position.z]}
      rotation={[0, rack.rotationY, 0]}
      userData={{ entityId: rack.id, selected }}
      onPointerDown={dragHandlers.onPointerDown}
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={dragHandlers.onPointerUp}
      onClick={(e) => {
        if (editorViewMode === 'LAYOUT') {
          dragHandlers.onClick(e);
        }
      }}
      onPointerOver={(event) => {
        if (editorViewMode === 'LAYOUT') {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
          setHoveredEntity(rack.id);
        }
      }}
      onPointerOut={() => {
        if (editorViewMode === 'LAYOUT') {
          document.body.style.cursor = 'auto';
          setHoveredEntity(null);
        }
      }}
    >
      {/* Structural Parts */}
      <InstanceGroup matrices={instances.uprights} material={theme.upright} name={`uprights-${rack.id}`} />
      <InstanceGroup matrices={instances.beams} material={theme.beam} name={`beams-${rack.id}`} />
      <InstanceGroup matrices={instances.decks} material={theme.deck} name={`decks-${rack.id}`} />

      {/* Mezzanine Platform Deck Sub-Grid Guide */}
      {rack.type === 'mezzanine' && (
        <group position={[0, rack.dimensions.height + 0.005, 0]}>
          <gridHelper
            args={[
              Math.max(rack.dimensions.width, rack.dimensions.depth),
              Math.max(2, Math.round(Math.max(rack.dimensions.width, rack.dimensions.depth))),
              0x38bdf8,
              0x0284c7,
            ]}
          />
        </group>
      )}

      {/* Realistic Cargo & Wooden Euro-Pallets */}
      {cargoInstances.pallets.length > 0 && (
        <InstanceGroup
          matrices={cargoInstances.pallets}
          material={PALLET_MATERIAL}
          name={`pallets-${rack.id}`}
        />
      )}
      {cargoInstances.cartons.length > 0 && (
        <CargoCartonInstanceGroup
          matrices={cargoInstances.cartons}
          bins={cargoInstances.occupiedBins}
          rack={rack}
          heatmapMetric={heatmapMetric}
          name={`cartons-${rack.id}`}
        />
      )}

      {/* Invisible Bounding Hitbox with generous padding so clicks from acute angles reliably hit */}
      {editorViewMode === 'LAYOUT' && (
        <mesh position={[0, rack.dimensions.height / 2, 0]}>
          <boxGeometry
            args={[
              rack.dimensions.width + 0.3,
              rack.dimensions.height + 0.2,
              rack.dimensions.depth + 0.3,
            ]}
          />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Selected / Hovered Rack Outline (in Layout mode) */}
      {(selected || isHovered) && editorViewMode === 'LAYOUT' && (
        <group position={[0, rack.dimensions.height / 2, 0]}>
          <primitive
            object={
              new LineSegments(
                boundEdges,
                selected ? SELECTED_LINE_MATERIAL : HOVER_RACK_LINE_MATERIAL
              )
            }
          />
        </group>
      )}

      {/* Floating 3D Rack Badge on Hover / Selection (non-bleeding, fixed scale, bounded z-index) */}
      {(selected || isHovered) && editorViewMode === 'LAYOUT' && (
        <Html
          position={[0, rack.dimensions.height + 0.35, 0]}
          center
          zIndexRange={[10, 0]}
          className={`select-none ${selected ? 'pointer-events-none' : 'pointer-events-auto'}`}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={(event) => {
              if (!selected) {
                event.stopPropagation();
                selectEntity(rack.id);
              }
            }}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg transition-all ${
              selected
                ? 'border-2 border-white bg-neutral-900/95 text-white shadow-sky-500/30 ring-2 ring-sky-500/50'
                : 'border-2 border-sky-400 bg-neutral-900/90 text-white shadow-md cursor-pointer hover:scale-105'
            }`}
            title={`Rack ${rack.name}`}
          >
            <Boxes className="h-3 w-3 text-sky-400 shrink-0" strokeWidth={1.75} />
            <span className="whitespace-nowrap">{rack.name}</span>
          </div>
        </Html>
      )}

      {/* Interactive Bin Compartments in WMS & Picking Modes */}
      {(editorViewMode === 'WMS' || editorViewMode === 'PICKING') && (
        <group name={`interactive-bins-${rack.id}`}>
          {rack.bins.map((bin) => {
            const isTarget = pickList.some((p) => p.binId === bin.id);
            return (
              <InteractiveBinSlot
                key={bin.id}
                bin={bin}
                rack={rack}
                isSelected={bin.id === selectedBinId}
                isHovered={bin.id === hoveredBinId}
                isPickTarget={isTarget}
                isPickingMode={editorViewMode === 'PICKING'}
                onSelect={() => selectBin(bin.id)}
                onHover={(hovered) => setHoveredBin(hovered ? bin.id : null)}
                onTogglePick={() => {
                  if (isTarget) {
                    removeBinFromPickList(bin.id);
                  } else {
                    addBinToPickList(bin.id);
                  }
                }}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}


