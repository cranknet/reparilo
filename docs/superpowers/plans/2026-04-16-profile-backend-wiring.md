# Profile Backend Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the profile page and dashboard to real backend data by adding user stats/sessions endpoints, extending the auth store with name/email, and updating all frontend components.

**Architecture:** Extend existing server routes and frontend stores/components in-place. No new files except the plan doc. Follow existing patterns (Fastify routes, Zustand store, Material Symbols icons, Tailwind classes).

**Tech Stack:** Fastify, Prisma, Better Auth, React, Zustand, Axios, Tailwind, react-i18next

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `shared/schemas/auth.schema.ts` | Add `username` to `updateProfileSchema` |
| Modify | `server/lib/auth.ts:142-159` | Add `name`/`email` to session extraction |
| Modify | `server/plugins/auth.ts:126-138` | Add `name`/`email` to FastifyRequest type |
| Modify | `server/routes/users.ts` | Add stats, sessions, revoke-session endpoints; extend PATCH to accept username |
| Modify | `src/stores/auth.ts` | Add `name`/`email` to AuthUser + checkSession |
| Modify | `src/pages/profile/index.tsx` | Wire form to store, fetch stats/sessions, add username field |
| Modify | `src/pages/dashboard/index.tsx` | Add greeting banner with user name + pending jobs stat |
| Modify | `src/components/modules/sidebar.tsx` | Link user card to /profile, show name |

---

### Task 1: Extend `updateProfileSchema` with username

**Files:**
- Modify: `shared/schemas/auth.schema.ts:27-30`

- [ ] **Step 1: Add username field to schema**

In `shared/schemas/auth.schema.ts`, replace the `updateProfileSchema`:

```ts
export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address").optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add shared/schemas/auth.schema.ts
git commit -m "feat: add username to updateProfileSchema"
```

---

### Task 2: Add `name` and `email` to session/auth chain

**Files:**
- Modify: `server/lib/auth.ts:142-159`
- Modify: `server/plugins/auth.ts:88-95,126-138`

- [ ] **Step 1: Update `getSessionFromRequest` in `server/lib/auth.ts`**

Replace the return block (lines 153-159) with:

```ts
  return {
    id: session.user.id,
    name: (session.user.name as string) ?? "",
    username: session.user.username as string,
    email: session.user.email as string,
    role: session.user.role as string,
    isActive: session.user.isActive as boolean,
    mustChangePassword: session.user.mustChangePassword as boolean,
  };
```

- [ ] **Step 2: Update the dev bypass user in `server/plugins/auth.ts`**

Replace the dev bypass block (lines 88-94) with:

```ts
      request.user = {
        id: "dev",
        name: "Developer",
        username: "dev",
        email: "dev@reparilo.local",
        role: "OWNER",
        isActive: true,
        mustChangePassword: false,
      };
```

- [ ] **Step 3: Update the FastifyRequest type declaration in `server/plugins/auth.ts`**

Replace the interface (lines 131-137) with:

```ts
    interface FastifyRequest {
      user: {
        id: string;
        name: string;
        username: string;
        email: string;
        role: string;
        isActive: boolean;
        mustChangePassword: boolean;
      } | null;
    }
```

- [ ] **Step 4: Commit**

```bash
git add server/lib/auth.ts server/plugins/auth.ts
git commit -m "feat: add name and email to session/auth chain"
```

---

### Task 3: Extend `PATCH /api/users/:id` to accept username

**Files:**
- Modify: `server/routes/users.ts:215-276`

- [ ] **Step 1: Update the PATCH handler to handle username**

Replace lines 235-275 in `server/routes/users.ts` (the body after `const { name, email } = parsed.data;`) with:

```ts
    const { name, email, username } = parsed.data;

    if (name === undefined && email === undefined && username === undefined) {
      return reply
        .status(400)
        .send({ error: "At least one field is required" });
    }

    if (email) {
      const existing = await app.prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return reply.status(409).send({ error: "Email already in use" });
      }
    }

    if (username) {
      const existing = await app.prisma.user.findFirst({
        where: { username, NOT: { id } },
      });
      if (existing) {
        return reply.status(409).send({ error: "Username already in use" });
      }
    }

    const data: { name?: string; email?: string; username?: string } = {};
    if (name) {
      data.name = name;
    }
    if (email) {
      data.email = email;
    }
    if (username) {
      data.username = username;
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    return reply.send(updated);
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: extend PATCH /users/:id to accept username"
```

---

### Task 4: Add `GET /api/users/:id/stats` endpoint

**Files:**
- Modify: `server/routes/users.ts` (add new route after the existing `GET /:id/activity`)

- [ ] **Step 1: Add the stats endpoint**

Append this route at the end of `usersRoutes`, before the closing `}`:

```ts
  app.get("/:id/stats", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!canViewUserActivity(requestingUser.id, id, requestingUser.role)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [completedJobs, monthlyJobs] = await Promise.all([
      app.prisma.job.count({
        where: {
          technicianId: id,
          status: { in: ["DONE", "DELIVERED"] },
        },
      }),
      app.prisma.job.count({
        where: {
          technicianId: id,
          status: { in: ["DONE", "DELIVERED"] },
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return reply.send({ completedJobs, monthlyJobs });
  });
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: add GET /users/:id/stats endpoint"
```

---

### Task 5: Add `GET /api/users/:id/sessions` and `DELETE /api/users/:id/sessions/:sessionId`

**Files:**
- Modify: `server/routes/users.ts` (append after stats route)

- [ ] **Step 1: Add sessions list endpoint**

Append after the stats route:

```ts
  app.get("/:id/sessions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (requestingUser.id !== id) {
      return reply.status(403).send({ error: "Can only view own sessions" });
    }

    const currentToken = request.headers["authorization"]?.replace("Bearer ", "") ?? "";

    const sessions = await app.prisma.session.findMany({
      where: { userId: id, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        token: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.token === currentToken,
    }));

    return reply.send(result);
  });
```

- [ ] **Step 2: Add session revoke endpoint**

Append after the sessions list route:

```ts
  app.delete("/:id/sessions/:sessionId", async (request, reply) => {
    const { id, sessionId } = request.params as { id: string; sessionId: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (requestingUser.id !== id) {
      return reply.status(403).send({ error: "Can only revoke own sessions" });
    }

    const session = await app.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, token: true },
    });

    if (!session || session.userId !== id) {
      return reply.status(404).send({ error: "Session not found" });
    }

    const currentToken = request.headers["authorization"]?.replace("Bearer ", "") ?? "";
    if (session.token === currentToken) {
      return reply.status(400).send({ error: "Cannot end current session" });
    }

    await app.prisma.session.delete({ where: { id: sessionId } });

    return reply.send({ success: true });
  });
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: add session list and revoke endpoints"
```

---

### Task 6: Update frontend auth store with `name` and `email`

**Files:**
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: Update `AuthUser` interface**

Replace the `AuthUser` interface (lines 5-11) with:

```ts
interface AuthUser {
  email: string;
  id: string;
  isActive: boolean;
  mustChangePassword: boolean;
  name: string;
  role: RoleType;
  username: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/auth.ts
git commit -m "feat: add name and email to AuthUser interface"
```

---

### Task 7: Wire profile page to real data

**Files:**
- Modify: `src/pages/profile/index.tsx`

This is the largest task. Changes are: (a) add stats fetching, (b) add sessions fetching with revoke, (c) add username field to personal form, (d) initialize form from store with name/email, (e) update PATCH call to include username.

- [ ] **Step 1: Add stats state and fetch**

After the existing `activityLoading` state (line ~177), add:

```ts
  const [stats, setStats] = useState({ completedJobs: 0, monthlyJobs: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
```

Add a `loadStats` callback next to the existing `loadActivity`:

```ts
  const loadStats = useCallback(async () => {
    if (!userId) return;
    setStatsLoading(true);
    try {
      const res = await api.get(`/users/${userId}/stats`);
      setStats(res.data);
    } catch {
      setStats({ completedJobs: 0, monthlyJobs: 0 });
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);
```

Add an effect to load stats on mount (near the existing `loadActivity` effect):

```ts
  useEffect(() => {
    loadStats();
  }, [loadStats]);
```

- [ ] **Step 2: Add sessions state and fetch**

Add session types and state. After the existing `ActivityItem` interface (line ~73), add:

```ts
interface SessionItem {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  userAgent: string | null;
}
```

Add state after the existing activity state (line ~177):

```ts
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
```

Add a `loadSessions` callback:

```ts
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setSessionsLoading(true);
    try {
      const res = await api.get(`/users/${userId}/sessions`);
      setSessions(res.data);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [userId]);
```

Add an effect to load sessions when security tab is active (near the existing activity tab effect):

```ts
  useEffect(() => {
    if (activeTab === "security") {
      loadSessions();
    }
  }, [activeTab, loadSessions]);
```

Add a revoke handler:

```ts
  async function handleRevokeSession(sessionId: string) {
    if (!userId) return;
    try {
      await api.delete(`/users/${userId}/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // error already handled by axios interceptor
    }
  }
```

- [ ] **Step 3: Add username to personal form**

Update the `personalForm` state initialization (line ~158) to include `username`:

```ts
  const [personalForm, setPersonalForm] = useState({
    name: user?.name || user?.username || "",
    email: user?.email || "",
    language: detectLanguage(),
    username: user?.username || "",
  });
```

Update `personalInitial` accordingly (it mirrors the initial state).

Update `handlePersonalSubmit` to send `username`:

```ts
      await api.patch(`/users/${userId}`, {
        name: personalForm.name,
        email: personalForm.email,
        username: personalForm.username,
      });
```

- [ ] **Step 4: Add username field to `renderPersonalSection`**

Add a new input field after the name input (after the `profile-name` div), inside the grid:

```tsx
          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="profile-username">
              {t("username")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-username"
              onChange={(e) => {
                setPersonalForm((f) => ({ ...f, username: e.target.value }));
                setPersonalDirty(true);
              }}
              type="text"
              value={personalForm.username}
            />
          </div>
```

- [ ] **Step 5: Replace hardcoded sidebar stats**

In the sidebar section (around line ~668-691), replace the hardcoded `127` and `43`:

Replace `127` with `{statsLoading ? "—" : stats.completedJobs}`

Replace `43` with `{statsLoading ? "—" : stats.monthlyJobs}`

- [ ] **Step 6: Replace hardcoded sessions in `renderSecuritySection`**

Replace the two hardcoded session divs (lines ~519-561) with a dynamic list:

```tsx
          <div className="space-y-3">
            {sessionsLoading && (
              <div className="flex items-center justify-center py-6">
                <span className="material-symbols-outlined animate-spin text-[24px] text-on-surface-variant">
                  progress_activity
                </span>
              </div>
            )}
            {!sessionsLoading && sessions.length === 0 && (
              <p className="text-on-surface-variant text-sm">
                {t("profile_no_sessions")}
              </p>
            )}
            {sessions.map((session) => (
              <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4" key={session.id}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                    {session.userAgent?.includes("Mobile") ? "smartphone" : "laptop_mac"}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">
                      {session.userAgent ? parseUserAgent(session.userAgent) : t("profile_unknown_device")}
                      {session.isCurrent ? ` — ${t("profile_current_session")}` : ""}
                    </p>
                    <p className="text-on-surface-variant text-xs">
                      {session.ipAddress ?? t("profile_unknown_ip")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.isCurrent ? (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-success" />
                      <span className="font-bold text-success text-xs uppercase">
                        {t("profile_active")}
                      </span>
                    </>
                  ) : (
                    <button
                      className="font-bold text-tertiary text-xs transition-colors hover:text-tertiary-container"
                      onClick={() => handleRevokeSession(session.id)}
                      type="button"
                    >
                      {t("profile_end_session")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
```

Add a simple UA parser helper near the top of the file (after `getInitials`):

```ts
function parseUserAgent(ua: string): string {
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return ua.slice(0, 30);
}
```

- [ ] **Step 7: Update display name to prefer `name` over `username`**

Change line ~141:

```ts
  const displayName = user?.name || user?.username || t("default_user_display");
```

- [ ] **Step 8: Add missing i18n keys**

Add to `src/i18n/locales/en.json` in the profile section:

```json
  "profile_no_sessions": "No active sessions",
  "profile_unknown_device": "Unknown device",
  "profile_unknown_ip": "Unknown IP"
```

Then run `pnpm run sync-locales` to sync to fr/ar.

- [ ] **Step 9: Commit**

```bash
git add src/pages/profile/index.tsx src/i18n/locales/
git commit -m "feat: wire profile page to real backend data"
```

---

### Task 8: Add greeting banner to dashboard

**Files:**
- Modify: `src/pages/dashboard/index.tsx:96-127`

- [ ] **Step 1: Import auth store and add greeting**

Add import at top:

```ts
import { useAuthStore } from "@/stores/auth";
```

Inside the component, after the `useTranslation` line:

```ts
  const userName = useAuthStore((s) => s.user?.name || s.user?.username || "");
```

Replace the existing header section (lines 98-127, the `<div className="mb-8 flex...">` block) with:

```tsx
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("dashboard_greeting", { name: userName })}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("realtime_status")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-2.5 font-bold font-headline text-on-secondary-fixed-variant text-sm transition-all hover:bg-surface-container-highest-container sm:flex-none md:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              print
            </span>
            <span className="whitespace-nowrap">{t("daily_summary")}</span>
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 sm:flex-none md:px-8"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              add_box
            </span>
            <span className="whitespace-nowrap">{t("new_checkin")}</span>
          </button>
        </div>
      </div>
```

- [ ] **Step 2: Add i18n key**

Add to `src/i18n/locales/en.json`:

```json
  "dashboard_greeting": "Welcome back, {{name}}"
```

Run `pnpm run sync-locales`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/dashboard/index.tsx src/i18n/locales/
git commit -m "feat: add personalized greeting to dashboard"
```

---

### Task 9: Link sidebar user card to `/profile`

**Files:**
- Modify: `src/components/modules/sidebar.tsx:130-174`

- [ ] **Step 1: Update the user card to show name and link to profile**

Replace the user card section (the `<div className="rounded-xl bg-surface-container-high p-3">` block, lines 130-174) with:

```tsx
        <NavLink
          className="rounded-xl bg-surface-container-high p-3 transition-colors hover:bg-surface-container-highest"
          to="/profile"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-on-primary text-sm">
              {getInitials(userName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-on-surface text-sm">
                {userName}
              </p>
              <p className="truncate text-on-surface-variant text-xs">
                {t(ROLE_LABEL_KEYS[role])}
              </p>
            </div>
            <button
              aria-label={
                logoutPending
                  ? t("auth_sign_out_confirm")
                  : t("auth_sign_out_instead")
              }
              className={`flex items-center justify-center rounded-xl px-3 py-3 transition-all duration-200 ${FOCUS_VISIBLE} ${
                logoutPending
                  ? "bg-error-container font-medium text-on-error-container text-xs"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLogoutClick();
              }}
              title={
                logoutPending
                  ? t("auth_sign_out_confirm")
                  : t("auth_sign_out_instead")
              }
              type="button"
            >
              {logoutPending ? (
                t("auth_sign_out_confirm")
              ) : (
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-lg"
                >
                  logout
                </span>
              )}
            </button>
          </div>
        </NavLink>
```

Update the store access near the top of the component (line ~61) to include name:

```ts
  const userName = useAuthStore((s) => s.user?.name || s.user?.username || "");
```

Remove the old `username` variable since we're using `userName` now.

Import `NavLink` is already present.

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/sidebar.tsx
git commit -m "feat: link sidebar user card to profile page"
```

---

### Task 10: Final lint and verification

- [ ] **Step 1: Run linting**

```bash
pnpm run lint
```

Fix any issues.

- [ ] **Step 2: Run type check**

```bash
pnpm run typecheck
```

Fix any type errors.

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: address lint/typecheck issues from profile wiring"
```
