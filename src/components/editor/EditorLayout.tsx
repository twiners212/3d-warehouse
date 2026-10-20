'use client';

// Fulfills ARCHITECTURE.md Section 2 (editor/EditorLayout.tsx):
// Split container hosting the Sidebar Palette HUD and the R3F canvas.
// The canvas wrapper is the HTML5 drop target: drag-over feeds the placement
// bus; a valid drop commits AddEntityCommand with auto-generated bins.
// Phase 5: loads the persisted blueprint on mount.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DragEvent } from 'react';
import { WarehouseCanvas } from '@/components/canvas/WarehouseCanvas';
import { SidebarPalette } from './ui/SidebarPalette';
import { SceneOutliner } from './ui/SceneOutliner';
import { PropertiesInspector } from './ui/PropertiesInspector';
import { EditorStatusBar } from './ui/EditorStatusBar';
import { TopNavToolbar, buildBlueprintFromStore } from './ui/TopNavToolbar';
import { ControlsModal } from './ui/ControlsModal';
import { GuidedTourOverlay } from './ui/GuidedTourOverlay';
import { AisleGeneratorModal } from './ui/AisleGeneratorModal';
import { WmsDataHubModal } from './ui/WmsDataHubModal';
import { SettingsModal } from '@/components/common/SettingsModal';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation, type TranslationDictionary } from '@/lib/i18n';
import { BinDetailDrawer } from './ui/BinDetailDrawer';
import { ZonePalletDrawer } from './ui/ZonePalletDrawer';
import { HeatmapLegendHUD } from './ui/HeatmapLegendHUD';
import { PickingPlaybackDock } from './picking/PickingPlaybackDock';
import { PickingManifestDrawer } from './picking/PickingManifestDrawer';
import { useEditorShortcuts } from './useEditorShortcuts';
import { Boxes, ListTree, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { createAddRackCommand } from '@/engine/commands/AddEntityCommand';
import { createAddStructuralElementCommand } from '@/engine/commands/StructuralCommands';
import { createAddZoneCommand } from '@/engine/commands/ZoneCommands';
import { createAddVerticalConnectorCommand } from '@/engine/commands/VerticalConnectorCommands';
import { deriveRackDimensions, generateBinsForRack } from '@/engine/procedural/bin-generator';
import {
  nextRackId,
  nextRackName,
  nextStructureId,
  nextStructureName,
  nextZoneId,
  nextZoneName,
  nextVerticalConnectorId,
  nextVerticalConnectorName,
} from '@/engine/procedural/naming';
import { snapToGrid } from '@/engine/spatial/spatial-math';
import {
  findAvailablePlacementPosition,
  isPlacementValid,
  resolvePlacementPosition,
} from '@/engine/spatial/snapping';
import { screenToWorldFloor } from '@/engine/spatial/raycasting';
import { placementBus, setPlacementDragOver, resetPlacementBus } from '@/lib/placement/placement-bus';
import { cameraBus } from '@/lib/camera/camera-bus';
import { getWarehouseLayout, persistWarehouseLayout } from '@/app/actions/layout-actions';
import { useEditorStore } from '@/stores/useEditorStore';
import type { RackEntity, RackType, StructuralElement, StructuralItemType, WarehouseZone, ZoneType, VerticalConnector, VerticalConnectorType } from '@/types/layout';
import type { DraggedPaletteItem } from '@/types/interaction';
import type { AuthUser } from '@/lib/auth/types';

const ZONE_DEFAULT_COLORS: Record<ZoneType, string> = {
  receiving: '#10b981',
  shipping: '#0284c7',
  picking: '#f59e0b',
  quarantine: '#f43f5e',
  storage: '#8b5cf6',
};

function formatTypeName(item: DraggedPaletteItem, t?: TranslationDictionary): string {
  if (item.type === 'rack') {
    switch (item.subType) {
      case 'selective_pallet':
        return 'Selective Pallet Rack';
      case 'double_deep':
        return 'Double-Deep Pallet Rack';
      case 'drive_in':
        return 'Drive-In Bulk Rack';
      case 'push_back':
        return 'Push-Back Gravity Rack';
      case 'cantilever':
        return 'Cantilever Rack';
      case 'shelving':
        return 'Multi-Tier Shelving';
      case 'mezzanine':
        return 'Mezzanine Platform Deck';
      default:
        return 'Storage Rack';
    }
  }
  if (item.type === 'structural') {
    switch (item.subType) {
      case 'wall':
        return 'Concrete Wall Segment';
      case 'column':
        return t ? t.editor.inspector.structuralColumn : 'Structural Pillar Column';
      case 'dock_door':
        return 'Overhead Dock Door';
      case 'bollard':
        return 'Safety Bollard';
      case 'charging_dock':
        return 'Battery Charging Dock';
      default:
        return 'Facility Structure';
    }
  }
  if (item.type === 'zone') {
    switch (item.subType) {
      case 'receiving':
        return 'Receiving Inbound Zone';
      case 'shipping':
        return 'Shipping Outbound Zone';
      case 'picking':
        return 'Staging & Picking Lane';
      case 'quarantine':
        return 'Quarantine & QC Area';
      default:
        return 'Operational Zone';
    }
  }
  if (item.type === 'connector') {
    switch (item.subType) {
      case 'lift':
        return 'Cargo Elevator / Lift';
      case 'ramp':
        return 'Inclined Access Ramp';
      case 'stairs':
        return 'Industrial Access Stairs';
      default:
        return 'Vertical Connector';
    }
  }
  return 'Asset';
}

function handleDragOver(event: DragEvent<HTMLDivElement>): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = placementBus.item ? 'copy' : 'none';
  }
  setPlacementDragOver(event.clientX, event.clientY, true);
}

function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
  if (event.target === event.currentTarget) {
    setPlacementDragOver(0, 0, false);
  }
}

export function EditorLayout({
  blueprintId,
  currentUser,
}: {
  blueprintId: string;
  currentUser?: AuthUser | null;
}) {
  const router = useRouter();
  const [showControlsModal, setShowControlsModal] = useState(false);
  useEditorShortcuts(() => setShowControlsModal((prev) => !prev));
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [toast, setToast] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isSavingAndExiting, setIsSavingAndExiting] = useState(false);
  const [saveExitError, setSaveExitError] = useState<string | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState<'catalogue' | 'outliner'>('catalogue');
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { t } = useTranslation();
  const [isAisleGeneratorOpen, setIsAisleGeneratorOpen] = useState(false);
  const [aisleGeneratorRack, setAisleGeneratorRack] = useState<RackEntity | null>(null);
  const [isWmsHubOpen, setIsWmsHubOpen] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editorViewMode = useEditorStore((s) => s.editorViewMode);

  // Dedicated Workspace Transition: Auto-collapse left sidebar & open Manifest right sidebar in Picking mode
  const [prevViewMode, setPrevViewMode] = useState(editorViewMode);
  const [savedLeftSidebarOpen, setSavedLeftSidebarOpen] = useState(isLeftSidebarOpen);

  if (prevViewMode !== editorViewMode) {
    setPrevViewMode(editorViewMode);
    if (editorViewMode === 'PICKING') {
      setSavedLeftSidebarOpen(isLeftSidebarOpen);
      setIsLeftSidebarOpen(false);
      setIsRightSidebarOpen(true);
    } else if (prevViewMode === 'PICKING') {
      setIsLeftSidebarOpen(savedLeftSidebarOpen);
    }
  }

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  const handleOpenAisleGenerator = (rack?: RackEntity | null) => {
    setAisleGeneratorRack(rack ?? null);
    setIsAisleGeneratorOpen(true);
  };

  const blueprintName = useEditorStore((s) => s.blueprintName);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const theme = useSettingsStore((s) => s.theme);

  // Auto-Save Interval Background Sync
  useEffect(() => {
    if (autoSaveInterval <= 0) return;
    const intervalMs = autoSaveInterval * 1000;
    const timer = setInterval(() => {
      const state = useEditorStore.getState();
      if (state.isDirty && loadState === 'ready') {
        const bp = buildBlueprintFromStore(state, blueprintId);
        void persistWarehouseLayout(bp).then((res) => {
          if (res.success) {
            state.markSaved();
            showToast('Auto-saved to Neon');
          }
        });
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoSaveInterval, loadState, blueprintId, showToast]);

  // Auto-trigger tour on first visit if not dismissed
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('warehouse_tour_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage read issues
    }
  }, []);

  // Unsaved Changes Navigation Guards (Tab close, reload, and browser back button)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    const handlePopState = () => {
      if (useEditorStore.getState().isDirty) {
        window.history.pushState(null, '', window.location.href);
        setShowUnsavedModal(true);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Auto-expand Right Sidebar (Properties Inspector) whenever an entity is selected
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state, prevState) => {
      if (
        (state.selectedEntityId && state.selectedEntityId !== prevState.selectedEntityId) ||
        (state.selectedEntityIds.length > 0 && state.selectedEntityIds !== prevState.selectedEntityIds)
      ) {
        setIsRightSidebarOpen(true);
      }
    });
    return unsub;
  }, []);

  const handleSaveAndExit = async () => {
    setIsSavingAndExiting(true);
    setSaveExitError(null);
    try {
      const state = useEditorStore.getState();
      const bp = buildBlueprintFromStore(state, blueprintId);
      const result = await persistWarehouseLayout(bp);
      if (result.success) {
        state.markSaved();
        setShowUnsavedModal(false);
        router.push('/');
      } else {
        const errMsg = result.error ?? 'Unknown database error';
        setSaveExitError(errMsg);
        showToast(`Save failed: ${errMsg}`);
        setIsSavingAndExiting(false);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Database connection error';
      setSaveExitError(errMsg);
      showToast(`Save error: ${errMsg}`);
      setIsSavingAndExiting(false);
    }
  };

  const handleDiscardAndExit = () => {
    useEditorStore.getState().setIsDirty(false);
    setShowUnsavedModal(false);
    router.push('/');
  };

  const handleAddItem = (item: DraggedPaletteItem) => {
    const state = useEditorStore.getState();
    const config = item.defaultConfig;

    // Fulfills Phase 24: Spawn item in active camera viewport focus area
    const focus = cameraBus.getCurrentFocus();
    const targetCenterX = focus ? focus.x : state.floorDimensions.width / 2;
    const targetCenterZ = focus ? focus.z : state.floorDimensions.depth / 2;

    const activeLevel =
      state.activeLevelId && state.activeLevelId !== 'ALL'
        ? (state.buildingLevels ?? []).find((l) => l.id === state.activeLevelId)
        : undefined;
    const elevationY = activeLevel ? activeLevel.elevationY : 0;
    const levelId = activeLevel?.id;

    if (item.type === 'rack') {
      const bays = config.bays ?? 3;
      const levels = config.levels ?? 3;

      const levelRacks = state.racks.filter(
        (r) => (r.levelId || 'level-1') === (levelId || 'level-1')
      );

      const availablePos = findAvailablePlacementPosition({
        width: config.width,
        depth: config.depth,
        preferredX: targetCenterX,
        preferredZ: targetCenterZ,
        rotationY: 0,
        gridStep: state.gridSnapStep,
        neighbors: levelRacks,
        floorWidth: state.floorDimensions.width,
        floorDepth: state.floorDimensions.depth,
      });

      const rackType = item.subType as RackType;

      const rack: RackEntity = {
        id: nextRackId(),
        name: nextRackName(state.racks),
        type: rackType,
        position: { x: availablePos.x, y: elevationY, z: availablePos.z },
        rotationY: 0,
        dimensions: deriveRackDimensions({
          bays,
          levels,
          bayWidth: config.width / bays,
          bayDepth: config.depth,
          levelHeight: config.height / levels,
        }),
        bays,
        levels,
        levelHeight: config.height / levels,
        bayWidth: config.width / bays,
        bayDepth: config.depth,
        bins: [],
        levelId,
      };
      rack.bins = generateBinsForRack(rack);

      state.executeCommand(createAddRackCommand(rack));
      state.selectEntity(rack.id);
      showToast(`Added ${rack.name}: ${formatTypeName(item)} (${rack.bins.length} bins)`);
    } else if (item.type === 'structural') {
      const structType = item.subType as StructuralItemType;
      const clampedX = Math.max(
        config.width / 2,
        Math.min(state.floorDimensions.width - config.width / 2, targetCenterX)
      );
      const clampedZ = Math.max(
        config.depth / 2,
        Math.min(state.floorDimensions.depth - config.depth / 2, targetCenterZ)
      );
      const centerX = snapToGrid(clampedX, state.gridSnapStep);
      const centerZ = snapToGrid(clampedZ, state.gridSnapStep);

      const element: StructuralElement = {
        id: nextStructureId(),
        name: nextStructureName(structType, state.structuralElements),
        type: structType,
        position: { x: centerX, y: elevationY, z: centerZ },
        dimensions: { width: config.width, height: config.height, depth: config.depth },
        rotationY: 0,
        levelId,
      };

      state.executeCommand(createAddStructuralElementCommand(element));
      state.selectEntity(element.id);
      showToast(`Added ${element.name}: ${formatTypeName(item)}`);
    } else if (item.type === 'zone') {
      const zoneType = item.subType as ZoneType;
      const clampedX = Math.max(
        config.width / 2,
        Math.min(state.floorDimensions.width - config.width / 2, targetCenterX)
      );
      const clampedZ = Math.max(
        config.depth / 2,
        Math.min(state.floorDimensions.depth - config.depth / 2, targetCenterZ)
      );
      const centerX = snapToGrid(clampedX, state.gridSnapStep);
      const centerZ = snapToGrid(clampedZ, state.gridSnapStep);

      const zone: WarehouseZone = {
        id: nextZoneId(),
        name: nextZoneName(zoneType, state.zones),
        type: zoneType,
        colorHex: ZONE_DEFAULT_COLORS[zoneType] || '#0284c7',
        position: { x: centerX, y: elevationY, z: centerZ },
        dimensions: { width: config.width, height: 0.05, depth: config.depth },
        levelId,
      };

      state.executeCommand(createAddZoneCommand(zone));
      state.selectEntity(zone.id);
      showToast(`Added ${zone.name}: ${formatTypeName(item)} (${config.width}×${config.depth}m)`);
    } else if (item.type === 'connector') {
      const connType = item.subType as VerticalConnectorType;
      const clampedX = Math.max(
        config.width / 2,
        Math.min(state.floorDimensions.width - config.width / 2, targetCenterX)
      );
      const clampedZ = Math.max(
        config.depth / 2,
        Math.min(state.floorDimensions.depth - config.depth / 2, targetCenterZ)
      );
      const centerX = snapToGrid(clampedX, state.gridSnapStep);
      const centerZ = snapToGrid(clampedZ, state.gridSnapStep);

      const levels = [...(state.buildingLevels ?? [])].sort((a, b) => a.elevationY - b.elevationY);
      const activeIdx = activeLevel
        ? levels.findIndex((l) => l.id === activeLevel.id)
        : 0;

      const currentLevel =
        activeIdx >= 0 && levels[activeIdx]
          ? levels[activeIdx]
          : levels[0] ?? { id: 'level-ground', elevationY: 0, height: 3.6 };
      const nextLevel =
        activeIdx >= 0 && activeIdx < levels.length - 1
          ? levels[activeIdx + 1]
          : undefined;

      const fromLevel = currentLevel;
      const toLevel = nextLevel ?? fromLevel;
      const connectorHeight = nextLevel
        ? Math.max(1, nextLevel.elevationY - fromLevel.elevationY)
        : config.height ?? currentLevel.height ?? 4.0;

      const connector: VerticalConnector = {
        id: nextVerticalConnectorId(),
        name: nextVerticalConnectorName(connType, state.verticalConnectors),
        type: connType,
        position: { x: centerX, y: fromLevel.elevationY, z: centerZ },
        rotationY: 0,
        dimensions: {
          width: config.width ?? 3.5,
          depth: config.depth ?? 3.5,
          height: connectorHeight,
        },
        fromLevelId: fromLevel.id,
        toLevelId: toLevel.id,
      };

      state.executeCommand(createAddVerticalConnectorCommand(connector));
      state.selectEntity(connector.id);
      showToast(`Added ${connector.name}: ${formatTypeName(item)}`);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const item = placementBus.item;
    const { camera, getCanvasRect } = placementBus;
    resetPlacementBus();

    if (!item || !camera || !getCanvasRect) return;
    const state = useEditorStore.getState();
    const activeLevel =
      state.activeLevelId && state.activeLevelId !== 'ALL'
        ? (state.buildingLevels ?? []).find((l) => l.id === state.activeLevelId)
        : undefined;
    const elevationY = activeLevel ? activeLevel.elevationY : 0;

    const rawPoint = screenToWorldFloor(
      event.clientX,
      event.clientY,
      camera,
      getCanvasRect(),
      elevationY
    );
    if (!rawPoint) return;

    commitPlacement(rawPoint.x, rawPoint.z, item);
  };

  const commitPlacement = (
    rawX: number,
    rawZ: number,
    item: NonNullable<typeof placementBus.item>
  ): void => {
    const state = useEditorStore.getState();
    const config = item.defaultConfig;

    const activeLevel =
      state.activeLevelId && state.activeLevelId !== 'ALL'
        ? (state.buildingLevels ?? []).find((l) => l.id === state.activeLevelId)
        : undefined;
    const elevationY = activeLevel ? activeLevel.elevationY : 0;
    const levelId = activeLevel?.id;

    if (item.type === 'rack') {
      const bays = config.bays ?? 3;
      const levels = config.levels ?? 3;

      const levelRacks = state.racks.filter(
        (r) => (r.levelId || 'level-1') === (levelId || 'level-1')
      );

      const snapped = resolvePlacementPosition({
        rawX,
        rawZ,
        entityWidth: config.width,
        entityDepth: config.depth,
        entityRotationY: 0,
        gridStep: state.gridSnapStep,
        isSnapEnabled: state.isSnappingEnabled,
        neighbors: levelRacks,
        floorWidth: state.floorDimensions.width,
        floorDepth: state.floorDimensions.depth,
      });

      const isValid = isPlacementValid({
        x: snapped.x,
        z: snapped.z,
        width: config.width,
        depth: config.depth,
        rotationY: 0,
        neighbors: levelRacks,
        floorWidth: state.floorDimensions.width,
        floorDepth: state.floorDimensions.depth,
      });

      if (!isValid) return;

      const rackType = item.subType as RackType;

      const rack: RackEntity = {
        id: nextRackId(),
        name: nextRackName(state.racks),
        type: rackType,
        position: { x: snapped.x, y: elevationY, z: snapped.z },
        rotationY: 0,
        dimensions: deriveRackDimensions({
          bays,
          levels,
          bayWidth: config.width / bays,
          bayDepth: config.depth,
          levelHeight: config.height / levels,
        }),
        bays,
        levels,
        levelHeight: config.height / levels,
        bayWidth: config.width / bays,
        bayDepth: config.depth,
        bins: [],
        levelId,
      };
      rack.bins = generateBinsForRack(rack);

      state.executeCommand(createAddRackCommand(rack));
      state.selectEntity(rack.id);
      showToast(`Placed ${rack.name}: ${formatTypeName(item, t)} (${rack.bins.length} bins)`);
    } else if (item.type === 'structural') {
      const structType = item.subType as StructuralItemType;
      const snappedX = state.isSnappingEnabled ? snapToGrid(rawX, state.gridSnapStep) : rawX;
      const snappedZ = state.isSnappingEnabled ? snapToGrid(rawZ, state.gridSnapStep) : rawZ;

      const element: StructuralElement = {
        id: nextStructureId(),
        name: nextStructureName(structType, state.structuralElements),
        type: structType,
        position: { x: snappedX, y: elevationY, z: snappedZ },
        dimensions: { width: config.width, height: config.height, depth: config.depth },
        rotationY: 0,
        levelId,
      };

      state.executeCommand(createAddStructuralElementCommand(element));
      state.selectEntity(element.id);
      showToast(`Placed ${element.name}: ${formatTypeName(item, t)}`);
    } else if (item.type === 'zone') {
      const zoneType = item.subType as ZoneType;
      const snappedX = state.isSnappingEnabled ? snapToGrid(rawX, state.gridSnapStep) : rawX;
      const snappedZ = state.isSnappingEnabled ? snapToGrid(rawZ, state.gridSnapStep) : rawZ;

      const zone: WarehouseZone = {
        id: nextZoneId(),
        name: nextZoneName(zoneType, state.zones),
        type: zoneType,
        colorHex: ZONE_DEFAULT_COLORS[zoneType] || '#0284c7',
        position: { x: snappedX, y: elevationY, z: snappedZ },
        dimensions: { width: config.width, height: 0.05, depth: config.depth },
        levelId,
      };

      state.executeCommand(createAddZoneCommand(zone));
      state.selectEntity(zone.id);
      showToast(`Placed ${zone.name}: ${formatTypeName(item, t)} (${config.width}×${config.depth}m)`);
    } else if (item.type === 'connector') {
      const connType = item.subType as VerticalConnectorType;
      const snappedX = state.isSnappingEnabled ? snapToGrid(rawX, state.gridSnapStep) : rawX;
      const snappedZ = state.isSnappingEnabled ? snapToGrid(rawZ, state.gridSnapStep) : rawZ;

      const levels = [...(state.buildingLevels ?? [])].sort((a, b) => a.elevationY - b.elevationY);
      const activeIdx = activeLevel
        ? levels.findIndex((l) => l.id === activeLevel.id)
        : 0;

      const currentLevel =
        activeIdx >= 0 && levels[activeIdx]
          ? levels[activeIdx]
          : levels[0] ?? { id: 'level-ground', elevationY: 0, height: 3.6 };
      const nextLevel =
        activeIdx >= 0 && activeIdx < levels.length - 1
          ? levels[activeIdx + 1]
          : undefined;

      const fromLevel = currentLevel;
      const toLevel = nextLevel ?? fromLevel;
      const connectorHeight = nextLevel
        ? Math.max(1, nextLevel.elevationY - fromLevel.elevationY)
        : config.height ?? currentLevel.height ?? 4.0;

      const connector: VerticalConnector = {
        id: nextVerticalConnectorId(),
        name: nextVerticalConnectorName(connType, state.verticalConnectors),
        type: connType,
        position: { x: snappedX, y: fromLevel.elevationY, z: snappedZ },
        rotationY: 0,
        dimensions: {
          width: config.width ?? 3.5,
          depth: config.depth ?? 3.5,
          height: connectorHeight,
        },
        fromLevelId: fromLevel.id,
        toLevelId: toLevel.id,
      };

      state.executeCommand(createAddVerticalConnectorCommand(connector));
      state.selectEntity(connector.id);
      showToast(`Placed ${connector.name}: ${formatTypeName(item, t)}`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const blueprint = await getWarehouseLayout(blueprintId);
        if (cancelled) return;
        if (!blueprint) {
          setLoadState('error');
          return;
        }
        useEditorStore.getState().loadBlueprint(blueprint);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();

    return () => {
      cancelled = true;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [blueprintId]);

  if (loadState === 'loading') {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Loading blueprint…
      </main>
    );
  }

  if (loadState === 'error') {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-neutral-950">
        <p className="text-neutral-300">Blueprint not found: {blueprintId}</p>
        <Link href="/" className="text-sm text-sky-400 hover:underline">
          Back to blueprints
        </Link>
      </main>
    );
  }

  return (
    <main
      className={`relative flex h-screen w-screen flex-col overflow-hidden transition-colors duration-200 ${
        theme === 'light' ? 'bg-[#f8fafc] text-slate-900' : 'bg-neutral-950 text-neutral-100'
      }`}
    >
      <TopNavToolbar
        blueprintId={blueprintId}
        currentUser={currentUser}
        onRequestExit={() => setShowUnsavedModal(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAisleGenerator={() => handleOpenAisleGenerator(null)}
        onOpenWmsHub={() => setIsWmsHubOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Sidebar (Asset Catalogue & Scene Outliner) */}
        {isLeftSidebarOpen ? (
          <aside className="relative flex h-full w-80 shrink-0 flex-col border-r border-slate-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 z-20 select-none shadow-xl transition-all duration-200">
            {/* Left Sidebar Header Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/80 px-2 pt-2 gap-1">
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('catalogue')}
                  className={`flex-1 rounded-t-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeLeftTab === 'catalogue'
                      ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60'
                      : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Catalogue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('outliner')}
                  className={`flex-1 rounded-t-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeLeftTab === 'outliner'
                      ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-900/60'
                      : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  <ListTree className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Outliner</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsLeftSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
                title="Collapse Left Sidebar"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Left Sidebar Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {activeLeftTab === 'catalogue' ? (
                <SidebarPalette
                  onAddItem={handleAddItem}
                  onOpenAisleGenerator={() => handleOpenAisleGenerator(null)}
                />
              ) : (
                <SceneOutliner />
              )}
            </div>
          </aside>
        ) : (
          <div className="absolute left-3 top-3 z-30">
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-800/90 bg-white/90 dark:bg-neutral-900/90 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-neutral-300 shadow-xl backdrop-blur-md hover:border-sky-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
              title="Expand Left Sidebar (Assets & Outliner)"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Assets</span>
            </button>
          </div>
        )}

        {/* Center 3D Canvas Area */}
        <div
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="relative flex-1 min-h-0">
            <WarehouseCanvas onOpenControls={() => setShowControlsModal(true)} />
          </div>
          {/* Bottom Footer: Dedicated Playback Dock in Picking mode, or Telemetry Bar in Layout mode */}
          {editorViewMode === 'PICKING' ? (
            <PickingPlaybackDock
              onOpenControls={() => setShowControlsModal(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          ) : (
            <EditorStatusBar
              onOpenControls={() => setShowControlsModal(true)}
              onOpenTour={() => setIsTourOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </div>

        {/* Right Sidebar (Properties Inspector in Layout/WMS, or Manifest in Picking mode) */}
        {isRightSidebarOpen ? (
          <aside className={`relative flex h-full shrink-0 z-20 ${editorViewMode === 'PICKING' ? 'w-80 md:w-96' : ''}`}>
            {editorViewMode === 'PICKING' ? (
              <PickingManifestDrawer
                isOpen={true}
                docked={true}
                onClose={() => setIsRightSidebarOpen(false)}
              />
            ) : (
              <>
                <PropertiesInspector
                  onOpenAisleGenerator={handleOpenAisleGenerator}
                  onOpenWmsHub={() => setIsWmsHubOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => setIsRightSidebarOpen(false)}
                  className="absolute left-2 top-2 z-30 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
                  title="Collapse Inspector"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </>
            )}
          </aside>
        ) : (
          <div className="absolute right-3 top-4 z-30">
            <button
              type="button"
              onClick={() => setIsRightSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-800/90 bg-white/90 dark:bg-neutral-900/90 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-neutral-300 shadow-xl backdrop-blur-md hover:border-sky-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition"
              title={editorViewMode === 'PICKING' ? 'Buka Manifest Pesanan' : 'Expand Right Inspector'}
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              {editorViewMode === 'PICKING' ? (
                <>
                  <Package className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.75} />
                  <span>Manifest</span>
                </>
              ) : (
                <span>Inspector</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Slide-Over WMS Bin Inspection Drawer */}
      <BinDetailDrawer />

      {/* Slide-Over WMS Zone Pallet Staging Drawer */}
      <ZonePalletDrawer />

      {/* WMS Analytics & Heatmap Floating Dock & Legend */}
      <HeatmapLegendHUD />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 rounded-full border border-sky-500/50 bg-white/95 dark:bg-neutral-900/95 px-4 py-2 text-xs font-medium text-sky-600 dark:text-sky-300 shadow-xl shadow-slate-900/20 dark:shadow-black/50 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            {toast}
          </div>
        </div>
      )}

      {/* Controls & Moveset Guide Cheat Sheet Modal */}
      <ControlsModal
        isOpen={showControlsModal}
        onClose={() => setShowControlsModal(false)}
      />

      {/* Global Settings & Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Aisle Auto-Spanning & Array Generator Modal */}
      <AisleGeneratorModal
        isOpen={isAisleGeneratorOpen}
        onClose={() => {
          setIsAisleGeneratorOpen(false);
          setAisleGeneratorRack(null);
        }}
        initialRack={aisleGeneratorRack}
      />

      {/* Enterprise WMS Data Hub & Slotting Optimizer Modal */}
      <WmsDataHubModal
        isOpen={isWmsHubOpen}
        onClose={() => setIsWmsHubOpen(false)}
        onShowToast={(msg) => showToast(msg)}
      />

      {/* Interactive Step-by-Step Spotlight Guided Tour */}
      <GuidedTourOverlay
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        currentMode={editorViewMode}
        onModeChangeRequired={(mode) => useEditorStore.getState().setEditorViewMode(mode)}
        onTabChangeRequired={(tab) => {
          setIsLeftSidebarOpen(true);
          setActiveLeftTab(tab);
        }}
        onEnsureInspectorOpen={() => {
          setIsRightSidebarOpen(true);
        }}
      />

      {/* Unsaved Changes Exit Warning Dialog */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">Unsaved Changes</h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">You have unsaved activity in this blueprint</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/50 p-3.5 text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
              Modifications made to <span className="font-semibold text-slate-900 dark:text-neutral-100">{blueprintName}</span> have not been saved yet. If you leave now without saving, your recent changes will be lost.
            </div>

            {saveExitError && (
              <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/80 p-3 text-xs text-red-600 dark:text-red-200">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Gagal menyimpan:</span>
                </p>
                <p className="mt-1 text-[11px] text-red-700 dark:text-red-300 font-mono break-words">{saveExitError}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  setSaveExitError(null);
                }}
                disabled={isSavingAndExiting}
                className="rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndExit}
                disabled={isSavingAndExiting}
                className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-700 dark:hover:text-white transition disabled:opacity-50"
              >
                Discard & Leave
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndExit()}
                disabled={isSavingAndExiting}
                className="rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-500 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSavingAndExiting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  'Save & Leave'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


