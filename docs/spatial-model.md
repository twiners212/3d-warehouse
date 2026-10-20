# SPATIAL MODEL & MATHEMATICAL SPECIFICATION: 3D WEB WAREHOUSE BUILDER

This document defines the mathematical foundations, coordinate frames, transformation pipelines, and spatial validation algorithms for the 3D Web Warehouse Layout Builder.

---

## 1. Global Coordinate Space (World Frame)

The spatial engine strictly adheres to a **Right-Handed Cartesian ($Y$-Up)** coordinate frame conforming to WebGL and Three.js defaults.


```

```
   +Y (Elevation / Height)
    ▲
    │
    │
    │───────► +X (Width / Horizontal)
   /
  /
 ▼

```

+Z (Depth / Length)

```

* **Measurement Unit:** Standard Metric ($1.0\text{ unit} = 1.0\text{ meter}$).
* **Axes Allocation:**
  * **$X$-Axis (Width):** Horizontal span across the warehouse floor (West $\rightarrow$ East). Positive $+X$ is directed to the right.
  * **$Y$-Axis (Height):** Vertical elevation above floor level (Floor $\rightarrow$ Ceiling). Physical elements strictly satisfy $Y \ge 0$.
  * **$Z$-Axis (Depth):** Longitudinal span across the warehouse floor (Dock/Front $\rightarrow$ Rear/Back). Positive $+Z$ is directed outward toward the viewer.
* **Origin Anchor $(0, 0, 0)$:** Fixed to the **Bottom-Left-Front** vertex of the warehouse floor bounding box.

---

## 2. Pivot Points & Anchor Conventions

To avoid spatial offsets or mesh clipping during rotation and level scaling, every spatial entity defines a fixed anchor point:

| Entity Type | Pivot / Origin Anchor | Justification |
|---|---|---|
| **Warehouse Floor** | Top-Left-Front Corner at $(0, 0, 0)$ | Ensures all floor coordinates lie within $X \ge 0, Z \ge 0$. |
| **Rack Entity** | **Bottom-Center $(X_c, Y = 0, Z_c)$** | Allows $Y$-axis rotation in place without altering footprint center coordinates. |
| **Bin Slot (Child)** | Bottom-Left-Front Corner of Bay | Simplifies local stacking calculations ($X_{\text{local}}, Y_{\text{local}} \ge 0$). |
| **Structural Column** | Bottom-Center $(X_c, Y = 0, Z_c)$ | Aligns symmetrically with floor grid intersections. |
| **Wall Segment** | Bottom-Center of Base Line | Distributes wall thickness symmetrically across grid lines. |

---

## 3. Rotation & Orientation Standards

* **Rotational Freedom:** 1-Degree of Freedom (Yaw rotation around the vertical $Y$-axis only). Pitch ($\theta_X$) and Roll ($\theta_Z$) are strictly locked to $0$.
* **Discrete Increments:** Rotations are constrained to $90^\circ$ steps ($\frac{\pi}{2}\text{ rad}$):

$$\theta_Y \in \left\{ 0,\; \frac{\pi}{2}\approx 1.570796,\; \pi\approx 3.141593,\; \frac{3\pi}{2}\approx 4.712389 \right\}$$

* **Orientation Matrix:**

$$\mathbf{R}_Y(\theta) = \begin{bmatrix} \cos\theta & 0 & \sin\theta \\ 0 & 1 & 0 \\ -\sin\theta & 0 & \cos\theta \end{bmatrix}$$

---

## 4. Local-to-World Coordinate Transformations

Bin slots are defined in the parent rack's local coordinate space. The absolute world position $\mathbf{P}_{\text{world}}$ of a bin slot is computed as:

$$\mathbf{P}_{\text{world}} = \mathbf{P}_{\text{rack}} + \mathbf{R}_Y(\theta) \cdot \mathbf{P}_{\text{local}}$$

### Parametric Bin Coordinate Calculation

For a rack entity with $B$ bays, $L$ levels, total width $W$, bay width $w_{\text{bay}}$, and level height $h_{\text{level}}$:

* **Local $X$ Offset (Bay $b \in [1, B]$):**
  $$X_{\text{local}}(b) = (b - 1) \cdot w_{\text{bay}} - \frac{W}{2} + \frac{w_{\text{bay}}}{2}$$
* **Local $Y$ Offset (Level $l \in [1, L]$):**
  $$Y_{\text{local}}(l) = (l - 1) \cdot h_{\text{level}}$$
* **Local $Z$ Offset:**
  $$Z_{\text{local}} = 0 \quad (\text{centered along rack depth})$$

---

## 5. Spatial Mathematics & Validation Algorithms

### 5.1 Floor Grid Snapping

Transforms unconstrained pointer coordinates $(X_{\text{raw}}, Z_{\text{raw}})$ on the floor plane to the nearest grid increment $S$ (default $S = 0.5\text{ m}$):

$$X_{\text{snapped}} = \left\lfloor \frac{X_{\text{raw}}}{S} + 0.5 \right\rfloor \cdot S$$

$$Z_{\text{snapped}} = \left\lfloor \frac{Z_{\text{raw}}}{S} + 0.5 \right\rfloor \cdot S$$

### 5.2 Effective Footprint Calculation (Rotated AABB)

Since rotation is constrained to multiples of $90^\circ$, the oriented bounding footprint on the $XZ$-plane simplifies to:

$$W_{\text{eff}}(W, D, \theta) = \begin{cases} W, & \text{if } \theta \in \{0, \pi\} \\ D, & \text{if } \theta \in \{\frac{\pi}{2}, \frac{3\pi}{2}\} \end{cases}$$

$$D_{\text{eff}}(W, D, \theta) = \begin{cases} D, & \text{if } \theta \in \{0, \pi\} \\ W, & \text{if } \theta \in \{\frac{\pi}{2}, \frac{3\pi}{2}\} \end{cases}$$

### 5.3 2D Collision Detection (XZ-Plane Overlap)

Two objects $A$ and $B$ collide if their bounding boxes intersect on both axes:

$$\Delta X = |A_x - B_x| < \frac{A.W_{\text{eff}} + B.W_{\text{eff}}}{2}$$

$$\Delta Z = |A_z - B_z| < \frac{A.D_{\text{eff}} + B.D_{\text{eff}}}{2}$$

$$\text{isColliding}(A, B) = \Delta X \land \Delta Z$$

### 5.4 Magnetic Edge-to-Edge Snapping

When dragging Object $A$ within snap threshold distance $T \le 0.3\text{ m}$ of Object $B$:

1. **X-Axis Edge Align:**
   $$\text{If } \left| \left(A_x - \frac{A.W_{\text{eff}}}{2}\right) - \left(B_x + \frac{B.W_{\text{eff}}}{2}\right) \right| \le T \implies A_x = B_x + \frac{B.W_{\text{eff}} + A.W_{\text{eff}}}{2}$$
2. **Z-Axis Edge Align:**
   $$\text{If } \left| \left(A_z - \frac{A.D_{\text{eff}}}{2}\right) - \left(B_z + \frac{B.D_{\text{eff}}}{2}\right) \right| \le T \implies A_z = B_z + \frac{B.D_{\text{eff}} + A.D_{\text{eff}}}{2}$$

### 5.5 Out-of-Bounds Invariant

An entity at $(X_c, Z_c)$ with effective dimensions $(W_{\text{eff}}, D_{\text{eff}})$ is valid within warehouse boundaries $[W_{\text{floor}} \times L_{\text{floor}}]$ if and only if:

$$\left(X_c - \frac{W_{\text{eff}}}{2} \ge 0\right) \land \left(X_c + \frac{W_{\text{eff}}}{2} \le W_{\text{floor}}\right)$$

$$\left(Z_c - \frac{D_{\text{eff}}}{2} \ge 0\right) \land \left(Z_c + \frac{D_{\text{eff}}}{2} \le L_{\text{floor}}\right)$$

---

## 6. TypeScript Spatial Math Reference Implementation

```typescript
// src/engine/spatial/spatial-math.ts

export interface Vector2D {
  x: number;
  z: number;
}

export interface Vector3D extends Vector2D {
  y: number;
}

export interface Footprint {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotationY: number; // in radians
}

export function snapToGrid(value: number, step: number = 0.5): number {
  return Math.round(value / step) * step;
}

export function getEffectiveDimensions(width: number, depth: number, rotationY: number) {
  const normalizedRotation = Math.abs(rotationY % Math.PI);
  const isPerpendicular = Math.abs(normalizedRotation - Math.PI / 2) < 0.01;

  return {
    effectiveWidth: isPerpendicular ? depth : width,
    effectiveDepth: isPerpendicular ? width : depth,
  };
}

export function checkAABBCollision(a: Footprint, b: Footprint): boolean {
  const dimA = getEffectiveDimensions(a.width, a.depth, a.rotationY);
  const dimB = getEffectiveDimensions(b.width, b.depth, b.rotationY);

  const deltaX = Math.abs(a.x - b.x);
  const deltaZ = Math.abs(a.z - b.z);

  const minDistanceX = (dimA.effectiveWidth + dimB.effectiveWidth) / 2;
  const minDistanceZ = (dimA.effectiveDepth + dimB.effectiveDepth) / 2;

  // Margin buffer to prevent false-positive touching edge collisions
  const COLLISION_EPSILON = 0.001;

  return deltaX < minDistanceX - COLLISION_EPSILON && deltaZ < minDistanceZ - COLLISION_EPSILON;
}

export function isWithinWarehouseBounds(
  entity: Footprint,
  warehouseBounds: { width: number; depth: number }
): boolean {
  const { effectiveWidth, effectiveDepth } = getEffectiveDimensions(
    entity.width,
    entity.depth,
    entity.rotationY
  );

  const halfW = effectiveWidth / 2;
  const halfD = effectiveDepth / 2;

  return (
    entity.x - halfW >= 0 &&
    entity.x + halfW <= warehouseBounds.width &&
    entity.z - halfD >= 0 &&
    entity.z + halfD <= warehouseBounds.depth
  );
}

export function calculateLocalToWorld(
  rackPos: Vector3D,
  rackRotationY: number,
  localPos: Vector3D
): Vector3D {
  const cosTheta = Math.cos(rackRotationY);
  const sinTheta = Math.sin(rackRotationY);

  return {
    x: rackPos.x + (localPos.x * cosTheta + localPos.z * sinTheta),
    y: rackPos.y + localPos.y,
    z: rackPos.z + (-localPos.x * sinTheta + localPos.z * cosTheta),
  };
}

```

```

<ElicitationsGroup message="Pilih file blueprint implementasi berikutnya untuk melengkapi proyek:">
  <Elicitation label="Buat Zustand store (useEditorStore.ts)" query="Tuliskan kode lengkap implementasi Zustand Editor Store untuk 3D Warehouse Builder dengan Command Pattern."/>
  <Elicitation label="Buat ProceduralRack.tsx dengan InstancedMesh" query="Tuliskan kode lengkap komponen React Three Fiber ProceduralRack.tsx menggunakan InstancedMesh."/>
  <Elicitation label="Buat database migrations & seed data Drizzle" query="Buat script migrasi database dan dummy seed data untuk Neon Postgres menggunakan Drizzle ORM."/>
</ElicitationsGroup>
