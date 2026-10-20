# 📌 3D-Warehouse — Actionable Plan & Audit Findings (For Tomorrow)
*Target Execution Date: Next Development Session*  
*Workspace:* `c:\Users\radit\.gemini\antigravity\scratch\3d-warehouse`  
*Current Baseline:* TypeScript Typecheck Passing (`npm run typecheck`), Smoke Test Suite Passing (`28/28`, `43/43`, `72/72`, `25/25`).

---

## 🚀 Quick Checklist for Tomorrow

### Priority 0: Critical Bug Fixes
- [x] **Task 1: Fix Mezzanine Height Calculation in QuickAdd**
  - **Target File:** [`src/components/editor/ui/PropertiesInspector.tsx`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/components/editor/ui/PropertiesInspector.tsx)
  - **Issue:** `handleQuickAddMezzanine` uses `newElevation - elevationY` without accounting for source level height or platform top elevation, causing vertical connectors to under-calculate height and clip through source floors.
  - **Action:** Account for `sourceTopY = sourceLevel.elevationY + (sourceLevel.height ?? 0)` before calculating connector height.
  - **Verification:** Run `npm run test:multi-floor-ops`.

- [x] **Task 2: Fix ZoneFootprint Early-Return & Ghost Mesh Guard**
  - **Target File:** [`src/components/canvas/ZoneFootprint.tsx`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/components/canvas/ZoneFootprint.tsx)
  - **Issue:** ZoneFootprint returns `null` based on `isHidden` without considering `isEffectiveSelected` in LAYOUT mode, potentially causing ghost mesh issues or inconsistent drag-and-drop hitboxes.
  - **Action:** Refactor visibility guard so that meshes are cleanly suppressed unless explicitly selected or matching the active level slice.
  - **Verification:** Run `npm run test:zone-pallets`.

---

### Priority 1: Maintainability & Architectural Safety
- [x] **Task 3: Harden `placementBus` Against Unintended Direct Mutations**
  - **Target File:** [`src/lib/placement/placement-bus.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/lib/placement/placement-bus.ts)
  - **Issue:** Mutable singleton allows any module to modify drag state directly without encapsulation, posing race-condition risks during multi-drag or quick canvas switches.
  - **Action:** Expose controlled updater functions or encapsulate state inside a factory/accessor pattern while preserving zero-re-render 60fps canvas performance.
  - **Verification:** Typecheck and run drag-and-drop verification.

- [x] **Task 4: Centralize Magic Numbers & Level Constraints**
  - **Target Files:**
    - [`src/constants/warehouse.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/constants/warehouse.ts) *(or create if not present)*
    - [`src/components/editor/ui/PropertiesInspector.tsx`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/components/editor/ui/PropertiesInspector.tsx)
    - [`src/engine/procedural/zone-pallet-generator.ts`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/engine/procedural/zone-pallet-generator.ts)
  - **Constants to extract:**
    - `MAX_BUILDING_LEVELS = 4` (currently duplicated across UI and test scripts)
    - `DEFAULT_OCCUPANCY_RATE = 0.66` (replaces hardcoded `slotIndex % 3 !== 0`)
  - **Verification:** Run `npm run typecheck` and `npm run test:smoke`.

---

### Priority 2: UI Hardening & Internationalization
- [x] **Task 5: Extract Inline Strings to i18n Dictionaries**
  - **Target Files:**
    - [`src/components/editor/EditorLayout.tsx`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/components/editor/EditorLayout.tsx)
    - [`src/components/editor/ui/PropertiesInspector.tsx`](file:///c:/Users/radit/.gemini/antigravity/scratch/3d-warehouse/src/components/editor/ui/PropertiesInspector.tsx)
    - Dictionary: `src/i18n/*.ts`
  - **Action:** Replace hardcoded strings ("Connector", "Structural Pillar Column", "Add Mezzanine", etc.) with dictionary lookup keys.

---

## 📋 Full Audit Report & Technical Details

### 1️⃣ Executive Summary
All existing unit, integration, and smoke tests for **multi-floor, vertical connectors, zone-pallet generation, and WMS inventory** are currently passing (`28/28`, `43/43`, `72/72`, `25/25`). TypeScript type-checking is clean (`npm run typecheck`).

The codebase is solid and functional, but has identified edge-case runtime behaviors and technical debt that should be addressed before adding further building levels or custom connector models.

---

### 2️⃣ Detailed Findings & Implementation Notes

#### 🐛 Bug #1: Mezzanine Connector Height Calculation
- **Location:** `src/components/editor/ui/PropertiesInspector.tsx` (around lines 1700–1720)
- **Current Code:**
  ```ts
  height: newElevation - (buildingLevels.find(l => l.id === connector.fromLevelId)?.elevationY ?? 0)
  ```
- **Root Cause:** If the source floor (`fromLevelId`) is a raised platform or has a non-zero height/elevation offset, subtracting only `elevationY` neglects the source level's physical thickness/height. This causes the generated vertical connector (stairs, elevator shaft) to have an insufficient height, intersecting the floor slab.
- **Proposed Fix:**
  ```ts
  const sourceLevel = buildingLevels.find((l) => l.id === connector.fromLevelId);
  const sourceTopY = sourceLevel ? sourceLevel.elevationY + (sourceLevel.height ?? 0) : 0;
  const height = Math.max(1, newElevation - sourceTopY);
  ```

#### 🐛 Bug #2: ZoneFootprint Visibility & Selection Logic
- **Location:** `src/components/canvas/ZoneFootprint.tsx` (lines 80–110)
- **Current Behavior:**
  ```ts
  const isHidden = activeLevelId !== 'ALL' && (floorSliceMode === 'ISOLATE' ? !isCurrentLevel : isUpperLevel);
  if (isHidden) return null;
  ```
- **Issue:** When switching floor slice modes or selecting a zone in LAYOUT mode across levels, returning `null` unconditionally can leave orphan selection bounds or suppress interaction when the user is trying to edit an element.
- **Proposed Fix:** Ensure that if an item is actively selected by the user (`isEffectiveSelected`), its outline/indicator remains predictable or cleanly deselects without ghost mesh artifacts:
  ```tsx
  if (isHidden && !isEffectiveSelected) return null;
  ```

#### 🛡️ Architecture Note: `placementBus` Mutability
- **Location:** `src/lib/placement/placement-bus.ts`
- **Current Behavior:** A shared mutable singleton holds canvas drag coordinates and active drag payload to bypass React render lifecycles at 60 FPS.
- **Improvement:** Wrap mutations behind setter methods (e.g. `setPlacementDragState(...)`) or provide a clear reset hook on unmount so that cancelled drag events never leave stale payloads on the canvas.

#### 🧱 Constants & Magic Numbers
- `MAX_BUILDING_LEVELS` is currently hardcoded as `4` in several test files and UI headers.
- Pallet occupancy in `zone-pallet-generator.ts` uses `slotIndex % 3 !== 0` (~66%). Expose this as `DEFAULT_PALLET_OCCUPANCY_RATIO`.

---

## 🧪 Verification Playbook for Tomorrow

Execute these commands in sequence to verify all fixes:

```bash
# 1. Typecheck the entire project
npm run typecheck

# 2. Run multi-floor operations smoke test
npm run test:multi-floor-ops

# 3. Run zone pallets smoke test
npm run test:zone-pallets

# 4. Run general smoke tests
npm run test:smoke

# 5. Full Next.js production build test
npm run build
```

---
*Created automatically on 2026-09-15. Ready for immediate pickup tomorrow!*
