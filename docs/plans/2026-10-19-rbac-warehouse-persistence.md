# RBAC Login & Warehouse Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a secure, custom session-based Role-Based Access Control (RBAC) system in Next.js 16 and PostgreSQL/Drizzle ORM with 3 roles (`ADMIN`, `EDITOR`, `VIEWER`), enforcing access control on warehouse layout persistence and user management.

**Architecture:** 
1. **Database Schema & Audit Trail:** Add `users` and `sessions` tables with `bcryptjs` password hashing and a 24-hour expiration window; extend `warehouse_blueprints` with `created_by` and `updated_by` foreign keys.
2. **Server-Side Enforcement & RBAC:** Protect `persistWarehouseLayout` and `deleteWarehouseLayout` actions by inspecting the authenticated session token from HTTP-only cookies, permitting mutations only for `ADMIN` and `EDITOR`, and recording the author's user ID.
3. **Route Guards & UI Adaptation:** Protect `/editor`, `/admin/users`, and dashboard routes via Next.js middleware; render visual role badges in `TopNavToolbar` and `DashboardClient`, disabling mutation controls (Save, Delete, New Facility) for `VIEWER` accounts.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL (`node-postgres` & `@neondatabase/serverless`), `bcryptjs`, TypeScript 5, Tailwind CSS 3.4, Lucide React.

---

## Phased Overview & Execution Order

- **Phase 1: Dependencies & Database Schema Expansion**
  - Task 1: Install `bcryptjs` and types (`package.json`)
  - Task 2: Drizzle ORM Schema Extensions (`src/db/schema.ts`)
  - Task 3: Database Migration Script Execution (`drizzle/` & `src/db/migrate.ts`)
  - Task 4: Database Admin Seeder (`scripts/seed-admin.ts`)
- **Phase 2: Authentication Core & Session Management**
  - Task 5: Auth & Crypto Utilities (`src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/types.ts`)
  - Task 6: Authentication Server Actions (`src/app/actions/auth-actions.ts`)
  - Task 7: Smoke Test for Authentication & Session Lifecycle (`scripts/smoke-auth-session.ts`)
- **Phase 3: RBAC & Data Persistence Enforcement**
  - Task 8: User Management Server Actions (`src/app/actions/user-actions.ts`)
  - Task 9: Secure `layout-actions.ts` with RBAC Validation and Audit Logging
  - Task 10: Smoke Test for RBAC Warehouse Persistence (`scripts/smoke-rbac-persistence.ts`)
- **Phase 4: Middleware & Authentication UI**
  - Task 11: Route Guard Middleware (`src/middleware.ts`)
  - Task 12: Dedicated Industrial Login Page (`src/app/login/page.tsx`)
  - Task 13: Admin User Management Interface (`src/app/admin/users/page.tsx` & `src/components/admin/UserManagementClient.tsx`)
- **Phase 5: Editor & Dashboard UI Integration**
  - Task 14: TopNavToolbar RBAC Badges & Viewer Save Lock (`src/components/editor/ui/TopNavToolbar.tsx`)
  - Task 15: Dashboard User Header & Viewer Mutation Guard (`src/components/dashboard/DashboardClient.tsx`)
- **Phase 6: Quality Verification & Documentation**
  - Task 16: Verification of Build, Types, and Smoke Tests
  - Task 17: Update Documentation (`README.md` & `PROGRESS.md`)

---

## Phase 1: Dependencies & Database Schema Expansion

### Task 1: Install `bcryptjs` and types

**Files:**
- Modify: `package.json`

**Step 1: Install packages**
Run:
```powershell
npm install bcryptjs
npm install -D @types/bcryptjs
```
Expected: packages added to dependencies and devDependencies in `package.json`.

**Step 2: Commit**
```powershell
git add package.json package-lock.json
git commit -m "deps: add bcryptjs and @types/bcryptjs for auth password hashing"
```

---

### Task 2: Drizzle ORM Schema Extensions

**Files:**
- Modify: `src/db/schema.ts`

**Step 1: Add `users` and `sessions` tables, and add `createdBy` / `updatedBy` to `warehouseBlueprints`**

In `src/db/schema.ts`:
1. Define `UserRole` enum/type: `'ADMIN' | 'EDITOR' | 'VIEWER'`.
2. Define table `users`:
   - `id`: `text('id').primaryKey()` (UUID/CUID)
   - `name`: `text('name').notNull()`
   - `email`: `text('email').notNull().unique()`
   - `passwordHash`: `text('password_hash').notNull()`
   - `role`: `text('role').$type<UserRole>().default('VIEWER').notNull()`
   - `createdAt`: `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`
   - `updatedAt`: `timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()`
3. Define table `sessions`:
   - `id`: `text('id').primaryKey()` (cryptographic session token)
   - `userId`: `text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })`
   - `expiresAt`: `timestamp('expires_at', { withTimezone: true }).notNull()`
   - `createdAt`: `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`
   - Index on `userId`
4. Update `warehouseBlueprints`:
   - `createdBy`: `text('created_by').references(() => users.id, { onDelete: 'set null' })`
   - `updatedBy`: `text('updated_by').references(() => users.id, { onDelete: 'set null' })`
5. Export relational definitions for `users`, `sessions`, and `warehouseBlueprints`.

**Step 2: Verify TypeScript compiles**
Run:
```powershell
npm run typecheck
```
Expected: Exit code 0 without schema type errors.

**Step 3: Commit**
```powershell
git add src/db/schema.ts
git commit -m "feat(db): add users and sessions schema with audit trail fields"
```

---

### Task 3: Database Migration Script Execution

**Files:**
- Create: `drizzle/0002_rbac_auth_tables.sql` (or generate via `npx drizzle-kit generate`)
- Modify: `src/db/migrate.ts` if needed

**Step 1: Generate migration SQL or apply schema**
Run:
```powershell
npm run db:generate
```
Or execute manual idempotent migration statements in `src/db/migrate.ts`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

ALTER TABLE warehouse_blueprints ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_blueprints ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
```

**Step 2: Run migration**
Run:
```powershell
npm run db:migrate
```
Expected: Migration executes successfully.

**Step 3: Commit**
```powershell
git add drizzle/ src/db/
git commit -m "feat(db): execute migration for rbac auth tables"
```

---

### Task 4: Database Admin Seeder

**Files:**
- Create: `scripts/seed-admin.ts`
- Modify: `package.json` (add `"db:seed": "tsx scripts/seed-admin.ts"`)

**Step 1: Write `scripts/seed-admin.ts`**
- Connect to DB.
- Check if default admin user `admin@warehouse.local` exists.
- If not, hash password `admin12345` with `bcryptjs` and insert user with role `ADMIN`.
- Also seed test accounts:
  - `editor@warehouse.local` (password `editor12345`, role `EDITOR`)
  - `viewer@warehouse.local` (password `viewer12345`, role `VIEWER`)
- Output summary with role and credentials for easy local testing.

**Step 2: Run seeder**
Run:
```powershell
npm run db:seed
```
Expected: Seeds `admin@warehouse.local`, `editor@warehouse.local`, and `viewer@warehouse.local`.

**Step 3: Commit**
```powershell
git add scripts/seed-admin.ts package.json
git commit -m "feat(auth): add admin and role seed script"
```

---

## Phase 2: Authentication Core & Session Management

### Task 5: Auth & Crypto Utilities

**Files:**
- Create: `src/lib/auth/types.ts`
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/session.ts`

**Step 1: Write `src/lib/auth/types.ts`**
Define interfaces:
- `UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER'`
- `AuthUser = { id: string; name: string; email: string; role: UserRole }`
- `SessionData = { session: { id: string; userId: string; expiresAt: Date }; user: AuthUser }`

**Step 2: Write `src/lib/auth/password.ts`**
- `hashPassword(password: string): Promise<string>` using `bcryptjs.hash(password, 10)`
- `verifyPassword(password: string, hash: string): Promise<boolean>` using `bcryptjs.compare`

**Step 3: Write `src/lib/auth/session.ts`**
- Session duration: `SESSION_MAX_AGE_SECONDS = 24 * 60 * 60` (24 hours).
- `createSession(userId: string): Promise<string>` -> generates a crypto random token, inserts into `sessions` table with `expiresAt = new Date(Date.now() + 24*3600*1000)`.
- `validateSessionToken(token: string): Promise<SessionData | null>` -> queries `sessions` and joins `users`, checks if expired. If expired, deletes session and returns null.
- `invalidateSession(token: string): Promise<void>` -> deletes from `sessions`.
- `getAuthSession(): Promise<SessionData | null>` -> reads `warehouse_session` cookie from `next/headers`, validates session token.
- `setSessionCookie(token: string, expiresAt: Date): Promise<void>` -> sets HTTP-only, secure (in prod), SameSite: 'lax', path: '/'.
- `deleteSessionCookie(): Promise<void>` -> deletes `warehouse_session` cookie.

**Step 4: Commit**
```powershell
git add src/lib/auth/
git commit -m "feat(auth): implement password hashing and 24h session management"
```

---

### Task 6: Authentication Server Actions

**Files:**
- Create: `src/app/actions/auth-actions.ts`

**Step 1: Implement actions**
- `loginAction(formData: { email: string; password: string }): Promise<{ success: boolean; error?: string; user?: AuthUser }>`:
  - Validates input format (Zod schema).
  - Finds user by email in `users` table.
  - Verifies password with `verifyPassword`.
  - Creates session token and sets cookie via `setSessionCookie`.
  - Returns user profile.
- `logoutAction(): Promise<{ success: boolean }>`:
  - Reads cookie, calls `invalidateSession`, and removes cookie.
- `getCurrentUserAction(): Promise<AuthUser | null>`:
  - Returns current logged-in user or null.

**Step 2: Commit**
```powershell
git add src/app/actions/auth-actions.ts
git commit -m "feat(auth): implement login, logout, and get current user server actions"
```

---

### Task 7: Smoke Test for Authentication & Session Lifecycle

**Files:**
- Create: `scripts/smoke-auth-session.ts`
- Modify: `package.json` (add `"test:auth": "tsx scripts/smoke-auth-session.ts"`)

**Step 1: Write test script**
- Verifies password hashing and comparison with `bcryptjs`.
- Creates a session in the database for `admin@warehouse.local`.
- Validates token returns user object with `role === 'ADMIN'`.
- Validates invalid / expired token returns null.
- Invalidates session and verifies token is deleted.

**Step 2: Run test**
Run:
```powershell
npm run test:auth
```
Expected: PASS with 0 errors.

**Step 3: Commit**
```powershell
git add scripts/smoke-auth-session.ts package.json
git commit -m "test: add smoke test for auth and session lifecycle"
```

---

## Phase 3: RBAC & Data Persistence Enforcement

### Task 8: User Management Server Actions

**Files:**
- Create: `src/app/actions/user-actions.ts`

**Step 1: Implement user administration actions with `ADMIN` guard**
- Helper: `assertAdmin(): Promise<AuthUser>` -> calls `getAuthSession()`. Throws or returns error if not authenticated or `user.role !== 'ADMIN'`.
- `listUsers(): Promise<{ success: boolean; users?: Array<Omit<AuthUser, 'passwordHash'> & { createdAt: Date }>; error?: string }>`
- `createUser(input: { name: string; email: string; password: string; role: UserRole }): Promise<{ success: boolean; error?: string }>`
- `updateUserRole(userId: string, newRole: UserRole): Promise<{ success: boolean; error?: string }>`
- `deleteUser(userId: string): Promise<{ success: boolean; error?: string }>` (prevent admin from deleting their own active account).

**Step 2: Commit**
```powershell
git add src/app/actions/user-actions.ts
git commit -m "feat(rbac): implement admin user management actions with role validation"
```

---

### Task 9: Secure `layout-actions.ts` with RBAC Validation and Audit Logging

**Files:**
- Modify: `src/app/actions/layout-actions.ts`

**Step 1: Add session verification and role enforcement**
1. In `persistWarehouseLayout(blueprint: WarehouseLayoutBlueprint)`:
   - Call `getAuthSession()`.
   - If no valid session: return `{ success: false, error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' }`.
   - If `session.user.role === 'VIEWER'`: return `{ success: false, error: 'Akses ditolak: role Viewer hanya memiliki izin baca dan tidak dapat menyimpan layout.' }`.
   - In database upsert for `warehouseBlueprints`:
     - Set `updatedBy = session.user.id`.
     - If creating new blueprint, set `createdBy = session.user.id`.
2. In `deleteWarehouseLayout(id: string)`:
   - Call `getAuthSession()`.
   - If no valid session or `role === 'VIEWER'`: return `{ success: false, error: 'Akses ditolak: role Viewer tidak dapat menghapus layout.' }`.
3. In `listWarehouseLayouts()`:
   - Include author metadata (join with `users` to provide `authorName` or `updatedByName` if available).

**Step 2: Run typecheck**
Run:
```powershell
npm run typecheck
```
Expected: Exit code 0.

**Step 3: Commit**
```powershell
git add src/app/actions/layout-actions.ts
git commit -m "feat(rbac): enforce role gates on layout persistence and record audit trail"
```

---

### Task 10: Smoke Test for RBAC Warehouse Persistence

**Files:**
- Create: `scripts/smoke-rbac-persistence.ts`
- Modify: `package.json` (add `"test:rbac": "tsx scripts/smoke-rbac-persistence.ts"`)

**Step 1: Write test script**
- Test Case 1: Attempt persist with `VIEWER` session -> Expect FAIL / Forbidden error.
- Test Case 2: Attempt persist with `EDITOR` session -> Expect SUCCESS, `updatedBy` matches editor ID.
- Test Case 3: Attempt persist with `ADMIN` session -> Expect SUCCESS.
- Test Case 4: Attempt delete with `VIEWER` -> Expect FAIL.
- Test Case 5: Attempt delete with `ADMIN` -> Expect SUCCESS.

**Step 2: Run test**
Run:
```powershell
npm run test:rbac
```
Expected: All 5 RBAC security assertions PASS.

**Step 3: Commit**
```powershell
git add scripts/smoke-rbac-persistence.ts package.json
git commit -m "test: add rbac layout persistence smoke test"
```

---

## Phase 4: Middleware & Authentication UI

### Task 11: Route Guard Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Implement route protection**
- Protected paths: `/`, `/editor/:path*`, `/admin/:path*`.
- Public paths: `/login`, `/_next/:path*`, `/favicon.ico`, `/public/:path*`.
- Read cookie `warehouse_session`. If missing and accessing protected path, redirect to `/login?callbackUrl=...`.
- If accessing `/admin/:path*`, verify session has `role === 'ADMIN'` (or enforce at page layout level via `getAuthSession()`).
- If authenticated user accesses `/login`, redirect to `/`.

**Step 2: Verify middleware compilation**
Run:
```powershell
npm run build
```

**Step 3: Commit**
```powershell
git add src/middleware.ts
git commit -m "feat(auth): add middleware route guard for editor and admin routes"
```

---

### Task 12: Dedicated Industrial Login Page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/LoginForm.tsx`

**Step 1: Build Login UI**
- Industrial dark warehouse aesthetic matching the app:
  - Deep slate/zinc background with subtle grid line texture.
  - Warehouse 3D Box/Building icon branding: "3D Warehouse Hub".
  - Clean email and password inputs with Lucide icons (`Mail`, `Lock`, `ShieldCheck`).
  - Clear error callout on bad credentials.
  - Helpful quick-demo role selector / badge hint (`admin@warehouse.local`, `editor@warehouse.local`, `viewer@warehouse.local`) for seamless testing.
  - Loading spinner on submit.

**Step 2: Commit**
```powershell
git add src/app/login/ src/components/auth/
git commit -m "feat(ui): add modern industrial login page and form"
```

---

### Task 13: Admin User Management Interface

**Files:**
- Create: `src/app/admin/users/page.tsx`
- Create: `src/components/admin/UserManagementClient.tsx`

**Step 1: Build User Management View**
- Server component validates `user.role === 'ADMIN'`, redirects non-admins.
- Client component features:
  - Header with "Kembali ke Dashboard", title "Manajemen Pengguna & Hak Akses (RBAC)".
  - Button "Tambah Pengguna Baru" opening a modal (Name, Email, Password, Role: ADMIN / EDITOR / VIEWER).
  - Table of users: Name, Email, Role (with styled badges: Admin in Purple/Indigo, Editor in Blue/Sky, Viewer in Emerald/Green), Created Date, and Action buttons (Change Role, Delete).
  - Confirmation modal for delete.

**Step 2: Commit**
```powershell
git add src/app/admin/users/ src/components/admin/
git commit -m "feat(admin): add user management interface with role assignment"
```

---

## Phase 5: Editor & Dashboard UI Integration

### Task 14: TopNavToolbar RBAC Badges & Viewer Save Lock

**Files:**
- Modify: `src/components/editor/ui/TopNavToolbar.tsx`
- Modify: `src/components/editor/EditorLayout.tsx` (pass `currentUser` to `TopNavToolbar`)

**Step 1: Update TopNavToolbar**
1. Accept `currentUser?: AuthUser | null` in props.
2. In Save Button:
   - If `currentUser?.role === 'VIEWER'`:
     - Render button as disabled with text "Mode Baca (Viewer)".
     - Icon: `Lock` or `Eye` icon with amber/slate tint.
     - Tooltip: "Role Viewer hanya dapat melihat dan tidak memiliki izin menyimpan perubahan."
   - If `currentUser?.role !== 'VIEWER'`:
     - Retain standard glowing Save button.
3. In Header Right Area:
   - Display User Profile pill: user initials/avatar, user name, role badge (`ADMIN`, `EDITOR`, `VIEWER`).
   - Dropdown menu with:
     - User email and role.
     - Link to `/admin/users` (visible only if `ADMIN`).
     - Button "Keluar / Logout" calling `logoutAction()`.

**Step 2: Commit**
```powershell
git add src/components/editor/ui/TopNavToolbar.tsx src/components/editor/EditorLayout.tsx
git commit -m "feat(editor): integrate rbac badge, viewer save lock, and user menu in top toolbar"
```

---

### Task 15: Dashboard User Header & Viewer Mutation Guard

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/app/page.tsx` (fetch current user and pass to `DashboardClient`)

**Step 1: Update DashboardClient**
1. Display current user banner/profile in the top bar with Role badge and Logout button.
2. If user is `ADMIN`, display a prominent quick link to "Kelola User / RBAC".
3. If user is `VIEWER`:
   - Disable or hide the "New Facility" / template creation buttons.
   - Hide or disable layout Delete buttons, displaying a "Viewer (Read Only)" chip.
4. Show last updated author name (`updatedBy`) on facility summary cards if present.

**Step 2: Commit**
```powershell
git add src/components/dashboard/DashboardClient.tsx src/app/page.tsx
git commit -m "feat(dashboard): add user profile header, admin link, and viewer read-only restrictions"
```

---

## Phase 6: Quality Verification & Documentation

### Task 16: Verification of Build, Types, and Smoke Tests

**Step 1: Run linter and typecheck**
Run:
```powershell
npm run typecheck
npm run lint
```
Expected: 0 errors.

**Step 2: Run all smoke test suites**
Run:
```powershell
npm run test:auth
npm run test:rbac
npm run test:smoke
```
Expected: All suites exit with code 0.

**Step 3: Test production build**
Run:
```powershell
npm run build
```
Expected: Successful build for all routes (`/`, `/login`, `/editor/[id]`, `/admin/users`).

---

### Task 17: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `PROGRESS.md`

**Step 1: Document RBAC System**
- Detail default seeded accounts:
  - `admin@warehouse.local` / `admin12345` (Role: ADMIN)
  - `editor@warehouse.local` / `editor12345` (Role: EDITOR)
  - `viewer@warehouse.local` / `viewer12345` (Role: VIEWER)
- Explain role permissions matrix:
  | Aksi / Kemampuan | ADMIN | EDITOR | VIEWER |
  | :--- | :---: | :---: | :---: |
  | Akses 3D Canvas & Navigasi | ✅ | ✅ | ✅ |
  | Jalankan Simulasi & WMS Hub | ✅ | ✅ | ✅ |
  | Simpan Layout Warehouse (`persistWarehouseLayout`) | ✅ | ✅ | ❌ |
  | Buat & Hapus Blueprint Warehouse | ✅ | ✅ | ❌ |
  | Kelola User & Ganti Role (`/admin/users`) | ✅ | ❌ | ❌ |
- Record progress entries in `PROGRESS.md`.

**Step 2: Commit**
```powershell
git add README.md PROGRESS.md
git commit -m "docs: document rbac authentication and role permission matrix"
```
