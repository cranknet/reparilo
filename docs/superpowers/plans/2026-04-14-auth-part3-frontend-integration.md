# Auth & RBAC Part 3: Frontend Auth Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the frontend to real auth — upgrade the Zustand auth store, add route protection, disable sign-up, and connect the login page to real API endpoints.

**Architecture:** The auth store fetches the session on app mount and exposes `login`/`logout`/`checkSession` actions. A `ProtectedRoute` component wraps dashboard routes. The login page uses the `api` axios client for cookie-based auth. Sign-up is disabled.

**Tech Stack:** React, Zustand, TanStack Router, Axios

---

### Task 1: Upgrade Zustand Auth Store

**Files:**
- Rewrite: `src/stores/auth.ts`

- [ ] **Step 1: Replace the mock auth store with real session-based auth**

```typescript
// src/stores/auth.ts
import type { RoleType } from "@shared/constants";
import api from "@/lib/api";

interface AuthUser {
  id: string;
  role: RoleType;
  username: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: RoleType;
  error: string | null;

  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: "OWNER" as RoleType,
  error: null,

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("/auth/session");
      const user = res.data.user;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        role: user.role as RoleType,
        error: null,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        role: "OWNER" as RoleType,
      });
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/auth/sign-in", { username, password });
      const res = await api.get("/auth/session");
      const user = res.data.user;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        role: user.role as RoleType,
        error: null,
      });
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.response?.data?.error || "Login failed";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/sign-out");
    } catch {
      // Ignore — we clear local state regardless
    }
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      role: "OWNER" as RoleType,
      error: null,
    });
    window.location.href = "/login";
  },

  clearError: () => set({ error: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/auth.ts
git commit -m "feat: upgrade auth store with real session-based auth"
```

---

### Task 2: Create ProtectedRoute Component

**Files:**
- Create: `src/components/modules/protected-route.tsx`

- [ ] **Step 1: Create the ProtectedRoute component**

```tsx
// src/components/modules/protected-route.tsx
import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/auth";

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-primary animate-spin text-4xl">
            progress_activity
          </span>
          <span className="font-medium text-on-surface-variant">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/protected-route.tsx
git commit -m "feat: add ProtectedRoute component with loading, auth, and must-change-password checks"
```

---

### Task 3: Create Change Password Page

**Files:**
- Create: `src/pages/auth/change-password.tsx`

- [ ] **Step 1: Create the forced password change page**

This page is shown when `mustChangePassword === true`. It's a simple form that requires the old password and a new password.

```tsx
// src/pages/auth/change-password.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/change-password", { oldPassword, newPassword });
      await useAuthStore.getState().checkSession();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md rounded-2xl bg-surface-container p-8 shadow-lg">
        <div className="mb-6 text-center">
          <span className="material-symbols-outlined mb-2 block text-4xl text-primary">
            lock_reset
          </span>
          <h1 className="font-bold font-headline text-2xl text-on-surface">
            Change Your Password
          </h1>
          <p className="mt-1 text-on-surface-variant text-sm">
            You must set a new password before continuing.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error-container px-4 py-3 text-on-error-container text-sm">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label
              className="block font-bold text-xs text-on-surface-variant uppercase tracking-wider"
              htmlFor="oldPassword"
            >
              Current Password
            </label>
            <input
              className="w-full rounded-xl bg-surface-container-highest px-4 py-3 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
              id="oldPassword"
              onChange={(e) => setOldPassword(e.target.value)}
              required
              type="password"
              value={oldPassword}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="block font-bold text-xs text-on-surface-variant uppercase tracking-wider"
              htmlFor="newPassword"
            >
              New Password
            </label>
            <input
              className="w-full rounded-xl bg-surface-container-highest px-4 py-3 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
              id="newPassword"
              minLength={8}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="block font-bold text-xs text-on-surface-variant uppercase tracking-wider"
              htmlFor="confirmPassword"
            >
              Confirm New Password
            </label>
            <input
              className="w-full rounded-xl bg-surface-container-highest px-4 py-3 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
              id="confirmPassword"
              minLength={8}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          <button
            className="atelier-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold font-headline text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Changing..." : "Change Password"}
          </button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-on-surface-variant hover:text-on-surface"
          onClick={logout}
          type="button"
        >
          Sign out instead
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/change-password.tsx
git commit -m "feat: add forced password change page for mustChangePassword flow"
```

---

### Task 4: Update App Routes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add ProtectedRoute, change-password route, and session check on mount**

```tsx
// src/App.tsx
import type { RoleType } from "@shared/constants";
import { Role } from "@shared/constants";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import DashboardLayout from "@/components/modules/dashboard-layout";
import ProtectedRoute from "@/components/modules/protected-route";
import ChangePasswordPage from "@/pages/auth/change-password";
import LoginPage from "@/pages/auth/login";
import AiAnalystPage from "@/pages/ai-analyst";
import DashboardPage from "@/pages/dashboard";
import FrontDeskPage from "@/pages/dashboard/front-desk";
import TechnicianDashboardPage from "@/pages/dashboard/technician";
import JobsPage from "@/pages/jobs";
import PartsCatalogPage from "@/pages/parts";
import ProfilePage from "@/pages/profile";
import RepairsPage from "@/pages/repairs";
import SettingsPage from "@/pages/settings";
import TrackingPage from "@/pages/tracking";
import { useAuthStore } from "@/stores/auth";

const DASHBOARD_MAP: Record<RoleType, React.ComponentType> = {
  [Role.OWNER]: DashboardPage,
  [Role.TECHNICIAN]: TechnicianDashboardPage,
  [Role.FRONT_DESK]: FrontDeskPage,
};

export default function App() {
  const role = useAuthStore((s) => s.role);
  const checkSession = useAuthStore((s) => s.checkSession);
  const DashboardComponent = DASHBOARD_MAP[role];

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<TrackingPage />} path="/tracking/:jobCode?" />
      <Route element={<ChangePasswordPage />} path="/change-password" />
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <DashboardLayout>
              <DashboardComponent />
            </DashboardLayout>
          }
          path="/"
        />
        <Route
          element={
            <DashboardLayout>
              <JobsPage />
            </DashboardLayout>
          }
          path="/jobs"
        />
        <Route
          element={
            <DashboardLayout>
              <PartsCatalogPage />
            </DashboardLayout>
          }
          path="/parts"
        />
        <Route
          element={
            <DashboardLayout>
              <RepairsPage />
            </DashboardLayout>
          }
          path="/repairs"
        />
        <Route
          element={
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          }
          path="/settings"
        />
        <Route
          element={
            <DashboardLayout>
              <AiAnalystPage />
            </DashboardLayout>
          }
          path="/ai-analyst"
        />
        <Route
          element={
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          }
          path="/profile"
        />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add ProtectedRoute wrapper and session check on app mount"
```

---

### Task 5: Update Login Page (Disable Sign-Up, Wire to API)

**Files:**
- Modify: `src/pages/auth/login.tsx`

Major changes:
1. Remove the sign-up tab toggle — always show sign-in form
2. Use the `api` axios client instead of raw `fetch`
3. Use the auth store `login` action
4. Show error messages from the API

- [ ] **Step 1: Simplify login page — remove sign-up mode, use auth store**

Replace the entire `LoginPage` component. Key changes:
- Remove `mode` state, `SignUpForm` component, and all sign-up fields
- Import `useAuthStore` and use `login` action
- Keep the visual layout (left panel branding, right panel form)
- Show `error` from the store

The `SignInForm` stays but uses `api.post("/auth/sign-in", ...)` via the store's `login` method. Remove the `SignUpForm` component entirely.

Here's the simplified structure:

```tsx
// src/pages/auth/login.tsx — key changes only

// REMOVE: mode state, fullName, email, confirmPassword, agreedToTerms, handleSignUp, SignUpForm

// REPLACE handleSignIn:
async function handleSignIn(e: React.FormEvent) {
  e.preventDefault();
  try {
    await login(username, password);
    // login() sets isAuthenticated=true, ProtectedRoute will redirect to /
  } catch {
    // error is set in the store
  }
}

// In the JSX, remove the mode toggle and SignUpForm entirely.
// Always show the SignInForm.
// Add error display from the store:
const error = useAuthStore((s) => s.error);
const clearError = useAuthStore((s) => s.clearError);

// Show error banner:
{error && (
  <div className="mb-4 rounded-xl bg-error-container px-4 py-3 text-on-error-container text-sm">
    {error}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/login.tsx
git commit -m "feat: disable sign-up, wire login to auth store, add error display"
```

---

### Task 6: Add Logout to TopBar/Sidebar

**Files:**
- Modify: `src/components/modules/top-bar.tsx` (or wherever the user menu is)
- Modify: `src/components/modules/sidebar.tsx` (if logout button exists here)

- [ ] **Step 1: Add logout functionality**

Find the existing logout button in the TopBar or Sidebar (check `src/components/modules/` for a sign-out button) and wire it to `useAuthStore.getState().logout()`.

If no logout button exists, add one to the sidebar or top bar:

```tsx
import { useAuthStore } from "@/stores/auth";

// Inside the component:
const logout = useAuthStore((s) => s.logout);
const username = useAuthStore((s) => s.user?.username);

// In the JSX, find the user menu area and add:
<button
  onClick={logout}
  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
  type="button"
>
  <span className="material-symbols-outlined text-lg">logout</span>
  {username}
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/
git commit -m "feat: add logout button wired to auth store"
```

---

### Task 7: i18n Keys for Auth

**Files:**
- Modify: `src/i18n/locales/en.json`
- Then run: `pnpm run sync-locales`

- [ ] **Step 1: Add new auth-related i18n keys to `en.json`**

Add these keys (the sync script will auto-translate to ar/fr):

```json
{
  "auth_change_password": "Change Password",
  "auth_change_password_desc": "You must set a new password before continuing.",
  "auth_current_password": "Current Password",
  "auth_new_password": "New Password",
  "auth_confirm_new_password": "Confirm New Password",
  "auth_changing": "Changing...",
  "auth_passwords_no_match": "Passwords do not match",
  "auth_password_too_short": "Password must be at least 8 characters",
  "auth_sign_out_instead": "Sign out instead",
  "auth_login_failed": "Invalid username or password",
  "auth_account_disabled": "Account is disabled"
}
```

- [ ] **Step 2: Run sync**

```bash
pnpm run sync-locales
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/
git commit -m "feat: add i18n keys for auth change-password and error messages"
```

---

### Task 8: Integration Test — Verify End-to-End Auth

**Files:**
- Create: `server/__tests__/auth.test.ts`
- Create: `server/__tests__/rbac.test.ts`

- [ ] **Step 1: Write auth integration tests**

```typescript
// server/__tests__/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import authPlugin from "../plugins/auth.js";
import prismaPlugin from "../plugins/prisma.js";

describe("Auth endpoints", () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeAll(async () => {
    app = Fastify();
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    app.decorate("prisma", prisma);
    await app.register(authPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/auth/session returns 401 when not authenticated", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/session",
    });
    expect(response.statusCode).toBe(401);
  });

  it("POST /api/auth/sign-in returns 401 for invalid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in",
      payload: { username: "nonexistent", password: "wrong" },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
```

```typescript
// server/__tests__/rbac.test.ts
import { describe, it, expect } from "vitest";
import { requirePermission } from "../middlewares/rbac.js";
import { ROLE_PERMISSIONS, type RoleType } from "@shared/constants/roles";

describe("requirePermission", () => {
  it("OWNER has all permissions", () => {
    const ownerPerms = ROLE_PERMISSIONS.OWNER;
    expect(ownerPerms).toContain("jobs:read");
    expect(ownerPerms).toContain("users:write");
    expect(ownerPerms).toContain("settings:write");
  });

  it("TECHNICIAN cannot access users:write", () => {
    const techPerms = ROLE_PERMISSIONS.TECHNICIAN;
    expect(techPerms).not.toContain("users:write");
  });

  it("FRONT_DESK cannot access ai:access", () => {
    const fdPerms = ROLE_PERMISSIONS.FRONT_DESK;
    expect(fdPerms).not.toContain("ai:access");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: RBAC unit tests pass. Auth integration tests pass (assuming DB is seeded).

- [ ] **Step 3: Commit**

```bash
git add server/__tests__/
git commit -m "test: add auth and RBAC integration tests"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run the full lint and typecheck**

```bash
pnpm run lint
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 2: Start the dev server and manually test**

```bash
pnpm dev
```

Test the following:
1. Navigate to `/login` — sign-in form appears, no sign-up tab
2. Sign in with seeded admin credentials (`admin` / `SEED_ADMIN_PASSWORD`)
3. Should redirect to `/change-password` (mustChangePassword = true)
4. Change password — should redirect to dashboard
5. Sign out — should redirect to `/login`
6. Try accessing `/jobs` without auth — should redirect to `/login`

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: auth integration fixes from manual testing"
```