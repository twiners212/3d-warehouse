# Bug Remediation & Quality Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up and resolve all 14 confirmed, high-confidence, and potential bugs identified during the codebase audit, eliminate 49 ESLint errors and all test failures, achieving zero TypeScript errors, zero lint errors, and 100% passing test suites.

**Architecture:** 
1. **Cloud Persistence & Schema**: Extend Drizzle schema (`warehouse_blueprints`, `racks`, `inventory_bins`) with missing multi-floor and SKU attributes, update server action serialization (`layout-actions.ts`), and preserve imported ERP data upon reload.
2. **React 19 & Component Runtime**: Hoist all conditional hooks out of early return blocks (`ZoneFootprint.tsx`, `ZonePalletDrawer.tsx`), replace invalid `setState` calls in effects with pure render derivations or key-based remounting, and eliminate mutation of Zustand state inside Three.js `useFrame`.
3. **Core Domain & Routing**: Enforce environment-aware auth gates on REST endpoints, make rack configuration bin regeneration sensitive to dimensional changes, correct ground floor deletion guards, ensure vertical connector selection enforces level connectivity, and level-filter spatial snapping.
4. **Lint & Test Quality**: Modernize E2E assertions to match the current UI (`'Catalogue'`), correct non-null assertions in test scripts, fix `prefer-const` and explicit `any`, achieving `npm run lint` exit code 0.

**Tech Stack:** Next.js 16 (App Router), React 19, Three.js / React Three Fiber, Drizzle ORM / PostgreSQL (Neon HTTP & local pg), Zustand 5, Zod 3, Playwright, Tailwind CSS 3.4.

---

## Phased Overview & Execution Order

- **Phase A: Database Schema & Cloud Persistence Integrity (Bugs #1 & #2)**
  - Task 1: Drizzle ORM Schema Migration (`src/db/schema.ts`, `drizzle/`)
  - Task 2: Server Action Serialization & Deserialization (`src/app/actions/layout-actions.ts`)
  - Task 3: Store Serialization in Header (`src/components/editor/ui/TopNavToolbar.tsx`)
- **Phase B: React 19 Runtime Crashes & Rules of Hooks (Bugs #3, #4, #10, #11)**
  - Task 4: Hook Hoisting in `ZoneFootprint.tsx` (Bug #3)
  - Task 5: Parent Guard & State Sync in `ZonePalletDrawer.tsx` (Bug #4)
  - Task 6: Pure Three.js Transforms in `MultiVehicleFleetAgents.tsx` (Bug #10)
  - Task 7: Derived JSON & Pure Renders in `WmsDataHubModal.tsx` (Bug #11)
- **Phase C: Core Domain & Routing Logic Fixes (Bugs #5, #6, #7, #8, #13, #14)**
  - Task 8: REST API Security Hardening (`src/app/api/wms/inventory/route.ts` & `sync/route.ts`) (Bug #5)
  - Task 9: Dimension-Aware Bin Regeneration in `UpdateRackConfigCommand.ts` (Bug #6)
  - Task 10: Ground Floor Removal Guard in `PropertiesInspector.tsx` (Bug #7)
  - Task 11: Multi-Floor Connector Filter in `routing-engine.ts` (Bug #8)
  - Task 12: Level-Filtered Snapping & Collision in `EditorLayout.tsx` (Bug #13)
  - Task 13: Functional Inbound WMS Sync Persistence in `route.ts` (Bug #14)
- **Phase D: ESLint 0-Error Cleanup & Test Suite Modernization (Bugs #9, #12 & ESLint)**
  - Task 14: E2E Playwright Selector Modernization (`scripts/e2e-new-blueprint.mjs`) (Bug #9)
  - Task 15: Non-null Optional Chain Fixes in `smoke-picking-split-waypoint.ts` (Bug #12)
  - Task 16: React 19 `set-state-in-effect`, `prefer-const`, and `any` Cleanup across UI & Scripts

---

## Phase A: Database Schema & Cloud Persistence Integrity

### Task 1: Drizzle ORM Schema Migration (Bugs #1 & #2)

**Files:**
- Modify: `src/db/schema.ts:20-85`
- Create migration script or run drizzle push

**Step 1: Inspect existing schema definitions**
Verify `warehouseBlueprints` is missing `buildingLevels`, `verticalConnectors`, `pickingConfig`; `racks` is missing `levelId`; `inventoryBins` is missing `skuData`.

**Step 2: Update `src/db/schema.ts`**
Add the following fields:
```typescript
// in warehouseBlueprints:
buildingLevels: jsonb('building_levels').$type<BuildingLevel[]>().default([]).notNull(),
verticalConnectors: jsonb('vertical_connectors').$type<VerticalConnector[]>().default([]).notNull(),
pickingConfig: jsonb('picking_config').$type<PickingRouteConfig>(),

// in racks:
levelId: text('level_id').default('level-1').notNull(),

// in inventoryBins:
skuData: jsonb('sku_data').$type<BinSkuData>(),
```

**Step 3: Run Typecheck and Schema Verification**
Run: `npm run typecheck`
Expected: PASS (0 errors).

**Step 4: Commit**
```bash
git add src/db/schema.ts
git commit -m "fix(db): add multi-floor, pickingConfig, and skuData columns to drizzle schema"
```

---

### Task 2: Server Action Serialization & Deserialization (Bugs #1 & #2)

**Files:**
- Modify: `src/app/actions/layout-actions.ts:75-210`
- Test: `scripts/smoke-bins-wms.ts` & `scripts/smoke-multi-floor.ts`

**Step 1: Update `persistWarehouseLayout` in `layout-actions.ts`**
- In `warehouseBlueprints` insert/update values: add `buildingLevels: valid.buildingLevels ?? []`, `verticalConnectors: valid.verticalConnectors ?? []`, `pickingConfig: valid.pickingConfig ?? null`.
- In `racks` insert values: add `levelId: r.levelId ?? 'level-1'`.
- In `inventoryBins` insert values: add `skuData: b.skuData ?? null`.

**Step 2: Update `getWarehouseLayout` in `layout-actions.ts`**
- Reassemble blueprint metadata:
  ```typescript
  buildingLevels: meta.buildingLevels ?? [],
  verticalConnectors: meta.verticalConnectors ?? [],
  pickingConfig: meta.pickingConfig ?? undefined,
  ```
- Reassemble racks:
  ```typescript
  levelId: r.levelId ?? 'level-1',
  ```
- Reassemble bins (Preserve real SKU data, only fallback to mock if occupied without SKU data):
  ```typescript
  skuData: b.skuData ?? (b.isOccupied ? generateMockSkuData(canonicalId) : undefined),
  ```

**Step 3: Run Verification Scripts**
Run: `npx tsx scripts/smoke-multi-floor.ts`
Run: `npx tsx scripts/smoke-bins-wms.ts`
Expected: Both test suites pass.

**Step 4: Commit**
```bash
git add src/app/actions/layout-actions.ts
git commit -m "fix(persistence): persist and reassemble multi-floor structures, picking config, and sku data"
```

---

### Task 3: Store Serialization in TopNavToolbar (Bug #1)

**Files:**
- Modify: `src/components/editor/ui/TopNavToolbar.tsx:23-52`

**Step 1: Update `buildBlueprintFromStore`**
Include `buildingLevels` and `verticalConnectors` from `state`:
```typescript
export function buildBlueprintFromStore(
  state: ReturnType<typeof useEditorStore.getState>,
  blueprintId: string
): WarehouseLayoutBlueprint {
  const existing = state.blueprintId ?? blueprintId;
  const now = new Date().toISOString();
  return {
    id: existing,
    name: state.blueprintName,
    floorDimensions: state.floorDimensions,
    gridSnapStep: state.gridSnapStep,
    zones: state.zones,
    structuralElements: state.structuralElements,
    racks: state.racks,
    buildingLevels: state.buildingLevels,
    verticalConnectors: state.verticalConnectors,
    pickingConfig:
      state.pickList.length > 0 || state.fleet.length > 0
        ? {
            pickList: state.pickList,
            customWaypoints: state.customWaypoints,
            depotPosition: state.depotPosition,
            selectedVehicleType: state.selectedVehicleType,
            isManualSequence: state.isManualSequence,
            fleet: state.fleet,
          }
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
}
```

**Step 2: Run Typecheck**
Run: `npm run typecheck`
Expected: PASS.

**Step 3: Commit**
```bash
git add src/components/editor/ui/TopNavToolbar.tsx
git commit -m "fix(editor): preserve buildingLevels and verticalConnectors on manual and auto save"
```

---

## Phase B: React 19 Runtime Crashes & Rules of Hooks

### Task 4: Hook Hoisting in `ZoneFootprint.tsx` (Bug #3)

**Files:**
- Modify: `src/components/canvas/ZoneFootprint.tsx:270-320`

**Step 1: Relocate Early Return**
Move `if (isHidden && !isEffectiveSelected) return null;` from line 272 to **after** all hook declarations (`isStaging`, `palletSlots`, `pallets/cartons`, `masterLabelText`, `activeSelectedSlot`, and event handlers), directly above the JSX return block.

**Step 2: Verify ESLint**
Run: `npx eslint src/components/canvas/ZoneFootprint.tsx`
Expected: 0 `rules-of-hooks` errors in `ZoneFootprint.tsx`.

**Step 3: Commit**
```bash
git add src/components/canvas/ZoneFootprint.tsx
git commit -m "fix(canvas): hoist useMemo hooks above conditional early return in ZoneFootprint"
```

---

### Task 5: Parent Guard & State Sync in `ZonePalletDrawer.tsx` (Bug #4)

**Files:**
- Modify: `src/components/editor/ui/ZonePalletDrawer.tsx:35-115`

**Step 1: Add Parent Guard**
In `ZonePalletDrawer`:
Ensure `<ZonePalletDrawerContent>` is only rendered when `foundZone` and `foundSlot` are strictly defined:
```typescript
if (!foundZone || !foundSlot) {
  return null;
}
return (
  <ZonePalletDrawerContent
    key={foundSlot.id}
    zone={foundZone}
    slot={foundSlot}
    onClose={deselectZonePallet}
    onExecute={executeCommand}
  />
);
```

**Step 2: Remove Conditional Early Return & Replace `useEffect` setState**
In `ZonePalletDrawerContent`:
1. Remove `if (!zone || !slot) return null;` from line 74 since `zone` and `slot` are guaranteed non-null.
2. Replace `useEffect` `setState` with React 19 recommended key-based mount (`key={foundSlot.id}`) and initial state calculation from `slot.skuData`.

**Step 3: Verify ESLint**
Run: `npx eslint src/components/editor/ui/ZonePalletDrawer.tsx`
Expected: 0 errors in `ZonePalletDrawer.tsx`.

**Step 4: Commit**
```bash
git add src/components/editor/ui/ZonePalletDrawer.tsx
git commit -m "fix(ui): enforce strict parent mounting and key-based draft state for ZonePalletDrawer"
```

---

### Task 6: Pure Three.js Transforms in `MultiVehicleFleetAgents.tsx` (Bug #10)

**Files:**
- Modify: `src/components/canvas/MultiVehicleFleetAgents.tsx:125-135`

**Step 1: Remove Direct Prop Mutation**
In `SingleFleetAgent`, remove direct mutation of `agent.position3D`:
```typescript
// Replace direct mutation with local Three.js group update:
groupRef.current.position.set(posX, posY, posZ);
```
Simulation position sync is handled in the simulation tick in `fleet-dispatcher.ts`, keeping the render component pure and immutable.

**Step 2: Verify ESLint**
Run: `npx eslint src/components/canvas/MultiVehicleFleetAgents.tsx`
Expected: 0 `react-hooks/immutability` errors.

**Step 3: Commit**
```bash
git add src/components/canvas/MultiVehicleFleetAgents.tsx
git commit -m "fix(canvas): eliminate props mutation in useFrame inside MultiVehicleFleetAgents"
```

---

### Task 7: Derived JSON & Pure Renders in `WmsDataHubModal.tsx` (Bug #11)

**Files:**
- Modify: `src/components/editor/ui/WmsDataHubModal.tsx:295-350`

**Step 1: Convert `useMemo` with `setState` to Derived Value or `useEffect`**
Replace `useMemo(() => { ... setWebhookPayloadJson(...) }, [erpPreset])` with:
Either:
1. `useEffect(() => { ... setWebhookPayloadJson(...) }, [erpPreset, blueprintId])`
Or:
2. Derive `defaultPayloadJson` during render for initial/preset states without setting state in memo.

**Step 2: Verify ESLint**
Run: `npx eslint src/components/editor/ui/WmsDataHubModal.tsx`
Expected: 0 `react-hooks/set-state-in-render` errors.

**Step 3: Commit**
```bash
git add src/components/editor/ui/WmsDataHubModal.tsx
git commit -m "fix(ui): eliminate setState within useMemo in WmsDataHubModal"
```

---

## Phase C: Core Domain & Routing Logic Fixes

### Task 8: REST API Security Hardening (Bug #5)

**Files:**
- Modify: `src/app/api/wms/inventory/route.ts:8-17`
- Modify: `src/app/api/wms/sync/route.ts:8-20`

**Step 1: Guard 'demo' Token by Environment**
In both routes, update `authenticateRequest()`:
```typescript
function authenticateRequest(req: NextRequest): boolean {
  const isDev = process.env.NODE_ENV !== 'production';
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const tokenQuery = req.nextUrl.searchParams.get('token');
    return tokenQuery === WMS_SECRET_TOKEN || (isDev && tokenQuery === 'demo');
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === WMS_SECRET_TOKEN || (isDev && token === 'demo');
}
```

**Step 2: Test API with Invalid and Valid Tokens**
Run smoke test script or curl to verify unauthorized requests reject with 401.

**Step 3: Commit**
```bash
git add src/app/api/wms/inventory/route.ts src/app/api/wms/sync/route.ts
git commit -m "fix(security): restrict demo wms token bypass to non-production environments"
```

---

### Task 9: Dimension-Aware Bin Regeneration in `UpdateRackConfigCommand.ts` (Bug #6)

**Files:**
- Modify: `src/engine/commands/UpdateRackConfigCommand.ts:50-75`
- Test: `scripts/smoke-commands.ts`

**Step 1: Check Dimension and Geometry Alterations**
In `UpdateRackConfigCommand.execute()`:
Regenerate bins when either bin count changes OR dimensions (`bayWidth`, `bayDepth`, `levelHeight`) change:
```typescript
const dimensionsChanged =
  next.bays !== rack.bays ||
  next.levels !== rack.levels ||
  next.bayWidth !== rack.bayWidth ||
  next.bayDepth !== rack.bayDepth ||
  next.levelHeight !== rack.levelHeight;

let bins = rack.bins;
if (dimensionsChanged) {
  const freshBins = generateBinsForRack(next);
  // Preserve existing SKU / occupancy for overlapping (bayIndex, levelIndex)
  const existingMap = new Map(rack.bins.map((b) => [`${b.bayIndex}-${b.levelIndex}`, b]));
  bins = freshBins.map((fb) => {
    const prev = existingMap.get(`${fb.bayIndex}-${fb.levelIndex}`);
    if (prev) {
      return {
        ...fb,
        isOccupied: prev.isOccupied,
        skuData: prev.skuData,
      };
    }
    return fb;
  });
}
```

**Step 2: Run Command Smoke Test**
Run: `npx tsx scripts/smoke-commands.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add src/engine/commands/UpdateRackConfigCommand.ts
git commit -m "fix(engine): regenerate and preserve bins when rack dimensions change"
```

---

### Task 10: Ground Floor Removal Guard in `PropertiesInspector.tsx` (Bug #7)

**Files:**
- Modify: `src/components/editor/ui/PropertiesInspector.tsx:272-279`

**Step 1: Update Ground Level Protection Check**
```typescript
const handleRemoveLevel = (lvl: BuildingLevel) => {
  if (lvl.id === 'level-1' || lvl.isDefault || lvl.elevationY === 0) {
    onShowWarning('Lantai dasar (Ground) tidak dapat dihapus');
    return;
  }
  executeCommand(createRemoveBuildingLevelCommand(lvl));
};
```

**Step 2: Run Typecheck**
Run: `npm run typecheck`
Expected: PASS.

**Step 3: Commit**
```bash
git add src/components/editor/ui/PropertiesInspector.tsx
git commit -m "fix(ui): guard ground floor deletion using level-1 ID and elevation check"
```

---

### Task 11: Multi-Floor Connector Filter in `routing-engine.ts` (Bug #8)

**Files:**
- Modify: `src/engine/routing/routing-engine.ts:28-56`
- Test: `scripts/smoke-multi-floor.ts`

**Step 1: Add Level Matching in `findBestConnector`**
```typescript
export function findBestConnector(
  startPos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  vehicleType: VehicleType,
  verticalConnectors: VerticalConnector[],
  startLevelId?: string,
  targetLevelId?: string
): VerticalConnector | null {
  const allowedTypes: VerticalConnectorType[] =
    vehicleType === 'CART'
      ? ['cargo_lift', 'lift', 'ramp', 'stairs']
      : ['cargo_lift', 'lift', 'ramp'];

  const candidates = verticalConnectors.filter((c) => {
    if (!allowedTypes.includes(c.type)) return false;
    if (startLevelId && targetLevelId && startLevelId !== targetLevelId) {
      const connects =
        (c.fromLevelId === startLevelId && c.toLevelId === targetLevelId) ||
        (c.fromLevelId === targetLevelId && c.toLevelId === startLevelId);
      if (!connects) return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;
  // compute shortest planar distance among valid floor-matching candidates
  ...
}
```

**Step 2: Run Multi-Floor Smoke Test**
Run: `npx tsx scripts/smoke-multi-floor.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add src/engine/routing/routing-engine.ts
git commit -m "fix(routing): restrict vertical connector selection to connecting levels"
```

---

### Task 12: Level-Filtered Snapping & Collision in `EditorLayout.tsx` (Bug #13)

**Files:**
- Modify: `src/components/editor/EditorLayout.tsx:340-355, 535-555`

**Step 1: Filter Rack Neighbors by Level**
When resolving placement position and validity in `EditorLayout.tsx`:
```typescript
const levelRacks = state.racks.filter(
  (r) => (r.levelId || 'level-1') === (levelId || 'level-1')
);

// pass levelRacks instead of state.racks to findAvailablePlacementPosition & isPlacementValid
```

**Step 2: Run Typecheck**
Run: `npm run typecheck`
Expected: PASS.

**Step 3: Commit**
```bash
git add src/components/editor/EditorLayout.tsx
git commit -m "fix(editor): scope rack placement snapping and collision to current level"
```

---

### Task 13: Functional Inbound WMS Sync Persistence in `route.ts` (Bug #14)

**Files:**
- Modify: `src/app/api/wms/sync/route.ts:55-75`
- Test: `scripts/smoke-wms-sync-slotting.ts`

**Step 1: Implement Atomic DB Updates for Direct-Matched Items**
Update `POST /api/wms/sync`:
When `directMatched.length > 0`, fetch the blueprint and update matching bin slots with the inbound SKU data, saving the updated blueprint.

**Step 2: Run Sync Smoke Test**
Run: `npx tsx scripts/smoke-wms-sync-slotting.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add src/app/api/wms/sync/route.ts
git commit -m "fix(api): execute inventory updates for direct matched items in wms sync route"
```

---

## Phase D: ESLint 0-Error Cleanup & Test Suite Modernization

### Task 14: E2E Playwright Selector Modernization (Bug #9)

**Files:**
- Modify: `scripts/e2e-new-blueprint.mjs:25-35`

**Step 1: Update Ready State DOM Assertion**
Change line 29:
```javascript
// Before:
const palette = await page.getByText('Asset Palette').isVisible();

// After: Check for 'Catalogue' tab or role button
const palette = await page.getByRole('button', { name: /Catalogue/i }).isVisible().catch(() => false);
```

**Step 2: Run E2E Test**
Run: `npm run test:e2e`
Expected: PASS (`PASS editor reached ready state`, Exit Code 0).

**Step 3: Commit**
```bash
git add scripts/e2e-new-blueprint.mjs
git commit -m "fix(e2e): update palette selector to match Catalogue sidebar tab"
```

---

### Task 15: Non-null Optional Chain Fixes in `smoke-picking-split-waypoint.ts` (Bug #12)

**Files:**
- Modify: `scripts/smoke-picking-split-waypoint.ts:95-115`

**Step 1: Fix Optional Chaining Assertions**
Change:
```typescript
assert(Math.abs(res1?.projectedPoint.x! - 10) < 0.001, 'Projected X is 10.0');
```
To:
```typescript
assert(res1 !== null && Math.abs(res1.projectedPoint.x - 10) < 0.001, 'Projected X is 10.0');
```
Apply to lines 97, 98, 106, 107, 108, 113, 114.

**Step 2: Run Smoke Test**
Run: `npx tsx scripts/smoke-picking-split-waypoint.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add scripts/smoke-picking-split-waypoint.ts
git commit -m "fix(test): eliminate non-null asserted optional chain expressions in waypoint smoke test"
```

---

### Task 16: React 19 `set-state-in-effect`, `prefer-const`, and `any` Cleanup across UI & Scripts

**Files:**
- Modify: `src/components/editor/ui/AisleGeneratorModal.tsx`
- Modify: `src/components/editor/ui/BinDetailDrawer.tsx`
- Modify: `src/components/editor/ui/GuidedTourOverlay.tsx`
- Modify: `src/components/editor/ui/PropertiesInspector.tsx`
- Modify: `src/components/editor/ui/TopNavToolbar.tsx`
- Modify: `src/components/editor/EditorLayout.tsx`
- Modify: `src/components/canvas/TransformGizmo.tsx`
- Modify: `src/components/editor/ui/CatalogItemPreviewPopover.tsx`
- Modify: `src/engine/procedural/zone-pallet-generator.ts`
- Modify: `src/engine/routing/astar-pathfinder.ts`
- Modify: `src/engine/routing/tsp-optimizer.ts`
- Modify: `scripts/smoke-fleet-simulation.ts`
- Modify: `scripts/smoke-zone-pallets.ts`

**Step 1: Fix React 19 `set-state-in-effect` and Refs**
- Replace sync `useEffect` drafts with key-based remounting or React 19 render-time adjustments (`if (prevProp !== prop) setDraft(...)`).
- In `EditorLayout.tsx`, move `showToast` declaration above its usage in `useEffect`.
- In `GuidedTourOverlay.tsx`, move `currentModeRef.current = currentMode` inside `useEffect`.

**Step 2: Fix `prefer-const` and Explicit `any`**
- Change `let` to `const` in `astar-pathfinder.ts`, `tsp-optimizer.ts`, `zone-pallet-generator.ts`, `smoke-fleet-simulation.ts`, `smoke-zone-pallets.ts`.
- Replace `any` in `TransformGizmo.tsx` and `CatalogItemPreviewPopover.tsx` with proper Three.js / generic types (`ThreeEvent<PointerEvent>`, `Record<string, unknown>`).

**Step 3: Run Full Lint Suite**
Run: `npm run lint`
Expected: 0 errors (Exit code 0).

**Step 4: Commit**
```bash
git add src/ scripts/
git commit -m "refactor(lint): resolve all React 19 hooks and typescript lint errors"
```

---

## Final Verification Checklist

1. `npm run typecheck` -> 0 errors.
2. `npm run build` -> Clean Turbopack production build.
3. `npm run lint` -> 0 errors.
4. `npm run test:e2e` -> E2E Playwright test passes.
5. All 22 smoke test scripts in `scripts/smoke-*.ts` pass.
