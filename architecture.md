# Architecture & System Design: 3D Warehouse Digital Twin

This document defines the software architecture, design patterns, spatial engine pipelines, data flow, and directory structure for the 3D Warehouse Layout Builder & Spatial WMS.

---

## 1. High-Level System Architecture

The application adopts a **Decoupled Layered Architecture** separating high-frequency 60 FPS WebGL rendering loops from React DOM component lifecycles and the serverless persistence tier.

```
+-------------------------------------------------------------------------------+
|                               NEXT.JS CLIENT                                  |
|                                                                               |
|  +-------------------------------------+  +--------------------------------+  |
|  |       REACT DOM LAYER (HTML/CSS)    |  |     WEBGL CANVAS LAYER (R3F)   |  |
|  | - TopNavToolbar (Mode, Undo, Redo)  |  | - Perspective / Orthographic   |  |
|  | - PropertiesInspector (Parametric)  |  | - Procedural InstancedMesh     |  |
|  | - PickingPlaybackDock & Outliner    |  | - Floor Raycaster & Snapping   |  |
|  | - WmsDataHubModal & Analytics       |  | - Three.js Spatial Transform   |  |
|  +-------------------------------------+  +--------------------------------+  |
|                     \                                     /                   |
|                      +-----------------+-----------------+                    |
|                                        |                                      |
|                    +---------------------------------------+                  |
|                    |       ZUSTAND UNIFIED STATE STORE     |                  |
|                    | - BlueprintSlice (Racks, Levels, Zones|                  |
|                    | - PickingSlice (TSP Orders, Fleet AGV)|                  |
|                    | - HistorySlice (ICommand Undo/Redo)   |                  |
|                    | - SelectionSlice & ViewSlice          |                  |
|                    +---------------------------------------+                  |
+----------------------------------------|--------------------------------------+
                                         | Server Actions / REST Payloads
                                         v
+-------------------------------------------------------------------------------+
|                           NEXT.JS SERVER / API TIER                           |
|  - Server Actions: getWarehouseLayout, persistWarehouseLayout, deleteLayout   |
|  - REST API Routes: POST /api/wms/sync, GET /api/wms/inventory                |
|  - Middleware Auth: HTTP-Only Session Cookie verification & RBAC Enforcement  |
|  - Zod Validation: WarehouseBlueprintSchema, WmsSyncPayloadSchema            |
+----------------------------------------|--------------------------------------+
                                         | Neon HTTP Driver (@neondatabase/serverless)
                                         v
+-------------------------------------------------------------------------------+
|                         NEON SERVERLESS POSTGRESQL                            |
|  - warehouse_blueprints (Metadata, building_levels, picking_config)           |
|  - racks (Spatial coordinates, dimensions, bay/level configs)                 |
|  - inventory_bins (Normalized bin slots, SKU metadata, occupancy)             |
|  - users & sessions (RBAC identities, bcrypt hashed credentials)              |
+-------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```
3d-warehouse/
├── drizzle/                    # Drizzle ORM migration files & schema snapshots
├── docs/                       # Technical specifications & design manuals
│   ├── data-model.md           # Relational PostgreSQL & Drizzle schema specs
│   ├── spatial-model.md        # 3D coordinate geometry & raycasting formulas
│   └── developer.md            # Comprehensive developer manual & test matrix
├── public/                     # Static icons & assets
├── scripts/                    # Automated smoke test & verification suite
└── src/
    ├── app/                    # Next.js 16 App Router
    │   ├── actions/            # Server Actions (layout-actions.ts)
    │   ├── api/wms/            # REST API endpoints (/inventory, /sync)
    │   ├── editor/[id]/        # 3D Canvas Editor route
    │   ├── admin/users/        # User role administration route
    │   ├── login/              # Session authentication route
    │   ├── layout.tsx          # Root layout & font injection
    │   └── page.tsx            # Warehouse dashboard & facility selector
    ├── components/
    │   ├── canvas/             # React Three Fiber 3D scene components
    │   │   ├── WarehouseCanvas.tsx
    │   │   ├── CameraController.tsx
    │   │   ├── ProceduralRack.tsx
    │   │   ├── ZoneFootprint.tsx
    │   │   ├── FleetVehicles.tsx
    │   │   └── PickingRouteOverlay.tsx
    │   ├── editor/             # 2D editor HUD & panels
    │   │   ├── ui/             # TopNavToolbar, PropertiesInspector, SceneOutliner
    │   │   └── picking/        # PickingToolbarHUD, PickingPlaybackDock
    │   ├── admin/              # User management tables & role toggles
    │   └── common/             # Settings, modals & shared UI widgets
    ├── db/                     # Drizzle ORM configuration & PostgreSQL client
    ├── engine/                 # Pure domain & algorithmic engines
    │   ├── commands/           # Command Pattern implementations (Undo/Redo)
    │   ├── procedural/         # Procedural mesh & bin generators
    │   ├── routing/            # Spatial A* pathfinding, TSP 2-opt, TrafficController
    │   ├── slotting/           # ABC velocity slotting optimizer
    │   └── spatial/            # AABB collision & snapping math
    ├── hooks/                  # Custom React hooks (useDirectEntityDrag, etc.)
    ├── lib/                    # Auth, i18n, validations, placement-bus
    ├── stores/                 # Modular Zustand slices (blueprint, picking, history)
    ├── styles/                 # Global CSS & Tailwind design tokens (globals.css)
    └── types/                  # TypeScript interface definitions
```

---

## 3. Core Engine Subsystems

### 3.1 Procedural Instanced Rendering
To achieve consistent 60 FPS performance when rendering facilities with over 10,000 inventory bins:
- Racks are decomposed into structural elements (vertical upright columns, horizontal crossbeams, and wire decks).
- Elements are batched into `THREE.InstancedMesh` nodes.
- Transformations are computed mathematically and written directly into instance transformation matrices, reducing draw calls from several thousand to $\le 50$ per frame.

### 3.2 Multi-Floor & Vertical Routing Architecture
- Facilities support multiple building levels (`buildingLevels`: Ground, Mezzanine, Upper Deck).
- Floor slicing modes allow isolated viewing (`ISOLATE`) or ghosted upper floor visualization (`GHOST_UPPER`).
- Vertical transit is handled through physical connectors (freight lifts, vertical conveyors, and spiral chutes) with dynamic transition waypoint generation.

### 3.3 TSP 2-Opt & Fleet Traffic Coordination
- Pick orders are sequenced using a combination of Nearest Neighbor heuristics and 2-opt local search optimization to minimize picker travel distance.
- Multi-agent fleet simulations coordinate multiple automated guided vehicles (AGVs), forklifts, and AMR carts.
- The `TrafficController` handles corridor conflicts, right-of-way assignment, and deadlock prevention by prioritizing stationary/loading units over moving traffic.

### 3.4 Transactional Command Pattern (Undo / Redo)
All mutations in the 3D editor implement the `ICommand` interface:
```typescript
export interface ICommand {
  execute(): void;
  undo(): void;
  description?: string;
}
```
Commands store inverted deltas, allowing users to reverse and replay complex multi-object operations, bulk deletions, procedural regenerations, and zone duplicate actions without state corruption.

---

## 4. Security & Data Integrity

- **Session Authentication**: Cryptographically random 32-byte tokens stored in Neon PostgreSQL with 24-hour expiration, delivered via HTTP-Only, SameSite cookies.
- **Role-Based Access Control**:
  - `ADMIN`: Full system access, user administration, layout creation, modification, and deletion.
  - `EDITOR`: Layout creation, modification, and persistence with author audit trails.
  - `VIEWER`: Read-only 3D inspection and picking route observation.
- **Atomic Cascade Persistence**: Layout updates replace topology in a single atomic transaction or sequentially ordered idempotent batches, ensuring rack and bin counts always match spatial geometries.
