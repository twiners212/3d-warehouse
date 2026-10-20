# Developer Maintenance & Engineering Workflow Guide

This guide establishes the standardized development, testing, branching, and deployment workflow for the **3D Warehouse Digital Twin & Spatial WMS** project.

---

## 1. Daily Development Workflow

Follow this 5-stage loop for any bug fix, enhancement, or new feature:

```
[1. Branch / Feature] ──► [2. Local Dev & Verification] ──► [3. Pre-Commit Quality Gate] ──► [4. Atomic Commit & Push] ──► [5. Production Deployment]
```

### Stage 1: Develop
1. Always start from an up-to-date `main` branch:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create an isolated feature or fix branch following naming conventions:
   ```bash
   git checkout -b feat/picking-sound-effects
   ```

### Stage 2: Testing & Verification
Before staging any code, run the local quality checks:
```bash
# 1. Verify TypeScript types (Zero compiler errors required)
npm run typecheck

# 2. Verify ESLint rules
npm run lint

# 3. Run relevant domain smoke tests
npm run test:picking
npm run test:multi-floor-ops

# 4. Verify Next.js production compilation
npm run build
```

### Stage 3: Commit
Follow Conventional Commits format with clear scopes:
```bash
git add .
git commit -m "feat(picking): add audio feedback to AGV vehicle pallet docking"
```

### Stage 4: Push & Pull Request
Push branch to GitHub and open a Pull Request to trigger the automated CI verification:
```bash
git push origin feat/picking-sound-effects
```

### Stage 5: Deploy
- Merging to `main` automatically triggers deployment to **Vercel Production**.
- Inspect live logs at the Vercel dashboard: [https://vercel.com](https://vercel.com).

---

## 2. Branching & Git Conventions

### Branch Naming Convention
| Type | Pattern | Example |
|---|---|---|
| New Features | `feat/<short-description>` | `feat/virtual-minimap` |
| Bug Fixes | `fix/<issue-name>` | `fix/touch-orbit-gesture` |
| Performance | `perf/<target-subsystem>` | `perf/instanced-mesh-culling` |
| Refactoring | `refactor/<module-name>` | `refactor/command-bus` |
| Documentation | `docs/<update-topic>` | `docs/api-sync-examples` |

### Commit Message Convention (Conventional Commits)
Format: `<type>(<optional-scope>): <imperative description>`

- `feat(editor): add bounding box dimensions tooltip on rack hover`
- `fix(routing): prevent AGV deadlock when crossing vertical lifts`
- `perf(canvas): throttle pointer move raycaster to 60hz animation frame`
- `refactor(stores): split pickingSlice into sub-slices for fleet and orders`
- `docs(readme): add interactive video demo link`

---

## 3. Architecture & Code Quality Guidelines

### When to Refactor
- When a file exceeds **400 lines of code** with multiple distinct responsibilities.
- When spatial math formulas (AABB, matrix transforms, Euler angles) are duplicated across components instead of residing in `src/engine/spatial/`.
- When state mutations bypass the `ICommand` pattern in editor mode, breaking Undo/Redo consistency.

### When to Split Components
- When a Three.js canvas component handles both **geometry rendering** and **HTML DOM overlays**; separate the 3D meshes (`src/components/canvas/`) from the 2D HUD panels (`src/components/editor/ui/`).
- When a component requires more than 5 distinct Zustand store selectors.

### When to Optimize
- If WebGL frame rate drops below **50 FPS** on mid-range hardware during full warehouse overview.
- If total draw calls exceed **60**; batch individual geometries into `THREE.InstancedMesh`.
- When raycasting on pointer move causes input latency; ensure raycasters use throttling or RAF ticks.

---

## 4. Long-Term Repository Hygiene

1. **Keep Secrets Out of Git**: Never commit `.env` or files containing database connection strings. Keep `.env.example` updated with variable names only.
2. **Lock Framework Dependencies**:
   - Keep Tailwind CSS on version **3.4.x** (do not upgrade to v4 without a full layout audit).
   - Test Next.js version bumps in an isolated branch before upgrading.
3. **Prune Stale Branches**: Delete merged feature branches locally and on GitHub to prevent repository clutter.
