'use client';

// Fulfills Phase 39: Visualisasi Pallet & Kargo di Zona Operasional
// Procedural Staging Pallet Grid, Instanced 3D Euro-Pallets & Cartons,
// Top-Left Anti-Collision Master Label, and Mini ID Tags with WMS inspection.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type InstancedMesh,
} from 'three';
import { Html } from '@react-three/drei';
import type { WarehouseZone, ZonePalletSlot } from '@/types/layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { useDirectEntityDrag } from '@/hooks/useDirectEntityDrag';
import {
  calculateZonePalletSlots,
  generateZonePalletInstances,
  isZoneStagingEligible,
  STANDARD_PALLET_WIDTH,
  STANDARD_PALLET_DEPTH,
} from '@/engine/procedural/zone-pallet-generator';

const UNIT_BOX_GEOMETRY = new BoxGeometry(1, 1, 1);

const PALLET_WOOD_MATERIAL = new MeshStandardMaterial({
  color: 0xc49a63, // Euro pine wood tone
  roughness: 0.85,
  metalness: 0.05,
});

const CARGO_CARTON_MATERIAL = new MeshStandardMaterial({
  color: 0xcb9b51, // Heavy-duty kraft carton
  roughness: 0.75,
  metalness: 0.02,
});

function InstanceGroup({
  matrices,
  material,
  name,
  onClick,
}: {
  matrices: Matrix4[];
  material: MeshStandardMaterial;
  name: string;
  onClick?: (instanceId: number) => void;
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

  if (matrices.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[UNIT_BOX_GEOMETRY, material, matrices.length]}
      name={name}
      frustumCulled
      onClick={(e) => {
        if (onClick && e.instanceId !== undefined) {
          e.stopPropagation();
          onClick(e.instanceId);
        }
      }}
    />
  );
}

interface ZonePalletTagProps {
  zone: WarehouseZone;
  slot: ZonePalletSlot;
  palletW: number;
  palletD: number;
  isSelected: boolean;
}

function ZonePalletTag({
  zone,
  slot,
  palletW,
  palletD,
  isSelected,
}: ZonePalletTagProps) {
  const [hovered, setHovered] = useState(false);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const selectZonePallet = useEditorStore((s) => s.selectZonePallet);

  // Only display individual pallet slot & carton ID tags in WMS mode; hide in LAYOUT and PICKING
  if (editorViewMode !== 'WMS') return null;

  // Mini ID badge position: top-left corner of each pallet slot
  const tagX = slot.relativePosition.x - palletW / 2 + 0.15;
  const tagZ = slot.relativePosition.z - palletD / 2 + 0.15;
  const tagY = slot.isOccupied ? 0.95 : 0.22;
  const shortCode = `P-${slot.slotIndex.toString().padStart(2, '0')}`;

  return (
    <Html
      position={[tagX, tagY, tagZ]}
      center
      zIndexRange={[15, 0]}
      className="select-none pointer-events-auto"
    >
      <div
        className="relative group cursor-pointer"
        onClick={(e) => {
          if (editorViewMode === 'WMS') {
            e.stopPropagation();
            selectZonePallet(zone.id, slot.id);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Compact ID badge */}
        <div
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-tight shadow-md backdrop-blur-md transition-all ${
            isSelected
              ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 scale-110 shadow-emerald-500/50'
              : hovered
              ? 'bg-sky-500 text-white ring-1 ring-sky-300 scale-105 shadow-sky-500/30'
              : slot.isOccupied
              ? 'bg-neutral-900/90 text-amber-300 border border-amber-500/40 hover:border-amber-400'
              : 'bg-neutral-900/70 text-neutral-400 border border-neutral-700/50'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              slot.isOccupied ? 'bg-amber-400' : 'bg-neutral-500'
            }`}
          />
          <span>{shortCode}</span>
        </div>

        {/* Hover Tooltip showing SKU details in WMS Mode */}
        {hovered && editorViewMode === 'WMS' && (
          <div className="absolute left-0 bottom-full mb-1.5 z-50 min-w-[190px] p-2 rounded-lg bg-neutral-950/95 border border-neutral-700 shadow-2xl backdrop-blur-md text-left text-white pointer-events-none animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-1 mb-1">
              <span className="text-[10px] font-mono font-bold text-amber-400">{slot.id}</span>
              <span
                className={`text-[8px] font-semibold px-1 py-0.2 rounded uppercase ${
                  slot.isOccupied ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {slot.isOccupied ? 'Occupied' : 'Empty'}
              </span>
            </div>
            {slot.isOccupied && slot.skuData ? (
              <div className="space-y-0.5 text-[10px]">
                <div className="font-semibold text-neutral-200 line-clamp-1">
                  {slot.skuData.productName}
                </div>
                <div className="text-[9px] text-neutral-400 font-mono">
                  SKU: <span className="text-neutral-300">{slot.skuData.sku}</span>
                </div>
                <div className="text-[9px] text-neutral-400 font-mono">
                  Lot: <span className="text-neutral-300">{slot.skuData.lotNumber}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-neutral-400 pt-0.5">
                  <span>Qty: <strong className="text-white">{slot.skuData.quantity}</strong> {slot.skuData.unit}</span>
                  <span><strong className="text-white">{slot.skuData.weightKg}</strong> kg</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-neutral-400 italic">Slot kosong (Siap untuk staging)</div>
            )}
            <div className="mt-1 pt-1 border-t border-neutral-800/80 text-[8px] text-sky-400 text-center font-medium">
              Klik untuk buka detail kargo
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}

interface ZoneFootprintProps {
  zone: WarehouseZone;
  selected?: boolean;
}

export function ZoneFootprint({ zone, selected = false }: ZoneFootprintProps) {
  const selectEntity = useEditorStore((s) => s.selectEntity);
  const setHoveredEntity = useEditorStore((s) => s.setHoveredEntity);
  const hoveredEntityId = useEditorStore((s) => s.hoveredEntityId);
  const editorViewMode = useEditorStore((s) => s.editorViewMode);
  const selectedZonePallet = useEditorStore((s) => s.selectedZonePallet);
  const selectZonePallet = useEditorStore((s) => s.selectZonePallet);

  const isEffectiveSelected = selected && editorViewMode === 'LAYOUT';
  const buildingLevels = useEditorStore((s) => s.buildingLevels);
  const activeLevelId = useEditorStore((s) => s.activeLevelId);
  const floorSliceMode = useEditorStore((s) => s.floorSliceMode);

  const activeLevel = buildingLevels.find((l) => l.id === activeLevelId);
  const activeElevation = activeLevel?.elevationY ?? 0;
  const isCurrentLevel =
    activeLevelId === 'ALL' ||
    (zone.levelId
      ? zone.levelId === activeLevelId
      : Math.abs((zone.position.y ?? 0) - activeElevation) <= 0.2);
  const isUpperLevel = activeLevelId !== 'ALL' && (zone.position.y ?? 0) > activeElevation + 0.1;
  const isHidden =
    activeLevelId !== 'ALL' &&
    (floorSliceMode === 'ISOLATE' ? !isCurrentLevel : isUpperLevel);

  const isHovered = hoveredEntityId === zone.id && editorViewMode === 'LAYOUT';

  const width = zone.dimensions?.width ?? 10;
  const depth = zone.dimensions?.depth ?? 10;

  // Position label at top-left corner of the operational zone area with safe margin
  const labelX = -width / 2 + Math.min(1.5, width * 0.2);
  const labelZ = -depth / 2 + Math.min(0.8, depth * 0.2);

  const planeGeo = useMemo(
    () => new PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
    [width, depth]
  );
  const edgesGeo = useMemo(() => new EdgesGeometry(planeGeo), [planeGeo]);

  const zoneColor = useMemo(() => new Color(zone.colorHex || '#0284c7'), [zone.colorHex]);

  const planeMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: zoneColor,
        transparent: true,
        opacity: isHidden ? 0.35 : isEffectiveSelected ? 0.5 : isHovered ? 0.35 : 0.22,
        depthWrite: false,
      }),
    [zoneColor, isEffectiveSelected, isHovered, isHidden]
  );

  const edgeMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: isEffectiveSelected ? 0xffffff : isHovered ? 0x38bdf8 : zoneColor,
        linewidth: isEffectiveSelected || isHovered ? 2.5 : 1.5,
      }),
    [zoneColor, isEffectiveSelected, isHovered]
  );

  const dragHandlers = useDirectEntityDrag({
    entityId: zone.id,
    entityType: 'zone',
    position: zone.position,
    dimensions: { width, height: zone.dimensions?.height ?? 0.1, depth },
    rotationY: 0,
    disabled: editorViewMode !== 'LAYOUT' || (isHidden && !isEffectiveSelected),
  });

  // Staging pallets procedural generation
  const isStaging = useMemo(() => isZoneStagingEligible(zone), [zone]);
  const palletSlots = useMemo(
    () => (isStaging ? calculateZonePalletSlots(zone) : []),
    [zone, isStaging]
  );

  const { pallets, cartons, occupiedSlots, allSlots } = useMemo(
    () =>
      isStaging
        ? generateZonePalletInstances(zone, palletSlots)
        : { pallets: [], cartons: [], occupiedSlots: [], allSlots: [] },
    [zone, palletSlots, isStaging]
  );

  const totalPallets = allSlots.length;
  const occupiedCount = occupiedSlots.length;
  const occupancyPercent =
    totalPallets > 0 ? Math.round((occupiedCount / totalPallets) * 100) : 0;

  // Master Zone Label Text
  const masterLabelText = useMemo(() => {
    if (isStaging && totalPallets > 0) {
      return `${zone.name} · ${occupiedCount}/${totalPallets} Pallets (${occupancyPercent}%)`;
    }
    return zone.name;
  }, [zone.name, isStaging, totalPallets, occupiedCount, occupancyPercent]);

  // Selected pallet in this zone (if any)
  const activeSelectedSlot = useMemo(() => {
    if (!selectedZonePallet || selectedZonePallet.zoneId !== zone.id) return null;
    return allSlots.find((s) => s.id === selectedZonePallet.palletId) ?? null;
  }, [selectedZonePallet, zone.id, allSlots]);

  const palletW = zone.stagingConfig?.palletWidth ?? STANDARD_PALLET_WIDTH;
  const palletD = zone.stagingConfig?.palletDepth ?? STANDARD_PALLET_DEPTH;

  const handlePalletClick = (instanceId: number) => {
    if (editorViewMode === 'WMS') {
      const clickedSlot = allSlots[instanceId];
      if (clickedSlot) {
        selectZonePallet(zone.id, clickedSlot.id);
      }
    }
  };

  const handleCartonClick = (instanceId: number) => {
    if (editorViewMode === 'WMS') {
      const clickedSlot = occupiedSlots[instanceId];
      if (clickedSlot) {
        selectZonePallet(zone.id, clickedSlot.id);
      }
    }
  };

  if (isHidden && !isEffectiveSelected) return null;

  return (
    <group
      name={`zone-${zone.id}`}
      position={[zone.position.x, (zone.position.y ?? 0) + 0.02, zone.position.z]}
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
          setHoveredEntity(zone.id);
        }
      }}
      onPointerOut={() => {
        if (editorViewMode === 'LAYOUT') {
          document.body.style.cursor = 'auto';
          setHoveredEntity(null);
        }
      }}
    >
      <mesh geometry={planeGeo} material={planeMaterial} />
      <primitive object={new LineSegments(edgesGeo, edgeMaterial)} />

      {/* 3D Hitbox Slab (Height 0.3m) to guarantee raycasting capture from any angle in Layout mode */}
      {editorViewMode === 'LAYOUT' && (
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[width + 0.2, 0.3, depth + 0.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* 3D Staging Pallets & Cartons */}
      {isStaging && pallets.length > 0 && (
        <group name={`zone-pallets-${zone.id}`}>
          <InstanceGroup
            matrices={pallets}
            material={PALLET_WOOD_MATERIAL}
            name={`mesh-pallets-${zone.id}`}
            onClick={handlePalletClick}
          />
          {cartons.length > 0 && (
            <InstanceGroup
              matrices={cartons}
              material={CARGO_CARTON_MATERIAL}
              name={`mesh-cartons-${zone.id}`}
              onClick={handleCartonClick}
            />
          )}

          {/* Active Pallet Selection Highlight Box */}
          {activeSelectedSlot && (
            <group
              position={[
                activeSelectedSlot.relativePosition.x,
                0.4,
                activeSelectedSlot.relativePosition.z,
              ]}
            >
              <mesh>
                <boxGeometry args={[palletW + 0.08, 0.8, palletD + 0.08]} />
                <meshBasicMaterial color="#10b981" transparent opacity={0.18} depthWrite={false} />
              </mesh>
              <primitive
                object={
                  new LineSegments(
                    new EdgesGeometry(new BoxGeometry(palletW + 0.08, 0.8, palletD + 0.08)),
                    new LineBasicMaterial({ color: 0x34d399, linewidth: 3 })
                  )
                }
              />
            </group>
          )}

          {/* Mini ID Tags on each Pallet Slot (P-01, P-02, etc.) positioned at top-left corner */}
          {allSlots.map((slot) => (
            <ZonePalletTag
              key={slot.id}
              zone={zone}
              slot={slot}
              palletW={palletW}
              palletD={palletD}
              isSelected={activeSelectedSlot?.id === slot.id}
            />
          ))}
        </group>
      )}

      {/* Floating Master Zone Label (positioned at top-left corner of zone area) */}
      <Html
        position={[labelX, 0.25, labelZ]}
        center
        zIndexRange={[10, 0]}
        className={`select-none ${editorViewMode !== 'LAYOUT' || isEffectiveSelected ? 'pointer-events-none' : 'pointer-events-auto'}`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={(event) => {
            if (editorViewMode === 'LAYOUT' && !isEffectiveSelected) {
              event.stopPropagation();
              selectEntity(zone.id);
            }
          }}
          onPointerOver={(event) => {
            if (editorViewMode === 'LAYOUT') {
              event.stopPropagation();
              setHoveredEntity(zone.id);
            }
          }}
          onPointerOut={() => {
            if (editorViewMode === 'LAYOUT') {
              setHoveredEntity(null);
            }
          }}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg transition-all ${
            isEffectiveSelected
              ? 'border-2 border-white bg-neutral-900/95 text-white shadow-sky-500/30 ring-2 ring-sky-500/50'
              : isHovered
                ? 'border-2 border-sky-400 bg-neutral-900/90 text-white shadow-md scale-105 cursor-pointer'
                : editorViewMode === 'LAYOUT'
                  ? 'border border-neutral-700/80 bg-neutral-950/80 text-neutral-200 hover:border-sky-400 cursor-pointer'
                  : 'border border-neutral-700/60 bg-neutral-950/70 text-neutral-300 opacity-85 cursor-default'
          }`}
          style={{ borderColor: isEffectiveSelected ? '#ffffff' : isHovered ? '#38bdf8' : zone.colorHex }}
          title={editorViewMode === 'LAYOUT' ? `Click to select ${zone.name} zone` : zone.name}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: zone.colorHex }}
          />
          <span className="whitespace-nowrap">{masterLabelText}</span>
        </div>
      </Html>
    </group>
  );
}
