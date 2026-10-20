// Warehouse Starter Layout Templates
// Provides pre-configured, industry-standard warehouse designs for instant exploration.

import type { WarehouseLayoutBlueprint, RackEntity, StructuralElement, WarehouseZone } from '@/types/layout';
import { deriveRackDimensions, generateBinsForRack } from '@/engine/procedural/bin-generator';

export interface WarehouseTemplateDefinition {
  id: string;
  name: string;
  category: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: string;
  floorDimensions: { width: number; height: number; depth: number };
  estimatedRacks: number;
  estimatedBins: number;
  highlightSpecs: string[];
  createBlueprint: (id: string, name?: string) => WarehouseLayoutBlueprint;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const WAREHOUSE_TEMPLATES: WarehouseTemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Empty Canvas',
    category: 'Custom / Starter',
    badge: 'Open Floor',
    badgeColor: 'border-slate-300 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800/80 text-slate-700 dark:text-neutral-300',
    description: 'A clean 60×40m industrial floor ready for scratch architectural layout and custom zoning.',
    icon: '📐',
    floorDimensions: { width: 60, height: 10, depth: 40 },
    estimatedRacks: 0,
    estimatedBins: 0,
    highlightSpecs: ['60m × 40m footprint (2,400 m²)', '10m clearance ceiling', '0.5m default grid snap'],
    createBlueprint: (id, customName) => {
      const now = new Date().toISOString();
      return {
        id,
        name: customName || 'Untitled Warehouse',
        gridSnapStep: 0.5,
        floorDimensions: { width: 60, height: 10, depth: 40 },
        zones: [],
        structuralElements: [],
        racks: [],
        createdAt: now,
        updatedAt: now,
      };
    },
  },
  {
    id: 'ecommerce_hub',
    name: 'E-Commerce Fulfillment Hub',
    category: 'Distribution & Logistics',
    badge: 'Popular',
    badgeColor: 'border-sky-200 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
    description: 'High-throughput fulfillment center with 6 Selective Pallet aisles, Inbound/Outbound staging zones, and 3 dock doors.',
    icon: '⚡',
    floorDimensions: { width: 80, height: 12, depth: 50 },
    estimatedRacks: 6,
    estimatedBins: 192,
    highlightSpecs: ['80m × 50m footprint (4,000 m²)', '6 Selective Pallet Aisles (192 Bins)', '3 Dock Doors & Dual Staging Lanes'],
    createBlueprint: (id, customName) => {
      const now = new Date().toISOString();

      const zones: WarehouseZone[] = [
        {
          id: createId('zone'),
          name: 'Inbound Receiving',
          colorHex: '#10b981',
          type: 'receiving',
          position: { x: 22, y: 0, z: 8 },
          dimensions: { width: 34, height: 0.05, depth: 10 },
        },
        {
          id: createId('zone'),
          name: 'Staging & Sorting Lane',
          colorHex: '#f59e0b',
          type: 'picking',
          position: { x: 60, y: 0, z: 8 },
          dimensions: { width: 30, height: 0.05, depth: 10 },
        },
        {
          id: createId('zone'),
          name: 'Outbound Shipping Dock',
          colorHex: '#0284c7',
          type: 'shipping',
          position: { x: 40, y: 0, z: 43 },
          dimensions: { width: 50, height: 0.05, depth: 9 },
        },
      ];

      const structuralElements: StructuralElement[] = [
        {
          id: createId('struct'),
          name: 'Dock Door 01',
          type: 'dock_door',
          position: { x: 26, y: 0, z: 49 },
          dimensions: { width: 3.6, height: 4.5, depth: 0.4 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Dock Door 02',
          type: 'dock_door',
          position: { x: 40, y: 0, z: 49 },
          dimensions: { width: 3.6, height: 4.5, depth: 0.4 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Dock Door 03',
          type: 'dock_door',
          position: { x: 54, y: 0, z: 49 },
          dimensions: { width: 3.6, height: 4.5, depth: 0.4 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Pillar Column A',
          type: 'column',
          position: { x: 20, y: 0, z: 27 },
          dimensions: { width: 0.8, height: 12, depth: 0.8 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Pillar Column B',
          type: 'column',
          position: { x: 60, y: 0, z: 27 },
          dimensions: { width: 0.8, height: 12, depth: 0.8 },
          rotationY: 0,
        },
      ];

      const racks: RackEntity[] = [];
      const aisleNames = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'];
      const aisleX = [26, 32, 38, 44, 50, 56];

      for (let i = 0; i < 6; i++) {
        const rackId = createId('rack');
        const rack: RackEntity = {
          id: rackId,
          name: aisleNames[i],
          type: 'selective_pallet',
          position: { x: aisleX[i], y: 0, z: 27 },
          rotationY: 0,
          dimensions: deriveRackDimensions({
            bays: 4,
            levels: 4,
            bayWidth: 1.5,
            bayDepth: 1.1,
            levelHeight: 1.5,
          }),
          bays: 4,
          levels: 4,
          bayWidth: 1.5,
          bayDepth: 1.1,
          levelHeight: 1.5,
          bins: [],
        };
        const bins = generateBinsForRack(rack);
        // Pre-populate ~60% occupancy for a rich first-glance demo
        bins.forEach((bin, idx) => {
          if (idx % 3 !== 0) {
            bin.isOccupied = true;
            bin.skuData = {
              sku: `SKU-EC-${1000 + idx}`,
              productName: `Fulfillment Item ${idx + 1}`,
              quantity: 24 + (idx * 6) % 60,
              unit: 'CTN',
              lotNumber: `LOT-2026-${(idx % 12) + 1}`,
              weightKg: 280 + (idx * 35) % 450,
              velocityClass: idx % 2 === 0 ? 'A' : 'B',
            };
          }
        });
        rack.bins = bins;
        racks.push(rack);
      }

      return {
        id,
        name: customName || 'E-Commerce Fulfillment Hub',
        gridSnapStep: 0.5,
        floorDimensions: { width: 80, height: 12, depth: 50 },
        zones,
        structuralElements,
        racks,
        createdAt: now,
        updatedAt: now,
      };
    },
  },
  {
    id: 'cold_storage',
    name: 'High-Density Cold Storage',
    category: 'Refrigerated & Frozen',
    badge: 'Dense Storage',
    badgeColor: 'border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300',
    description: 'Thermal-efficient layout featuring Double-Deep Pallet and Drive-In Bulk racks, temperature airlocks, and QC quarantine zone.',
    icon: '❄️',
    floorDimensions: { width: 50, height: 9, depth: 35 },
    estimatedRacks: 4,
    estimatedBins: 64,
    highlightSpecs: ['50m × 35m footprint (1,750 m²)', 'Double-Deep & Drive-In Racks', 'Quarantine Inspection & Airlock Doors'],
    createBlueprint: (id, customName) => {
      const now = new Date().toISOString();

      const zones: WarehouseZone[] = [
        {
          id: createId('zone'),
          name: 'Cold Inbound Airlock',
          colorHex: '#10b981',
          type: 'receiving',
          position: { x: 14, y: 0, z: 6 },
          dimensions: { width: 22, height: 0.05, depth: 8 },
        },
        {
          id: createId('zone'),
          name: 'QC & Quarantine Area',
          colorHex: '#f43f5e',
          type: 'quarantine',
          position: { x: 38, y: 0, z: 6 },
          dimensions: { width: 18, height: 0.05, depth: 8 },
        },
      ];

      const structuralElements: StructuralElement[] = [
        {
          id: createId('struct'),
          name: 'Refrigerated Dock 01',
          type: 'dock_door',
          position: { x: 14, y: 0, z: 1 },
          dimensions: { width: 3.5, height: 4.0, depth: 0.4 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Perimeter Insulated Wall',
          type: 'wall',
          position: { x: 25, y: 0, z: 34 },
          dimensions: { width: 48, height: 9, depth: 0.5 },
          rotationY: 0,
        },
      ];

      const racks: RackEntity[] = [];
      const configs = [
        { name: 'C01', type: 'double_deep' as const, x: 14, z: 20, bays: 4, levels: 4, depth: 2.2 },
        { name: 'C02', type: 'double_deep' as const, x: 22, z: 20, bays: 4, levels: 4, depth: 2.2 },
        { name: 'C03', type: 'drive_in' as const, x: 31, z: 20, bays: 4, levels: 4, depth: 2.5 },
        { name: 'C04', type: 'drive_in' as const, x: 41, z: 20, bays: 4, levels: 4, depth: 2.5 },
      ];

      configs.forEach((cfg) => {
        const rackId = createId('rack');
        const rack: RackEntity = {
          id: rackId,
          name: cfg.name,
          type: cfg.type,
          position: { x: cfg.x, y: 0, z: cfg.z },
          rotationY: 0,
          dimensions: deriveRackDimensions({
            bays: cfg.bays,
            levels: cfg.levels,
            bayWidth: 1.5,
            bayDepth: cfg.depth,
            levelHeight: 1.5,
          }),
          bays: cfg.bays,
          levels: cfg.levels,
          bayWidth: 1.5,
          bayDepth: cfg.depth,
          levelHeight: 1.5,
          bins: [],
        };
        const bins = generateBinsForRack(rack);
        bins.forEach((b, idx) => {
          if (idx % 2 === 0) {
            b.isOccupied = true;
            b.skuData = {
              sku: `FROZEN-${2000 + idx}`,
              productName: `Frozen Pallet Stock ${idx + 1}`,
              quantity: 40,
              unit: 'PLT',
              lotNumber: `LOT-COLD-${idx + 1}`,
              weightKg: 650,
              velocityClass: 'B',
            };
          }
        });
        rack.bins = bins;
        racks.push(rack);
      });

      return {
        id,
        name: customName || 'High-Density Cold Storage',
        gridSnapStep: 0.5,
        floorDimensions: { width: 50, height: 9, depth: 35 },
        zones,
        structuralElements,
        racks,
        createdAt: now,
        updatedAt: now,
      };
    },
  },
  {
    id: 'cantilever_depot',
    name: 'Heavy Industrial & Long Goods Depot',
    category: 'Heavy Material & Steel',
    badge: 'Specialized',
    badgeColor: 'border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    description: 'Designed for lumber, pipes, and bar stock with Cantilever open arms, a Mezzanine platform deck, and safety perimeter bollards.',
    icon: '🏗️',
    floorDimensions: { width: 70, height: 10, depth: 40 },
    estimatedRacks: 4,
    estimatedBins: 24,
    highlightSpecs: ['70m × 40m footprint (2,800 m²)', 'Cantilever Open-Arm Racks', 'Mezzanine Deck & Perimeter Safety Bollards'],
    createBlueprint: (id, customName) => {
      const now = new Date().toISOString();

      const zones: WarehouseZone[] = [
        {
          id: createId('zone'),
          name: 'Heavy Loading & Staging',
          colorHex: '#f59e0b',
          type: 'picking',
          position: { x: 35, y: 0, z: 33 },
          dimensions: { width: 50, height: 0.05, depth: 9 },
        },
      ];

      const structuralElements: StructuralElement[] = [
        {
          id: createId('struct'),
          name: 'Overhead Dock 01',
          type: 'dock_door',
          position: { x: 25, y: 0, z: 39 },
          dimensions: { width: 4.5, height: 5.0, depth: 0.4 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Overhead Dock 02',
          type: 'dock_door',
          position: { x: 45, y: 0, z: 39 },
          dimensions: { width: 4.5, height: 5.0, depth: 0.4 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Safety Bollard 1',
          type: 'bollard',
          position: { x: 19, y: 0, z: 35 },
          dimensions: { width: 0.3, height: 1.0, depth: 0.3 },
          rotationY: 0,
        },
        {
          id: createId('struct'),
          name: 'Safety Bollard 2',
          type: 'bollard',
          position: { x: 51, y: 0, z: 35 },
          dimensions: { width: 0.3, height: 1.0, depth: 0.3 },
          rotationY: 0,
        },
      ];

      const racks: RackEntity[] = [];

      // Cantilever Racks
      const cantilevers = [
        { name: 'K01', x: 18, z: 18, bays: 3, levels: 3 },
        { name: 'K02', x: 28, z: 18, bays: 3, levels: 3 },
        { name: 'K03', x: 38, z: 18, bays: 3, levels: 3 },
      ];

      cantilevers.forEach((cfg) => {
        const rackId = createId('rack');
        const rack: RackEntity = {
          id: rackId,
          name: cfg.name,
          type: 'cantilever',
          position: { x: cfg.x, y: 0, z: cfg.z },
          rotationY: 0,
          dimensions: deriveRackDimensions({
            bays: cfg.bays,
            levels: cfg.levels,
            bayWidth: 2.0,
            bayDepth: 1.3,
            levelHeight: 1.8,
          }),
          bays: cfg.bays,
          levels: cfg.levels,
          bayWidth: 2.0,
          bayDepth: 1.3,
          levelHeight: 1.8,
          bins: [],
        };
        const bins = generateBinsForRack(rack);
        bins.forEach((b, idx) => {
          if (idx % 2 === 0) {
            b.isOccupied = true;
            b.skuData = {
              sku: `STEEL-${5000 + idx}`,
              productName: `Structural Steel Bar 6m`,
              quantity: 12,
              unit: 'BDL',
              lotNumber: `LOT-STL-2026`,
              weightKg: 850,
              velocityClass: 'A',
            };
          }
        });
        rack.bins = bins;
        racks.push(rack);
      });

      // Mezzanine Platform Deck
      const mezId = createId('rack');
      const mezzanine: RackEntity = {
        id: mezId,
        name: 'MEZ01',
        type: 'mezzanine',
        position: { x: 55, y: 0, z: 15 },
        rotationY: 0,
        dimensions: { width: 6.0, height: 3.5, depth: 3.0 },
        bays: 2,
        levels: 1,
        bayWidth: 3.0,
        bayDepth: 3.0,
        levelHeight: 3.5,
        bins: [],
      };
      mezzanine.bins = generateBinsForRack(mezzanine);
      racks.push(mezzanine);

      return {
        id,
        name: customName || 'Heavy Industrial & Long Goods Depot',
        gridSnapStep: 0.5,
        floorDimensions: { width: 70, height: 10, depth: 40 },
        zones,
        structuralElements,
        racks,
        createdAt: now,
        updatedAt: now,
      };
    },
  },
];
