# Progress Report — 3D Warehouse Layout Builder & Spatial WMS

**Tanggal:** 8 Oktober 2026
**Fase Aktif:** ✅ Semua fase core + enterprise features selesai (**Phase 1–44: Full Core, Multi-Floor, Fleet, WMS Sync, In-App Guidance, & Audit Quality Hardening**)
**Status Keseluruhan:** 🟢 PRODUCTION-READY (ENTERPRISE GRADE) — Digital Twin 3D Warehouse OS lengkap dengan 0 TypeScript Errors, 0 ESLint Errors, 100% Passing Test Suites, Skema Database Neon Cloud Termigrasi, Click-to-Split Interactive 3D Waypoint Creation, Multi-Agent Fleet Simulation (1–6 Unit Armada, VRP Capacity & Spatial Clustering Partitioning), Dynamic Traffic Controller (Radar Cone Proximity, Hierarchy Priority Yielding Forklift > AGV > Cart, Traffic Alerts), Battery Energy Lifecycle & Charging Dock Integration, 3D Camera Follow-Cam tracking, Tabbed Fleet Manager Drawer, WMS Simulation & Dynamic Slotting Optimizer, Analytics Heatmaps, Multi-Selection, 4 Industry Templates, 9-Step Guided Spotlight Tour, Dual Language (ID/EN) & Themes, Multi-Floor Mezzanine Vertical Layers & Z-Elevation Routing, dan Strict Command Pipeline Undo/Redo.

---

## ✅ 1. Verifikasi Spesifikasi (Selesai)

Keenam dokumen spesifikasi telah dibaca dan di-cross-reference:

| Dokumen | Status | Catatan |
|---|---|---|
| `PRD.md` | ✅ | Kontrak data TS, DB architecture, engine subsystems |
| `ARCHITECTURE.md` | ✅ | Directory tree, Command Pipeline, Instancing rules |
| `SPATIAL-MODEL.md` | ✅ | Y-Up, pivot Bottom-Center, AABB/OBB math |
| `INTERACTION-SPECIFICATION.md` | ✅ | FSM editor, raycast priority, snapping pipeline |
| `DATA-MODEL.md` | ✅ | Drizzle schema + index + Zod contracts |
| `Agent.md` | ✅ | Guardrails keamanan & DoD checklist |

**Temuan verifikasi:**
- Workspace awal hanya berisi 6 file spec → seluruh scaffold harus dibuat dari nol.
- Discrepancy terdeteksi: `PRD.md §3.2` memakai `$type<any[]>()`; mengikuti versi **DATA-MODEL.md §5 yang typed** demi invariant zero-`any`.
- Catatan arsitektural: driver `neon-http` tidak mendukung interactive `db.transaction()` → persistence akan pakai batch semantics / chunked statements pada Phase 5.

---

## ✅ 2. Scaffold Proyek (Selesai)

- Next.js **16.3.2** (App Router) + TypeScript strict + ESLint 9, `src/` dir, alias `@/*`.
- **Tailwind CSS 3.4.19** dikonfigurasi manual (`tailwind.config.ts`, `postcss.config.mjs`, directives di `globals.css`) sesuai requirement.
- Dependencies ter-pin & ter-install:

| Paket | Versi |
|---|---|
| `three` + `@types/three` | 0.182.0 |
| `@react-three/fiber` | 9.5.0 |
| `@react-three/drei` | 10.7.6 |
| `zustand` | 5.0.10 |
| `drizzle-orm` | **0.45.2** (patch security) |
| `@neondatabase/serverless` | 1.0.2 |
| `zod` | 4.1.13 |
| `drizzle-kit`, `tsx`, `dotenv` | dev |

- 🔒 **Security fix:** audit menemukan SQL injection advisory di `drizzle-orm@0.45.1` → di-upgrade ke 0.45.2. Prod deps kini **0 vulnerabilities** (sisa advisory dev-only dari toolchain drizzle-kit).

---

## ✅ 3. Types Layer (Selesai)

| File | Isi |
|---|---|
| `src/types/spatial.ts` | `Vector2D/Vector3D`, `Size3D`, `Footprint`, `WarehouseBounds` |
| `src/types/layout.ts` | `RackEntity`, `BinSlot`, `WarehouseZone`, `StructuralElement`, `WarehouseLayoutBlueprint` |
| `src/types/commands.ts` | `ICommand { execute, undo }` + konstanta depth history 30 |
| `src/types/interaction.ts` | `EditorInteractionMode`, `DraggedPaletteItem`, `InteractionState` |

---

## ✅ 4. Validation & Constants Layer (Selesai)

- `src/lib/validations/layout-schema.ts` — Zod schemas lengkap (bin ID regex `[A-Z0-9]+-\d{2}-\d{2}`, clamp bays ≤30 / levels ≤12 / bayWidth ≥0.8).
- `src/lib/constants/warehouse-defaults.ts` — grid snap 0.5m, magnetic threshold 0.3m, epsilon kolisi 0.001, batch chunk 1000 bin, warna ghost preview valid/invalid.

---

## ✅ 5. Database Layer (Selesai — **Neon production aktif**, migrasi applied)

- `src/db/index.ts` — Neon HTTP driver + Drizzle instance. **(26 Agu 2026)** kini driver-agnostik: `localhost/127.0.0.1` → node-postgres Pool, remote → Neon HTTP (zero behavior change untuk prod).
- `src/db/schema.ts` — 3 tabel (`warehouse_blueprints`, `racks`, `inventory_bins`) dengan FK cascade + 4 index dari DATA-MODEL §4 (termasuk unique `uq_rack_bay_level`), JSONB typed (zero `any`).
- `src/db/migrate.ts` — programmatic migration runner, driver-agnostik + dotenv autoload.
- `drizzle.config.ts`, `.env.example`, npm scripts: `db:generate`, `db:migrate`, `typecheck`.
- **Neon production (26 Agu 2026):** `.env` memakai pooled Neon URL; migrasi `0000_clever_nekra.sql` applied — round-trip persistence verified (lihat §12). Dummy Docker lokal (`warehouse-db-local`) tidak lagi diperlukan dan bisa dihapus.

---

## ✅ 6. State Management Layer (Selesai)

- `src/stores/slices/historySlice.ts` — Command stack undo/redo, truncation redo-tail, cap 30 langkah. **(31 Agu 2026)** ditambahkan `isDirty`, `markSaved()`, `setIsDirty()` untuk unsaved changes tracking.
- `src/stores/slices/blueprintSlice.ts` — mutator immutable racks/zones/meta; `loadBlueprint` kini mereset `isDirty=false` + clears history.
- `src/stores/slices/selectionSlice.ts` — FSM mode, single-entity selection, snapping toggle.
- `src/stores/useEditorStore.ts` — komposisi ketiga slice.

---

## ✅ 7. Engine Foundations (Selesai)

- `src/engine/procedural/bin-generator.ts` — deterministic bin ID + koordinat lokal per SPATIAL-MODEL §4.
- `src/engine/spatial/spatial-math.ts` — `snapToGrid`, `getEffectiveDimensions`, `checkAABBCollision`, `isWithinWarehouseBounds`, `calculateLocalToWorld`, `nextRotationStep`.
- Commands: `Command.ts`, `AddEntityCommand.ts`, `MoveEntityCommand.ts`, `UpdateRackConfigCommand.ts` (snapshot-lazy + regen bins), `RemoveEntityCommand.ts`.

---

## ✅ 8. Penyelesaian TypeScript & Lint Awal (Selesai 26 Agu 2026)

- Perbaikan hasil `tsc --noEmit` pertama:
  - `LayoutProps<"/">` di layout.tsx → diganti `{ children: React.ReactNode }` ✅ fixed
  - patch type `updateRackConfig` kurang `dimensions` ✅ fixed
  - implicit `any` pada callback `set()` di slices → ✅ fixed: `StateCreator<any>` diganti tipe gabungan `EditorStore` di `src/stores/editor-store.ts` — zero-`any`, `tsc --noEmit` + ESLint bersih

---

## ✅ 9. Phase 1 Verification Gate & DB Migration (Selesai 26 Agu 2026)

1. ~~Fix type errors tersisa~~ ✅ `tsc --noEmit` bersih (0 errors).
2. ~~`next build` sukses sebagai verification gate~~ ✅ build sukses (Next 16.3.2 Turbopack — compile + typecheck + static pages OK).
3. ~~Generate + apply Drizzle migrations~~ ✅ selesai via DB runner (lihat §5).
4. ~~Smoke test store~~ ✅ ALL PASSED — `npm run test:smoke` (`scripts/smoke-store.ts`): add/move/update/remove + undo/redo, regen bins (15 bin), redo-tail truncation, history cap 30.

---

## ✅ 10. Phase 2 — Procedural Meshing & Palette UI (26 Agu 2026)

| File | Isi |
|---|---|
| `src/engine/procedural/rack-geometry.ts` | Matrix builders uprights/beams/decks (ARCHITECTURE §4.1) — 3 draw call per rack |
| `src/stores/slices/viewSlice.ts` | `cameraMode` (ORTHO_2D/PERSP_3D) + toggle grid; ter-wire ke `EditorStore` |
| `src/components/canvas/ProceduralRack.tsx` | 3× `InstancedMesh` + `setMatrixAt`, hover/select handlers, memoized per config |
| `src/components/canvas/CameraController.tsx` | Dual camera: OrbitControls 3D / top-down locked 2D; shortcut `2/V`,`3/B` |
| `src/components/canvas/WarehouseFloor.tsx` | Floor mesh + boundary outline + gridHelper snap-step, click-to-deselect |
| `src/components/canvas/WarehouseCanvas.tsx` | R3F Canvas root: lights, floor, racks, camera controller |
| `src/components/editor/ui/SidebarPalette.tsx` | HTML5 drag palette (3 tipe rack) → `setDraggedItem` |
| `src/components/editor/EditorLayout.tsx` | Split container palette + canvas |

**Verifikasi:** `tsc` ✅ · ESLint ✅ · smoke test ALL PASSED ✅ · `next build` ✅ · dev server HTTP 200 + palette rendered ✅.

**Catatan:** Ghost preview drop→AddEntityCommand (raycast+snap+collision) adalah scope Phase 3 sesuai PRD §6; drag dari palette sudah men-set `draggedItem` di store.

---

## ✅ 11. Phase 3 — Spatial Interaction & Snapping Engine (26 Agu 2026)

| File | Isi |
|---|---|
| `src/engine/spatial/raycasting.ts` | Pointer client coords → world floor point (ray ∩ plane Y=0) |
| `src/engine/spatial/snapping.ts` | Pipeline 3 langkah: grid → magnetic edge (≤0.3m) → boundary clamp + gate validitas §5.1 |
| `src/engine/commands/RotateEntityCommand.ts` | Rotasi diskrit +90° undoable |
| `src/engine/procedural/naming.ts` | Auto-naming aisle "A01…" deterministik (reuse-safe setelah delete) |
| `src/lib/placement/placement-bus.ts` | Bus transient drag HTML→canvas tanpa re-render 60Hz |
| `src/components/canvas/CameraBridge.tsx` | Registrasi camera+rect untuk konversi drop DOM→world |
| `src/components/canvas/PlacementPreview.tsx` | Ghost mesh hijau/merah live (§5.1), dispose material saat unmount |
| `src/components/canvas/TransformGizmo.tsx` | Translate gizmo: snap live, invalid → revert tanpa command, commit MoveEntityCommand saat valid |
| `src/components/editor/useEditorShortcuts.ts` | R/Delete/Esc/Ctrl+Z/Ctrl+Y (+skip input fields) |
| `EditorLayout.tsx` | Drop target HTML5 → AddEntityCommand + auto bins + select |

**Verifikasi:** `tsc` ✅ · ESLint ✅ · smoke store ALL PASSED ✅ · **smoke snapping ALL PASSED** (`npm run test:snapping`) ✅ · build sebelumnya ✅.

---

## ✅ 12. Phase 5 — Persistence & Server Actions (26 Agu 2026)

**Database dirombak ke Neon production** (user-supplied pooled URL, sslmode+channel_binding). Dummy Docker lokal tidak lagi dipakai.

| File | Isi |
|---|---|
| `src/db/index.ts` | + `supportsTransactions` flag — neon-http TIDAK support `db.transaction()` → fallback batch semantics (sesuai catatan Phase 1) |
| `src/app/actions/layout-actions.ts` | Server actions: `persistWarehouseLayout` (Zod gate → upsert meta → cascade replace racks+bins → chunk insert 1000), `getWarehouseLayout` (reassemble racks+bins), `listWarehouseLayouts`, `deleteWarehouseLayout` |
| `src/lib/io/blueprint-io.ts` | Export JSON blueprint, Export CSV bin list (13 kolom WMS), Import JSON via Zod gate yang sama |
| `src/components/editor/ui/TopNavToolbar.tsx` | Save / Undo / Redo / Export JSON / Export CSV |
| `src/components/editor/EditorLayout.tsx` | Load blueprint dari Neon saat mount; loading/error state |
| `src/app/editor/[id]/page.tsx` | Route editor (`params: Promise` sesuai Next 16 docs) |
| `src/app/page.tsx` + `DashboardClient.tsx` | Dashboard: list blueprint (rack/bin count, updated), New, Delete, Import JSON |

**Verifikasi:** `npm run test:persistence` **ALL PASSED di Neon** ✅ (Zod reject, save, reload reassemble, cascade replace, counts, delete) · tsc ✅ · ESLint ✅ · build ✅ (routes `/` dan `/editor/[id]` dynamic ƒ) · runtime HTTP 200 dashboard+editor dengan query Neon live ✅.

---

## ✅ 13. Phase 4 — Properties Inspector (26 Agu 2026, menyusul setelah Phase 5)

| File | Isi |
|---|---|
| `src/components/editor/ui/PropertiesInspector.tsx` | Panel parametrik rack terpilih: bays/levels/bayWidth/bayDepth/levelHeight dengan clamp PRD §7; tombol Rotate 90°; validasi pra-commit (`isValidPatch`/`isValidRotation`) — perubahan yang akan collision/out-of-bounds ditolak + warning "Cannot …: space obstructed" auto-hide; bin count preview; semua commit via ICommand (undoable) |

**Verifikasi:** tsc ✅ · ESLint ✅ · build ✅.

---

## ✅ 14. Bugfix: Editor stuck di "Loading blueprint…" (26 Agu 2026)

- **Root cause:** React 18 StrictMode double-invokes effects saat dev. Guard `loadedRef` membatalkan run pertama (via `cancelled`) sambil memblokir run kedua → `getWarehouseLayout` tidak pernah selesai diterapkan ke store.
- **Fix:** hapus ref-guard; load per-`blueprintId` idempoten dengan flag `cancelled` standar + try/catch.
- **Verifikasi E2E browser (Playwright):** `npm run test:e2e` — seed blueprint → buka `/editor/{id}` → loading detached → "Asset Palette" visible ✅ PASS.

---

## ✅ 15. Bugfix: SSR Hydration Mismatch (31 Agu 2026)

- **Root cause:** `DashboardClient.tsx` memanggil `toLocaleString()` pada timestamp — hasil server vs client bisa berbeda → React hydration mismatch error.
- **Fix:** Tambahkan `suppressHydrationWarning` pada elemen `<span>` yang memuat output `toLocaleString()`.
- **Verifikasi:** Browser load tanpa hydration error ✅.

---

## ✅ 16. Palette Click-to-Add & Drag-and-Drop (31 Agu 2026)

- **Fitur:** Menambahkan tombol `+ Add` pada setiap item palette untuk click-to-place selain drag-and-drop.
- Auto-placement algorithm (`findAvailablePlacementPosition`) untuk menemukan lokasi kosong pertama di lantai gudang.
- Toast notification feedback saat asset berhasil ditambahkan.

---

## ✅ 17. Room Dimensions Editor & Presets (31 Agu 2026)

- **Fitur:** Menambahkan kontrol edit dimensi ruangan (Width, Depth, Ceiling Height) di Properties Inspector saat tidak ada entity yang dipilih.
- Preset Quick-Sizes: Small (30×20m), Medium (60×40m), Large (100×60m).
- Floor Dimension Command (`createSetFloorDimensionsCommand`) dengan undo/redo support.
- Grid snap step editing dan real-time 3D floor resize.

---

## ✅ 18. Expanded Asset Catalogue — 15 Asset Types (31 Agu 2026)

Ekspansi besar-besaran asset palette menjadi 3 kategori accordion dengan 15 tipe asset industrial:

### Storage Racking (7 tipe)
| Tipe | Material Theme |
|---|---|
| Selective Pallet Rack | Royal Blue & Safety Orange |
| Double-Deep Pallet Rack | Deep Blue & Amber |
| Drive-In Bulk Rack | Ruby Red & Coral |
| Push-Back Gravity Rack | Teal & Cyan |
| Cantilever Rack | Industrial Yellow |
| Multi-Tier Shelving | Galvanized Zinc |
| Mezzanine Platform Deck | Charcoal Steel |

### Facility Structures (4 tipe)
| Tipe | Deskripsi 3D |
|---|---|
| Concrete Wall Segment | Dinding beton dengan dimensi konfigurabel |
| Structural Pillar Column | Kolom tiang dengan pelat dasar |
| Overhead Dock Door | Pintu muat industri dengan frame peringatan kuning |
| Safety Bollard | Bollard pelindung kuning dengan garis hitam reflektif |

### Operational Floor Zones (4 tipe)
| Tipe | Warna Default |
|---|---|
| Receiving Inbound Zone | Emerald Green |
| Shipping Outbound Zone | Sky Blue |
| Staging & Picking Lane | Amber Yellow |
| Quarantine & QC Area | Rose Red |

**File baru & modifikasi:**

| File | Isi |
|---|---|
| `src/types/layout.ts` | Expanded `RackType` (7), `StructuralItemType` (4), `WarehouseZone` (dengan spatial bounds) |
| `src/lib/validations/layout-schema.ts` | Zod schemas untuk semua tipe baru |
| `src/engine/commands/StructuralCommands.ts` | **[NEW]** Add/Remove/Move/Rotate/Update commands untuk structural elements |
| `src/engine/commands/ZoneCommands.ts` | **[NEW]** Add/Remove/Move/Update commands untuk operational zones |
| `src/components/canvas/ProceduralStructure.tsx` | **[NEW]** 3D meshes: walls, columns, dock doors, bollards |
| `src/components/canvas/ZoneFootprint.tsx` | **[NEW]** Floor zones dengan fill transparan, edge rings, HUD label badges |
| `src/components/canvas/ProceduralRack.tsx` | Industrial material themes per rack type + selection outline |
| `src/components/canvas/WarehouseCanvas.tsx` | Render ketiga entity types (zones, structures, racks) |
| `src/components/canvas/TransformGizmo.tsx` | Multi-entity transform (racks + structures + zones) |
| `src/engine/procedural/naming.ts` | ID & name generators untuk structures dan zones |
| `src/components/editor/ui/SidebarPalette.tsx` | 3-section collapsible accordion, 15 item asset |
| `src/components/editor/ui/PropertiesInspector.tsx` | Contextual inspector: Rack config, Structure dimensions, Zone category/color/area |
| `src/components/editor/EditorLayout.tsx` | Placement routing + toast untuk semua 15 tipe asset |
| `src/stores/slices/blueprintSlice.ts` | State mutators untuk structural elements dan zones |

**Verifikasi:** Browser E2E test ✅ — semua 3 accordion expand/collapse, 15 asset types dapat ditambahkan, diinspeksi, diubah warnanya, di-move, di-rotate, dan dihapus.

---

## ✅ 19. Delete Confirmation Dialog & Unsaved Changes Guard (31 Agu 2026)

### Delete Confirmation Dialog
- `DashboardClient.tsx` — Tombol Delete pada blueprint di dashboard kini membuka modal konfirmasi dengan ikon danger, detail blueprint (nama, jumlah rack, jumlah bin), dan tombol Cancel/Delete Blueprint.

### Unsaved Changes Navigation Guard
| Mekanisme | Implementasi |
|---|---|
| `historySlice.ts` | `isDirty: boolean`, `markSaved()`, `setIsDirty()` — auto-set true pada executeCommand/undo/redo |
| `TopNavToolbar.tsx` | Status badge: `All saved` (gray) vs `● Unsaved changes` (amber pulse); `markSaved()` on successful save; `onRequestExit` callback |
| `EditorLayout.tsx` — `beforeunload` | Peringatan browser bawaan saat tab ditutup/reload dengan perubahan belum di-save |
| `EditorLayout.tsx` — `popstate` | Intercept tombol Back browser → tampilkan modal |
| `EditorLayout.tsx` — `← Blueprints` | Intercept klik navigasi → tampilkan Unsaved Changes modal |
| **Unsaved Changes Modal** | 3 opsi: **Keep Editing** (tetap di editor), **Discard & Leave** (buang perubahan), **Save & Leave** (simpan lalu keluar) |

**Verifikasi:** Browser E2E test ✅ — Delete Confirmation modal muncul saat klik Delete, Cancel membatalkan, dan Delete Blueprint menghapus. Unsaved Changes modal muncul saat navigasi keluar, Save & Leave menyimpan dan redirect ke dashboard.

---

## ✅ 20. Blueprint Navigation Enhancement & Moveset Guide (31 Agu 2026)

### Camera Navigation Engine
| Fitur | Implementasi |
|---|---|
| WASD / Arrow Keys | Continuous camera panning (24m/s) di bidang lantai horizontal |
| Q / E | Continuous camera orbit rotation (1.8 rad/s) |
| Smart Focus [F] | Bounding box framing — kamera animasi smooth ke pusat entity terpilih, zoom proporsional ukuran objek |
| Reset Overview [Space] | Kamera kembali ke pandangan umum seluruh gudang |
| Smooth Transitions | Lerp-based camera interpolation (6.0 factor) untuk semua preset & focus |
| Camera Presets | 3D Isometric [3], 2D Top-Down [2], Front View [4], Side View [5] |

### Floating Viewport HUD Toolbar
- `ViewportToolbar.tsx` **[NEW]** — Glassmorphic toolbar di sudut kanan atas canvas:
  - Zoom In (+) / Zoom Out (-)
  - 🎯 Focus Selected (disabled jika tidak ada entity terpilih)
  - 🏠 Overview (reset camera)
  - 🧊 3D / 📐 2D toggle (indikator mode aktif)
  - Front View / Side View presets
  - 🧲 Grid Snap toggle (ON/OFF)

### Moveset Guide & Quick-Tips
| File | Isi |
|---|---|
| `src/components/editor/ui/CanvasQuickTips.tsx` | **[NEW]** Floating tips bar (Orbit · Pan · Zoom · WASD · F · R) + tombol `⌨️ Moveset Guide [?]` |
| `src/components/editor/ui/ControlsModal.tsx` | **[NEW]** Full visual cheat sheet modal: 3 kartu (🖱️ Mouse Gestures, 🧭 Camera Navigation, 🛠️ Object & History) |
| `src/lib/camera/camera-bus.ts` | **[NEW]** Event bus untuk dispatch camera actions (focus, presets, zoom, reset) |
| `src/components/canvas/CameraController.tsx` | Rewritten: smooth transitions, WASD/QE, cameraBus subscriber, bounding box focus |
| `src/components/editor/useEditorShortcuts.ts` | Extended: F (focus), Space (reset), G (snap), ? / H (moveset modal), 4/5 (front/side presets); R dan Delete kini support structures & zones |

**Verifikasi:** Dev server ✅ — semua navigasi keyboard, viewport toolbar, dan moveset modal berfungsi di browser.

---

## ✅ 21. WMS & Visualisasi Bins 3D (Selesai — 1 Sep 2026)

- **Dual-Mode System**:
  - `editorViewMode: 'LAYOUT' | 'WMS'` pada store state.
  - Mode Switcher di `TopNavToolbar.tsx` (`[ 📐 Layout Builder ]` vs `[ 📦 WMS Inventory ]`).
  - TransformGizmo otomatis disembunyikan dalam mode WMS untuk mencegah salah geser rak saat berinteraksi dengan bins.
- **Visualisasi 3D Kargo & Palet**:
  - Palet kayu standar EUR ($1.2\text{m} \times 0.8\text{m} \times 0.144\text{m}$) di-render menggunakan `InstancedMesh` dengan material kayu cokelat natural.
  - Tumpukan kardus kraft stacked di-render menggunakan `InstancedMesh` dengan material karton dan variasi tinggi realistis.
  - Slot bin kosong menampilkan bounding box wireframe transparan; slot bin yang di-hover disorot cyan (`#38bdf8`), dan bin yang dipilih disorot amber (`#f59e0b`).
- **Interactive Bin Detail Drawer (`BinDetailDrawer.tsx`)**:
  - Slide-over drawer di sisi kanan saat bin dipilih.
  - Header: Canonical Bin ID (misal `A01-02-03`), Bay & Level, Rack Name & Type.
  - Occupancy Toggle Switch (Stocked vs Empty) dengan indikator visual.
  - Payload Capacity Gauge: Progress bar berat vs kapasitas maksimum (`maxWeightKg`) dengan overload alert jika melebihi kapasitas.
  - SKU & Cargo Form: SKU code, Product Name, Quantity, Unit, Lot Number, Expiry Date, Weight (kg).
  - Quick Actions: "Stock Pallet", "Clear Bin", "Re-randomize SKU", "Deselct/Esc".
- **Batch Operations & Command Pipeline**:
  - `createUpdateBinOccupancyCommand`: Snapshot atomic per bin untuk Undo/Redo.
  - `createBatchUpdateRackBinsCommand`: Stock All Bins / Empty All Bins per rak.
  - `createBatchUpdateAllBinsCommand`: Warehouse-wide Stock All, Empty All, dan Randomize 70% demo occupancy.
  - `createUpdateBinSkuDataCommand`: Update data SKU dan max payload per bin.
- **Export/Import & Database Layer**:
  - CSV Export diperluas dengan kolom SKU: `sku`, `product_name`, `quantity`, `unit`, `lot_number`, `weight_kg`.
  - Database reassembly otomatis menggenerasikan mock SKU deterministik untuk slot yang terisi.
- **Automated Verification**:
  - Script baru `scripts/smoke-bins-wms.ts` (`npm run test:wms`) memvalidasi 8 poin spesifikasi: bin generation, cargo matrices, occupancy command, SKU metadata update, batch rack update, warehouse randomize, Zod schema validation, dan viewMode synchronization.
  - `npm run test:smoke` ✅ PASS
  - `npm run test:snapping` ✅ PASS
  - `npm run test:wms` ✅ PASS
  - `npm run typecheck` (`tsc --noEmit`) ✅ PASS (Zero errors)
  - `npm run build` (`next build`) ✅ PASS (Zero errors, Turbopack compile sukses)

---

## ✅ 22. Visual Heatmap & WMS Analytics Layer (Selesai — 1 Sep 2026)

- **3D Dynamic Instanced Coloring**:
  - `CargoCartonInstanceGroup` di `ProceduralRack.tsx` mengaplikasikan pewarnaan dinamis per-instansi via `mesh.setColorAt(i, color)` dan `mesh.instanceColor.needsUpdate = true`.
  - Zero extra draw calls, rendering instanced tetap 60 FPS.
- **Tiga Dimensi Analisis Spasial**:
  1. `OCCUPANCY`: Densitas slot rak (<40% Cyan, 40-75% Amber, >75% Red).
  2. `WEIGHT_STRESS`: Rasio beban muatan (`weightKg / maxWeightKg`: <50% Emerald Safe, 50-75% Yellow Moderate, 75-90% Orange Heavy, 90-100% Red Critical, >100% Purple Overload Alert).
  3. `ABC_VELOCITY`: Kecepatan perputaran produk (Class A Fast Mover Emerald `#10b981`, Class B Medium Mover Amber `#f59e0b`, Class C Slow Mover Slate `#64748b`).
- **Floating Analytics HUD & Legend (`HeatmapLegendHUD.tsx`)**:
  - Dock switch mode melayang di tengah bawah viewport WMS: `[📦 Standard Cargo] | [🔥 Occupancy %] | [⚖️ Weight Stress] | [⚡ ABC Velocity]`.
  - Telemetri live gudang: Total Payload tonase (tonnes), Warehouse Utilization (%), dan Counter Overloaded Bins.
  - Collapsible Legend Card di pojok kanan bawah yang otomatis menyesuaikan spektrum warna dengan metrik yang sedang aktif.
- **Drawer SKU & Data Integration**:
  - Penambahan atribut `velocityClass?: 'A' | 'B' | 'C'` pada `BinSkuData`, `BinSkuDataSchema`, dan `MOCK_SKU_CATALOG`.
  - Selector tombol interaktif ABC Velocity di dalam `BinDetailDrawer.tsx` untuk penyesuaian kelas perputaran secara langsung.
  - Ekspor CSV WMS diperbarui dengan kolom `velocity_class`.
- **Automated Verification**:
  - Script test baru `scripts/smoke-heatmap-analytics.ts` (`npm run test:heatmap`) memvalidasi seluruh ambang batas warna, schema Zod, sinkronisasi slice view, dan mutasi Undo/Redo.
  - `npm run test:heatmap` ✅ PASS
  - `npm run test:wms` ✅ PASS
  - `npm run test:smoke` ✅ PASS
  - `npm run test:snapping` ✅ PASS
  - `npm run typecheck` (`tsc --noEmit`) ✅ PASS (Zero errors)
  - `npm run build` (`next build`) ✅ PASS (Turbopack compile sukses)

---

## ✅ 23. Enhanced Hitboxes & Selection for Floor Zones & Small Assets (Selesai — 1 Sep 2026)

- **Perbaikan Bug Nama Ruangan (Warehouse Blueprint Name Mismatch)**:
  - Memperbaiki `setBlueprintMeta` pada `src/stores/slices/blueprintSlice.ts` yang sebelumnya tidak memetakan `meta.name` ke `state.blueprintName`.
  - Menambahkan proteksi `document.activeElement.blur()` pada `TopNavToolbar.tsx` sebelum `handleSave` agar input nama langsung tersimpan ke database Neon secara permanen.
- **Volumetric 3D Hitbox & Interactive Badge untuk Operational Floor Zones (`ZoneFootprint.tsx`)**:
  - Menambahkan invisible volumetric slab mesh (`BoxGeometry(width, 0.2, depth)`) pada $Y=0.1\text{m}$ sehingga raycasting mouse selalu menangkap klik permukaan lantai zona tanpa menembus ke ground mesh.
  - Mengaktifkan interaktivitas penuh pada label melayang 3D (`<Html>`): kini memiliki `cursor: pointer` dan event `onClick` untuk memilih zona secara instan saat badge diklik.
  - Menambahkan efek hover glow outline cyan (`#38bdf8`) dan pembesaran halus saat kursor mengarah ke zona.
- **Expanded Invisible Hitboxes untuk Objek Kecil (`ProceduralStructure.tsx`)**:
  - Untuk `bollard`: menambahkan invisible cylinder collider berdiameter minimal $0.7\text{m}$ (meningkatkan area klik >500% dibanding mesh visual asli $0.3\text{m}$), menghilangkan frustrasi mengeklik objek berukuran kecil dari jarak kamera jauh.
  - Untuk `column` & `dock_door`: menambahkan invisible bounding padding $+0.4\text{m}$ untuk kemudahan seleksi.
  - Menambahkan kursor `pointer` dan efek outline kawat berpendar (cyan `#38bdf8` saat hover, emas `#f59e0b` saat selected).
- **Hover & Selection Feedback untuk Storage Racking (`ProceduralRack.tsx` & `SidebarPalette.tsx`)**:
  - Menambahkan full-envelope invisible bounding box hitbox (`BoxGeometry(w, h, d)`) pada rak di canvas 3D sehingga kursor yang mengarah ke sela-sela antar balok (beams/uprights) tetap menangkap rak secara konsisten tanpa tembus ke lantai.
  - Outline kawat berpendar cyan cerah (`#38bdf8`) dan kursor berubah menjadi `pointer` saat mouse mengarah (hover) ke rak mana pun di canvas 3D.
  - Menampilkan floating 3D badge di atas rak saat hover/select: menunjukkan Nama Rak, Konfigurasi Bay & Level, serta Jumlah Bins (`📦 A01 (3 bays · 4 levels · 12 bins)`).
  - Kartu katalog Storage Racking di sidebar ditingkatkan dengan hover elevation, glowing accent border, dan responsivitas interaktif.
- **Automated Verification**:
  - Script test `scripts/smoke-room-rename.ts` memvalidasi komitmen nama ruangan, `isDirty`, dan round-trip Undo/Redo.
  - Script test `scripts/smoke-selection-hitboxes.ts` (`npm run test:hitboxes`) memvalidasi rasio ekspansi collider dan seleksi objek.
  - Seluruh test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `typecheck`, `next build`) lolos 100% dengan zero errors.

---

## ✅ 24. Direct Mesh Click-and-Drag & Viewport-Focused Placement (Phase 24 — Selesai 1 Sep 2026)

Mewujudkan dua fitur interaksi manipulasi spasial yang diminta pengguna:
1. **Direct Click-and-Hold/Drag on 3D Entities**:
   - Pengguna kini dapat langsung mengeklik dan menahan mouse (*pointerDown*) di mana saja pada badan rak, struktur, atau zona, lalu menggesernya (*drag*) melintasi lantai gudang secara alami, tanpa harus mengeklik kotak kecil tengah gizmo.
   - Hook terpadu `useDirectEntityDrag.ts` menangani penangkapan pointer (*pointer capture*), raycast bidang lantai $Y=0$, pemeliharaan offset grab kursor, real-time spatial updates, dan snapping grid/magnetic edge.
   - OrbitControls dinonaktifkan secara otomatis (`isDirectDragging: true`) saat dragging berlangsung sehingga kamera tidak ikut berputar ketika objek diseret.
   - Saat pointer dilepas (*pointerUp*), jika posisi objek berubah, perintah `createMoveRackCommand`, `createMoveStructuralElementCommand`, atau `createMoveZoneCommand` secara otomatis dieksekusi ke command stack untuk full Undo/Redo support. Jika hanya diklik tanpa digeser, objek terseleksi secara instan.
2. **Viewport-Focused Asset Placement from Catalogue**:
   - Saat pengguna mengeklik item dari Asset Catalogue di sidebar, ite- **Automated Verification**:
   - Script test `scripts/smoke-direct-drag-focus.ts` (`npm run test:direct-drag`) memverifikasi placement berbasis fokus kamera, transisi state `isDirectDragging`, serta eksekusi move command + Undo/Redo.
   - Seluruh test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `typecheck`, dan `next build`) lolos 100% dengan zero errors.

---

## ✅ 25. Multi-Object Selection & Bulk Operations (Phase 25 — Selesai 1 Sep 2026)

Mewujudkan interaksi seleksi massal dan operasi tingkat lanjut hasil wawancara `/grill-me`:
1. **Dua Metode Seleksi Multi-Objek**:
   - **Shift + Click**: Menambah atau mengurangi objek (rak, kolom/dinding, zona) ke dalam array seleksi grup `selectedEntityIds`.
   - **Shift + Drag (Marquee Box Selection)**: Menahan tombol `Shift` lalu menggeser kursor di area lantai untuk memunculkan kotak seleksi 2D transparan berpendar (`MarqueeSelection.tsx`). Menghitung proyeksi posisi 3D ke koordinat layar dan memilih seluruh objek yang terlingkupi secara instan.
   - Klik di lantai kosong atau tekan `Esc` membersihkan seluruh seleksi.
2. **Bulk Direct Dragging**:
   - Menggeser salah satu objek di dalam grup terpilih secara otomatis menggerakkan **seluruh grup secara proporsional** dengan jarak relatif tetap terjaga. Snapping (grid 0.5m & batas lantai) diterapkan pada anchor objek yang ditarik.
3. **Atomic Bulk Commands (Single Ctrl+Z Undo)**:
   - `createBulkMoveCommand`: Menggerakkan sekumpulan objek secara bersamaan.
   - `createBulkDeleteCommand`: Menghapus semua objek terpilih dengan dialog konfirmasi jumlah item.
   - `createBulkDuplicateCommand`: Menduplikasi seluruh grup terpilih (`Ctrl+D`) dengan offset +2m.
   - `createBulkRotateCommand`: Memutar semua objek terpilih 90° secara in-place (`R`).
4. **Dedicated Multi-Selection Inspector & Floating Canvas HUD**:
   - Panel `MultiSelectionInspector.tsx` otomatis tampil di sidebar kanan saat $\ge 2$ objek terpilih: menampilkan ringkasan komposisi grup, tombol aksi massal, dan 5 alat perataan spasial (Rata Kiri, Rata Kanan, Rata Atas, Rata Bawah, dan Ratakan Spasi Horizontal).
   - Banner mengambang di atas canvas 3D: menunjukkan jumlah objek terpilih (`N Objek Terpilih`), petunjuk drag, dan tombol pembatalan cepat `[Esc / Batal]`.
5. **Automated Verification**:
   - Script test `scripts/smoke-multi-selection.ts` (`npm run test:multi-select`) memverifikasi toggle seleksi, marquee, bulk move, bulk rotate, bulk duplicate, bulk delete, dan atomic undo/redo.
   - Seluruh test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `test:multi-select`, `typecheck`, dan `next build`) lolos 100% dengan zero errors.

---

## ✅ 26. Comprehensive UI/UX Redesign — Dashboard & Blueprint Editor (Phase 26 — Selesai 2 Sep 2026)

Transformasi visual komprehensif berstandar enterprise dengan tema **Industrial High-Tech Glassmorphism** (`#0a0e17` dark slate, frosted glass, glowing cyan & amber accents):

1. **Dashboard Overhaul (Facility Command Center)**:
   - **Hero & Global Telemetry Strip**: Menampilkan 4 kartu metrik live teragregasi (Total Fasilitas, Total Unit Rak, Kapasitas Bins Penyimpanan, dan Estimasi Tonase Muatan) dengan branding `SPATIAL WAREHOUSE OS // v2.5`.
   - **Interactive Starter Templates & Modal Launcher (`CreateBlueprintModal.tsx`)**:
     - 4 Template industri siap pakai: *Blank Canvas (60×40m)*, *E-Commerce Fulfillment Hub (80×50m pre-populated 6 aisles, 96 bins, dock doors)*, *High-Density Cold Storage (50×35m)*, dan *Heavy Cantilever & Long Goods Depot (70×40m)*.
     - Opsi *Custom Dimensions*: Konfigurasi panjang (W), lebar (D), tinggi plafon (H), dan snap interval (0.25m, 0.5m, 1.0m) dengan preview instan luas lantai ($m^2$) dan volume ($m^3$).
   - **Real-Time Filtering & View Modes**:
     - Input pencarian cepat nama fasilitas.
     - Dropdown sortir dinamis: *Recently Modified*, *Name (A–Z)*, *Most Racks*, dan *Highest Capacity (Bins)*.
     - Toggle view ganda: **Interactive Grid Cards** (dengan badge 3D twin, kartu statistik, dan menu aksi) vs **Dense Table List View**.

2. **Blueprint Editor Command Header (`TopNavToolbar.tsx`)**:
   - Header frosted glass (`backdrop-blur-md bg-neutral-900/90`) dengan inline rename nama blueprint secara langsung (click-to-rename & instant blur/enter commit).
   - Dimension chip interaktif dengan luas area ($m^2$) terhubung ke room dimensions.
   - Mode Switcher taktil beraksen pendaran (*Layout Builder* biru langit vs *WMS Inventory* kuning amber).
   - Tombol Undo/Redo dengan shortcut badge (`Ctrl+Z`, `Ctrl+Y`).
   - Indikator status penyimpanan live (*All saved* vs pulsing amber *Unsaved changes*).
   - Menu Dropdown Export terpadu (*Export Blueprint JSON* & *Export WMS Bins CSV*).
   - Tombol Save glowing bergradien dengan status loading spinner.

3. **Modular Collapsible Sidebars & Scene Outliner**:
   - **Left Sidebar**:
     - Tab 1: **Asset Catalogue (`SidebarPalette.tsx`)** dengan input pencarian instan untuk menyaring 15 tipe asset, kartu beraksen material industri, dan tombol `+ Add`.
     - Tab 2: **Scene Outliner (`SceneOutliner.tsx`)** menampilkan pohon objek hierarkis seluruh Racks, Structures, dan Zones di scene dengan filter pencarian, indikator jumlah slot, tombol hapus cepat, dan integrasi kamera auto-framing saat item diklik.
     - Tombol minimize/maximize (`◀ / ▶`) untuk meluaskan viewport canvas 3D.
   - **Right Sidebar**:
     - Tab 1: **Properties Inspector** kontekstual (Rack, Structure, Zone, Multi-selection group).
     - Tab 2: **Facility & Grid Settings** untuk mengatur dimensi ruangan lantai, batas ketinggian plafon, dan snap step kapan pun.
     - Tombol minimize/maximize (`▶ / ◀`).

4. **Live Viewport Telemetry Status Bar (`EditorStatusBar.tsx`)**:
   - Status bar font mono docked di bagian bawah viewport 3D canvas:
     - Koordinat kursor world space live ($X, Z$ dalam meter) yang diperbarui secara halus dari permukaan lantai (`telemetryBus`).
     - Indikator grid snapping aktif (0.5m / ON / OFF).
     - Status kamera aktif (3D Perspective / 2D Top-Down).
     - Penghitung kepadatan scene (jumlah Racks, Bins, Structures, Zones).
     - Tombol cepat untuk membuka *Moveset & Keyboard Shortcuts Guide* (`[⌨️ Shortcuts]`).

5. **Automated & Visual Browser Verification**:
   - Script test baru `scripts/smoke-templates-telemetry.ts` (`npm run test:templates`) memvalidasi kepatuhan Zod 4 template industri, perhitungan koordinat lokal slot bin, serta event bus telemetri kursor.
   - Seluruh test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `test:multi-select`, `test:templates`, `typecheck`, dan `next build`) lolos 100% dengan zero errors.
   - Subagent browser memvalidasi alur end-to-end: pembuatan blueprint dari template, interaksi katalog & outliner, simulasi WMS, heatmap mode, dan dialog proteksi *Save & Leave*.

---

## ✅ 27. Step-by-Step Interactive Spotlight Tutorial (Phase 27 — Selesai 2 Sep 2026)

Membangun panduan interaktif berbasis spotlight cutout yang memandu pengguna langkah demi langkah di dalam Blueprint Editor 3D:

1. **Guided Spotlight Tour Engine (`GuidedTourOverlay.tsx`)**:
   - **Spotlight Cutout Halus**: Berbasis SVG mask dinamis yang menyorot elemen UI target (`[data-tour="..."]`) dengan border neon berdenyut (`animate-pulse shadow-[0_0_25px_rgba(56,189,248,0.45)]`) dan meredam latar belakang secara elegan tanpa memblokir interaksi.
   - **Kartu Panduan Glassmorphic**:
     - Badge langkah dinamis (`LANGKAH X DARI 6`).
     - Judul langkah, deskripsi rinci, serta daftar shortcut keyboard dan tips operasional.
     - Kontrol navigasi: tombol `[◀ Kembali]`, `[Lanjut ▶]`, dan `[Selesai 🎉]`.
     - Tombol `[✕ Tutup / Matikan]` untuk keluar seketika dari tutorial kapan saja.
     - Checkbox *"Jangan tampilkan lagi"* yang menyimpan preferensi di `localStorage` (`warehouse_tour_dismissed`).
2. **6 Langkah Terstruktur Komprehensif**:
   - **Langkah 1: Navigasi Kamera & Viewport 3D** (Orbit mouse, Pan, Zoom, shortcut WASD, Focus `[F]`, toggle 2D/3D).
   - **Langkah 2: Katalog Aset Industri** (15 varian rak/struktur/zona, fitur pencarian instan, cara drag & drop atau click-to-add).
   - **Langkah 3: Seleksi & Manipulasi Objek** (Klik seleksi, direct drag dengan snapping grid/magnetik, tombol `[R]` untuk rotasi, duplikasi `[Ctrl+D]`, multi-seleksi).
   - **Langkah 4: Properties Inspector & Outliner** (Ubah dimensi rak, bay, level, luas lantai, serta inspeksi hierarki pohon objek scene).
   - **Langkah 5: Mode WMS & Heatmap Analitik** (Simulasi inventaris kargo kayu/karton, drawer inspeksi bin, dan visualisasi heatmap beban/okupansi/ABC).
   - **Langkah 6: Simpan, Ekspor & Proteksi Data** (Penyimpanan ke database Neon, ekspor JSON blueprint & CSV bins manifest).
3. **Pemicu Ulang (Re-triggering) & Akses Mudah**:
   - Tombol `[🎓 Panduan]` disematkan di header utama (`TopNavToolbar.tsx`) dan di status bar bawah (`EditorStatusBar.tsx`) sehingga pengguna dapat memulai ulang tutorial kapan pun.
4. **Verifikasi & Validasi**:
   - Script test otomatis `scripts/smoke-guided-tour.ts` (`npm run test:tour`) memverifikasi ke-6 langkah, selector target DOM, transisi navigasi maju-mundur, dan logika batas.
   - Browser subagent memverifikasi auto-start pada kunjungan pertama, navigasi langkah 1 s.d. 4, penutupan di tengah jalan via tombol Tutup `[✕]`, re-triggering dari tombol Panduan, dan penyelesaian tur hingga tombol `[Selesai 🎉]`.
   - Seluruh test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `test:multi-select`, `test:templates`, `test:tour`, `typecheck`, dan `next build`) lolos 100% tanpa error.

---

## ✅ 28. Settings System, Dual Language (ID/EN) & Theme Engine (Phase 28 — Selesai 2 Sep 2026)

Membangun sistem pengaturan global (**System Settings & Preferences**) terpadu dengan lokalisasi dua bahasa, tema ganda, konversi satuan dinamis, performa grafis 3D, dan auto-save:

1. **Zustand Settings Store & Persistence (`useSettingsStore.ts`)**:
   - Menyimpan preferensi pengguna di browser `localStorage` (`warehouse_app_settings`):
     - `language`: `'id'` (Bahasa Indonesia) vs `'en'` (English).
     - `theme`: `'dark'` (Dark Slate) vs `'light'` (Clean Industrial Light).
     - `unitSystem`: `'metric'` ($m, kg$) vs `'imperial'` ($ft, lbs$).
     - `graphicsQuality`: Dynamic Shadows & Anti-Aliasing toggles.
     - `showGridLines`: Toggle garis kisi-kisi grid lantai.
     - `autoSaveInterval`: Background auto-sync (Mati / 2 Menit / 5 Menit).
   - Menyinkronkan class `.light` / `.dark` ke `document.documentElement` secara otomatis saat tema berubah.
2. **Modul Lokalisasi & Kamus i18n (`src/lib/i18n/`)**:
   - `id.ts` & `en.ts`: Kamus terstruktur lengkap (126 keys) mencakup Dashboard, Editor, Modal, Tour, Status Bar, dan Settings.
   - Hook `useTranslation()` untuk akses teks instan dan reaktif tanpa me-reload halaman atau mengganggu state canvas 3D.
   - Helper konversi satuan: `formatDistance`, `formatWeight`, `formatArea`, dan `formatVolume` yang mendukung standar Metrik dan Imperial ($ft, lbs$).
3. **Modal Dialog Pengaturan (`SettingsModal.tsx`)**:
   - Dialog glassmorphic elegan dengan 4 tab kategori:
     - `[🌐 Umum / General]`: Kartu seleksi Bahasa (ID/EN) & Tema (Dark Slate / Clean Light).
     - `[📐 Satuan & Grid / Units & Grid]`: Toggle Metrik vs Imperial & visibilitas grid line lantai.
     - `[🎮 Grafis & 3D / Graphics]`: Toggle Dynamic 3D Shadows & Anti-Aliasing.
     - `[💾 Penyimpanan / Storage]`: Pilihan interval Auto-Save & tombol Reset to Factory Defaults.
   - Dapat diakses melalui tombol `[⚙️]` di header Dashboard, toolbar atas Editor (`TopNavToolbar`), dan status bar bawah (`EditorStatusBar`).
4. **Adaptasi Visual & Canvas 3D**:
   - Tema *Clean Industrial Blueprint Light*: Background `#f8fafc` bersih, kartu putih transparan border slate-200, lantai 3D abu-abu beton terang (`0xe2e8f0`), grid line slate-blue, dan ambient lighting yang cerah.
   - Scrollbar ganda yang otomatis menyesuaikan warna track dan thumb untuk Dark Mode maupun Light Mode.
5. **Verifikasi & Validasi**:
   - Test otomatis `scripts/smoke-settings-i18n.ts` (`npm run test:settings`): memvalidasi 100% key parity antara ID & EN, formula konversi $m \leftrightarrow ft$ dan $kg \leftrightarrow lbs$, mutasi store, dan reset defaults.
   - Browser subagent memverifikasi alur penggantian bahasa ke English, tema ke Clean Light Mode, satuan ke Imperial, navigasi ke 3D editor, dan restorasi kembali ke Dark Mode & Bahasa Indonesia.
   - Seluruh 10 test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `test:multi-select`, `test:templates`, `test:tour`, `test:settings`), `npm run typecheck`, dan `npm run build` lolos 100% tanpa error.

---

## ✅ 29. Aisle Auto-Spanning & Array Generator (Phase 29 — Selesai 3 Sep 2026)

Membangun modul generator array rak dan lorong gudang prosedural (**Aisle Auto-Spanning & Array Generator**) yang memungkinkan perancangan tata letak puluhan rak dan ratusan slot bin secara instan dalam satu kali klik:

1. **Procedural Aisle Generator Engine (`aisle-generator.ts`)**:
   - Menghitung koordinat spasial 3D, clearance antar-lorong, dan orientasi (sepanjang lebar X atau panjang Z).
   - Mendukung topologi industri: **Single Rows** dan **Back-to-Back Pairs** (dilengkapi celah flue pengaman standar NFPA/FM Global).
   - Mendukung **Collinear Multi-Bay Runs** (deretan unit rak tersambung ujung-ke-ujung per baris).
   - 4 Preset Peralatan Industri cepat:
     - *Counterbalance Forklift*: lebar bersih ~3.5m.
     - *Reach Truck*: lebar bersih ~2.8m.
     - *VNA (Very Narrow Aisle) Turret Truck*: lebar bersih ~1.8m.
     - *Order Picker / Manual*: lebar bersih ~1.4m.
   - Deteksi kolisi AABB terhadap rintangan eksisting dan batas perimeter lantai gudang.
   - Penamaan deterministik regex-compliant (`^[A-Z0-9]+$`) yang menghasilkan bin ID sah sesuai Zod schema (`^[A-Z0-9]+-\d{2}-\d{2}$`).
2. **Atomic Command Pipeline (`GenerateAisleArrayCommand.ts`)**:
   - Menambahkan seluruh rak dalam satu mutasi immutable (`addRacks`).
   - Mengaktifkan multi-seleksi otomatis (`setMultipleSelection`) pada seluruh rak baru.
   - Single-action Undo/Redo: 1 kali `Ctrl+Z` menghapus seluruh array secara bersih tanpa meninggalkan jejak atau orphan bin.
3. **Live 3D Ghost Preview (`AisleArrayPreview.tsx` & `aisle-preview-bus.ts`)**:
   - Preview visual real-time di canvas Three.js saat modal dibuka.
   - Kotak transparan hijau (`#10b981`) untuk posisi valid dan merah (`#ef4444`) untuk posisi tabrakan.
   - Toggle *"Skip Colliding Racks"* untuk hanya men-generate rak di posisi bebas rintangan.
4. **Interactive Glassmorphic Wizard (`AisleGeneratorModal.tsx`)**:
   - Dual entry point: tombol `[⚡ Array Lorong]` di toolbar atas atau `[⚡ Buat Array Lorong]` di Properties Inspector rak terpilih.
   - Telemetri instan: total rak, estimasi kapasitas bin, dimensi footprint total $(L \times P)$.
   - Tombol 1-klik *Auto-Expand Floor* jika dimensi array melampaui ukuran lantai saat ini.
   - Dukungan dwibahasa penuh (ID/EN) terintegrasi ke kamus `useTranslation()`.
5. **Verifikasi & Validasi**:
   - Test otomatis `scripts/smoke-aisle-generator.ts` (`npm run test:aisle`): memvalidasi rumus matematika jarak baris tunggal & back-to-back, preset forklift, regex bin ID Zod, deteksi tabrakan & out-of-bounds, serta atomic Undo/Redo.
   - Seluruh 11 test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `test:multi-select`, `test:templates`, `test:tour`, `test:settings`, `test:aisle`), `npm run typecheck`, dan `npm run build` lolos 100% tanpa error.

---

## ✅ 30. Dual-Theme Parity & Perbaikan Menyeluruh Light Mode (Phase 30 — Selesai 3 Sep 2026)

Menghadirkan dukungan tema ganda (*dual theme*) yang sempurna dan konsisten untuk seluruh aplikasi, memperbaiki kontras rendah dan elemen gelap hardcoded di Light Mode:
1. **Perbaikan Container & Background**:
   - Seluruh panel, toolbar, modal dialog, kartu telemetri, dan outliner beralih ke styling responsif kelas Tailwind `dark:...` dengan latar belakang terang bersih (`#f8fafc` / `bg-white/95`) dan bayangan lembut di Light Mode.
2. **Keterbacaan Font & Kontras Tinggi**:
   - Menyelaraskan teks dari yang sebelumnya pudar/putih di latar terang menjadi teks kontras tinggi (`text-slate-900`, `text-slate-700`, `text-slate-500`).
3. **Penyelarasan Tag Branding & Lencana Blueprint**:
   - Tag OS `SPATIAL WAREHOUSE OS // v2.5` di dashboard dan editor diubah menjadi `border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-semibold shadow-sm` dengan titik pulsasi `bg-sky-500 dark:bg-sky-400`.
   - Lencana kartu "3D TWIN" diselaraskan dengan kelas sky light mode yang sama.
   - Tag kategori katalog palet: Storage Racking (`bg-sky-50 text-sky-700`), Facility Structures (`bg-purple-50 text-purple-700`), dan Operational Zones (Emerald, Sky, Amber, Rose) tampil sangat jelas dan mudah dibaca di kedua mode.
4. **Scrollbar Khusus Light Mode**:
   - Menambahkan styling scrollbar khusus di `globals.css` untuk `.light` agar scrollbar tidak tampak hitam pekat di latar belakang putih.

---

## ✅ 31. Presisi Seleksi Raycast & Anti-Desync Hitbox 3D (Phase 31 — Selesai 3 Sep 2026)

Memperbaiki keandalan klik seleksi objek 3D dari berbagai sudut kamera (khususnya sudut curam, sejajar, atau dari atas) dan mencegah pembatalan seleksi (*click-through deselect*):
1. **Event Propagation Isolation (`useDirectEntityDrag.ts`)**:
   - Menambahkan handler `onClick` khusus pada interaksi entitas langsung dengan `event.stopPropagation()`, mengisolasi klik pada objek agar tidak tembus ke raycaster lantai (`WarehouseFloor`).
2. **Perluasan Invisible Bounding Hitboxes**:
   - **`ProceduralRack.tsx`**: Memperluas volume hitbox tak terlihat (`width + 0.3m`, `height + 0.2m`, `depth + 0.3m`) sehingga klik di celah balok rangka rak selalu terdeteksi akurat.
   - **`ProceduralStructure.tsx`**: Mempertebal hitbox dinding tipis 30cm (menjadi `depth + 0.5m`) dan dock door agar sangat mudah diklik dari sudut sejajar; memperlebar radius klik kolom pilar dan safety bollard.
   - **`ZoneFootprint.tsx`**: Menambahkan slab volume hitbox setinggi 0.3m (`boxGeometry args={[width + 0.2, 0.3, depth + 0.2]}`) agar zona operasional lantai mudah diklik dari sudut horizontal rendah.
3. **Auto-Open Inspector Observer (`EditorLayout.tsx`)**:
   - Menambahkan `useEffect` reaktif yang secara otomatis membuka panel *Properties Inspector* sebelah kanan begitu sebuah entitas terpilih, sekalipun panel sebelumnya dalam kondisi tertutup (*collapsed*).

---

## ✅ 32. Hover Preview Bentuk 3D Aset Katalog & Sinkronisasi Visual Asli (Phase 32 — Selesai 3 Sep 2026)

Menambahkan kartu popover preview mengambang (*hover card*) pada katalog aset sidebar dengan ilustrasi isometrik vektor yang tersinkronisasi 1:1 dengan model 3D aslinya di kanvas:
1. **Komponen Flyout Card Cerdas (`CatalogItemPreviewPopover.tsx` & `SidebarPalette.tsx`)**:
   - Menampilkan popover saat kursor berada di atas kartu palet dengan jeda halus 150ms (`hoverTimeoutRef`) agar tidak berkedip saat kursor bergerak cepat.
   - Posisi vertikal dinamis mengikuti ketinggian kursor dan terkunci dalam batas layar (*viewport clamping*).
   - Penutupan instan otomatis begitu pengguna mulai melakukan drag-and-drop aset ke lantai 3D.
2. **Sinkronisasi Presisi 15 Tipe Aset Industri**:
   - **Concrete Wall**: Balok dinding beton masif 3D dengan garis dilatasi dan kontur perak (`#94a3b8`) sesuai mesh asli di kanvas.
   - **Structural Pillar**: Tiang pilar persegi ramping vertikal setinggi 8m dengan pelat flensa baja dasar (`#1e293b`) dan 4 titik baut angkur lantai.
   - **Overhead Dock Door**: Portal frame keselamatan kuning industri (`#eab308`) dengan daun pintu *roll-up shutter* bergaris slate (`#334155`) dan lintel hazard hazard.
   - **Safety Bollard**: Tiang silinder kuning keselamatan dengan pelat dasar melingkar dan **dua gelang hitam reflektif** proporsional persis model 3D aslinya.
   - **Racks & Zones**: Rangka Selective Pallet biru royal 4-tier dengan wire deck dan karton kraft, Double-Deep tandem 2.2m, Drive-In LIFO merah terowongan forklift, Cantilever lengan kuning, Mezzanine platform baja 6x6m, serta zona Receiving, Shipping, Staging, dan Quarantine.
   - Informasi spesifikasi teknis: dimensi standar $(L \times P \times T)$, estimasi kapasitas bin/palet, dan tips penataan logistik.

---

## ✅ 33. Resolusi Bleeding ID Elemen 3D & Koreksi Fokus Kamera (Phase 33 — Selesai 3 Sep 2026)

Menyelesaikan kendala teks label ID yang meluber membesar hingga 10x lipat saat mode fokus/zoom dan menembus panel antarmuka:
1. **Stabilisasi Skala HTML 3D & Bounded Z-Index (`ProceduralRack.tsx` & `ZoneFootprint.tsx`)**:
   - Menghapus atribut `distanceFactor={35}` pada `<Html>` Drei yang sebelumnya menyebabkan pembesaran ekstrem tak terbatas saat kamera mendekati objek ($d \approx 3.5\text{m}$).
   - Menerapkan skala tajam konstan (*constant crisp font scale* 11px) pada semua tingkat zoom kamera.
   - Membatasi lapisan z-index dengan `zIndexRange={[10, 0]}` sehingga elemen badge 3D selalu berada di bawah bilah alat (z-20), modal (z-30), dan panel inspektor.
   - Mengaktifkan `pointer-events-none` saat objek terseleksi agar badge tidak memblokir klik gizmo panah ataupun mesh 3D.
2. **Koreksi Vektor Pusat Fokus Kamera (`CameraController.tsx`)**:
   - Memperbaiki perhitungan titik pusat fokus objek: menghilangkan penambahan `width / 2` dan `depth / 2` yang redundan (karena origin entitas sudah berada di tengah).
   - Target kamera kini membidik tepat ke titik tengah asli `(x, height / 2, z)` dengan margin pandang proporsional.

---

## ✅ 34. Sistem Validasi & Pembatasan Dimensi Spasial (Phase 34 — Selesai 3 Sep 2026)

Menerapkan sistem pengamanan dan pembatasan dimensi yang ketat, logis, dan terintegrasi standar keselamatan industri:
1. **Batas Dimensi Kustom Gudang (`WAREHOUSE_DIMENSION_LIMITS`)**:
   - **Panjang / Depth (Z)**: `5m` s.d. `500m`.
   - **Lebar / Width (X)**: `5m` s.d. `200m`.
   - **Tinggi Plafon / Height (Y)**: `2.5m` s.d. `30m`.
2. **Relational Clearance Sprinkler Pemadam Kebakaran (`FIRE_SPRINKLER_CLEARANCE`)**:
   - Clearance wajib sebesar `0.5m` di bawah plafon atap gudang.
   - Menghitung tinggi aman maksimum rak secara dinamis: $\text{Tinggi Maksimal Rak} = \text{Tinggi Plafon} - 0.5\text{m}$.
   - Helper otomatis `calculateMaxRackLevels` dan `calculateMaxRackLevelHeight` untuk mencegah konfigurasi rak menyentuh plafon/sprinkler.
3. **Perimeter Containment & Deteksi Okupansi Lengkap (`snapping.ts`)**:
   - Fungsi `getWarehouseOccupiedBounds` kini mengaudit batas spasial seluruh entitas di gudang (rak, struktur fasilitas, dan zona lantai).
   - Mencegah pengecilan ukuran lantai gudang di bawah batas terluar objek yang telah terpasang.
   - Mencegah pengecilan atap gudang di bawah puncak objek tertinggi + 0.5m clearance.
   - Mencegah penambahan atau pergeseran zona yang melampaui dinding perimeter gudang (`calculateMaxZoneDimensions`).
4. **UX Auto-Clamping & Umpan Balik Toast (`PropertiesInspector.tsx`)**:
   - Komponen input `NumericField` dilengkapi callback `onClamp` yang memberikan peringatan instan ketika nilai input pengguna disesuaikan ke batas aman terdekat.
   - Peringatan toast deskriptif muncul saat terjadi pelanggaran batas atau konflik dimensi.

---

## ✅ 35. Standarisasi Icon Pack Modern CAD — Lucide Icons (Phase 35 — Selesai 3 Sep 2026)

Melakukan migrasi menyeluruh terhadap seluruh ikon aplikasi, menggantikan emoji Unicode mentah dan ikon inline SVG usang dengan paket ikon berstandar industri **Lucide Icons (`lucide-react`)**:
1. **Bahasa Desain Modern Minimalist CAD**:
   - Konsistensi ketebalan garis presisi (`strokeWidth={1.75}` untuk tombol/inline dan `1.5` untuk ikon backdrop besar).
   - Skala proporsional: `h-3 w-3` (subtle badges), `h-3.5 w-3.5` (inline inputs/actions), `h-4 w-4` (tabs & buttons), `h-5 w-5` (modal headers & cards).
2. **Pemetaan Semantik Presisi Industri**:
   - Racking: `Boxes`
   - Dock Doors: `DoorClosed`
   - Concrete Walls: `BrickWall`
   - Safety Bollards: `ShieldAlert`
   - Column Pillars: `Columns`
   - Inbound / Receiving: `ArrowDownToLine`
   - Outbound / Shipping: `ArrowUpFromLine`
   - Staging / Sorting: `ArrowLeftRight`
   - Quarantine: `AlertTriangle`
   - Fasilitas Gudang: `Warehouse` & `Building2`
   - Inventaris & Bins: `PackageCheck` & `PackageX`
   - Analitik Muatan & Heatmap: `Scale`, `Activity`, `Zap`
3. **Cakupan 17 Komponen yang Dimigrasikan**:
   - `ViewportToolbar.tsx`, `TopNavToolbar.tsx`, `SidebarPalette.tsx`, `CatalogItemPreviewPopover.tsx`, `SceneOutliner.tsx`, `PropertiesInspector.tsx`, `MultiSelectionInspector.tsx`, `CanvasQuickTips.tsx`, `AisleGeneratorModal.tsx`, `SettingsModal.tsx`, `BinDetailDrawer.tsx`, `HeatmapLegendHUD.tsx`, `ControlsModal.tsx`, `EditorStatusBar.tsx`, `EditorLayout.tsx`, `DashboardClient.tsx`, `CreateBlueprintModal.tsx`, dan floating badge 3D `ProceduralRack.tsx`.
4. **Verifikasi & Build**:
   - Kompilasi produksi Next.js Turbopack bersih: `npm run build` sukses (Exit code 0, 0 error TypeScript dalam 3.9s).

---

## ✅ 36. Simulasi Jalur Pengambilan Barang & Optimasi Rute (Phase 36 — Selesai 10 Sep 2026)

Membangun modul simulasi logistik cerdas tingkat lanjut (**Digital Twin Picking Path & Routing Optimization Engine**) dengan visualisasi interaktif di kanvas Three.js:

1. **Engine Grid Navigasi & Penghindaran Tabrakan Spasial (`grid-map.ts`)**:
   - Memetakan seluruh denah lantai ke grid beresolusi $0.5\text{m}$.
   - Memindai seluruh rak, pilar kolom, dan dinding beton sebagai rintangan fisik dengan clearance pengaman.
   - Fungsi `calculateBayAccessPoint` cerdas yang mengidentifikasi posisi berdiri picker di lorong terbuka ($+Z$ vs $-Z$) di depan rak.
2. **A\* Shortest Pathfinding & Line-of-Sight Smoothing (`astar-pathfinder.ts`)**:
   - Algoritma A* 8-arah dengan heuristik Octile dan proteksi pemotongan sudut diagonal.
   - Penghalusan lintasan raycasting Bresenham yang memangkas belokan zigzag redundan, menghasilkan garis lurus yang mulus di sepanjang lorong gudang tanpa menabrak rintangan fisik.
3. **TSP 2-Opt Heuristic Route Sequencing (`tsp-optimizer.ts`)**:
   - Mengkombinasikan *Nearest Neighbor* dan perbaikan iteratif *2-Opt* untuk memecahkan Traveling Salesperson Problem (Depot $\to$ Picks $\to$ Depot).
   - Menghitung metrik perbandingan rute optimal vs acak (% Jarak & Waktu Tempuh yang Dihemat).
4. **Visualisasi 3D Kanvas & Model Agen Multi-Equipment (`PickingRouteVisualizer.tsx` & `SimulatedVehicleAgent.tsx`)**:
   - Pita lintasan neon animated dash bercahaya di lantai dengan flowing pulse effect.
   - Pin nomor urutan perhentian (1, 2, 3...) di lantai dan sinar laser vertikal terhubung langsung ke slot bin 3D yang ditinggikan pada rak.
   - Model prosedural 3D untuk 3 tipe kendaraan agen:
     - **Forklift Industri**: Sasis kuning keselamatan, tiang mast, garpu dengan palet & karton, serta suar berkedip ($4.0\text{ m/s}$).
     - **AGV Robot Otonom**: Bodi rounded futuristik dengan cincin lampu status LED dan kubah sensor LiDAR yang berputar ($2.5\text{ m/s}$).
     - **Manual Picking Cart**: Keranjang baja bertingkat dengan kotak tote plastik ($1.2\text{ m/s}$).
   - Pergerakan animasi halus dengan interpolasi rotasi yaw (*heading*) menghadap arah laju lintasan.
5. **HUD Pemutar & Manifest Pesanan (`PickingPlaybackDock.tsx` & `PickingManifestDrawer.tsx`)**:
   - Floating Playback Dock di bawah kanvas (Play/Pause, Timeline Scrubbing Slider, Speed Multiplier $1\times, 2\times, 5\times$, dan live telemetri jarak/waktu).
   - Picking Manifest Drawer di sisi kanan berisi checklist item SKU dan kartu komparasi efisiensi penghematan.
   - Mode utama ke-3 `[⚡ Picking Route]` di header navigasi, click-to-pick interaktif langsung pada slot bin di kanvas 3D, serta dukungan penuh dwibahasa (ID/EN) dan Dark/Light mode.
6. **Verifikasi & Pengujian Otomatis**:
   - Test suite baru `scripts/smoke-picking-routing.ts` (`npm run test:picking`): 56 / 56 assertion lolos 100%.
   - Seluruh test suite, `typecheck` (`tsc --noEmit`), dan `next build` lolos 100% tanpa error.

---

## ✅ 43. Phase 37: Interactive Picking Route Editing & Waypoint Manipulation (Selesai 10 Sep 2026)

Menyempurnakan mode Picking Route dengan kapabilitas pengeditan interaktif langsung setelah rute dibuat secara otomatis (*post auto-create route & waypoint editing*):

1. **Direct 3D Floor Dragging untuk Pin Stop & Depot (`DepotMarker.tsx` & `PickingRouteVisualizer.tsx`)**:
   - Pengguna dapat mengeklik dan menyeret pin Depot langsung di lantai kanvas 3D.
   - Setiap pin Stop penjemputan (Stop 1, Stop 2...) dapat diseret di sepanjang lorong gudang untuk memodifikasi titik akses perhentian kendaraan (`accessPoint3D`).
   - Snapping grid presisi ($0.5\text{m}$ / custom) dan pembatasan batas dinding gudang (*bounds clamping*).
   - Selama proses dragging, kontrol kamera OrbitControls otomatis terkunci (`isDirectDragging: true`) agar rotasi pandangan 3D tidak terganggu.
2. **Reordering Urutan Stop & Manual Sequence Lock (`PickingManifestDrawer.tsx`)**:
   - Kontrol tombol navigasi Naik [▲] dan Turun [▼] di setiap kartu perhentian manifest order.
   - Otomatis mengunci urutan rute (`isManualSequence: true`) dengan indikator badge `[🔒 Urutan Manual (Terkunci)]` sehingga algoritma TSP 2-Opt tidak menimpa modifikasi manual pengguna.
   - Tombol `[⚡ Re-Optimize (TSP)]` tersedia di Manifest Drawer dan Toolbar atas untuk mengembalikan urutan matematis terpendek kapan saja.
3. **Custom Transit Waypoints (`routing-engine.ts`, `PickingRouteVisualizer.tsx`, `PickingToolbarHUD.tsx`)**:
   - Pengguna dapat menyisipkan titik belokan/transit perantara kustom di antara stop:
     - Melalui tombol `[+ Waypoint]` pada floating toolbar HUD atas.
     - Melalui klik langsung pada garis lintasan rute polyline 3D di lantai.
   - Waypoint transit dirender sebagai suar berlian ungu bercahaya (*floating purple diamond beacon*) dengan cincin neon lantai.
   - Pin waypoint transit dapat diseret langsung untuk membelokkan rute dan memiliki tombol hapus cepat `[×]`.
4. **Full Command History & Undo/Redo (`PickingCommands.ts`)**:
   - Seluruh tindakan mutasi pengeditan rute diintegrasikan ke Command Pattern (`ICommand`):
     - `createReorderPickStopsCommand`
     - `createMovePickAccessPointCommand`
     - `createMoveDepotPositionCommand`
     - `createAddCustomWaypointCommand`
     - `createRemoveCustomWaypointCommand`
     - `createMoveCustomWaypointCommand`
     - `createAutoOptimizeRouteCommand`
   - Mendukung penuh `Ctrl+Z` (Undo), `Ctrl+Y` (Redo), dan menandai status dokumen belum tersimpan (`isDirty: true`).
5. **Dukungan Dwibahasa Penuh (ID/EN)**:
   - Kamus bahasa Indonesia dan Inggris telah dilengkapi dengan istilah rute picking: `manualSequence`, `autoTsp`, `reorderUp`, `reorderDown`, `reOptimizeBtn`, `addWaypoint`, `customWaypoint`, `deleteWaypoint`, dan `dragDepotHint`.
6. **Verifikasi & Pengujian Otomatis**:
   - Test suite baru `scripts/smoke-picking-editing.ts` (`npm run test:picking-edit`): 26 / 26 assertion lolos 100%.
   - `npm run test:picking`: 56 / 56 assertion lolos 100%.
   - `npm run typecheck` (`tsc --noEmit`): 0 errors (strict zero-`any`).
   - `npm run build` (`next build`): Kompilasi Turbopack selesai dengan exit code 0.

---

## ✅ 44. Phase 38: Direct Polyline Line Editing, Clear Route to Scratch Slate & Manual Point-to-Point Route Creator (Selesai 10 Sep 2026)

Menyempurnakan kapabilitas routing dan manipulasi lintasan logistik 3D dengan 3 pilar interaksi mutakhir hasil wawancara `/grill-me`:

1. **Direct Polyline Line Segment Dragging & Corridor Redirect (`PickingRouteVisualizer.tsx` & `LineBendHandle`)**:
   - Menghitung titik tengah (*midpoint*) dari setiap segmen lintasan polyline antar-stop secara dinamis.
   - Menampilkan *diamond bend handle* bercahaya saat kursor mendekati garis lintasan di lantai.
   - Pengguna dapat mengeklik dan menyeret (*drag*) garis lintasan untuk membelokkan rute ke lorong gudang lain secara langsung (*CAD & Google Maps route pulling interaction*).
   - Menampilkan preview garis elastis (*rubber-band line*) secara dinamis selama drag berlangsung.
2. **Obstacle-Aware Walkability Snapping (`grid-map.ts`)**:
   - Fungsi `findNearestWalkablePoint` memindai kisi rintangan (*walkability grid*) secara radial.
   - Preview visual otomatis berubah warna: biru langit `#38bdf8` jika berada di lorong terbuka (*walkable aisle*) dan merah mawar `#f43f5e` jika berada di atas rak/dinding.
   - Jika pengguna melepas titik pembelok di atas area rintangan, sistem otomatis memagnetkan koordinat ke lorong terbuka terdekat yang valid.
   - Titik pembelok otomatis didaftarkan sebagai `CustomWaypoint` dengan eksekusi `createAddCustomWaypointCommand`, memberikan integrasi A* seketika dan full Undo/Redo (`Ctrl+Z`).
3. **Clear / Reset Rute Menyeluruh ke Scratch Mode (`ClearRouteModal.tsx` & `PickingCommands.ts`)**:
   - Tombol tempat sampah di Floating Toolbar HUD dan Manifest Drawer kini membuka dialog konfirmasi glassmorphic dengan ringkasan rute (jumlah perhentian, titik transit, total jarak tempuh).
   - Menjaga posisi kustom Depot agar tidak tereset ke posisi awal secara paksa.
   - Perintah atomic `createClearPickingRouteCommand` membersihkan seluruh rute dan snapshot data sebelumnya disimpan di Command Stack sehingga pengguna dapat membatalkan penghapusan (`Ctrl+Z`) dan memulihkan seluruh rute seketika.
4. **Manual Point-to-Point Route Creator (`PickingToolbarHUD.tsx` & `ProceduralRack.tsx`)**:
   - Mode interaktif baru `[✏️ Rancang Rute Manual]` yang dapat diaktifkan melalui tombol toolbar dengan indikator pendaran aktif (*pulsing indicator*).
   - Banner instruksi melayang di atas kanvas memandu pengguna untuk mengeklik slot bin satu per satu secara berurutan.
   - Setiap slot bin yang diklik otomatis ditambahkan sebagai perhentian berikutnya (`isManualSequence: true`) dengan eksekusi `createAddBinToManualRouteCommand`, memperbarui polyline lintasan A* secara live tanpa diacak ulang oleh TSP.
5. **Blueprint JSON Persistence & Zod Schema Validation (`layout-schema.ts` & `TopNavToolbar.tsx`)**:
   - Menyimpan konfigurasi rute (`pickList`, `customWaypoints`, `depotPosition`, `selectedVehicleType`, `isManualSequence`) ke dalam skema `WarehouseLayoutBlueprint` saat diekspor ke JSON.
   - Validasi runtime Zod ketat (`PickingRouteConfigSchema`) yang menjaga 100% kompatibilitas mundur (*backward compatibility*) untuk blueprint lama yang belum memiliki konfigurasi picking.
6. **Dukungan Dwibahasa Penuh (ID/EN) & Tema Ganda**:
   - Menambahkan seluruh string Phase 38 ke kamus `id.ts` dan `en.ts` dengan 100% parity (212 keys terverifikasi).
   - Desain antarmuka responsif untuk Dark Mode slate dan Clean Light Mode.
7. **Verifikasi & Pengujian Otomatis**:
   - Test suite baru `scripts/smoke-picking-phase38.ts` (`npm run test:picking-p38`): 39 / 39 assertion lolos 100%.
   - Seluruh test suite (`test:smoke`, `test:snapping`, `test:wms`, `test:heatmap`, `test:hitboxes`, `test:direct-drag`, `test:multi-select`, `test:templates`, `test:tour`, `test:settings`, `test:aisle`, `test:picking`, `test:picking-edit`, `test:picking-p38`) lolos 100%.
   - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
   - `npm run build` (`next build`): Kompilasi Turbopack selesai dengan sukses (exit code 0).

## ✅ 45. Phase 38 Extended: 3D ID Badge Anti-Collision, Smart LOD & Display Mode Toggle (Selesai 10 Sep 2026)

Menyelesaikan permasalahan tumpukan visual ID badge pada kanvas 3D Picking Route ketika perhentian berada di lorong yang berdekatan atau pada bay rak yang berdampingan:

1. **Smart LOD & Anti-Collision Hybrid (`PickingRouteVisualizer.tsx`)**:
   - Menghitung peta kedekatan (*proximity map*) spasial secara otomatis antar-perhentian ($\le 3.5\text{m}$ atau berada di rak yang sama).
   - Perhentian yang terdeteksi berkerumun (*clustered*) otomatis beralih ke badge lingkaran ringkas (*compact circular badge*) yang menampilkan nomor perhentian (`[4]`, `[5]`), menghilangkan polusi visual pill teks panjang yang saling bertubrukan.
   - Mengimplementasikan elevasi bertingkat (*vertical staggering*): pin berpasangan diatur pada ketinggian $Y=0.85\text{m}$ dan $Y=1.30\text{m}$ untuk menghindari tumpang tindih visual dari sudut kamera manapun.
2. **Dynamic Hover & Active Pin Expansion**:
   - Mengarahkan kursor (*hover*) ke pin atau badge perhentian ringkas secara instan memperluas tampilannya menjadi pill ID bin lengkap (`[5] C02-03-03`).
   - Perhentian yang sedang aktif diambil oleh kendaraan (`isCurrent`) atau sedang digeser (`isDraggingThis`) otomatis selalu diperluas dan diprioritaskan.
3. **Pilihan Mode Tampilan di Toolbar HUD (`PickingToolbarHUD.tsx` & `pickingSlice.ts`)**:
   - Menambahkan tombol toggle mode tampilan badge di Floating Toolbar HUD:
     - `'SMART'` (Bawaan): Smart LOD adaptif, hanya meringkas ID yang berdekatan/bertumpuk.
     - `'FULL'`: Selalu menampilkan ID bin lengkap pada seluruh perhentian.
     - `'COMPACT'`: Menampilkan nomor perhentian ringkas pada semua titik rute.
   - State `badgeDisplayMode` tersimpan reaktif di Zustand `useEditorStore` dengan helper `toggleBadgeDisplayMode()`.
4. **Pembersihan Tumpukan Telemetri Kendaraan di Depot (`SimulatedVehicleAgent.tsx`)**:
   - Ketinggian badge telemetri kendaraan ditinggikan dari $Y=2.2\text{m}$ ke $Y=2.8\text{m}$ agar memiliki jarak visual yang bersih dari marka lantai dan rak.
   - Badge telemetri kendaraan disembunyikan secara kondisional ketika kendaraan dalam kondisi parkir diam di Depot (`!playbackState.isPlaying && playbackState.progress < 0.01`), mencegah tubrukan visual dengan label `DEPOT / PACKING BASE`.
5. **Dukungan Dwibahasa Penuh (ID/EN) & Validasi**:
   - Menambahkan kunci terjemahan `badgeDisplayMode`, `badgeModeSmart`, `badgeModeFull`, `badgeModeCompact` pada `id.ts` dan `en.ts` dengan 100% key parity (216 keys terverifikasi).
   - Test suite `scripts/smoke-picking-phase38.ts` (`npm run test:picking-p38`): 55 / 55 assertion lolos 100%.
   - `npm run test:settings` (216 keys dictionary parity): lolos 100%.
   - `npm run build`: Kompilasi Next.js Turbopack sukses dengan exit code 0.
6. **Relokasi ID Badge Zona Operasional ke Sudut Kiri Atas Area (`ZoneFootprint.tsx`)**:
   - Menggeser posisi badge label/ID zona operasional (`RECEIVING-01`, `SHIPPING-01`, `STAGING-01`, `QUARANTINE-01`) dari titik tengah (*dead center* `[0, 0.25, 0]`) ke sudut kiri atas area (*top-left corner* `[-width/2 + margin, 0.25, -depth/2 + margin]`).
   - Mencegah label tertutup oleh muatan, palet, maupun rak yang ditempatkan di dalam area zona operasional sesuai standar cetak biru CAD / WMS Digital Twin.

---

## ✅ 46. Phase 38 Extended: Selection Isolation & Layout Entity Lock in Picking Route Mode (Selesai 10 Sep 2026)

Menerapkan isolasi seleksi penuh (*complete selection isolation*) saat pengguna berada di menu **Picking Route** (`editorViewMode === 'PICKING'`) sesuai prinsip UX aplikasi CAD/WMS profesional:

1. **Pembersihan Seleksi Otomatis Saat Beralih Mode (`selectionSlice.ts`)**:
   - Transisi ke mode `'PICKING'` secara otomatis dan atomik membersihkan `selectedEntityId: null`, `selectedEntityIds: []`, `hoveredEntityId: null`, dan mereset FSM mode ke `'IDLE'`.
   - Mengeliminasi *residual selection rings* atau gizmo transformasi layout yang tertinggal saat masuk ke mode simulasi rute.
2. **Karantina Klik & Drag pada Hook Universal (`useDirectEntityDrag.ts`)**:
   - Menambahkan guard `if (disabled) return;` pada handler `onClick` selain `onPointerDown`.
   - Menjamin bahwa setiap elemen yang diberi flag `disabled: true` tidak akan pernah merespons klik, mengaktifkan seleksi, ataupun memicu drag.
3. **Penguncian Seleksi 3D Entitas Layout pada Kanvas**:
   - **`ProceduralRack.tsx`**: Seleksi root rack dibatasi hanya untuk `editorViewMode === 'LAYOUT'`. Interaksi slot bin (`handleSlotClick`) tetap aktif 100% untuk memilih atau membatalkan pick target.
   - **`ProceduralStructure.tsx`**: Dinding, kolom/tiang struktural, dock door, dan bollard di-disable (`disabled: editorViewMode !== 'LAYOUT'`). Hover highlight, grab cursor, dan seleksi dinonaktifkan di mode Picking.
   - **`ZoneFootprint.tsx`**: Seluruh zona operasional di-disable saat di mode Picking (`disabled: editorViewMode !== 'LAYOUT'`). Pointer events pada badge label zona juga dinonaktifkan (`pointerEvents: 'none'`).
4. **Isolasi Marquee Box Multi-Selection (`MarqueeSelection.tsx`)**:
   - Shift-drag kotak seleksi multi-objek langsung dicegah jika `editorViewMode !== 'LAYOUT'`.
5. **Penguncian Scene Outliner & Indikator Visual (`SceneOutliner.tsx`)**:
   - Daftar entitas layout (rak, struktur, zona) di panel Outliner menjadi *read-only* saat mode Picking aktif (`pointer-events-none` & cursor not-allowed).
   - Tombol hapus entitas disembunyikan secara kondisional.
   - Banner informasi amber/emas dengan ikon gembok ditampilkan di bagian atas Outliner: *"Mode Rute Picking Aktif — Entitas layout terkunci. Beralih ke Mode Tata Letak untuk memilih & memodifikasi objek."*
6. **Verifikasi & Pengujian Otomatis**:
   - Test Group 8 pada `scripts/smoke-picking-phase38.ts`: 65 / 65 assertion lolos 100%.
   - Seluruh test suite (`test:picking-p38`, `test:picking`, `test:picking-edit`, `test:settings`, `test:wms`) lolos 100%.
   - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
   - `npm run build`: Kompilasi Next.js Turbopack sukses dengan exit code 0.

---

## ✅ 47. Phase 38 Extended: Dedicated Workspace Layout for Picking Route & UI Collision Prevention (Selesai 10 Sep 2026)

Menyelesaikan tumpukan visual antarmuka (*UI collisions*) pada menu **Picking Route** hasil wawancara `/grill-me`:

1. **Sub-Header Bar Terintegrasi (`PickingToolbarHUD.tsx`)**:
   - Memindahkan toolbar picking dari floating capsule di tengah atas kanvas menjadi **Sub-Header Bar baris kedua** yang terpasang (*docked*) langsung di bawah `TopNavToolbar`.
   - Membebaskan kanvas 3D sehingga `ViewportToolbar` (tombol kamera, zoom, snapping di pojok kanan atas kanvas) tidak lagi tertabrak atau tertutup.
   - Tombol layout yang tidak relevan di navbar atas (`Array Lorong`) otomatis disembunyikan di mode Picking.
2. **Docked Right Sidebar untuk Manifest Pesanan (`PickingManifestDrawer.tsx` & `EditorLayout.tsx`)**:
   - Manifest Pesanan kini berfungsi sebagai panel sidebar kanan yang terpasang (*docked sidebar* `w-96`) menggantikan Properties Inspector secara otomatis.
   - Kanvas 3D secara elastis menyesuaikan ukuran lebarnya tanpa ada elemen kanvas, entitas, ataupun kontrol kanan yang tertimpa.
   - Jika sidebar ditutup, tombol expand kanan menampilkan ikon `Package` dan teks *"Manifest"*.
   - Tombol toggle Manifest di sub-header terhubung langsung membuka/menutup sidebar kanan ini.
3. **Docked Playback Footer Bar (`PickingPlaybackDock.tsx`)**:
   - Mengubah player simulasi dari floating dock yang menumpuk di atas status bar menjadi **Footer Bar Terpasang (*docked footer*)** yang menggantikan `EditorStatusBar` secara langsung saat di mode Picking.
   - Mengintegrasikan Play/Pause, Rewind, Stop Counter, Bin ID aktif, Scrub Timeline Slider, estimasi waktu/jarak tempuh, pengatur kecepatan (1x, 2x, 5x), badge efisiensi TSP, serta tombol Panduan Kontrol 3D.
   - Menampilkan status bar panduan yang rapi saat daftar perhentian masih kosong (*empty pick list*).
4. **Auto-Collapse Sidebar Kiri saat Masuk Mode Picking**:
   - Sidebar kiri (Katalog Aset & Outliner) otomatis ditutup saat berpindah ke mode Picking untuk memaksimalkan area pandang kanvas 3D.
   - Pengguna tetap dapat membukanya kembali sewaktu-waktu lewat tombol toggle, dan status terbuka semula otomatis dipulihkan saat pengguna kembali ke mode Layout Builder.
5. **Verifikasi & Pengujian Otomatis**:
   - Test Group 9 pada `scripts/smoke-picking-phase38.ts` (`npm run test:picking-p38`): 74 / 74 assertion lolos 100%.
   - Seluruh test suite (`test:picking`, `test:picking-edit`, `test:settings`, `test:wms`) lolos 100%.
   - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
   - `npm run build` (`next build`): Kompilasi Turbopack produksi sukses 100% (exit code 0).

## ✅ 48. Blueprint Header Redesign & Zero-Shift Unification (Selesai 10 Sep 2026)

Redesign menyeluruh pada arsitektur header Blueprint (`TopNavToolbar`) dan layout workspace untuk mengeliminasi 100% pergeseran posisi elemen (*zero UI shift/jump*) serta menyatukan sub-menu yang membingungkan saat beralih antara **Layout Builder**, **WMS Inventory**, dan **Picking Route** sesuai hasil interview `/grill-me`:

1. **Dead-Center Invariant Mode Switcher (`TopNavToolbar.tsx`)**:
   - Menambatkan tombol pengalih mode (`[Layout Builder] [WMS Inventory] [Picking Route]`) pada koordinat dead-center absolut (`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10`).
   - Header atas memiliki tinggi tetap (`h-14` / 56px) dan posisi yang 100% invarian di ketiga mode tanpa bergeser satu piksel pun.
   - Membersihkan injeksi tombol-tombol dinamis WMS (`Randomize 70%`, `Stock All`, `Empty All`, meter okupansi) dan badge picks dari header tengah.
2. **Eliminasi Sub-Header Baris Kedua di Kanvas (`EditorLayout.tsx`)**:
   - Menghapus komponen baris kedua (`PickingToolbarHUD`) dari alur layout global.
   - Kanvas 3D kini mempertahankan ketinggian viewport yang stabil dan konsisten di ketiga mode tanpa ada dorongan atau lompatan vertikal saat masuk/keluar dari mode Picking.
3. **Pusat Kontrol Terpadu di Panel Manifest Kanan (`PickingManifestDrawer.tsx`)**:
   - Menyatukan seluruh kontrol picking ke dalam kartu terpadu (*Unified Routing Control Center Card*) di bagian atas drawer Manifest kanan:
     - **Armada Kendaraan (Fleet Selector)**: Tombol pemilih 3 armada (`Forklift` 4.0 m/s, `AGV Robot` 2.5 m/s, `Picking Cart` 1.2 m/s).
     - **Simulasi Pesanan**: Tombol generator cepat `[Sample (8)]` dan `[Wave (16)]`.
     - **Alat Rancang Rute**: `[✏️ Rancang Manual]` (dengan badge status aktif & animasi denyut), `[+ Waypoint]`, `[⚡ Re-Optimize]`, `[Refresh]`, dan `[Kosongkan]`.
     - **Visual & Depot**: Toggle mode ID kanvas (`Smart LOD` / `Full IDs` / `Compact`) dan koordinat Depot.
     - **Panduan Interaktif**: Banner panduan instruktif yang muncul otomatis saat Mode Rancang Rute manual aktif.
4. **Integrasi WMS Capacity Overview & Batch Actions ke Inspector Kanan (`PropertiesInspector.tsx`)**:
   - Memindahkan ringkasan okupansi gudang (total rak, total bin, bin terisi, bin kosong, dan bilah progres persentase) ke panel Inspector kanan saat mode WMS aktif dan tidak ada objek individual yang dipilih.
   - Menempatkan tombol aksi batch gudang (`[Randomize 70% Stock]`, `[Stock All (100%)]`, dan `[Empty All (0%)]`) secara ergonomis dengan dukungan penuh `Undo/Redo` (`Ctrl+Z`).
5. **Header Kanan 100% Statis & Relokasi Array Lorong (`SidebarPalette.tsx`)**:
   - Sisi kanan header `TopNavToolbar` kini 100% statis memuat kontrol global yang berlaku universal: `Undo/Redo`, `Pengaturan`, `Panduan`, `Ekspor`, dan `Simpan`.
   - Tombol peluncur `[Array Lorong (Aisle Generator)]` dipindahkan ke panel kiri katalog aset (`SidebarPalette.tsx`) pada header bagian *Storage Racking* serta pada panel Inspector saat rak dipilih.
6. **Verifikasi & Pengujian Otomatis**:
   - Menambahkan Test Group 10 pada `scripts/smoke-picking-phase38.ts` (`npm run test:picking-p38`): 90 / 90 assertion lolos 100%.
   - Seluruh test suite (`test:picking`, `test:picking-edit`, `test:wms`, `test:settings`) lolos 100%.
   - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
   - `npm run build` (`next build`): Kompilasi Turbopack produksi sukses 100% (exit code 0).

## ✅ 49. Phase 39: Visualisasi Pallet & Kargo di Zona Operasional (Selesai 10 Sep 2026)

Menghadirkan sistem visualisasi 3D **Staging Pallet & Kargo di Zona Operasional (Receiving, Shipping, Picking/Staging)** lengkap dengan sistem penempatan anti-collision, mini tag ID slot di pojok kiri atas, drawer inspeksi kargo WMS di sisi kanan, serta integrasi kontrol staging di Properties Inspector:

1. **Kontrak Data & Skema Validasi Zod (`layout.ts` & `layout-schema.ts`)**:
   - Menambahkan tipe `ZonePalletSlot` dengan metadata posisi relatif, indeks slot, grid baris/kolom, status okupansi, dan `skuData?: BinSkuData`.
   - Menambahkan tipe `ZoneStagingConfig` (`enabled`, `slots`, `palletWidth`, `palletDepth`) pada `WarehouseZone` dengan kompatibilitas mundur 100% (opsional).
   - Menambahkan skema Zod `ZonePalletSlotSchema` dan `ZoneStagingConfigSchema` untuk validasi runtime dan serialisasi blueprint JSON yang aman.
2. **Procedural Staging Generator Engine (`zone-pallet-generator.ts`)**:
   - Menghitung grid baris dan kolom palet Euro standar ($1.2\text{m} \times 1.0\text{m} \times 0.144\text{m}$) dengan celah lorong forklift $0.45\text{m}$ dan margin perimeter $0.5\text{m}$ di dalam dimensi zona operasional secara deterministik.
   - Menghasilkan matriks 3D `Matrix4[]` untuk instancing palet kayu pinus dan tumpukan kardus kargo bertingkat.
   - Menyediakan generator mock data SKU kargo yang realistis disesuaikan dengan tipe zona (Inbound/Outbound/Staging).
3. **Atomic Command Pipeline & Undo/Redo (`ZonePalletCommands.ts`)**:
   - `createUpdateZonePalletCommand`: Mengubah status okupansi dan SKU data untuk palet spesifik dengan dukungan Undo/Redo (`Ctrl+Z`).
   - `createBatchUpdateZonePalletsCommand`: Mengisi semua palet (100% occupied) atau mengosongkan semua palet (0% occupied) dalam zona secara atomic dengan snapshot pemulihan.
   - `createUpdateZoneStagingConfigCommand`: Mengaktifkan atau menonaktifkan fitur staging pada zona.
4. **Ekstensi Zustand Store (`blueprintSlice.ts` & `selectionSlice.ts`)**:
   - Menambahkan state mutators: `updateZonePallet`, `batchUpdateZonePallets`, `updateZoneStagingConfig`.
   - Menambahkan koordinasi seleksi: `selectedZonePallet: { zoneId: string; palletId: string } | null`, `selectZonePallet`, `deselectZonePallet`.
   - Otomatis beralih ke mode WMS saat palet zona dipilih, serta membersihkan seleksi saat beralih ke mode Layout atau Picking.
5. **3D Canvas Rendering & ID Labeling Anti-Collision (`ZoneFootprint.tsx`)**:
   - Render efisien menggunakan Three.js `InstancedMesh` untuk palet kayu pinus (`#c49a63`) dan tumpukan kardus kargo kraft (`#cb9b51`).
   - **Master Label Zona**: Ditempatkan di **kiri atas area zona** menampilkan nama zona dan rasio okupansi palet: `[ZONE NAME] · X/Y Pallets (Z%)`.
   - **Mini ID Tag Palet**: Ditempatkan di **pojok kiri atas masing-masing slot palet** (`P-01`, `P-02`, dst.).
   - Di mode WMS, mengarahkan kursor (*hover*) memunculkan tooltip popover lengkap dengan nomor lot, SKU, kuantitas koli, dan berat kargo.
   - Mengeklik palet 3D atau mini tag membuka `ZonePalletDrawer` dan memunculkan kotak pendar hijau emerald di sekeliling palet aktif.
   - Di mode Layout, tag individual disembunyikan agar kanvas tetap bersih dan fokus pada pembentukan batas zona.
6. **WMS Zone Pallet Slide-Over Drawer (`ZonePalletDrawer.tsx` & `EditorLayout.tsx`)**:
   - Panel slide-over di sisi kanan saat palet di zona diklik pada mode WMS.
   - Menampilkan: Header ID Palet, Tipe Zona (Inbound/Outbound/Staging), status slot, meter beban muatan (berat aktual vs kapasitas standar 1000 kg), formulir edit SKU (Nama Barang, Kode SKU, Nomor Lot, Kuantitas, Berat, Klasifikasi ABC Velocity), serta tombol aksi cepat `[Isi Kargo]`, `[Kosongkan]`, dan `[Acak Demo]`.
7. **Kontrol Staging di Properties Inspector (`PropertiesInspector.tsx`)**:
   - Pada kartu `ZonePropertiesInspector`, ditambahkan seksi **Staging Pallet Grid**:
     - Toggle *"Tampilkan Palet Staging"*.
     - Indikator kapasitas slot palet dan persentase okupansi.
     - Tombol aksi batch: `[Isi Semua]` dan `[Kosongkan]`.
8. **Verifikasi & Pengujian Otomatis (`smoke-zone-pallets.ts`)**:
   - Script pengujian baru `npm run test:zone-pallets`: 25 / 25 assertion lolos 100%.
   - Seluruh test suite regresi (`test:picking-p38`, `test:picking`, `test:picking-edit`, `test:wms`, `test:settings`) lolos 100%.
   - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
   - `npm run build` (`next build`): Kompilasi Turbopack produksi Next.js sukses 100% (exit code 0).

---

## ✅ 40. Phase 40 — Multi-Floor / Mezzanine Vertical Layers & Z-Elevation Multi-Tier Routing (Selesai 15 Sep 2026)

Fase 40 menghadirkan arsitektur multi-lantai menyeluruh ke dalam 3D Warehouse OS:
1. **Hybrid Multi-Floor Architecture & Zod Contracts (`types/layout.ts`, `layout-schema.ts`, `warehouse-defaults.ts`)**:
   - Model `BuildingLevel` (`id`, `name`, `elevationY`, `height`, `orderIndex`, `type: 'GROUND' | 'MEZZANINE' | 'UPPER'`, `colorHex`).
   - Model `VerticalConnector` (`id`, `name`, `type: 'cargo_lift' | 'lift' | 'ramp' | 'stairs'`, `position`, `rotationY`, `dimensions`, `fromLevelId`, `toLevelId`).
   - Opsional `levelId?` pada `RackEntity`, `StructuralElement`, dan `WarehouseZone`.
   - 100% backward-compatible: blueprint lama yang tidak memiliki level otomatis difallback ke `level-1` (Ground Level, Y=0).
2. **Interactive Floor Slice Controller (`viewSlice.ts`, `ViewportToolbar.tsx`)**:
   - State `activeLevelId: string | 'ALL'` dan `floorSliceMode: 'ISOLATE' | 'GHOST_UPPER' | 'ALL'`.
   - Pill selector di Viewport HUD Toolbar: `[Semua | L1 | L2 | ...]`.
   - Toggle instan `[Isolate]` vs `[Ghost]` untuk kenyamanan inspeksi lantai mezzanine tanpa terhalang lantai atas.
3. **Procedural 3D Vertical Connectors (`ProceduralVerticalConnector.tsx`)**:
   - **Cargo Lift (`cargo_lift`/`lift`)**: 4 tiang baja sudut (`#475569`), motor housing atas (`#334155`), wire-frame/glass cabin cage transparan dengan hazard border (`#eab308`).
   - **Access Ramp (`ramp`)**: Incline slab wedge (`#64748b`), dual safety guardrails (`#eab308`), dan seamless floor alignment.
   - **Industrial Stairs (`stairs`)**: Dual channel stringers (`#334155`), stepped treads bertingkat (`#475569`), dan continuous handrails (`#f59e0b`).
   - Volumetric invisible raycast hitboxes, hover/selection edge outlines, dan dynamic floating HTML badges.
4. **Multilayer Floor Slabs & Entity Filtering (`WarehouseFloor.tsx`, `ProceduralRack.tsx`, `ProceduralStructure.tsx`, `ZoneFootprint.tsx`)**:
   - Multi-slab rendering pada tiap ketinggian `elevationY`.
   - Entitas di lantai atas otomatis disembunyikan (`ISOLATE`) atau dibuat transparan (`GHOST_UPPER`) sesuai level aktif.
   - Preview penempatan (`PlacementPreview.tsx`) otomatis menyesuaikan elevasi lantai aktif.
5. **Multilayer A* Routing & Equipment Constraints (`routing-engine.ts`)**:
   - Algoritma 3D A* pathfinding yang mendeteksi lompatan elevasi vertikal antar waypoint/stop.
   - Deteksi konektor terdekat via `findBestConnector(startPos, targetPos, vehicleType, verticalConnectors)`.
   - **Equipment Constraints**: Forklift dan AGV hanya diizinkan melalui Cargo Lift dan Ramp (dilarang menaiki tangga manual). Picking Trolley / Cart manual diizinkan di semua konektor.
   - **Realistis Transit Delays**: Waktu buka/tutup pintu lift + kecepatan lift 0.8 m/s, reduksi kecepatan ramp 20%, dan kecepatan tangga 0.9 m/s.
6. **3D Waypoints, Polyline & Vehicle Agents (`PickingRouteVisualizer.tsx`, `SimulatedVehicleAgent.tsx`)**:
   - Polyline 3D bercahaya yang menghubungkan antar elevasi lantai secara mulus.
   - Pin nomor stop dan label elevasi per lantai.
   - Agen kendaraan 3D menginterpolasi elevasi Y dan melakukan pitch rotation (kemiringan sudut) saat menaiki tanjakan ramp.
7. **Palette, Popover, Inspector & Outliner Integration (`SidebarPalette.tsx`, `CatalogItemPreviewPopover.tsx`, `PropertiesInspector.tsx`, `SceneOutliner.tsx`)**:
   - Kategori palet baru "Akses Vertikal" dengan 3 konektor.
   - Blueprint vector popover dengan dimensi spesifikasi teknis.
   - Contextual `ConnectorPropertiesInspector` untuk mengubah level asal, level tujuan, dimensi, dan orientasi.
   - Manajemen `BuildingLevels` di "Facility & Grid" inspector.
   - Grouping "Vertical Connectors" di Scene Outliner.
8. **ICommand Undo/Redo Pipeline (`BuildingLevelCommands.ts`, `VerticalConnectorCommands.ts`)**:
   - Dukungan penuh `Ctrl+Z` / `Ctrl+Y` untuk penambahan, penghapusan, modifikasi posisi, dan rotasi level serta konektor.
9. **Dual-Language Dictionary Parity (`id.ts`, `en.ts`)**:
   - 100% key parity untuk seksi `multiFloor` di Bahasa Indonesia dan Bahasa Inggris.
10. **Pengujian & Verifikasi Kualitas Otomatis (`scripts/smoke-multi-floor.ts`)**:
    - Script verifikasi khusus `npm run test:multi-floor`: 28 / 28 test assertions lolos 100%.
    - Test suite regresi (`test:picking-p38`, `test:picking`, `test:wms`, `test:settings`) lolos 100%.
    - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
    - `npm run build` (`next build`): Turbopack production build lolos sukses 100% (exit code 0).

---

## ✅ 41. Phase 40 Ext — Multi-Floor Operations, Strict Level Isolation & Placement Hardening (Selesai 15 Sep 2026)

Fase 40 Ext mengintegrasikan konsistensi multi-lantai secara komprehensif di seluruh subsistem 3D Warehouse OS (Layout Builder, WMS Inventory, Picking Route, dan Catalogue):
1. **Synchronized Active Floor Context di Semua Subsistem**:
   - Seluruh workspace (3D Canvas, Sidebar Catalogue, Properties Inspector, WMS Inventory Drawer, dan Picking Route Generator) terikat secara reaktif pada `activeLevelId` di `viewSlice`.
   - Grid 3D (`WarehouseFloor.tsx`) berelevasi otomatis mengikuti ketinggian lantai aktif (`elevationY`), memberikan feedback visual bidang kerja yang akurat.
2. **Strict Level Isolation & Zero-Bleeding untuk Zona & Akses Vertikal (`ZoneFootprint.tsx`, `ProceduralVerticalConnector.tsx`)**:
   - Memperbaiki isu visual tembus/bleeding: zona operasional (`WarehouseZone`) dan konektor vertikal (`VerticalConnector`) kini mematuhi filter `floorSliceMode` (`ISOLATE` dan `GHOST_UPPER`).
   - Ketika pengguna aktif di lantai 2 dalam mode `ISOLATE`, zona lantai 1 atau konektor yang tidak relevan dengan level aktif disembunyikan sepenuhnya.
   - Raycasting dan event handler dilock per lantai aktif sehingga interaksi klik/drag tidak bocor ke lantai non-aktif di bawahnya.
3. **Placement Preview & Raycast Elevation Alignment (`PlacementPreview.tsx`)**:
   - Penempatan entitas dari katalog secara cerdas mengunci koordinat base Y pada elevasi lantai aktif, mencegah objek melayang atau tenggelam ke ground floor.
   - Penanganan crash `TransformControls: The attached 3D object must be a part of the scene graph` dengan validasi referensi objek 3D sebelum `attach()` saat beralih mode.
4. **Batasan Realistis Multi-Floor (Max 4 Lantai / Mezzanine)**:
   - Pembatasan realistis `MAX_BUILDING_LEVELS = 4` (Ground Floor + hingga 3 tingkat mezzanine industri) sesuai batas struktural beban baja, clearance sistem sprinkler pemadam kebakaran, dan regulasi keselamatan gedung logistik.
5. **Multi-Floor WMS & Picking Route Seamless Interoperability**:
   - Drawer WMS Inventory secara kontekstual memfilter rak dan slot bin berdasarkan lantai aktif.
   - Manifest picking route menampilkan alert banner transisi vertikal (`Vertical Transit`) lengkap dengan instruksi penggunaan alat (Forklift/AGV via Lift & Ramp, Manual Cart via Tangga).
6. **Verifikasi Kualitas & Regresi**:
   - Script verifikasi khusus `npm run test:multi-floor-ops`: 43 / 43 test assertions lolos 100%.

---

## ✅ 42. Codebase Audit, Hardening & Eksekusi P0–P2 (Selesai 15 Sep 2026)

Menjalankan audit sistematis terhadap seluruh arsitektur proyek, integritas runtime, boundary layer, serta mengeksekusi seluruh paket perbaikan prioritas P0 hingga P2:
1. **Pemeriksaan Kompilasi & Build Turbopack**:
   - `npm run typecheck` (`tsc --noEmit`): 0 error TypeScript (strict zero-`any`).
   - Seluruh test suite lolos sempurna 100%:
     - `test:multi-floor`: 28 / 28 passing (100%)
     - `test:multi-floor-ops`: 43 / 43 passing (100%)
     - `test:picking`: 72 / 72 passing (100%)
     - `test:zone-pallets`: 25 / 25 passing (100%)
     - `test:smoke`: 8 / 8 passing (100%)
   - Production build `npm run build`: Kompilasi sukses dalam 14.3 detik tanpa error.
2. **Eksekusi Perbaikan Bug Kritis (Priority 0)**:
   - **Perhitungan Ketinggian & Elevasi Mezzanine (`PropertiesInspector.tsx`)**:
     - Memperbaiki `handleQuickAddMezzanine` agar menghitung `sourceElevation = sourceLevel.elevationY` dan `height = Math.max(1, newElevation - sourceElevation)`.
     - Menyelaraskan `position.y` konektor vertikal langsung ke lantai dasar/asal sehingga tidak terjadi *floor clipping* atau konektor menggantung.
   - **Guard Visibilitas & Seleksi `ZoneFootprint` (`ZoneFootprint.tsx`)**:
     - Memperbarui guard menjadi `if (isHidden && !isEffectiveSelected) return null;` dan menyesuaikan material seleksi.
     - Mencegah hilangnya hitbox / seleksi atau timbulnya *ghost mesh* saat beralih mode isolasi lantai (`ISOLATE`).
3. **Peningkatan Maintainability & Keamanan Arsitektur (Priority 1)**:
   - **Enkapsulasi State Singleton `placementBus` (`placement-bus.ts`)**:
     - Menyediakan fungsi mutasi dan pembaca terkontrol: `setPlacementDragOver`, `setPlacementItem`, `registerCameraBridge`, `unregisterCameraBridge`, `resetPlacementBus`, dan `getPlacementBusState`.
     - Mengeliminasi mutasi properti langsung dari `EditorLayout.tsx`, `SidebarPalette.tsx`, `CameraBridge.tsx`, dan `PlacementPreview.tsx` dengan tetap menjamin performa 60 FPS tanpa re-render berlebih.
   - **Sentralisasi Nilai Hardcoded & Batasan Level**:
     - Menambahkan `DEFAULT_PALLET_OCCUPANCY_RATIO = 0.66` pada `warehouse-defaults.ts`.
     - Menghubungkan perhitungan okupansi default pada `zone-pallet-generator.ts` ke konstanta tersebut.
     - Menghubungkan limit `MAX_BUILDING_LEVELS` dan `DEFAULT_LEVEL_HEIGHT` ke `PropertiesInspector.tsx`.
4. **UI Hardening & Internasionalisasi (Priority 2)**:
   - Menambahkan dictionary `editor.inspector` di `en.ts` dan `id.ts` untuk label konektor vertikal, teks tombol mezzanine, batas lantai maksimum, dan dialog elevasi.
   - Mengintegrasikan hook `useTranslation()` ke `PropertiesInspector.tsx` dan `EditorLayout.tsx`.
5. **Dokumentasi & Verifikasi Selesai**:
   - Seluruh checklist pada [`TODO_TOMORROW.md`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/TODO_TOMORROW.md) telah ditandai tuntas (`[x]`).
   - Laporan audit dan alur verifikasi terdokumentasi lengkap di artifact rencana kerja.

---

## ✅ 43. Phase 41: Automated Multi-Agent Fleet Simulation & Dynamic Traffic Control (Selesai 16 Sep 2026)

Fase 41 mengintegrasikan simulasi armada majemuk skala industri (Multi-Agent Fleet Simulation) dengan kendali lalu lintas dinamis (Dynamic Traffic Control) dan siklus energi baterai pada `3D Warehouse OS`:

1. **Multi-Agent Fleet Architecture & VRP Dispatching (`fleet-dispatcher.ts`)**:
   - **Ukuran Armada Dinamis (1–6 Unit)**: Mendukung konfigurasi awal default 3 armada (1 Forklift + 2 AGV) hingga batas maksimal 6 unit dengan kode warna poligram unik (`FLEET_PALETTE_COLORS`).
   - **VRP Partitioning Otomatis**: Partisi pesanan berbasis kapasitas muatan (*payload capacity*) dan klasterisasi spasial (*spatial clustering*). Beban berat (>20kg) diprioritaskan untuk Forklift, barang ringan/cepat dialokasikan ke AGV & Cart.
   - **Individual A* Pathfinding**: Setiap kendaraan menghitung rute A* independen dengan depot awal yang berjarak aman (*spacing offset*), menghasilkan polyline rute multi-warna di canvas 3D.
2. **Dynamic Traffic Controller & Radar Collision Avoidance (`traffic-controller.ts`)**:
   - **Forward Radar Cone**: Deteksi proksimitas radius 2.8m antar armada pada lantai yang sama.
   - **Hierarki Prioritas Kendaraan**: `FORKLIFT` (Bobot 3) > `AGV` (Bobot 2) > `CART` (Bobot 1). Jika tipe sama, kendaraan dengan progres rute lebih jauh mendapatkan hak jalan (*right-of-way*).
   - **Yielding & Deceleration Safety**: Armada berprioritas lebih rendah otomatis melambat (0.4 m/s crawl) dan mengaktifkan lampu bahaya (*hazard flasher*). Jika jarak < 1.4m (*stop distance threshold*), kendaraan rem darurat total (0 m/s).
   - **Live Traffic Alerts**: Peringatan simpang jalan (`INTERSECTION_YIELD`) dan baterai menipis (`LOW_BATTERY`) dengan lokasi 3D dan nama kendaraan terkait.
3. **Physical Charging Dock & Battery Energy Simulation**:
   - **3D Procedural Structure (`charging_dock`)**: Elemen fasilitas baru di katalog struktur dengan platform bergaris marka hazard kuning-hitam, pelat induksi metalik, tiang display LED indikator daya, dan lampu beacon biru glowing.
   - **Konsumsi Baterai Realistis**: Konsumsi aktif per km tempuh (`BATTERY_DRAIN_PER_KM = 3.5%`) dan per ton-km muatan (`BATTERY_DRAIN_PER_TON_KM = 2.0%`).
   - **Docking & Recharge**: Fitur `findNearestChargingDock` untuk navigasi kembali ke dock saat daya < 20%, dengan kecepatan pengisian simulasi 2.5%/detik.
4. **Follow-Cam 3D & Fleet Manager UI**:
   - **Multi-Vehicle 3D Rendering (`MultiVehicleFleetAgents.tsx`)**: Menampilkan seluruh armada simultan di canvas dengan lampu strobo, sensor lidar putar, tag ID baterai, dan badge *YIELDING*.
   - **Isometric Follow-Cam (`CameraController.tsx`)**: Kamera secara mulus mengunci dan mengikuti posisi serta rotasi kendaraan armada yang dipilih pengguna.
   - **Tabbed Manifest Drawer (`PickingManifestDrawer.tsx`)**: Tab *Roster Armada* (telemetri baterai, status armada, alert dismissal, tombol Add/Remove armada) berdampingan dengan tab *Manifest Pesanan*.
   - **Quick Fleet Status Bar (`PickingPlaybackDock.tsx`)**: Ringkasan armada aktif, tombol kamera ikuti (*Follow-Cam*), dan bar peringatan lalu lintas langsung di dock kontrol bawah.
5. **Command Pipeline (Undo/Redo) & Zod Schemas**:
   - `createAddFleetAgentCommand` & `createRemoveFleetAgentCommand` mendukung pembatalan (Ctrl+Z) dan eksekusi ulang (Ctrl+Y) penuh.
   - Skema validasi Zod `FleetAgentSchema`, `TrafficAlertSchema`, dan `StructuralElementSchema` terintegrasi pada `WarehouseBlueprintSchema`.
6. **Verifikasi Kualitas & Pengujian Menyeluruh**:
   - Smoke test suite baru `npm run test:fleet` (`scripts/smoke-fleet-simulation.ts`): **47 / 47 passing (100%)**.
   - Regresi smoke test suite (`npm run test:picking`, `npm run test:picking-p38`, `npm run test:multi-floor-ops`): **100% passing**.
   - TypeScript verification (`npm run typecheck`): **0 errors**.
   - Turbopack production build (`npm run build`): **Compiled successfully in 12.1s**.

---

## ⏭️ Sisa Roadmap & Masa Depan (Future Phases)

Tabel status pencapaian fase proyek terkini beserta rencana roadmap pengembangan tahap selanjutnya:

### 📊 Matriks Pencapaian Fase (Phase 21 – Phase 41)

| Fase | Status | Ruang Lingkup & Pencapaian Utama |
|---|---|---|
| ~~Phase 21 WMS Bins~~ | ✅ Selesai 1 Sep | 3D Bins, Euro Pallets, Kraft Cartons, Slide Drawer, Batch Commands |
| ~~Phase 22 WMS Heatmap~~ | ✅ Selesai 1 Sep | 3D Heatmaps (Occupancy, Weight Stress, ABC Velocity), Floating HUD & Legend |
| ~~Phase 23 Hitbox & Select~~ | ✅ Selesai 1 Sep | Expanded 3D Hitboxes (Bollard, Columns) & Interactive Floor Zones |
| ~~Phase 24 Direct Drag & Focus~~ | ✅ Selesai 1 Sep | Direct Mesh Dragging, Orbit Lock, Viewport-Focused Catalogue Placement |
| ~~Phase 25 Multi-Select & Bulk~~ | ✅ Selesai 1 Sep | Shift+Click, Marquee Box, Group Drag, Bulk Duplicate/Delete/Rotate/Align |
| ~~Phase 26 UI/UX Redesign~~ | ✅ Selesai 2 Sep | Glassmorphic Theme, Hero Telemetry, 4 Templates, Scene Outliner, Status Bar, Collapsible Docks |
| ~~Phase 27 Guided Tour~~ | ✅ Selesai 2 Sep | Step-by-Step Spotlight Tutorial, Dismissible Controls, LocalStorage Persistence, Restart Triggers |
| ~~Phase 28 Settings & i18n~~ | ✅ Selesai 2 Sep | Dual Language (ID/EN), Dark/Light Themes, Metric/Imperial Units, 3D Quality, Auto-Save |
| ~~Phase 29 Aisle Generator~~ | ✅ Selesai 3 Sep | Aisle Auto-Spanning, Back-to-Back Pairs, Equipment Presets, Live 3D Ghost Preview |
| ~~Phase 30 Dual-Theme Parity~~ | ✅ Selesai 3 Sep | Light Mode Comprehensive Support, High Contrast, OS & Blueprint Branding Tags |
| ~~Phase 31 Raycast & Hitboxes~~ | ✅ Selesai 3 Sep | Event Propagation Isolation, Thickened Wall/Dock Hitboxes, Auto-Open Inspector |
| ~~Phase 32 3D Hover Preview~~ | ✅ Selesai 3 Sep | Synchronized Isometric Vector Popover, Real Procedural Meshes Parity |
| ~~Phase 33 3D Badge Bleeding~~ | ✅ Selesai 3 Sep | Constant Scale HTML Badges, Bounded Z-Index, Camera Focus Origin Correction |
| ~~Phase 34 Spatial Clamping~~ | ✅ Selesai 3 Sep | 5-500m Bounds, Sprinkler Clearance 0.5m, Occupancy Containment, Live Toasts |
| ~~Phase 35 Lucide Icons Pack~~ | ✅ Selesai 3 Sep | Modern CAD Stroke 1.75, Semantic Asset Mapping, 17 Components Migrated |
| ~~Phase 36 Picking & Routing~~ | ✅ Selesai 10 Sep | A* Pathfinding, TSP 2-Opt, 3D Glowing Ribbons, Forklift/AGV/Cart Agents, Playback Dock |
| ~~Phase 37 Interactive Route Editing~~ | ✅ Selesai 10 Sep | Direct 3D Pin Dragging, Stop Reorder, Custom Waypoints, TSP Bypass & Re-Optimize, Undo/Redo |
| ~~Phase 38 Direct Line Editing & Scratch Reset~~ | ✅ Selesai 10 Sep | Midpoint Line Dragging & Corridor Redirect, Obstacle Snapping, Clear Route Modal + Undo, Manual Point-to-Point Creator, Blueprint JSON Persistence |
| ~~Phase 38 Ext: Anti-Collision & Isolation~~ | ✅ Selesai 10 Sep | 3D Smart LOD ID Badges, Top-Left Operational Zone Labels, Complete Selection Isolation & Entity Locking |
| ~~Phase 38 Ext: Dedicated Workspace & Header Redesign~~ | ✅ Selesai 10 Sep | Docked Manifest Sidebar, Sub-Header Elimination, Docked Playback Bar, Dead-Center Zero-Shift Mode Switcher |
| ~~Phase 40 Multi-Floor & Vertical Connectors~~ | ✅ Selesai 15 Sep | Building Levels, Floor Slice Modes (ISOLATE/GHOST), Cargo Lift, Access Ramp, Industrial Stairs, Multilayer A* Routing, Equipment Constraints |
| ~~Phase 40 Ext Multi-Floor Operations~~ | ✅ Selesai 15 Sep | Synchronized Global Floor Context, Level-Locked Raycasting & Placement, Dynamic 3D Grid Elevation, Floor-Scoped WMS Inventory & Batch Actions, Picking Manifest Vertical Transit Banners & Multi-Floor Visualization |
| ~~Codebase Audit & Hardening~~ | ✅ Selesai 15 Sep | Zero-Error Compilation, Mezzanine Height Fix, ZoneFootprint Guard, placementBus Encapsulation, i18n Inspector, Smoke Suite 100% Pass |
| ~~Phase 41 Fleet Simulation & Traffic Control~~ | ✅ Selesai 16 Sep | Multi-Agent Simulation (1-6 units), VRP Spatial Partitioning, Radar Collision Avoidance, Priority Yielding, Charging Docks, Battery Drain/Charge, Follow-Cam, Tabbed Fleet Drawer |
| ~~Phase 41 Ext: Click-to-Split & Waypoint Overhaul~~ | ✅ Selesai 16 Sep | Click-to-Split 3D Polyline, Hover Ghost Pin (+ badge & tooltip), findNearestPolylineSegment Perpendicular Projection, Zero Stray Lines Topology, Walkability Snapping Rubber-Band Preview, Double-Click Delete, Interleaved Drawer Checklist, Full Undo/Redo |
| ~~Phase 41 Ext: Multi-Floor Fleet Quotas & Realism~~ | ✅ Selesai 16 Sep | Batasan kapasitas armada 8 unit total & 4 unit/lantai (60 FPS Three.js guardrail), Dedicated Floor Assignment (`levelId` + elevation $y$), Beban Struktural Realistis (Forklift dilarang di Mezzanine, AGV/Cart only), Floor-Matched VRP Dispatching, Tab Filter Lantai di Drawer, Floor Slice 3D Isolation |
| ~~Phase 42 WMS Sync & Dynamic Slotting~~ | ✅ Selesai 8 Okt | Universal Spreadsheet Parser (CSV, TSV, JSON, Direct Excel Paste), Smart Column Mapping, Multi-Objective Dynamic Slotting Optimizer (ABC Proximity, Golden Zone, Heavy Clamping >25kg, Mezzanine limits), Atomic Undo/Redo (Ctrl+Z), Next.js REST API (/api/wms/sync, /api/wms/inventory), & ERP Webhook Simulator (SAP, Odoo, Generic REST) |

---

## ✅ 44. Phase 42: External WMS / ERP Connector, Bulk Inventory Sync & Dynamic Slotting Optimizer (Selesai 8 Okt 2026)

Fase 42 menghadirkan integrasi inventaris eksternal dan kecerdasan alokasi rak spasial tingkat lanjut ke dalam 3D Warehouse OS:

1. **Universal Spreadsheet Parser & Column Mapper (`src/lib/io/wms-sync-io.ts`)**:
   - Mendukung format file `.csv`, `.tsv`, `.json`, serta area **Direct Spreadsheet Clipboard Paste** (copy-paste langsung dari Microsoft Excel dan Google Sheets) tanpa menambah dependensi pihak ketiga.
   - Deteksi kolom otomatis cerdas (*smart column mapping*) yang mengenali variasi alias industri: `bin_id` / `lokasi`, `sku` / `kode_barang`, `product_name` / `nama_barang`, `quantity` / `qty`, `unit` / `satuan`, `lot_number`, `weight_kg` / `berat`, `velocity_class` / `kelas_abc`, dan `expiry_date`.
   - Strategi impor ganda (*Dual Mode*): *Direct Location Mapping* (memperbarui rak atau palet zona eksisting dengan opsi konflik `OVERWRITE` vs `SKIP`) dan *Unallocated Intake Queue* (menampung SKU lepas untuk dialokasikan otomatis).
   - Ekspor inventaris terpadu gudang (`exportFullWmsInventoryCsv`, `exportFullWmsInventoryTsv`, `exportFullWmsInventoryJson`) yang mencakup rak penyimpanan dan palet staging zona operasional secara simultan.

2. **Multi-Objective Dynamic Slotting Optimizer (`src/engine/slotting/slotting-optimizer.ts`)**:
   - Algoritma heuristik penempatan spasial tingkat industri logistik:
     - **ABC Velocity Proximity**: Barang cepat laku (Kelas A, ~80% aktivitas) dialokasikan paling dekat dengan Shipping Dock Doors atau Depot pangkalan kendaraan.
     - **Ergonomic Golden Zone**: Barang frekuensi tinggi diprioritaskan di tingkat 1 dan 2 (ketinggian ergonomis pinggang/dada pemetik). Barang lambat (Kelas C) dialokasikan ke tingkat atas atau lorong belakang.
     - **Heavy Item Bottom Clamping**: Barang berat ($> 25\text{ kg}$) diklem secara ketat hanya pada tingkat 1 (rak dasar) dan lantai Ground Floor untuk mencegah resiko struktural terguling dan beban mezzanine berlebih.
     - **Multi-Floor Constraints**: Menghormati batasan akses mezzanine (muatan berat $> 50\text{ kg}$ dilarang di lantai atas).
   - Menghasilkan ringkasan metrik efisiensi: rasio keberhasilan alokasi, penghematan jarak tempuh rata-rata ($+\text{XX}\%$), serta tabel rincian proposal penempatan dengan alasan penempatan eksplisit.

3. **Atomic Undo/Redo Pipeline & Visual Heatmap Coordination (`src/engine/commands/WmsSyncCommands.ts`)**:
   - Perintah `createApplyWmsInventorySyncCommand` menangkap snapshot kondisi inventaris sebelum mutasi pada rak dan zona operasional.
   - Mendukung pembatalan instan penuh (`Ctrl+Z`) dan pengulangan (`Ctrl+Y`).
   - Otomatis mengaktifkan visualisasi **3D ABC Velocity Heatmap** (`setHeatmapMetric('ABC_VELOCITY')`) saat eksekusi berhasil untuk memberikan umpan balik spasial seketika pada kanvas 3D.

4. **Active REST API Endpoints & Zod Contracts (`src/app/api/wms/sync/route.ts`, `src/app/api/wms/inventory/route.ts`, `wms-sync-schema.ts`)**:
   - `POST /api/wms/sync`: Menerima pembaruan inventaris terstruktur dengan validasi skema Zod dan autentikasi Bearer token.
   - `GET /api/wms/inventory`: Menyediakan query snapshot data digital twin inventaris gudang aktif.

5. **Integrated Modal UI & Dual-Language Parity (`WmsDataHubModal.tsx`, `id.ts`, `en.ts`)**:
   - Modal terpadu 3 tab (Impor/Ekspor Massal, Dynamic Slotting Optimizer, dan Simulator ERP Webhook dengan preset SAP S/4HANA, Odoo 17, dan Generic REST).
   - Aksesibel lewat panel *Inspector* kanan dan menu *TopNavToolbar* saat mode WMS aktif.
   - Paritas kamus dwibahasa (ID/EN) 100% terjaga (323 keys terverifikasi).

6. **Verifikasi Kualitas & Pengujian Menyeluruh**:
   - Smoke test suite baru `npm run test:wms-sync` (`scripts/smoke-wms-sync-slotting.ts`): **100% passing**.
   - Seluruh regresi test suite (`test:wms`, `test:heatmap`, `test:zone-pallets`, `test:multi-floor-ops`, `test:fleet`, `test:picking`, `test:settings`): **100% passing**.
   - TypeScript verification (`npm run typecheck`): **0 errors**.

---

## ✅ Phase 43: In-App Blueprint Guidance & Controls Overhaul (Selesai)

Pembaruan komprehensif sistem panduan dan cheatsheet kontrol di dalam blueprint editor 3D untuk merefleksikan seluruh fitur mutakhir aplikasi (Multi-Floor Mezzanines, Multi-Agent Fleet Simulation, TSP Route Optimization, dan Enterprise WMS Data Hub & Slotting Optimizer) dengan dukungan bilingual Bahasa Indonesia dan English secara penuh.

### 📦 Deliverables & Arsitektur Implementasi

1. **Expanded 9-Step Interactive Guided Tour Spotlight (`GuidedTourOverlay.tsx`)**:
   - Diperluas dari 6 langkah menjadi 9 langkah terstruktur berurutan:
     1. `step_navigation`: Navigasi Kamera & Viewport 3D (`[data-tour="viewport-controls"]`)
     2. `step_catalogue`: Katalog Aset Industri & Generator Lorong (`[data-tour="asset-catalogue"]`)
     3. `step_manipulation`: Seleksi, Manipulasi Objek & Multi-Seleksi Marquee (`[data-tour="3d-canvas"]`)
     4. `step_multi_floor`: Multi-Floor Mezzanines & Konektor Vertikal (`[data-tour="level-selector"]`)
     5. `step_mode_switcher`: Tiga Mode Kerja: Layout Builder, WMS Inventory & Picking Route (`[data-tour="mode-switcher"]`)
     6. `step_inspector_outliner`: Properties Inspector & Dimensi Fasilitas (`[data-tour="properties-inspector"]`)
     7. `step_wms_hub`: Enterprise WMS Data Hub & Slotting Optimizer (`[data-tour="wms-hub-trigger"]`)
     8. `step_fleet_picking`: Simulasi Multi-Agent Fleet & Optimalisasi TSP (`[data-tour="picking-manifest"]`)
     9. `step_save_export`: Simpan Cloud Neon, Ekspor CSV/JSON & Proteksi (`[data-tour="save-export"]`)
   - **Perbaikan Loop Bug & Transisi Mode Bebas Siklus**:
     - Memperbaiki bug di mana transisi dari langkah 6 ke 7 (yang mengaktifkan mode `WMS`) mereset indeks kembali ke langkah 1 (karena `currentMode` masuk dalam dependency array `useEffect`).
     - State `currentMode` kini diisolasi ke dalam `currentModeRef` dan trigger reset indeks dibatasi ketat hanya saat tur dibuka pertama kali (`[isOpen]`).
     - Tur melangkah mulus dari Langkah 1 hingga Langkah 9 dan menutup secara otomatis saat tombol Selesai/Close ditekan, serta memulihkan mode kerja awal pengguna (`initialModeRef`).
   - **Cakupan Penuh Tiga Mode di Langkah 5**:
     - Langkah 5 secara eksplisit menjelaskan ketiga mode operasi di mode switcher toolbar: Layout Builder, WMS Inventory, dan Picking Route (beserta tips dan fungsionalitas masing-masing).

2. **Responsive 4-Category Controls Cheatsheet Modal (`ControlsModal.tsx`)**:
   - Ditata ulang dari 3 kolom statis menjadi grid responsif 4 kategori kartu:
     - **Kartu 1 (Mouse & Seleksi)**: Left Click (Orbit/Pilih), Right Click (Pan), Scroll Wheel (Zoom), Drag-Drop Katalog, Gizmo X/Z, Shift+Drag (Marquee Box).
     - **Kartu 2 (Kamera & Multi-Lantai)**: WASD (Pan), QE (Rotate), F (Focus), Space (Reset View), 2D/3D (2/3), Level Switcher L1-L4, Isolate vs Ghosting.
     - **Kartu 3 (Manipulasi & Riwayat)**: R (Rotate 90°), Del (Hapus), G (Snapping), Esc (Deselect), Ctrl+Z (Undo 30 Langkah), Ctrl+Y (Redo).
     - **Kartu 4 (Simulasi Armada & Modul Lanjutan)**: Space (Play/Pause Route), Klik Garis (Split Waypoint), Follow-Cam, WMS Data Hub, Array Generator, ? / H (Buka Cheatsheet).
   - Terintegrasi penuh dengan `useTranslation()`.

3. **Adaptive Mode-Aware Canvas Quick Tips Bar (`CanvasQuickTips.tsx`)**:
   - Menampilkan pintasan kontekstual yang berubah otomatis berdasarkan `editorViewMode`:
     - **Mode LAYOUT**: Orbit · Pan · Zoom · WASD Pan · F Focus · R Rotate · Shift Multi-Select · `?` Panduan
     - **Mode WMS**: Klik Bin: Detail SKU · ⚡ Acak Stok · Heatmap Analitik · WMS Data Hub · `?` Panduan
     - **Mode PICKING**: Space Play/Pause · Klik Bin: Tambah Stop · Tarik Garis: Split Rute · Kamera Ikuti · `?` Panduan

4. **100% Dual-Language Parity (`id.ts` & `en.ts`)**:
   - Menambahkan namespace `tour`, `controlsGuide`, dan `quickTips` dengan total 437 kunci terverifikasi.
   - Paritas kunci kamus terverifikasi 100% via `scripts/smoke-settings-i18n.ts`.

5. **Pengujian & Verifikasi Menyeluruh**:
   - `npm run test:tour`: **100% Passing** (semua 9 langkah, transisi mode tanpa looping, verifikasi 3 mode pada step 5, target data-tour, dan kamus terverifikasi).
   - `npm run test:settings`: **100% Passing** (437 keys parity matched).
   - Seluruh regresi test suite (`test:wms-sync`, `test:fleet`, `test:multi-floor-ops`, `test:zone-pallets`, `test:picking`): **100% Passing**.
   - `npm run typecheck`: **0 errors**.
   - `npm run build`: **Compiled successfully (Turbopack, Exit code 0)**.

---

## ✅ Phase 44: Codebase Audit Remediation, Zero-Error Quality Hardening & Database Migration (Selesai — 8 Oktober 2026)

Pembersihan menyeluruh dan perbaikan seluruh temuan audit kode (14 bug terkonfirmasi, high-confidence, dan potensial), migrasi skema database Neon PostgreSQL, pemenuhan ketat aturan React 19 (Zero *Rules-of-Hooks*, Zero *State-in-Effect*, Zero *Ref Mutation in Render*), resolusi seluruh 49 error ESLint hingga **0 error**, serta modernisasi rangkaian pengujian Playwright E2E dan smoke test suite.

### 📦 Deliverables & Arsitektur Perbaikan

1. **Database Schema & Cloud Persistence Integrity (Bugs #1 & #2)**:
   - **Ekstensi Skema Drizzle (`src/db/schema.ts`)**:
     - Menambahkan kolom `buildingLevels` (`jsonb`), `verticalConnectors` (`jsonb`), dan `pickingConfig` (`jsonb`) ke tabel `warehouse_blueprints`.
     - Menambahkan kolom `levelId` (`text`, default `'level-1'`) ke tabel `racks`.
     - Menambahkan kolom `skuData` (`jsonb`) ke tabel `inventory_bins`.
   - **Migrasi Database Neon HTTP (`drizzle/0001_wild_riptide.sql`, `npm run db:migrate`)**:
     - Berkas migrasi Drizzle dibuat dan diaplikasikan langsung ke cluster remote Neon Postgres via `migrateNeonHttp`.
     - Memperbaiki kegagalan SQL `column "building_levels" of relation "warehouse_blueprints" does not exist` saat reload layout pada `test:persistence`.
   - **Serialisasi Server Actions (`src/app/actions/layout-actions.ts`)**:
     - `persistWarehouseLayout`: Menjamin struktur multi-lantai mezzanine, konektor tangga/lift, dan rute pemetikan tersimpan ke database.
     - `getWarehouseLayout`: Merekonstruksi seluruh level bangunan, memetakan `levelId` rak, dan menjaga data SKU riil yang diimpor dari WMS/ERP tanpa tertimpa data *mock* acak.
   - **Serialisasi Client (`TopNavToolbar.tsx`)**:
     - Fungsi `buildBlueprintFromStore` kini menserialisasi `buildingLevels` dan `verticalConnectors` pada *auto-save* maupun penyimpanan manual.

2. **React 19 Runtime Crashes & Rules of Hooks (Bugs #3, #4, #10, #11)**:
   - **Hook Hoisting (`ZoneFootprint.tsx`)**:
     - Mengangkat 5 hooks `useMemo` (`isStaging`, `palletSlots`, `pallets/cartons`, `masterLabelText`, `activeSelectedSlot`) ke atas blok *conditional early return* (`if (isHidden && !isEffectiveSelected) return null;`) untuk mencegah *crash* runtime React 19 "Rendered fewer hooks than expected".
   - **Key-Based Component Mounting (`ZonePalletDrawer.tsx` & `BinDetailDrawer.tsx`)**:
     - Menghapus pemanggilan `setState` di dalam `useEffect` yang memicu re-render berantai (cascading renders).
     - Menggunakan pola idiomatik React 19: membungkus konten drawer dengan kunci identitas entitas (`key={foundSlot.id}` / `key={foundBin.id}`) dan menginisialisasi draf state secara murni saat mount serta sinkronisasi aman saat render.
   - **Three.js Canvas Purity (`MultiVehicleFleetAgents.tsx`)**:
     - Menghapus mutasi langsung properti `agent.position3D` di dalam hook `useFrame`, memastikan komponen visual tetap murni dan bebas pelanggaran `react-hooks/immutability`.
   - **Eliminasi Side-Effect dalam Memo (`WmsDataHubModal.tsx`)**:
     - Menghapus mutasi `setState` di dalam `useMemo`; state JSON payload diturunkan melalui callback terisolasi dan handler pemilihan preset ERP yang eksplisit.

3. **Core Domain & Routing Logic Fixes (Bugs #5, #6, #7, #8, #13, #14)**:
   - **REST API Security Hardening (`/api/wms/inventory` & `/api/wms/sync`)**:
     - Membatasi token *bypass* `'demo'` hanya untuk lingkungan pengembangan lokal (`process.env.NODE_ENV !== 'production'`). Permintaan produksi tanpa token rahasia resmi `WMS_SECRET_TOKEN` ditolak dengan status HTTP 401 Unauthorized.
   - **Regenerasi Bin Berbasis Dimensi (`UpdateRackConfigCommand.ts`)**:
     - Perubahan parameter spasial rak (`bayWidth`, `bayDepth`, `levelHeight`) kini memicu regenerasi ukuran kompartemen bin 3D secara presisi, dengan tetap mempertahankan data okupansi dan SKU kompartemen yang bersesuaian.
   - **Proteksi Lantai Dasar (`PropertiesInspector.tsx`)**:
     - Memperluas guard penghapusan level agar memeriksa `lvl.id === 'level-1' || lvl.id === 'level-ground' || lvl.isDefault || lvl.elevationY === 0`, mencegah penghapusan lantai dasar yang tidak disengaja.
   - **Routing Vertikal Multi-Lantai Presisi (`routing-engine.ts`)**:
     - Fungsi `findBestConnector` memvalidasi konektor vertikal agar hanya memilih konektor yang secara fisik menghubungkan lantai asal (`startLevelId`) dan lantai tujuan (`targetLevelId`).
   - **Snapping Per Lantai (`EditorLayout.tsx`)**:
     - Snapping magnetik dan deteksi tabrakan saat *drag & drop* rak difilter ketat hanya terhadap rak di lantai aktif (`levelId`), mencegah interferensi snapping silang lantai.
   - **Persistensi Inbound WMS Direct-Match (`/api/wms/sync`)**:
     - Mengimplementasikan alur pembaruan database untuk barang *direct-matched* pada rute sinkronisasi inbound WMS melalui `getWarehouseLayout` dan `persistWarehouseLayout`.

4. **ESLint 0-Error Cleanup & Modernisasi Test Suite (Bugs #9, #12 & Lint)**:
   - **Pembersihan Total ESLint (0 Errors)**:
     - Memperbaiki seluruh 49 error ESLint sebelumnya menjadi **0 errors** (Exit code 0).
     - Menangani aturan `react-hooks/set-state-in-effect`, `react-hooks/refs`, `prefer-const`, serta `@typescript-eslint/no-explicit-any` di `AisleGeneratorModal.tsx`, `GuidedTourOverlay.tsx`, `PropertiesInspector.tsx`, `TopNavToolbar.tsx`, `EditorLayout.tsx`, dan `TransformGizmo.tsx`.
   - **Playwright E2E Assertion Modernization (`scripts/e2e-new-blueprint.mjs`)**:
     - Memperbarui pemilih selector tombol katalog ke `page.getByRole('button', { name: /Catalogue/i })` sehingga uji E2E lolos secara stabil (`PASS editor reached ready state`).
   - **Safe Optional Chaining (`scripts/smoke-picking-split-waypoint.ts`)**:
     - Menghapus *non-null asserted optional chains* (`!.`) pada pengujian proyeksi polyline dan menggantinya dengan penjaga *null guard* eksplisit.

### 🧪 Hasil Verifikasi Komprehensif

| Kategori Pemeriksaan | Perintah / Script | Hasil | Keterangan |
| :--- | :--- | :--- | :--- |
| **ESLint Validation** | `npm run lint` | **PASS (0 errors)** | Exit code 0, 0 error, semua aturan React 19 terpenuhi |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Exit code 0, `tsc --noEmit` bersih tanpa kesalahan tipe |
| **Next.js Production Build**| `npm run build` | **PASS (0 errors)** | Turbopack build sukses (13.6s), semua rute statis & dinamis terkompilasi |
| **Database Migrations** | `npm run db:migrate` | **PASS** | `0001_wild_riptide.sql` diterapkan ke Neon PostgreSQL |
| **E2E Browser Testing** | `npm run test:e2e` | **PASS** | Playwright Chromium berhasil membuka editor hingga status ready |
| **Database Persistence** | `npm run test:persistence` | **PASS (6/6)** | Upsert, reload reassembly, cascade replace & delete valid |
| **WMS Bin & Cargo** | `npm run test:wms` | **PASS (8/8)** | Instancing palet, okupansi, dan metadata SKU valid |
| **Heatmap Analytics** | `npm run test:heatmap` | **PASS (7/7)** | Pemetaan warna stress berat & ABC velocity valid |
| **Multi-Floor Engine** | `npm run test:multi-floor` | **PASS (28/28)** | Mezzanine 3D layer, konektor vertikal & Zod schema valid |
| **Multi-Floor Ops** | `npm run test:multi-floor-ops` | **PASS (43/43)** | Slicing visual, isolasi lantai, dan batas 4 lantai valid |
| **Fleet Simulation** | `npm run test:fleet` | **PASS (62/62)** | VRP dispatching, radar jarak, yielding, dan baterai valid |
| **WMS Sync & Slotting** | `npm run test:wms-sync` | **PASS (100%)** | Spreadsheet parsing, Golden Zone optimizer, dan REST API valid |
| **Click-to-Split Route** | `npm run test:split-waypoint`| **PASS (34/34)** | Proyeksi titik polyline, splitting garis, dan undo/redo valid |
| **Zone Pallets Instancing**| `npm run test:zone-pallets` | **PASS (25/25)** | Grid procedural palet zona & isolasi seleksi valid |
| **Guided Spotlight Tour** | `npm run test:tour` | **PASS (100%)** | 9-step tutorial, transisi mode tanpa looping & kamus valid |
| **Settings & i18n Parity** | `npm run test:settings` | **PASS (100%)** | Paritas kamus 437 kunci ID/EN cocok 100% |

---

### 🚀 Roadmap Pengembangan Selanjutnya (Upcoming Milestones)

| Fase | Prioritas | Ruang Lingkup & Sasaran Fitur |
|---|---|---|
| **Phase 45** | ⚡ **Tinggi** | **IoT Sensor Overlays & Realtime Environmental Digital Twin**<br>• Visualisasi sensor suhu, kelembapan, dan gas (Cold Storage QC monitoring)<br>• RFID scanner gate tracking (otomatis deteksi palet masuk/keluar saat melintasi dock door)<br>• Weight strain overload alerts pada rak secara live |
| **Phase 46** | 👥 **Menengah** | **Collaborative Multi-User Planner & Session Sharing**<br>• Sinkronisasi real-time multi-planner via WebRTC / WebSocket<br>• Cursor presence 3D (melihat pergerakan & seleksi rekan tim secara langsung)<br>• Room locking & mode presentasi arsitektur terintegrasi |

---

**Catatan keamanan:** `.env` berisi kredensial Neon asli — pastikan tetap gitignored; jangan pernah import `@/db` dari client component.




---

## Phase 44: RBAC Authentication & Persistence Access Control (2026-10-19)

### 🎯 Sasaran & Capaian Fitur
1. **Drizzle ORM Schema Extensions (`src/db/schema.ts`, `drizzle/0002_ambitious_ghost_rider.sql`)**:
   - Menambahkan tabel `users` (`id`, `name`, `email`, `password_hash`, `role: ADMIN | EDITOR | VIEWER`, `created_at`, `updated_at`).
   - Menambahkan tabel `sessions` (`id`, `user_id`, `expires_at`, `created_at`) dengan index pada `user_id`.
   - Menambahkan foreign key audit trail `created_by` dan `updated_by` pada tabel `warehouse_blueprints`.
   - Migrasi Drizzle diterapkan ke PostgreSQL dengan status sukses.
2. **Autentikasi Aman & Sesi 24 Jam (`src/lib/auth/`)**:
   - Hashing password dengan `bcryptjs` (salt rounds 10).
   - Pengelolaan sesi 24 jam dengan token acak aman di database dan cookie HTTP-Only SameSite `warehouse_session`.
   - Server Actions: `loginAction`, `logoutAction`, dan `getCurrentUserAction`.
3. **Role-Based Access Control (RBAC) & Proteksi Persistence**:
   - Server Action `persistWarehouseLayout`: Memvalidasi sesi dan role. Jika `role === 'VIEWER'` atau unauthenticated, operasi penyimpanan ditolak dengan pesan izin ditolak. Menyimpan user ID pada kolom `created_by` dan `updated_by`.
   - Server Action `deleteWarehouseLayout`: Memvalidasi sesi dan menolak jika role `VIEWER`.
   - Server Actions User Management (`src/app/actions/user-actions.ts`): Membatasi `listUsers`, `createUser`, `updateUserRole`, dan `deleteUser` hanya untuk `ADMIN`.
4. **Middleware & Route Guarding (`src/middleware.ts`)**:
   - Melindungi rute `/`, `/editor/:path*`, dan `/admin/:path*` dari akses tanpa autentikasi, mengarahkan ke `/login`.
5. **UI & Pengalaman Pengguna RBAC**:
   - Halaman Login modern bertema industrial (`/login` dan `LoginForm.tsx`) lengkap dengan preset quick-demo untuk Admin, Editor, dan Viewer.
   - Halaman Manajemen Pengguna Admin (`/admin/users` dan `UserManagementClient.tsx`).
   - Toolbar Editor (`TopNavToolbar.tsx`): Menampilkan badge role user dan avatar; tombol Save digantikan dengan badge *"Mode Baca"* terkunci saat login sebagai `VIEWER`.
   - Dashboard (`DashboardClient.tsx`): Menampilkan banner profil user, tombol aksi Admin RBAC, menampilkan nama pengubah layout (`updatedByName`), dan menonaktifkan pembuatan serta penghapusan layout untuk `VIEWER`.
6. **Verifikasi Kualitas & Pengujian Komprehensif**:
   - `npm run test:auth`: PASS (Verifikasi bcrypt dan siklus session DB).
   - `npm run test:rbac`: PASS (Verifikasi penolakan mutasi Viewer dan izin Admin/Editor).
   - `npm run test:persistence`: PASS (6/6 pengujian persistensi lulus).
   - `npm run typecheck`: PASS (0 errors).
   - `npm run lint`: PASS (0 errors).
   - `npm run build`: PASS (Turbopack production build sukses untuk semua rute).

---

## Phase 45: Complete Industrial Storage Racking, Shelving & Mezzanine Overhaul (2026-10-20)

### 🎯 Sasaran & Capaian Fitur
1. **Multi-Slot Parametric Bin Engine (`src/engine/procedural/bin-generator.ts`)**:
   - Menghadirkan fungsi `getSlotsPerBayLevel(type)` untuk menghitung kapasitas fisik riil setiap jenis rak:
     - **Selective Pallet Rack**: 2 palet berdampingan per beam level (`-A`, `-B`), total = $\text{Bays} \times \text{Levels} \times 2$.
     - **Double-Deep Pallet Rack**: 4 palet per bay-tier (2 lebar $\times$ 2 kedalaman: `-FL`, `-FR`, `-BL`, `-BR`), total = $\text{Bays} \times \text{Levels} \times 4$.
     - **Drive-In Bulk Rack**: 3 palet berderet ke dalam lorong LIFO (`-D01`, `-D02`, `-D03`), total = $\text{Bays} \times \text{Levels} \times 3$.
     - **Push-Back Gravity Rack**: 3 palet pada kereta bertingkat gravitasi (`-P1`, `-P2`, `-P3`), total = $\text{Bays} \times \text{Levels} \times 3$.
     - **Cantilever Rack**: 1 slot beban kargo panjang melintang per arm tier (`-CG1`), total = $\text{Bays} \times \text{Levels} \times 1$.
     - **Multi-Tier Shelving**: 3 kompartemen *small-parts* per tier (`-01`, `-02`, `-03`), total = $\text{Bays} \times \text{Levels} \times 3$.
     - **Mezzanine Platform Deck**: Platform terbuka lantai atas dengan penomoran terikat `levelId`.
   - Mengalokasikan koordinat lokal presisi `relativePosition` (X, Y, Z) dan `dimension` proporsional untuk tiap sub-slot individu.

2. **Geometri Struktural 3D & Kargo Realistis (`src/engine/procedural/rack-geometry.ts` & `ProceduralRack.tsx`)**:
   - **Cantilever**: Menghapus tiang tegak depan. Menghasilkan kolom mast vertikal baja kuning di bagian belakang, kaki pondasi lantai (*base feet*) kokoh, dan lengan *cantilever arms* yang menjulur ke depan.
   - **Drive-In**: Menghilangkan balok silang depan di lantai/tier bawah untuk akses manuver forklift; menambahkan *continuous side runner rails* sepanjang kedalaman lorong.
   - **Double-Deep**: Menambahkan rangka tengah tandem (*middle upright frame*) dan balok tengah untuk menopang palet baris belakang secara kokoh.
   - **Eliminasi Palet Kayu pada Rak Non-Palet**: Multi-tier Shelving dan Cantilever tidak lagi merender palet kayu Euro.
   - **Tote Box Plastik Industri & Kargo Panjang**: Shelving merender kontainer plastik aneka warna (*Royal Blue, Ruby Red, Emerald Green, Amber Gold*) dan karton kecil; Cantilever merender bundle material panjang (pipa/balok).
   - **Mezzanine Deck Guide Grid**: Menambahkan visualisasi kisi panduan sub-grid (*cyan gridHelper*) tepat di atas permukaan lantai platform baja mezzanine.

3. **Schema & Database Persistence Migration (`src/db/schema.ts`, `drizzle/0003_acoustic_bloodaxe.sql`)**:
   - Menambahkan kolom `slot_position` pada tabel `inventory_bins`.
   - Memperbarui unique index `uq_rack_bay_level` menjadi `(rack_id, bay_index, level_index, id)` sehingga mendukung multi-slot per bay-level tanpa konflik integritas database.
   - Migrasi Drizzle diterapkan ke PostgreSQL Neon via `npm run db:migrate`.
   - Schema Zod `BinSlotSchema` diperluas dengan regex `/^[A-Z0-9]+-\d{2}-\d{2}(-[A-Z0-9]+)?$/` dengan 100% kompatibilitas mundur.

4. **UI & Properties Inspector Synchronized (`PropertiesInspector.tsx` & `CatalogItemPreviewPopover.tsx`)**:
   - Properties panel menampilkan kalkulasi riil: `{bays} × {levels} × {mult} = {total} slots`.
   - Katalog flyout preview popover menampilkan kapasitas unit yang tepat (*Pallet Bins*, *Small-Parts Bins*, *Long Goods Tiers*, *Platform Deck Area*).

5. **Verifikasi Kualitas & Test Suite Parity**:
   - `npm run test:smoke`: **PASS** (12 bins & 30 bins multi-slot verified).
   - `npm run test:wms`: **PASS** (18 bins & WMS cargo instancing verified).
   - `npm run test:heatmap`: **PASS** (ABC Velocity, Weight Stress, Occupancy).
   - `npm run test:aisle`: **PASS** (24 bins per rack & Zod compliance).
   - `npm run test:templates`: **PASS** (192 bins template telemetry).
   - `npm run test:persistence`: **PASS** (Cascade replace & upsert Neon DB).
   - `npm run test:multi-floor` & `test:multi-floor-ops`: **PASS** (43/43 assertions).
   - `npm run test:fleet`: **PASS** (62/62 assertions).
   - `npm run typecheck`: **PASS (0 errors)**.
   - `npm run lint`: **PASS (0 errors)**.
   - `npm run build`: **PASS (Production bundle compiled cleanly)**.
