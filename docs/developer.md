# Developer Guide & Engineering Manual: 3D Warehouse Builder

Welcome to the **3D Web Warehouse Layout Builder & Spatial WMS** developer manual. This document provides end-to-end technical guidance for engineers contributing to, extending, or maintaining this codebase.

---

## 1. Developer Prerequisites & Quickstart

### Prerequisites
- **Node.js**: `v20.0.0` or higher (tested on Node.js 20 & 22)
- **Package Manager**: `npm` (v10+), `pnpm` (v9+), or `bun`
- **Database**: A PostgreSQL instance (either [Neon Serverless Postgres](https://neon.tech) or a local Postgres instance)

### Setup Instructions

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repository-url>
   cd 3d-warehouse
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Provide your database connection string in `.env`:
   ```env
   # Remote Neon Serverless Postgres:
   DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

   # Or Local PostgreSQL for offline development:
   # DATABASE_URL="postgresql://postgres:postgres@localhost:5432/warehouse_db"
   ```

3. **Run Database Migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. System Architecture & Component Layers

The application employs a **Decoupled Three-Tier Architecture** that cleanly isolates WebGL 60FPS render loops from React DOM state and database persistence.

```mermaid
graph TD
    subgraph UI_Layer ["React DOM UI Layer (HTML5 / Tailwind CSS)"]
        Toolbar["Toolbar & Mode Switcher"]
        Inspector["Inspector & Rack Properties"]
        Palette["Component Palette (Draggable Racks/Zones)"]
        HUD["Bin HUD, Analytics & Heatmap Tooltips"]
        Tour["Guided Tour & i18n Settings"]
    end

    subgraph State_Layer ["State Management (Zustand)"]
        BlueprintSlice["Blueprint Slice (Racks, Zones, Structures)"]
        SelectionSlice["Selection Slice (Single & Multi-Select)"]
        HistorySlice["History Slice (Command Undo/Redo)"]
        ViewSlice["View Slice (Mode, Heatmaps, Grid)"]
        SettingsStore["Settings Store (Units, i18n, Theme)"]
    end

    subgraph WebGL_Layer ["3D Canvas Layer (Three.js / React Three Fiber)"]
        Scene["Scene & Lighting"]
        CameraBus["Camera Bus (Presets 2D/3D & Focus)"]
        ProceduralMeshes["Procedural Instanced Racks & Bins"]
        SnappingEngine["Spatial Math & Snapping Engine"]
        Raycaster["Pointer & Box Select Raycaster"]
    end

    subgraph Backend_Tier ["Server Tier & Persistence (Next.js & Neon)"]
        AppRouter["Next.js App Router (/api & Server Actions)"]
        DrizzleORM["Drizzle ORM & Zod Validation"]
        NeonDB[("Neon Serverless Postgres / Local Postgres")]
    end

    UI_Layer -->|Dispatches Actions| State_Layer
    State_Layer -->|Subscribes / Reads| UI_Layer
    State_Layer -->|Syncs Reactive State| WebGL_Layer
    WebGL_Layer -->|Dispatches Commands / Selection| State_Layer
    State_Layer -->|JSON Serialization| AppRouter
    AppRouter --> DrizzleORM
    DrizzleORM --> NeonDB
```

---

## 3. State Management & Command Pattern

All spatial and editor interactions flow through **Zustand** using a modular slice pattern located in `src/stores/slices/`.

### Store Slices Overview

| Slice | File | Responsibility |
| :--- | :--- | :--- |
| `blueprintSlice` | [`src/stores/slices/blueprintSlice.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/stores/slices/blueprintSlice.ts) | Warehouse bounds, racks, structural walls/columns, zones, and floor dimensions. |
| `selectionSlice` | [`src/stores/slices/selectionSlice.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/stores/slices/selectionSlice.ts) | Primary selection, multi-selection array, hover states, and drag state. |
| `historySlice` | [`src/stores/slices/historySlice.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/stores/slices/historySlice.ts) | Command stack (`undoStack` and `redoStack`), transaction depth, and history execution. |
| `viewSlice` | [`src/stores/slices/viewSlice.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/stores/slices/viewSlice.ts) | View mode (`3d` / `2d`), heatmap toggles, grid visibility, and metric overlays. |
| `useSettingsStore` | [`src/stores/useSettingsStore.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/stores/useSettingsStore.ts) | Measurement unit (`metric` / `imperial`), language (`en` / `es` / `ja`), snap sensitivity, and theme. |

### Command Pattern Workflow

All mutations to blueprint entities must be executed through an `ICommand` instance to guarantee full Undo/Redo fidelity.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Shortcuts as Shortcuts / UI Handler
    participant Command as ICommand (e.g. MoveEntityCommand)
    participant Store as Zustand Editor Store
    participant History as History Stack

    User->>Shortcuts: Drag Rack / Press Shortcut ('R' Rotate, 'Ctrl+D' Duplicate)
    Shortcuts->>Command: Instantiate Command(entityId, oldVal, newVal)
    Shortcuts->>Store: store.executeCommand(command)
    Store->>Command: command.execute()
    Command->>Store: Apply entity mutation to blueprint state
    Store->>History: Push to undoStack; Clear redoStack
    
    Note over User,History: Undo Action (Ctrl+Z)
    User->>Shortcuts: Press Ctrl+Z
    Shortcuts->>Store: store.undo()
    Store->>History: Pop command from undoStack
    Store->>Command: command.undo()
    Command->>Store: Restore previous entity state
    Store->>History: Push command to redoStack
```

#### Creating a New Command
Implement the `ICommand` interface:
```typescript
export interface ICommand {
  readonly description: string;
  execute(): void;
  undo(): void;
}
```
Register the command in `src/engine/commands/` and dispatch it using `useEditorStore.getState().executeCommand(command)`.

---

## 4. 3D Spatial Engine & Mathematics

The spatial engine (`src/engine/spatial/`) powers real-time snapping, AABB collision detection, and raycasting.

### Coordinate System Conventions
- **Scale**: $1.0\text{ unit} = 1.0\text{ meter}$.
- **Handedness**: Right-Handed Cartesian with $Y$-Up.
  - $+X$: Warehouse width (Left to Right).
  - $+Y$: Warehouse elevation (Floor to Ceiling, $0$ at finished floor level).
  - $+Z$: Warehouse length (Front to Back).
- **Rotations**: Discrete $90^\circ$ increments around the vertical $Y$-axis ($\text{yaw} \in \{0, \frac{\pi}{2}, \pi, \frac{3\pi}{2}\}$ radians).
- **Origin Anchor**: $(0, 0, 0)$ is fixed at the front-left bottom corner of the warehouse perimeter.

### Snapping & Collision Pipeline (`snapping.ts`)
When dragging entities in 3D:
1. **Grid Snap**: Snaps coordinates to user-defined grid increments (e.g., $0.5\text{ m}$ or $1.0\text{ m}$).
2. **Edge & Face Snapping**: Calculates distance to adjacent rack faces and snaps when within the snapping threshold ($0.3\text{ m}$).
3. **Boundary Clamping**: Clamps bounding boxes inside the warehouse floor boundaries `[0, floor.width]` and `[0, floor.length]`.
4. **Collision Detection (AABB)**: Checks for overlapping Axis-Aligned Bounding Boxes with structural walls, columns, and other racks to prevent invalid placements.

---

## 5. Database Schema & Migrations (Drizzle ORM)

The application utilizes a **hybrid relational-document model** implemented with Drizzle ORM in [`src/db/schema.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/db/schema.ts):

### Tables & Relationships
1. **`warehouse_blueprints`**:
   - Stores blueprint metadata, grid snap step, floor dimensions (JSONB), zones data (JSONB), and structural elements (JSONB).
2. **`racks`**:
   - Normalized rack entities linked via `blueprintId` (Cascade delete). Stores 3D position (JSONB), dimensions (JSONB), rotation, bay counts, and level heights.
3. **`inventory_bins`**:
   - Normalized bin slots linked to both `rackId` and `blueprintId`. Stores slot codes (e.g. `A01-02-03`), bay/level indices, relative 3D positions, max weight capacity, SKU metadata, and occupancy flags.

### Running Migrations
The migration runner [`src/db/migrate.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/db/migrate.ts) automatically detects your environment:
- For remote Neon connections, it uses `@neondatabase/serverless` with the Neon HTTP migrator.
- For local connections (`localhost` or `127.0.0.1`), it uses `pg` (`node-postgres`).

```bash
# Generate SQL migration files from schema changes:
npm run db:generate

# Execute pending migrations against the database:
npm run db:migrate
```

---

## 6. Complete Verification & Smoke Test Suite

The project includes 13 deterministic smoke and integration test scripts in `scripts/`. These can be executed standalone without launching the Next.js web server.

### Smoke Tests Matrix

| Script Command | Target Script | What It Tests & Verifies |
| :--- | :--- | :--- |
| `npm run test:smoke` | [`scripts/smoke-store.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-store.ts) | Zustand store initialization, room size updates, adding/updating racks, and basic state mutations. |
| `npm run test:snapping` | [`scripts/smoke-snapping.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-snapping.ts) | Spatial snap engine: 2D/3D AABB calculations, face-to-face snap thresholds, and floor boundary clamping. |
| `npm run test:persistence` | [`scripts/smoke-persistence.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-persistence.ts) | Full round-trip serialization and deserialization between Zustand state and Drizzle schema structures. |
| `npm run test:wms` | [`scripts/smoke-bins-wms.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-bins-wms.ts) | Bin slot generation, bay/level coordinate math, occupancy toggles, and weight capacity validations. |
| `npm run test:heatmap` | [`scripts/smoke-heatmap-analytics.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-heatmap-analytics.ts) | Heatmap generation, pick-frequency calculations, velocity tiers (Fast/Medium/Slow), and occupancy analytics. |
| `npm run test:hitboxes` | [`scripts/smoke-selection-hitboxes.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-selection-hitboxes.ts) | Raycast hit detection, 3D bounding boxes, multi-level rack selection, and tolerance thresholds. |
| `npm run test:direct-drag` | [`scripts/smoke-direct-drag-focus.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-direct-drag-focus.ts) | Direct drag gesture handlers, pointer raycast projection on the ground plane, and camera focus events. |
| `npm run test:multi-select` | [`scripts/smoke-multi-selection.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-multi-selection.ts) | Multi-entity selection, marquee box select math, bulk rotation, bulk duplicate, and bulk delete commands. |
| `npm run test:templates` | [`scripts/smoke-templates-telemetry.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-templates-telemetry.ts) | Preset warehouse templates (E-commerce Fulfillment, Cold Storage, Bulk Distribution) and telemetry events. |
| `npm run test:tour` | [`scripts/smoke-guided-tour.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-guided-tour.ts) | Onboarding guided tour state machine: step transitions, target element tracking, and completion persistence. |
| `npm run test:settings` | [`scripts/smoke-settings-i18n.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-settings-i18n.ts) | Settings store: metric/imperial unit conversions, UI theme switching, and localization strings (EN, ES, JA). |
| `npm run test:e2e` | [`scripts/seed-e2e-blueprint.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/seed-e2e-blueprint.ts) & [`scripts/e2e-new-blueprint.mjs`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/e2e-new-blueprint.mjs) | Seeds an E2E test blueprint into the database and executes a headless Playwright browser test. |
| `npx tsx scripts/smoke-room-rename.ts` | [`scripts/smoke-room-rename.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/scripts/smoke-room-rename.ts) | Validates blueprint renaming, title synchronization, and audit timestamp tracking. |

### Running All Unit & Smoke Tests
```bash
# Run individual smoke test:
npm run test:smoke

# Run complete verification battery:
npm run test:snapping && npm run test:wms && npm run test:heatmap && npm run test:multi-select && npm run test:settings
```

---

## 7. Performance Guidelines for 3D & React

1. **Keep WebGL Loops Free of React DOM Rerenders**:
   - Never call `setState` inside Three.js `useFrame` callbacks.
   - Use `useEditorStore.getState()` for non-reactive reads inside high-frequency animation loops.
   - Subscribe selectively using Zustand selectors: `const mode = useEditorStore(s => s.viewMode)`.

2. **Procedural Instanced Meshes**:
   - Individual pallet positions and bin slots use `InstancedMesh` where possible to minimize WebGL draw calls when rendering hundreds of racks simultaneously.

3. **Strict Validation with Zod**:
   - All external JSON imports and database queries must be parsed through the Zod schemas defined in `src/types/` before updating Zustand state.

---

## 8. Directory Reference

```
3d-warehouse/
├── scripts/                      # 13 deterministic smoke test scripts & E2E runners
├── drizzle/                      # Generated SQL migrations
├── src/
│   ├── app/                      # Next.js App Router (Dashboard & Editor routes)
│   ├── components/
│   │   ├── canvas/               # Three.js / React Three Fiber canvas & 3D objects
│   │   ├── editor/               # Toolbar, Inspector, Shortcuts, Drag-Drop UI
│   │   ├── dashboard/            # Warehouse blueprint cards, creation modal
│   │   └── common/               # Modals, HUD overlays, tooltips
│   ├── db/                       # Drizzle schema, DB client, migration runner
│   ├── engine/
│   │   ├── commands/             # Command pattern implementations (Undo/Redo)
│   │   ├── procedural/           # 3D geometry builders for Racks, Bins, Zones
│   │   └── spatial/              # Snapping math, AABB collision, raycasting
│   ├── hooks/                    # Custom React hooks (canvas resize, tour, camera)
│   ├── lib/                      # Camera bus, telemetry, unit conversions
│   ├── stores/                   # Zustand stores and slice implementations
│   └── types/                    # TypeScript interfaces & Zod validation schemas
├── ARCHITECTURE.md               # Deep system architecture & data contracts
├── DATA-MODEL.md                 # Complete database schema & indexing strategy
├── DEVELOPER.md                  # This file
├── INTERACTION-SPECIFICATION.md   # UX interactions & keyboard shortcut bindings
├── PRD.md                        # Product requirements & specifications
└── SPATIAL-MODEL.md              # 3D spatial conventions & math proofs
```
