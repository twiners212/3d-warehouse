# SYSTEM SPECIFICATION & PRD: 3D WEB WAREHOUSE LAYOUT BUILDER

**Target:** Autonomous AI Coding Agent / Full-Stack Engineer

**Objective:** Deterministic, end-to-end implementation of an interactive 3D Warehouse Layout Builder & Spatial WMS on the web.

**Tech Stack Baseline:** Next.js (App Router), React Three Fiber / Three.js, Tailwind CSS, Zustand, **Neon Serverless Postgres** (`@neondatabase/serverless`), **Drizzle ORM**, Zod.

---

## 1. Spatial & Coordinate System Conventions

* **Unit Scale:** $1.0\text{ unit} = 1.0\text{ meter}$.
* **Coordinate System:** Right-Handed Cartesian ($Y$-Up).
* $X$-Axis: Horizontal / Warehouse Width (Left $\rightarrow$ Right: $-X \rightarrow +X$).
* $Y$-Axis: Vertical Elevation / Warehouse Height (Floor $\rightarrow$ Ceiling: $0 \rightarrow +Y$).
* $Z$-Axis: Depth / Warehouse Length (Front $\rightarrow$ Back: $-Z \rightarrow +Z$).


* **Rotational Constraints:** Discrete $90^\circ$ increments around the $Y$-axis ($\text{yaw} \in \{0, \frac{\pi}{2}, \pi, \frac{3\pi}{2}\}$ radians).
* **Origin Anchor:** The bottom-left-front corner of the warehouse floor bounding volume is fixed at $(X: 0, Y: 0, Z: 0)$.

---

## 2. Core Data Contracts (TypeScript Schema)

```typescript
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Size3D {
  width: number;   // X-dimension (meters)
  height: number;  // Y-dimension (meters)
  depth: number;   // Z-dimension (meters)
}

export type StructuralItemType = 'wall' | 'column' | 'dock_door' | 'zone';
export type RackType = 'selective_pallet' | 'cantilever' | 'shelving';

export interface BinSlot {
  id: string;             // e.g., "A01-02-03"
  rackId: string;
  bayIndex: number;       // 1-indexed
  levelIndex: number;     // 1-indexed
  relativePosition: Vector3D;
  dimension: Size3D;
  maxWeightKg: number;
  isOccupied: boolean;
}

export interface RackEntity {
  id: string;
  name: string;           // Aisle identifier (e.g., "A01")
  type: RackType;
  position: Vector3D;     // World space position (base center)
  rotationY: number;      // Radians: 0, 1.5708, 3.14159, 4.71239
  dimensions: Size3D;
  bays: number;           // Horizontal bays count
  levels: number;         // Vertical levels count
  levelHeight: number;    // Height per level in meters
  bayWidth: number;       // Width per bay in meters
  bayDepth: number;       // Depth of rack in meters
  bins: BinSlot[];
}

export interface WarehouseZone {
  id: string;
  name: string;
  colorHex: string;
  polygon: Array<{ x: number; z: number }>; // 2D floor footprint
  type: 'receiving' | 'storage' | 'picking' | 'quarantine' | 'shipping';
}

export interface WarehouseLayoutBlueprint {
  id: string;
  name: string;
  floorDimensions: Size3D;
  gridSnapStep: number;   // Default: 0.5
  zones: WarehouseZone[];
  racks: RackEntity[];
  structuralElements: Array<{
    id: string;
    type: StructuralItemType;
    position: Vector3D;
    dimensions: Size3D;
    rotationY: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

```

---

## 3. Database Architecture (Neon Postgres + Drizzle ORM)

Neon provides serverless connection pooling via HTTP/WebSockets. The database uses a hybrid relational + document model: layout metadata and spatial snapshots are indexed relational records, while bin hierarchies are normalized for transactional WMS operations.

### 3.1 Connection Setup (`src/db/index.ts`)

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

```

### 3.2 Drizzle Schema Definition (`src/db/schema.ts`)

```typescript
import { pgTable, text, timestamp, jsonb, real, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const warehouseBlueprints = pgTable('warehouse_blueprints', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gridSnapStep: real('grid_snap_step').default(0.5).notNull(),
  floorDimensions: jsonb('floor_dimensions').$type<{ width: number; height: number; depth: number }>().notNull(),
  zonesData: jsonb('zones_data').$type<any[]>().default([]).notNull(),
  structuralElements: jsonb('structural_elements').$type<any[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const racks = pgTable('racks', {
  id: text('id').primaryKey(),
  blueprintId: text('blueprint_id').notNull().references(() => warehouseBlueprints.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').$type<'selective_pallet' | 'cantilever' | 'shelving'>().notNull(),
  position: jsonb('position').$type<{ x: number; y: number; z: number }>().notNull(),
  rotationY: real('rotation_y').notNull(),
  dimensions: jsonb('dimensions').$type<{ width: number; height: number; depth: number }>().notNull(),
  bays: integer('bays').notNull(),
  levels: integer('levels').notNull(),
  bayWidth: real('bay_width').notNull(),
  bayDepth: real('bay_depth').notNull(),
  levelHeight: real('level_height').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryBins = pgTable('inventory_bins', {
  id: text('id').primaryKey(), // Format: "A01-02-03"
  rackId: text('rack_id').notNull().references(() => racks.id, { onDelete: 'cascade' }),
  blueprintId: text('blueprint_id').notNull().references(() => warehouseBlueprints.id, { onDelete: 'cascade' }),
  bayIndex: integer('bay_index').notNull(),
  levelIndex: integer('level_index').notNull(),
  relativePosition: jsonb('relative_position').$type<{ x: number; y: number; z: number }>().notNull(),
  dimension: jsonb('dimension').$type<{ width: number; height: number; depth: number }>().notNull(),
  maxWeightKg: real('max_weight_kg').default(1000.0).notNull(),
  isOccupied: boolean('is_occupied').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  rackBinIdx: uniqueIndex('rack_bin_idx').on(table.rackId, table.bayIndex, table.levelIndex),
}));

export const blueprintRelations = relations(warehouseBlueprints, ({ many }) => ({
  racks: many(racks),
  bins: many(inventoryBins),
}));

export const rackRelations = relations(racks, ({ one, many }) => ({
  blueprint: one(warehouseBlueprints, { fields: [racks.blueprintId], references: [warehouseBlueprints.id] }),
  bins: many(inventoryBins),
}));

```

---

## 4. Core Engine Subsystems & Logic

### 4.1 Viewport & Camera Controller State Machine

* **Camera Mode Toggle:**
* `MODE_2D_TOPDOWN`: `OrthographicCamera` positioned at $(X: W/2, Y: 100, Z: L/2)$ looking straight down at $(X: W/2, 0, Z: L/2)$. Orbit rotation disabled; only Pan and Zoom enabled.
* `MODE_3D_PERSPECTIVE`: `PerspectiveCamera` with FOV $50^\circ$, `OrbitControls` enabled (Polar angle bounded $0^\circ \le \theta \le 85^\circ$ to prevent clipping below the floor grid).


* **Frustum Culling:** Enabled on all mesh instances.

### 4.2 Procedural Geometry & Rendering Optimization

* **Instancing Requirement:** Use `THREE.InstancedMesh` for structural vertical posts, horizontal support beams, and pallet plates.
* **LOD (Level of Detail):**
* High-LOD (Distance $< 20\text{m}$): Full procedural rack with upright holes and shelf borders.
* Low-LOD (Distance $\ge 20\text{m}$): Simplified bounding box representation with wireframe outlines.



### 4.3 Snapping & Collision Detection Math

1. **Grid Snapping:**

$$X_{\text{snapped}} = \text{round}\left(\frac{X_{\text{raw}}}{\text{gridSnapStep}}\right) \times \text{gridSnapStep}$$


$$Z_{\text{snapped}} = \text{round}\left(\frac{Z_{\text{raw}}}{\text{gridSnapStep}}\right) \times \text{gridSnapStep}$$


2. **Magnetic Edge-to-Edge Alignment:**
* When dragging Object $A$ within distance $\le 0.3\text{m}$ of existing Object $B$, clamp the relevant axis coordinate of Object $A$ to match the bounding plane of Object $B$.


3. **2D AABB Collision Validation (XZ-Plane):**
* Two objects $A$ and $B$ collide if:

$$\vert{}A_x - B_x\vert{} < \frac{A_{\text{width}} + B_{\text{width}}}{2} \quad \text{AND} \quad \vert{}A_z - B_z\vert{} < \frac{A_{\text{depth}} + B_{\text{depth}}}{2}$$


* If collision = `true`: Set placement cursor material to `Color(0xff0000)` with `opacity: 0.5` and disable commit action.



### 4.4 Auto-Naming & Bin Coordinate Engine

When a rack configuration `(bays = B, levels = L)` is committed, the engine generates $B \times L$ bin objects using this deterministic sequence:


$$\text{Bin ID} = \text{Rack.name} + \text{"-"} + \text{String}(b).\text{padStart}(2, \text{'0'}) + \text{"-"} + \text{String}(l).\text{padStart}(2, \text{'0'})$$

* **$b \in [1, B]$:** Bay index from left to right.
* **$l \in [1, L]$:** Level index from bottom to top.

### 4.5 State Management & Command Pattern (Undo/Redo)

All mutations to the `WarehouseLayoutBlueprint` execute via an immutable Command Pattern stack:

```typescript
export interface Command {
  execute: () => void;
  undo: () => void;
}

export interface EditorStore {
  history: Command[];
  historyIndex: number;
  executeCommand: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
}

```

* **History Depth:** Fixed maximum of 30 steps.

---

## 5. Persistence, API & Neon Batching

Mutating complex layouts with hundreds of bins must execute within a single transaction to prevent orphan bins or inconsistent spatial states.

```typescript
// app/actions/save-layout.ts
'use server';

import { db } from '@/db';
import { warehouseBlueprints, racks, inventoryBins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { WarehouseLayoutBlueprint } from '@/types/layout';

export async function persistWarehouseLayout(blueprint: WarehouseLayoutBlueprint) {
  return await db.transaction(async (tx) => {
    // 1. Upsert Blueprint Metadata
    await tx.insert(warehouseBlueprints).values({
      id: blueprint.id,
      name: blueprint.name,
      gridSnapStep: blueprint.gridSnapStep,
      floorDimensions: blueprint.floorDimensions,
      zonesData: blueprint.zones,
      structuralElements: blueprint.structuralElements,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: warehouseBlueprints.id,
      set: {
        name: blueprint.name,
        gridSnapStep: blueprint.gridSnapStep,
        floorDimensions: blueprint.floorDimensions,
        zonesData: blueprint.zones,
        structuralElements: blueprint.structuralElements,
        updatedAt: new Date(),
      },
    });

    // 2. Cascade replace Racks and Bins for atomic consistency
    await tx.delete(racks).where(eq(racks.blueprintId, blueprint.id));
    await tx.delete(inventoryBins).where(eq(inventoryBins.blueprintId, blueprint.id));

    if (blueprint.racks.length > 0) {
      const rackRecords = blueprint.racks.map(r => ({
        id: r.id,
        blueprintId: blueprint.id,
        name: r.name,
        type: r.type,
        position: r.position,
        rotationY: r.rotationY,
        dimensions: r.dimensions,
        bays: r.bays,
        levels: r.levels,
        bayWidth: r.bayWidth,
        bayDepth: r.bayDepth,
        levelHeight: r.levelHeight,
      }));
      await tx.insert(racks).values(rackRecords);

      const allBins = blueprint.racks.flatMap(r => r.bins.map(b => ({
        id: b.id,
        rackId: r.id,
        blueprintId: blueprint.id,
        bayIndex: b.bayIndex,
        levelIndex: b.levelIndex,
        relativePosition: b.relativePosition,
        dimension: b.dimension,
        maxWeightKg: b.maxWeightKg,
        isOccupied: b.isOccupied,
      })));

      if (allBins.length > 0) {
        await tx.insert(inventoryBins).values(allBins);
      }
    }

    return { success: true, blueprintId: blueprint.id };
  });
}

```

---

## 6. Implementation Step Breakdown (Agent Execution Plan)

```
[Phase 1: Environment & Neon DB Setup]
 ├── Configure @neondatabase/serverless and Drizzle ORM in Next.js App Router.
 ├── Execute Drizzle migrations for blueprints, racks, and inventory_bins.
 └── Establish Zustand Store with Blueprint JSON schema and Command Pattern stack.

[Phase 2: Procedural Meshing & Palette UI]
 ├── Implement procedural Rack Mesh Component using InstancedMesh.
 ├── Build Canvas, Floor Grid Plane, and Dual-Camera Controller (2D/3D).
 └── Build HTML/Tailwind Sidebar Palette for dragging items onto the canvas.

[Phase 3: Spatial Interaction & Snapping Engine]
 ├── Implement Pointer Raycasting over the Floor Plane.
 ├── Implement AABB Collision Detector + 0.5m Grid & Edge Snapping.
 └── Integrate Gizmo/TransformControls for item translation and 90-degree rotation.

[Phase 4: Parameter Inspector & Auto-Naming]
 ├── Build Right-Sidebar Properties Inspector (Edit Bays, Levels, Width, Height).
 └── Implement automated Bin Generation and Slot Data synchronization.

[Phase 5: Persistence & Server Actions]
 ├── Write JSON Schema Validation via Zod.
 ├── Implement atomic layout persistence using Neon transactional batch queries.
 └── Add Export/Import handlers for JSON blueprints and CSV bin lists.

```

---

## 7. Edge Cases & Defensive Invariants

* **Out of Bounds Check:** An object cannot be placed if any vertex of its $XZ$ footprint exceeds the warehouse boundary $[0 \le X \le W_{\text{floor}}, 0 \le Z \le L_{\text{floor}}]$.
* **Canvas Unmount / Context Loss:** Canvas WebGL context must cleanly dispose of all geometries and materials on route transitions to prevent browser memory leaks.
* **Batch Mutation Limits:** Keep batch inserts under Neon HTTP payload boundaries by splitting bin records into chunks of 1,000 if layouts exceed 10,000 bins.
* **Zero or Negative Dimension Guard:** All input fields in the Inspector Panel must enforce minimum clamp values: `bays >= 1`, `levels >= 1`, `bayWidth >= 0.8`, `levelHeight >= 0.5`.

---
