# INTERACTION SPECIFICATION & RULES: 3D WEB WAREHOUSE BUILDER

This document specifies the user interaction lifecycle, state machine transitions, raycasting pipelines, snapping resolution order, collision feedback states, and keyboard mapping for the 3D Web Warehouse Layout Builder.

---

## 1. Global Interaction State Machine

The editor operates as a deterministic Finite State Machine (FSM). Only one interaction state can be active at any given moment.


```

```
              ┌────────────────┐
              │      IDLE      │◄─────────────────────────────┐
              └───────┬────────┘                              │
                      │                                       │
     ┌────────────────┼────────────────┬────────────────┐     │
     │ (Pointer Hover)│ (Palette Drag) │ (Pointer Down) │     │
     ▼                ▼                ▼                │     │

```

┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │     │
│   HOVER     │  │  PREVIEW_   │  │  SELECTED   │         │     │
│  HIGHLIGHT  │  │  PLACEMENT  │  │ (Active UI) │         │     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │     │
│ (Click)        │                │ (Gizmo/Drag)   │     │
└───────────────►├────────────────┼────────────────┘     │
│                │                      │
▼                ▼                      │
┌──────────────────────────────┐               │
│     ACTIVE_TRANSLATION       │               │
│ (Snapping + Collision Live)  │               │
└──────────────┬───────────────┘               │
│ (Pointer Up / Commit)         │
└───────────────────────────────┘

```

### State Definitions

| State | Trigger | Description |
|---|---|---|
| `IDLE` | Canvas click on empty space, `Esc` pressed | No entity selected; Orbit/Pan camera navigation active. |
| `HOVER` | Pointer intersects entity mesh | Visual highlight outline applied to hovered mesh. |
| `SELECTED` | Pointer click on entity mesh | Inspector panel opens; Transform gizmo attaches; selection bounding box renders. |
| `PREVIEW_PLACEMENT` | Dragging item from Sidebar Palette | Ghost mesh follows pointer raycast on floor plane with live collision color. |
| `ACTIVE_TRANSLATION` | Dragging selected mesh or Gizmo plane | Entity moves along $XZ$-plane with live snapping and collision detection. |
| `ROTATING` | Pressing `R` key or dragging rotation Gizmo ring | Rotates entity $90^\circ$ ($1.570796\text{ rad}$) around local $Y$-axis. |

---

## 2. Pointer Raycasting & Selection Hierarchy

### 2.1 Raycast Layer Priority
When the pointer moves or clicks on the canvas, raycasting is evaluated in strict order:

1. **Layer 0 (Gizmo Controls):** Drei/Three.js `TransformControls` handles (highest priority).
2. **Layer 1 (Interactive Entities):** Racks, walls, columns, dock doors.
3. **Layer 2 (Floor Plane):** Ground grid receiver at $Y = 0$.

### 2.2 Selection Invariants
* **Single Click Selection:** Left-clicking an entity sets `selectedEntityId = entity.id`.
* **Deselection:** Left-clicking the floor plane or pressing `Esc` resets `selectedEntityId = null`.
* **Multi-Selection (Box Select / Shift-Click):** Reserved for Phase 2. In Phase 1 MVP, selection is strictly single-entity.

---

## 3. Drag-and-Drop Placement Workflow (New Items)


```

[User drags asset from HTML Palette]
│
▼
Cursor enters Canvas Area
│
├── Spawns Ghost Preview Mesh
└── Disable OrbitControls
│
▼
Pointer Move Event (~60Hz Throttled)
│
├── Raycast to Floor Plane (Y = 0) ──► (X_raw, Z_raw)
├── Execute Snapping Pipeline      ──► (X_snap, Z_snap)
├── Check Bounds & Collisions      ──► isValid
└── Update Ghost Mesh Position & Material (Green / Red)
│
▼
Pointer Release (Drop Event)
│
├── IF isValid === TRUE:
│     ├── Instantiate Rack/Entity Object
│     ├── Execute AddEntityCommand(entity)
│     ├── Auto-generate Bin Coordinates
│     └── Set active selection to new entity
│
└── IF isValid === FALSE:
├── Abort placement & remove Ghost Mesh
└── Trigger UI warning shake/toast

```

---

## 4. Snapping Resolution Pipeline

During `ACTIVE_TRANSLATION` or `PREVIEW_PLACEMENT`, coordinate snapping is evaluated sequentially:


```

(X_raw, Z_raw) from Floor Raycast
│
▼
[Step 1: Grid Snapping]
X_grid = round(X_raw / 0.5) * 0.5
Z_grid = round(Z_raw / 0.5) * 0.5
│
▼
[Step 2: Magnetic Edge-to-Edge Alignment]
Search nearest neighbor entities within radius R <= 0.3m:
IF edge-distance <= 0.3m THEN
Override coordinate with aligned neighbor edge coordinate
ELSE
Keep (X_grid, Z_grid)
│
▼
[Step 3: Boundary Clamping]
Clamp (X, Z) so that all 4 corners remain within [0 <= X <= W_floor, 0 <= Z <= L_floor]
│
▼
Final Snapped Position (X_final, Z_final)

```

---

## 5. Collision & Validation Rules

### 5.1 Real-Time Visual Feedback

| State | Condition | Visual Indicator | Cursor Style |
|---|---|---|---|
| **Valid Placement** | No AABB overlap $\land$ Inside bounds | Ghost mesh: `Color(0x22c55e)` (Green), Opacity: `0.6` | `cursor: copy` or `grabbing` |
| **Collision Overlap** | AABB overlap with another entity | Ghost mesh: `Color(0xef4444)` (Red), Opacity: `0.6`, Red wireframe | `cursor: not-allowed` |
| **Out-of-Bounds** | Entity footprint exceeds warehouse floor | Ghost mesh: `Color(0xef4444)` (Red), Opacity: `0.6` | `cursor: not-allowed` |

### 5.2 Commit Gate & Fallback Policy
* **New Item Placement:** If dropped while in an invalid state (`Red`), the ghost mesh is destroyed immediately and no entity is created.
* **Existing Item Translation:** If dropped while in an invalid state, the entity reverts smoothly to its pre-drag position (`initialPosition`) without pushing a command to history.

---

## 6. Rotation Mechanics

* **Trigger:** Pressing the `R` key while an entity is selected or being dragged, or clicking the rotate button in the Inspector.
* **Execution:**
  $$\theta_{\text{new}} = (\theta_{\text{current}} + \frac{\pi}{2}) \pmod{2\pi}$$
* **Live Re-validation:** Upon rotation, dimensions $(W_{\text{eff}}, D_{\text{eff}})$ swap if moving between parallel and perpendicular orientations. The collision and bounding checks re-run immediately:
  * If rotating an existing placed entity causes a collision, flash the outline red and revert the rotation after $300\text{ms}$ with a warning tooltip *"Cannot rotate: space obstructed"*.

---

## 7. Keyboard & Shortcut Bindings

| Shortcut | Action | Scope / Context |
|---|---|---|
| `R` | Rotate active item $+90^\circ$ around $Y$-axis | Item selected or during drag preview |
| `Delete` / `Backspace` | Remove selected item (and all child bins) | Entity selected |
| `Escape` | Deselect active item / Cancel drag preview | Global |
| `Ctrl + Z` / `Cmd + Z` | Undo last action | Global editor |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo action | Global editor |
| `2` or `V` | Switch to **2D Top-Down View** (Orthographic) | Global editor |
| `3` or `B` | Switch to **3D Orbit View** (Perspective) | Global editor |
| `G` | Toggle grid visibility and snapping on/off | Global editor |
| `F` | Focus / center camera on selected entity | Entity selected |

---

## 8. TypeScript Interaction Contracts

```typescript
// src/types/interaction.ts

export type EditorInteractionMode =
  | 'IDLE'
  | 'HOVER'
  | 'SELECTED'
  | 'PREVIEW_PLACEMENT'
  | 'ACTIVE_TRANSLATION'
  | 'ROTATING';

export interface DraggedPaletteItem {
  type: 'rack' | 'structural' | 'zone';
  subType: string;
  defaultConfig: {
    width: number;
    depth: number;
    height: number;
    bays?: number;
    levels?: number;
  };
}

export interface InteractionState {
  mode: EditorInteractionMode;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  draggedItem: DraggedPaletteItem | null;
  isSnappingEnabled: boolean;
  isCollisionValid: boolean;
  activeTransformOrigin: { x: number; y: number; z: number } | null;
}

```

```

<ElicitationsGroup message="Pilih file blueprint implementasi berikutnya untuk melengkapi spesifikasi:">
  <Elicitation label="Buat Zustand store (useEditorStore.ts)" query="Tuliskan kode lengkap implementasi Zustand Editor Store untuk 3D Warehouse Builder dengan Command Pattern."/>
  <Elicitation label="Buat ProceduralRack.tsx dengan InstancedMesh" query="Tuliskan kode lengkap komponen React Three Fiber ProceduralRack.tsx menggunakan InstancedMesh."/>
  <Elicitation label="Buat implementasi WarehouseCanvas.tsx & CameraController.tsx" query="Tuliskan kode lengkap komponen React Three Fiber untuk WarehouseCanvas.tsx dan CameraController.tsx."/>
</ElicitationsGroup>
