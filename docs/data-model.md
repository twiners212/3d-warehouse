# DATA MODEL SPECIFICATION: 3D WEB WAREHOUSE BUILDER & SPATIAL WMS

**Document:** DATA_MODEL.md  
**Target:** Autonomous AI Coding Agents / Full-Stack Database Engineers  
**Storage Tier:** Neon Serverless PostgreSQL  
**ORM / Query Builder:** Drizzle ORM (PostgreSQL dialect via `@neondatabase/serverless`)  
**Runtime Validator:** Zod  

---

## 1. Storage Architecture & Paradigm

The persistence layer employs a **Hybrid Relational-Document Pattern** optimized for high-frequency 3D WebGL scenes and transactional Warehouse Management System (WMS) operations:

* **Relational / Normalized Tables (`racks`, `inventory_bins`):** Physical rack infrastructure and individual bin compartments are stored as discrete relational records with foreign key constraints, composite unique indexes, and occupancy status. This enables direct SQL indexing for stock allocation, picking route optimization, and SKU lookups.
* **Document / JSONB Fields (`zones_data`, `structural_elements`):** Environmental boundaries, floor zone polygons, dock doors, walls, and architectural pillars are persisted as structured JSONB arrays within `warehouse_blueprints` because they are read and mutated atomically as a single viewport payload.

---

## 2. Entity Relationship Diagram (ERD)


```

┌─────────────────────────────────────────────────────────────┐
│                    warehouse_blueprints                     │
├────────────────────────────────┬────────────────────────────┤
│ id (PK)                        │ text                       │
│ name                           │ varchar(255)               │
│ grid_snap_step                 │ real                       │
│ floor_dimensions               │ jsonb                      │
│ zones_data                     │ jsonb                      │
│ structural_elements            │ jsonb                      │
│ created_at                     │ timestamptz                │
│ updated_at                     │ timestamptz                │
└───────────────┬─────────────────────────────────────────────┘
│ 1
│
│ N (ON DELETE CASCADE)
▼
┌─────────────────────────────────────────────────────────────┐
│                            racks                            │
├────────────────────────────────┬────────────────────────────┤
│ id (PK)                        │ text                       │
│ blueprint_id (FK)              │ text                       │
│ name                           │ varchar(64)                │
│ type                           │ varchar(32)                │
│ position                       │ jsonb                      │
│ rotation_y                     │ real                       │
│ dimensions                     │ jsonb                      │
│ bays                           │ integer                    │
│ levels                         │ integer                    │
│ bay_width                      │ real                       │
│ bay_depth                      │ real                       │
│ level_height                   │ real                       │
│ created_at                     │ timestamptz                │
└───────────────┬─────────────────────────────────────────────┘
│ 1
│
│ N (ON DELETE CASCADE)
▼
┌─────────────────────────────────────────────────────────────┐
│                       inventory_bins                        │
├────────────────────────────────┬────────────────────────────┤
│ id (PK) [e.g. "A01-02-03"]     │ text                       │
│ blueprint_id (FK)              │ text                       │
│ rack_id (FK)                   │ text                       │
│ bay_index                      │ integer                    │
│ level_index                    │ integer                    │
│ relative_position              │ jsonb                      │
│ dimension                      │ jsonb                      │
│ max_weight_kg                  │ real                       │
│ is_occupied                    │ boolean                    │
│ created_at                     │ timestamptz                │
└─────────────────────────────────────────────────────────────┘

```

---

## 3. Data Dictionaries & Table Schemas

### 3.1 Table: `warehouse_blueprints`

Stores root facility dimensions, layout metadata, and environmental obstacles.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Unique blueprint identifier (`UUID` or `nanoid`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | User-assigned warehouse facility name |
| `grid_snap_step` | `REAL` | `NOT NULL DEFAULT 0.5` | Grid snapping interval in meters ($0.25, 0.5, 1.0$) |
| `floor_dimensions` | `JSONB` | `NOT NULL` | Floor bounds: `{ "width": number, "height": number, "depth": number }` |
| `zones_data` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of 2D polygon operational zones |
| `structural_elements` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of walls, columns, bollards, dock doors |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record last modification timestamp |

---

### 3.2 Table: `racks`

Stores structural parameters and spatial orientation of storage racks.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Unique rack identifier (`UUID` or `nanoid`) |
| `blueprint_id` | `TEXT` | `NOT NULL REFERENCES warehouse_blueprints(id) ON DELETE CASCADE` | Parent blueprint reference |
| `name` | `VARCHAR(64)` | `NOT NULL` | Aisle / rack identifier code (e.g., `"A01"`) |
| `type` | `VARCHAR(32)` | `NOT NULL` | Rack category: `'selective_pallet' \| 'cantilever' \| 'shelving'` |
| `position` | `JSONB` | `NOT NULL` | World space pivot coordinate: `{ "x": number, "y": 0, "z": number }` |
| `rotation_y` | `REAL` | `NOT NULL DEFAULT 0.0` | $Y$-axis yaw in radians ($\{0, \frac{\pi}{2}, \pi, \frac{3\pi}{2}\}$) |
| `dimensions` | `JSONB` | `NOT NULL` | Total bounding volume: `{ "width": number, "height": number, "depth": number }` |
| `bays` | `INTEGER` | `NOT NULL` | Number of horizontal bay columns ($\ge 1$) |
| `levels` | `INTEGER` | `NOT NULL` | Number of vertical shelf tiers ($\ge 1$) |
| `bay_width` | `REAL` | `NOT NULL` | Width per bay in meters |
| `bay_depth` | `REAL` | `NOT NULL` | Depth of shelf frame in meters |
| `level_height` | `REAL` | `NOT NULL` | Height per vertical level in meters |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record creation timestamp |

---

### 3.3 Table: `inventory_bins`

Stores normalized, addressable shelf locations for inventory tracking, pick routing, and spatial heatmaps.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Canonical address: `[RackName]-[Bay:2]-[Level:2]` (e.g., `"A01-04-02"`) |
| `blueprint_id` | `TEXT` | `NOT NULL REFERENCES warehouse_blueprints(id) ON DELETE CASCADE` | Root blueprint reference |
| `rack_id` | `TEXT` | `NOT NULL REFERENCES racks(id) ON DELETE CASCADE` | Immediate parent rack reference |
| `bay_index` | `INTEGER` | `NOT NULL` | 1-indexed horizontal bay position |
| `level_index` | `INTEGER` | `NOT NULL` | 1-indexed vertical tier level |
| `relative_position` | `JSONB` | `NOT NULL` | Local offset relative to rack origin: `{ "x", "y", "z" }` |
| `dimension` | `JSONB` | `NOT NULL` | Usable compartment volume: `{ "width", "height", "depth" }` |
| `max_weight_kg` | `REAL` | `NOT NULL DEFAULT 1000.0` | Maximum payload capacity in kilograms |
| `is_occupied` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Real-time bin occupancy status |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record creation timestamp |

---

## 4. Indexing Strategy & Integrity Invariants

```sql
-- Index 1: Accelerate rack querying during layout initialization
CREATE INDEX idx_racks_blueprint_id ON racks(blueprint_id);

-- Index 2: Accelerate bin extraction per rack entity
CREATE INDEX idx_bins_rack_id ON inventory_bins(rack_id);

-- Index 3: Composite index for occupancy analytics and spatial heatmap rendering
CREATE INDEX idx_bins_blueprint_occupancy ON inventory_bins(blueprint_id, is_occupied);

-- Constraint 1: Prevent duplicate bay-level index collision within the same rack
CREATE UNIQUE INDEX uq_rack_bay_level ON inventory_bins(rack_id, bay_index, level_index);

```

---

## 5. Drizzle ORM Schema Implementation (`src/db/schema.ts`)

```typescript
import { pgTable, text, timestamp, jsonb, real, integer, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Size3D {
  width: number;
  height: number;
  depth: number;
}

export interface WarehouseZonePayload {
  id: string;
  name: string;
  colorHex: string;
  polygon: Array<{ x: number; z: number }>;
  type: 'receiving' | 'storage' | 'picking' | 'quarantine' | 'shipping';
}

export interface StructuralItemPayload {
  id: string;
  type: 'wall' | 'column' | 'dock_door';
  position: Vector3D;
  dimensions: Size3D;
  rotationY: number;
}

// 1. Blueprints Table
export const warehouseBlueprints = pgTable('warehouse_blueprints', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gridSnapStep: real('grid_snap_step').default(0.5).notNull(),
  floorDimensions: jsonb('floor_dimensions').$type<Size3D>().notNull(),
  zonesData: jsonb('zones_data').$type<WarehouseZonePayload[]>().default([]).notNull(),
  structuralElements: jsonb('structural_elements').$type<StructuralItemPayload[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Racks Table
export const racks = pgTable('racks', {
  id: text('id').primaryKey(),
  blueprintId: text('blueprint_id')
    .notNull()
    .references(() => warehouseBlueprints.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').$type<'selective_pallet' | 'cantilever' | 'shelving'>().notNull(),
  position: jsonb('position').$type<Vector3D>().notNull(),
  rotationY: real('rotation_y').default(0.0).notNull(),
  dimensions: jsonb('dimensions').$type<Size3D>().notNull(),
  bays: integer('bays').notNull(),
  levels: integer('levels').notNull(),
  bayWidth: real('bay_width').notNull(),
  bayDepth: real('bay_depth').notNull(),
  levelHeight: real('level_height').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blueprintIdx: index('idx_racks_blueprint_id').on(table.blueprintId),
}));

// 3. Inventory Bins Table
export const inventoryBins = pgTable('inventory_bins', {
  id: text('id').primaryKey(), // E.g., "A01-02-03"
  blueprintId: text('blueprint_id')
    .notNull()
    .references(() => warehouseBlueprints.id, { onDelete: 'cascade' }),
  rackId: text('rack_id')
    .notNull()
    .references(() => racks.id, { onDelete: 'cascade' }),
  bayIndex: integer('bay_index').notNull(),
  levelIndex: integer('level_index').notNull(),
  relativePosition: jsonb('relative_position').$type<Vector3D>().notNull(),
  dimension: jsonb('dimension').$type<Size3D>().notNull(),
  maxWeightKg: real('max_weight_kg').default(1000.0).notNull(),
  isOccupied: boolean('is_occupied').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  rackIdx: index('idx_bins_rack_id').on(table.rackId),
  occupancyIdx: index('idx_bins_blueprint_occupancy').on(table.blueprintId, table.isOccupied),
  uniqueBayLevel: uniqueIndex('uq_rack_bay_level').on(table.rackId, table.bayIndex, table.levelIndex),
}));

// 4. Relational Definitions
export const blueprintRelations = relations(warehouseBlueprints, ({ many }) => ({
  racks: many(racks),
  bins: many(inventoryBins),
}));

export const rackRelations = relations(racks, ({ one, many }) => ({
  blueprint: one(warehouseBlueprints, {
    fields: [racks.blueprintId],
    references: [warehouseBlueprints.id],
  }),
  bins: many(inventoryBins),
}));

export const binRelations = relations(inventoryBins, ({ one }) => ({
  rack: one(racks, {
    fields: [inventoryBins.rackId],
    references: [racks.id],
  }),
  blueprint: one(warehouseBlueprints, {
    fields: [inventoryBins.blueprintId],
    references: [warehouseBlueprints.id],
  }),
}));

```

---

## 6. Runtime Validation Schemas (`src/lib/validations/layout-schema.ts`)

```typescript
import { z } from 'zod';

export const Vector3DSchema = z.object({
  x: z.number(),
  y: z.number().min(0, 'Y elevation cannot be negative'),
  z: z.number(),
});

export const Size3DSchema = z.object({
  width: z.number().positive('Width must be greater than 0'),
  height: z.number().positive('Height must be greater than 0'),
  depth: z.number().positive('Depth must be greater than 0'),
});

export const BinSlotSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]+-\d{2}-\d{2}$/, 'Bin ID must follow pattern [RACK]-[BAY:2]-[LEVEL:2]'),
  rackId: z.string().min(1),
  bayIndex: z.number().int().positive(),
  levelIndex: z.number().int().positive(),
  relativePosition: Vector3DSchema,
  dimension: Size3DSchema,
  maxWeightKg: z.number().positive().default(1000.0),
  isOccupied: z.boolean().default(false),
});

export const RackEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  type: z.enum(['selective_pallet', 'cantilever', 'shelving']),
  position: Vector3DSchema,
  rotationY: z.number(),
  dimensions: Size3DSchema,
  bays: z.number().int().min(1).max(30),
  levels: z.number().int().min(1).max(12),
  bayWidth: z.number().min(0.8).max(5.0),
  bayDepth: z.number().min(0.5).max(3.0),
  levelHeight: z.number().min(0.5).max(4.0),
  bins: z.array(BinSlotSchema),
});

export const WarehouseBlueprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  gridSnapStep: z.number().default(0.5),
  floorDimensions: Size3DSchema,
  zones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    colorHex: z.string(),
    polygon: z.array(z.object({ x: z.number(), z: z.number() })),
    type: z.enum(['receiving', 'storage', 'picking', 'quarantine', 'shipping']),
  })).default([]),
  structuralElements: z.array(z.object({
    id: z.string(),
    type: z.enum(['wall', 'column', 'dock_door']),
    position: Vector3DSchema,
    dimensions: Size3DSchema,
    rotationY: z.number(),
  })).default([]),
  racks: z.array(RackEntitySchema).default([]),
});

export type ValidatedBlueprint = z.infer<typeof WarehouseBlueprintSchema>;
export type ValidatedRack = z.infer<typeof RackEntitySchema>;
export type ValidatedBin = z.infer<typeof BinSlotSchema>;

```

```

<ElicitationsGroup message="Pondasi spesifikasi (PRD, Architecture, Spatial Model, Interaction Rules, Data Model) telah lengkap. Pilih modul kode pertama yang ingin diimplementasikan:">
  <Elicitation label="Buat Zustand editor store & Command Pattern" query="Tuliskan kode lengkap implementasi Zustand Editor Store untuk 3D Warehouse Builder dengan Command Pattern."/>
  <Elicitation label="Buat komponen ProceduralRack.tsx dengan InstancedMesh" query="Tuliskan kode lengkap komponen React Three Fiber ProceduralRack.tsx menggunakan InstancedMesh."/>
  <Elicitation label="Buat Server Actions persistence saveLayout/loadLayout" query="Tuliskan kode lengkap Server Actions Next.js untuk menyimpan dan memuat blueprint gudang secara atomik ke Neon Postgres via Drizzle."/>
</ElicitationsGroup>

```
