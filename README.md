# 3D Warehouse Digital Twin & Spatial WMS

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.182-0496FF?logo=three.js)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/R3F-9.5-purple)](https://r3f.docs.pmnd.rs/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-brown)](https://github.com/pmndrs/zustand)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F)](https://orm.drizzle.team/)
[![Neon Postgres](https://img.shields.io/badge/Neon-Serverless_Postgres-00E599?logo=postgresql)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

A high-performance **3D Warehouse Layout Builder & Spatial Warehouse Management System (WMS)** built for industrial logistics and supply chain digital twins. Design warehouse floors, manipulate procedural racking structures, simulate automated multi-vehicle fleet picking routes, and analyze inventory velocity heatmaps in real-time WebGL.

---

## ✨ Key Features

- **Interactive 3D WebGL Canvas**: 60 FPS hardware-accelerated rendering powered by Three.js and React Three Fiber with perspective, top-down 2D orthographic, and architectural projection views.
- **Procedural Racking & Structural Elements**: Dynamically generate and customize selective pallet racks, cantilever racks, drive-in systems, perimeter walls, dock doors, structural columns, and staging zones.
- **Multi-Floor & Mezzanine Operations**: Multi-tier mezzanine floor support, vertical conveyors, freight lifts, spiral chutes, and active level floor-slicing isolation modes (`ISOLATE`, `GHOST_UPPER`).
- **TSP Route Optimization & Multi-Agent Fleet Simulation**: Dynamic Travelling Salesperson Problem (2-opt TSP) route calculation, multi-vehicle dispatching (Forklifts, AGVs, AMR Carts), and corridor traffic collision avoidance.
- **Enterprise WMS & Spatial Analytics**: Real-time bin occupancy tracking (`Aisle-Bay-Level-Slot`), max load capacity checking ($1{,}000\text{ kg} / \text{slot}$), ABC velocity heatmaps, and REST API routes for external ERP/WMS synchronization.
- **CAD-Grade Editor & Command Pattern**: Marquee box selection, AABB collision detection, face-to-face snapping, grid alignment ($0.5\text{ m} / 1.0\text{ m}$), and infinite transactional Undo / Redo history.
- **Role-Based Access Control (RBAC)**: Secure HTTP-Only session authentication with tiered roles (`ADMIN`, `EDITOR`, `VIEWER`) and audit trail tracking.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Core Framework** | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| **3D Graphics & Math** | Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`) |
| **State Management** | Zustand 5 (Modular state slices + Transactional Command Pattern) |
| **Styling & UI** | Tailwind CSS 3.4, Lucide React Icons |
| **Database & ORM** | Neon Serverless PostgreSQL, Drizzle ORM 0.45 |
| **Validation & Security** | Zod (Runtime schema validation), Bcrypt.js, HTTP-Only Cookie Sessions |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher
- **npm** (or `pnpm` / `yarn`)
- **PostgreSQL Database**: Neon Serverless Postgres or a local PostgreSQL instance

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/3d-warehouse.git
cd 3d-warehouse

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy the template environment file and provide your database credentials:
```bash
cp .env.example .env
```
Inside `.env`:
```env
DATABASE_URL="postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"
WMS_API_KEY="your-wms-secret-key"
```

### 4. Database Migration & Seeding
```bash
# Apply Drizzle database migrations
npm run db:migrate

# Seed default test users (Admin, Editor, Viewer)
npm run db:seed
```

### 5. Running the Application
```bash
# Start local development server (with Turbopack)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

Default seed credentials:
- **Admin**: `admin@warehouse.local` / `admin12345`
- **Editor**: `editor@warehouse.local` / `editor12345`
- **Viewer**: `viewer@warehouse.local` / `viewer12345`

### 6. Production Build
```bash
# Run typechecking
npm run typecheck

# Build optimized production bundle
npm run build

# Start production server
npm run start
```

---

## 📁 Project Structure

```
3d-warehouse/
├── drizzle/              # Drizzle ORM migration files & schema snapshots
├── docs/                 # Detailed technical specifications & manuals
│   ├── architecture.md   # Architectural design, data flow & rendering pipeline
│   ├── data-model.md     # Relational schema & Drizzle ORM tables
│   ├── spatial-model.md  # 3D coordinate mathematics & raycasting
│   └── developer.md      # Engineering guidelines & test suite matrix
├── public/               # Static assets & icons
├── scripts/              # Automated verification & smoke test runners
└── src/
    ├── app/              # Next.js App Router (pages, layouts, Server Actions, API routes)
    │   ├── actions/      # Next.js Server Actions (blueprint persistence & RBAC)
    │   ├── api/wms/      # REST API endpoints for external WMS integration
    │   ├── editor/[id]/  # Interactive 3D layout canvas route
    │   └── login/        # Session authentication page
    ├── components/
    │   ├── canvas/       # 3D R3F components (WarehouseCanvas, ProceduralRack, ZoneFootprint)
    │   ├── editor/       # 2D editor HUD, properties inspector, toolbar, outliner
    │   ├── admin/        # User management & role administration
    │   └── common/       # Shared UI primitives & settings
    ├── engine/           # Decoupled algorithmic engine
    │   ├── commands/     # Command pattern implementations (Undo/Redo)
    │   ├── procedural/   # Procedural rack, bin, and zone geometry generators
    │   ├── routing/      # Spatial A* pathfinding & TSP 2-opt picking optimizer
    │   ├── slotting/     # ABC velocity slotting optimizer
    │   └── spatial/      # AABB collision detection & grid snapping
    ├── hooks/            # Custom React hooks (drag controls, shortcuts, camera)
    ├── lib/              # Auth session logic, Zod validation schemas, i18n
    ├── stores/           # Modular Zustand state slices (blueprint, picking, view)
    ├── styles/           # Global styles and Tailwind design tokens
    └── types/            # TypeScript type and interface definitions
```

---

## 🧪 Testing & Verification

The project includes 26 automated verification test suites covering spatial mathematics, state slice mutations, routing algorithms, and database persistence:

```bash
# Run full verification test suite
npx tsx scripts/verification-test-suite.ts

# Run picking route & TSP optimization tests
npm run test:picking

# Run multi-floor & vertical connector tests
npm run test:multi-floor-ops

# Run fleet multi-agent simulation tests
npm run test:fleet

# Run authentication & RBAC persistence tests
npm run test:rbac
```

---

## 📄 License

MIT License. Designed and engineered for industrial digital twin applications.
