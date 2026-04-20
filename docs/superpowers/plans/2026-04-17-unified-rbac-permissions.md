# Unified RBAC / Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homegrown string-based `ROLE_PERMISSIONS` table with a single typed access-control registry built on Better Auth's `createAccessControl`, enforced identically on the server (middleware) and client (hook + component), and fine-grained enough to express per-status-transition ownership and cost/margin visibility rules.

**Architecture:** One `shared/permissions.ts` module exports a typed `statement`, an `ac` instance, and three role builders (OWNER / TECHNICIAN / FRONT_DESK). The server's existing `admin` plugin already uses `createAccessControl`; we extend its statements with business resources and share the same `ac` + roles with a new `authClient`. Server `requirePermission(...)` becomes a thin wrapper over `auth.api.userHasPermission`. Client `useCan(...)` wraps `authClient.admin.checkRolePermission` (synchronous, no network). Status transitions move from a single `jobs:update_status` bucket to per-status checks (`jobStatus: [...]`). Front-Desk cancel window enforced at the service layer, not the permission layer.

**Tech Stack:** Better Auth 1.3+ (admin plugin, `createAccessControl`, `adminClient`), Fastify preHandlers, Zustand (unchanged), React hooks, Vitest.

---

## Context

The current system has two parallel enforcement paths:

- **Server:** `server/middlewares/rbac.ts` looks up `request.user.role` in `shared/constants/roles.ts#ROLE_PERMISSIONS` (flat strings like `"jobs:write"`).
- **Client:** `src/components/modules/protected-route.tsx#RequireRole` gates routes by role array. Feature gating leaks into ad-hoc string checks (`role === "TECHNICIAN"` in `sidebar.tsx:117`, `top-bar.tsx:50`).

Problems this plan solves:

1. **Drift risk** — two enforcement systems with overlapping intent.
2. **Stringly-typed permissions** — no autocomplete, typos silently deny or allow.
3. **Coarse scopes** — `jobs:write` covers create + edit + add parts + transition status; can't express that Front Desk owns `DELIVERED`/`RETURNED` while Technician owns `IN_REPAIR`/`DONE`.
4. **No field-level gates** — cost/margin visibility has nowhere to live; a future change-stream must not leak cost fields to Front Desk.
5. **Mix of role-strings and role-enum** — UI uses string literals bypassing the constant.

Better Auth's `createAccessControl` is already installed (narrowly, for admin plugin actions only). Extending it to business resources is the minimal, idiomatic fix. We do **not** adopt the organization plugin — Reparilo is single-location (`CLAUDE.md`).

### Role × resource decisions (from brainstorming)

| Resource | OWNER | TECHNICIAN | FRONT_DESK |
|---|---|---|---|
| `jobs` | view, create, edit, delete, cancel, assign, selfAssign, viewMargin | view, create, edit, selfAssign, viewMargin | view, create, cancel |
| `jobStatus` | all 8 JobStatus values | WAITING_FOR_PARTS, IN_REPAIR, ON_HOLD, DONE, CANCELLED | DELIVERED, RETURNED, CANCELLED |
| `parts` | all | viewCatalog, add, remove, viewCost, setCost, overridePrice | — |
| `customers` | view, create, edit | view | view, create, edit |
| `repairs` | viewCatalog, manageCatalog | viewCatalog | — |
| `reports` | viewSelf, viewShop, viewMargin | viewSelf | — |
| `settings` | view, edit | — | — |
| `notifications` | read, send, manage | read | read, send |
| `ai` | access | — | access |
| `user` / `session` (admin plugin) | all | list, get / — | create, list, get, update / — |

Row-level rules not expressible as permissions (enforced in services):
- **FD cancel**: job must be created by the requesting user AND within 30 minutes of creation.
- **Job reassignment**: only OWNER may set `technicianId` to anyone; TECHNICIAN may set `technicianId = self` (selfAssign).

### Out of scope

- Cost-price DB schema (`JobPart.unitCost`, `JobPart.profit`). The schema currently only has `unitPrice` (sell) and `totalCost = qty*unitPrice` (total sell). The `parts.viewCost` / `parts.setCost` / `reports.viewMargin` permissions are defined for future use; field-stripping is a no-op until the cost column exists. A follow-up plan should add the column + migration.
- Payments model. `payments` resource **not** included in the statement — the product uses `jobStatus = DELIVERED` as the completion signal; no separate payment record is modeled today.

---

## File Structure

**New files:**
- `shared/permissions.ts` — single source of truth: `statement`, `ac`, role builders
- `shared/__tests__/permissions.test.ts` — unit tests for role permission matrix
- `src/lib/auth-client.ts` — Better Auth React client with `adminClient({ ac, roles })`
- `src/hooks/use-can.ts` — `useCan(perms)` hook returning `boolean`
- `src/components/modules/can.tsx` — `<Can perm={...}>{children}</Can>` wrapper
- `server/__tests__/rbac.test.ts` — middleware unit tests

**Modified files:**
- `server/lib/auth.ts` — import shared `ac`, `ownerRole`, `technicianRole`, `frontDeskRole`; drop inline duplicates
- `server/middlewares/rbac.ts` — rewrite signature from `requirePermission("jobs:write")` to `requirePermission({ jobs: ["edit"] })`; call `auth.api.userHasPermission`
- `server/routes/jobs.ts` — migrate all `requirePermission` calls; replace `jobs:update_status` with inline `jobStatus: [<status>]` check in `PATCH /:id/status`
- `server/routes/parts.ts` — migrate to `parts: ["manageCatalog"]` etc.
- `server/routes/customers.ts` — migrate
- `server/routes/repairs.ts` — migrate
- `server/routes/settings.ts` — migrate; FD loses access (route-level `settings: ["view"]` now Owner-only)
- `server/routes/notifications.ts` — migrate
- `server/routes/ai.ts` — migrate
- `server/routes/users.ts` — migrate + replace `canModifyUser` / `canViewUserActivity` helpers with `auth.api.userHasPermission` calls
- `server/services/job.service.ts` — add 30-min cancel-window rule in `transitionStatus` for FD-initiated CANCELLED
- `src/components/modules/protected-route.tsx` — keep `RequireRole` for coarse redirects; add `RequirePermission` wrapper for permission-gated routes
- `src/app.tsx` — replace `<RequireRole roles={["OWNER", "TECHNICIAN"]}>` on `/parts` with `<RequirePermission perm={{ parts: ["viewCatalog"] }}>`; same for `/repairs`
- `src/components/modules/sidebar.tsx` — replace `role === "TECHNICIAN"` with `useCan`; nav item filtering via permissions
- `src/components/modules/top-bar.tsx` — same
- `src/stores/auth.ts` — no structural change; `role` still needed for `useCan` / `checkRolePermission`
- `shared/constants/roles.ts` — remove `ROLE_PERMISSIONS` export, keep `Role`, `RoleType`, `ROLE_LABELS`
- `shared/constants/index.ts` — remove `ROLE_PERMISSIONS` from barrel export
- `shared/__tests__/constants.test.ts` — remove `ROLE_PERMISSIONS` assertions (covered by new `permissions.test.ts`)

---

## Task 1: Shared access-control registry

**Files:**
- Create: `shared/permissions.ts`
- Create: `shared/__tests__/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `shared/__tests__/permissions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ac, frontDeskRole, ownerRole, roles, statement, technicianRole } from "../permissions";

describe("permission statement", () => {
  it("includes admin plugin defaults (user, session) and business resources", () => {
    expect(statement).toHaveProperty("user");
    expect(statement).toHaveProperty("session");
    expect(statement).toHaveProperty("jobs");
    expect(statement).toHaveProperty("jobStatus");
    expect(statement).toHaveProperty("parts");
    expect(statement).toHaveProperty("customers");
    expect(statement).toHaveProperty("repairs");
    expect(statement).toHaveProperty("reports");
    expect(statement).toHaveProperty("settings");
    expect(statement).toHaveProperty("notifications");
    expect(statement).toHaveProperty("ai");
  });
});

describe("roles map", () => {
  it("exposes OWNER / TECHNICIAN / FRONT_DESK keys", () => {
    expect(roles.OWNER).toBe(ownerRole);
    expect(roles.TECHNICIAN).toBe(technicianRole);
    expect(roles.FRONT_DESK).toBe(frontDeskRole);
  });
});

describe("OWNER", () => {
  it("has every action on every business resource", () => {
    const perms = ownerRole.statements;
    expect(perms.jobs).toContain("delete");
    expect(perms.jobs).toContain("viewMargin");
    expect(perms.jobStatus).toContain("INTAKE");
    expect(perms.jobStatus).toContain("DELIVERED");
    expect(perms.reports).toContain("viewShop");
    expect(perms.reports).toContain("viewMargin");
    expect(perms.settings).toContain("edit");
  });
});

describe("TECHNICIAN", () => {
  const perms = technicianRole.statements;

  it("can edit jobs, self-assign, view margin, but not assign others or delete", () => {
    expect(perms.jobs).toContain("edit");
    expect(perms.jobs).toContain("selfAssign");
    expect(perms.jobs).toContain("viewMargin");
    expect(perms.jobs).not.toContain("assign");
    expect(perms.jobs).not.toContain("delete");
  });

  it("owns mid-workflow status transitions (WAITING_FOR_PARTS, IN_REPAIR, ON_HOLD, DONE, CANCELLED)", () => {
    expect(perms.jobStatus).toEqual(
      expect.arrayContaining(["WAITING_FOR_PARTS", "IN_REPAIR", "ON_HOLD", "DONE", "CANCELLED"])
    );
    expect(perms.jobStatus).not.toContain("DELIVERED");
    expect(perms.jobStatus).not.toContain("RETURNED");
  });

  it("can add parts, view cost, override price", () => {
    expect(perms.parts).toEqual(
      expect.arrayContaining(["add", "remove", "viewCost", "setCost", "overridePrice"])
    );
  });

  it("views only self reports, never shop-wide or margin", () => {
    expect(perms.reports).toEqual(["viewSelf"]);
  });

  it("has no settings access", () => {
    expect(perms.settings ?? []).toEqual([]);
  });
});

describe("FRONT_DESK", () => {
  const perms = frontDeskRole.statements;

  it("can view/create/cancel jobs but not edit or delete", () => {
    expect(perms.jobs).toEqual(expect.arrayContaining(["view", "create", "cancel"]));
    expect(perms.jobs).not.toContain("edit");
    expect(perms.jobs).not.toContain("delete");
  });

  it("owns DELIVERED, RETURNED, CANCELLED transitions", () => {
    expect(perms.jobStatus).toEqual(
      expect.arrayContaining(["DELIVERED", "RETURNED", "CANCELLED"])
    );
    expect(perms.jobStatus).not.toContain("IN_REPAIR");
    expect(perms.jobStatus).not.toContain("DONE");
  });

  it("has no parts, reports, or settings access", () => {
    expect(perms.parts ?? []).toEqual([]);
    expect(perms.reports ?? []).toEqual([]);
    expect(perms.settings ?? []).toEqual([]);
  });

  it("can manage customers and send notifications", () => {
    expect(perms.customers).toEqual(expect.arrayContaining(["view", "create", "edit"]));
    expect(perms.notifications).toEqual(expect.arrayContaining(["read", "send"]));
  });
});

describe("ac.newRole returns usable instances", () => {
  it("ac is created from the statement", () => {
    expect(ac).toBeDefined();
    expect(typeof ac.newRole).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run shared/__tests__/permissions.test.ts`
Expected: FAIL — `Cannot find module '../permissions'`.

- [ ] **Step 3: Write the registry**

Create `shared/permissions.ts`:

```typescript
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { createAccessControl } from "better-auth/plugins/access";

/**
 * Single source of truth for RBAC.
 *
 * Spreads Better Auth's `defaultStatements` so the admin plugin keeps working
 * (user / session actions) and adds business resources on top.
 *
 * Action naming: camelCase for arbitrary actions; UPPER_SNAKE for jobStatus
 * actions so they match `JobStatus` enum values verbatim.
 */
export const statement = {
  ...defaultStatements,
  jobs: [
    "view",
    "create",
    "edit",
    "delete",
    "cancel",
    "assign",
    "selfAssign",
    "viewMargin",
  ],
  jobStatus: [
    "INTAKE",
    "WAITING_FOR_PARTS",
    "IN_REPAIR",
    "ON_HOLD",
    "DONE",
    "DELIVERED",
    "RETURNED",
    "CANCELLED",
  ],
  parts: [
    "viewCatalog",
    "manageCatalog",
    "add",
    "remove",
    "viewCost",
    "setCost",
    "overridePrice",
  ],
  customers: ["view", "create", "edit"],
  repairs: ["viewCatalog", "manageCatalog"],
  reports: ["viewSelf", "viewShop", "viewMargin"],
  settings: ["view", "edit"],
  notifications: ["read", "send", "manage"],
  ai: ["access"],
} as const;

export const ac = createAccessControl(statement);

export const ownerRole = ac.newRole({
  ...adminAc.statements,
  jobs: [
    "view",
    "create",
    "edit",
    "delete",
    "cancel",
    "assign",
    "selfAssign",
    "viewMargin",
  ],
  jobStatus: [
    "INTAKE",
    "WAITING_FOR_PARTS",
    "IN_REPAIR",
    "ON_HOLD",
    "DONE",
    "DELIVERED",
    "RETURNED",
    "CANCELLED",
  ],
  parts: [
    "viewCatalog",
    "manageCatalog",
    "add",
    "remove",
    "viewCost",
    "setCost",
    "overridePrice",
  ],
  customers: ["view", "create", "edit"],
  repairs: ["viewCatalog", "manageCatalog"],
  reports: ["viewSelf", "viewShop", "viewMargin"],
  settings: ["view", "edit"],
  notifications: ["read", "send", "manage"],
  ai: ["access"],
});

export const technicianRole = ac.newRole({
  user: ["list", "get"],
  session: [],
  jobs: ["view", "create", "edit", "selfAssign", "viewMargin"],
  jobStatus: ["WAITING_FOR_PARTS", "IN_REPAIR", "ON_HOLD", "DONE", "CANCELLED"],
  parts: ["viewCatalog", "add", "remove", "viewCost", "setCost", "overridePrice"],
  customers: ["view"],
  repairs: ["viewCatalog"],
  reports: ["viewSelf"],
});

export const frontDeskRole = ac.newRole({
  user: ["create", "list", "get", "update"],
  session: [],
  jobs: ["view", "create", "cancel"],
  jobStatus: ["DELIVERED", "RETURNED", "CANCELLED"],
  customers: ["view", "create", "edit"],
  notifications: ["read", "send"],
  ai: ["access"],
});

export const roles = {
  OWNER: ownerRole,
  TECHNICIAN: technicianRole,
  FRONT_DESK: frontDeskRole,
} as const;

export type Statement = typeof statement;

/** Shape accepted by `auth.api.userHasPermission` and `requirePermission`. */
export type PermissionCheck = {
  [K in keyof Statement]?: Array<Statement[K][number]>;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run shared/__tests__/permissions.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add shared/permissions.ts shared/__tests__/permissions.test.ts
git commit -m "feat(rbac): add shared access-control registry"
```

---

## Task 2: Wire shared AC into Better Auth (server + client)

**Files:**
- Modify: `server/lib/auth.ts:5-46, 127-138`
- Create: `src/lib/auth-client.ts`

- [ ] **Step 1: Replace the inline AC in `server/lib/auth.ts`**

Edit `server/lib/auth.ts`. Change the imports and delete the inline `ac` + role definitions so the file reuses the shared registry.

Replace lines 5-46 with:

```typescript
import { ac, roles } from "@shared/permissions";
import { admin, username } from "better-auth/plugins";
import { sendPasswordResetEmail } from "./email.js";
```

And replace the `plugins` array (lines 127-138) with:

```typescript
    plugins: [
      username(),
      admin({
        adminRoles: ["OWNER"],
        ac,
        roles,
      }),
    ],
```

- [ ] **Step 2: Create the client-side `auth-client.ts`**

Create `src/lib/auth-client.ts`:

```typescript
import { ac, roles } from "@shared/permissions";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? undefined
      : `${window.location.protocol}//${window.location.host}`,
  basePath: "/api/auth",
  plugins: [usernameClient(), adminClient({ ac, roles })],
});

export type AuthClient = typeof authClient;
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no new type errors).

- [ ] **Step 4: Run existing tests to verify nothing broke**

Run: `pnpm vitest run`
Expected: PASS (previously-passing tests still green; `shared/__tests__/constants.test.ts` still green — `ROLE_PERMISSIONS` not yet removed).

- [ ] **Step 5: Commit**

```bash
git add server/lib/auth.ts src/lib/auth-client.ts
git commit -m "feat(rbac): wire shared AC into Better Auth server & client"
```

---

## Task 3: Rewrite `requirePermission` middleware

**Files:**
- Modify: `server/middlewares/rbac.ts` (full rewrite)
- Create: `server/__tests__/rbac.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/rbac.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { requirePermission } from "../../server/middlewares/rbac.js";

type MockReply = {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

function makeReply(): MockReply {
  const reply = { status: vi.fn(), send: vi.fn() } as unknown as MockReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

function makeRequest(role: string | null, userHasPermission: ReturnType<typeof vi.fn>) {
  return {
    user: role ? { id: "u1", role } : null,
    server: { auth: { api: { userHasPermission } } },
  } as unknown as Parameters<ReturnType<typeof requirePermission>>[0];
}

describe("requirePermission", () => {
  it("returns 401 when no user on request", async () => {
    const reply = makeReply();
    const handler = requirePermission({ jobs: ["view"] });
    const spy = vi.fn();
    await handler(makeRequest(null, spy), reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 403 when userHasPermission.success is false", async () => {
    const reply = makeReply();
    const spy = vi.fn().mockResolvedValue({ success: false });
    const handler = requirePermission({ jobs: ["edit"] });
    await handler(makeRequest("FRONT_DESK", spy), reply as never);
    expect(spy).toHaveBeenCalledWith({
      body: { role: "FRONT_DESK", permissions: { jobs: ["edit"] } },
    });
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("passes through when userHasPermission.success is true", async () => {
    const reply = makeReply();
    const spy = vi.fn().mockResolvedValue({ success: true });
    const handler = requirePermission({ jobStatus: ["DELIVERED"] });
    await handler(makeRequest("FRONT_DESK", spy), reply as never);
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/__tests__/rbac.test.ts`
Expected: FAIL (current `requirePermission` has a different signature taking a string).

- [ ] **Step 3: Rewrite `server/middlewares/rbac.ts`**

Replace the entire file with:

```typescript
import type { PermissionCheck } from "@shared/permissions";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Verifies the requesting user's role has the given permissions.
 * Uses Better Auth's `auth.api.userHasPermission` — no DB call; purely
 * evaluates the role map registered with the admin plugin.
 */
export function requirePermission(permissions: PermissionCheck) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    const result = await request.server.auth.api.userHasPermission({
      body: {
        role: request.user.role,
        permissions,
      },
    });

    if (!result.success) {
      await reply.status(403).send({ error: "Insufficient permissions" });
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/__tests__/rbac.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify types compile (routes still use old signature — expect errors)**

Run: `pnpm exec tsc --noEmit 2>&1 | head -40`
Expected: FAIL — every `requirePermission("jobs:write")` in `server/routes/*.ts` now errors (`Argument of type 'string' is not assignable to parameter of type 'PermissionCheck'`). The middleware and its test compile cleanly; only the old-call-site routes fail. This is expected — Tasks 4-7 migrate them.

- [ ] **Step 6: Commit (build is knowingly broken until Task 7)**

```bash
git add server/middlewares/rbac.ts server/__tests__/rbac.test.ts
git commit -m "refactor(rbac): rewrite requirePermission for typed PermissionCheck (WIP: routes migrate in Tasks 4-7)"
```

**Plan note for executing agents:** Tasks 4, 5, 6, 7 each migrate a slice of routes. Between them, `pnpm exec tsc --noEmit` fails with decreasing error counts — that's the intended trajectory. `pnpm vitest run` still passes at every step (the failing routes don't have tests; the passing vitest tests use compiled dist or direct imports, not type-checking). Do not try to "fix" the type errors outside of the tasks below.

---

## Task 4: Migrate `server/routes/jobs.ts`

**Files:**
- Modify: `server/routes/jobs.ts:12, 65, 117, 150, 192-231, 244, 278, 312, 326, 360, 374, 424, 438, 472`

- [ ] **Step 1: Update the import and top-level hook**

In `server/routes/jobs.ts`:

Line 12 stays the same (`import { requirePermission } from "../middlewares/rbac.js";`).

Replace line 65:

```typescript
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));
```

- [ ] **Step 2: Migrate POST /  (create)**

Replace line 117:

```typescript
    { preHandler: [requirePermission({ jobs: ["create"] })] },
```

- [ ] **Step 3: Migrate PATCH /:id  (edit)**

Replace line 150:

```typescript
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
```

- [ ] **Step 4: Rewrite PATCH /:id/status to check per-status permission**

Replace the entire `PATCH /:id/status` handler (lines 190-231) with:

```typescript
  app.patch("/:id/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = transitionStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body", {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (!req.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    const permCheck = await app.auth.api.userHasPermission({
      body: {
        role: req.user.role,
        permissions: { jobStatus: [parsed.data.status] },
      },
    });
    if (!permCheck.success) {
      return sendError(
        reply,
        403,
        "FORBIDDEN_STATUS_TRANSITION",
        `Role ${req.user.role} cannot transition to ${parsed.data.status}`
      );
    }

    const userId = getUserId(req);
    const result = await transitionStatus(
      app.prisma,
      id,
      parsed.data.status,
      userId,
      { requestingRole: req.user.role }
    );
    if (!result) {
      return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    }
    if ("error" in result && result.error === "CONFLICT_STATUS_TRANSITION") {
      return sendError(
        reply,
        409,
        "CONFLICT_STATUS_TRANSITION",
        "Invalid status transition",
        {
          allowedTransitions: result.allowedTransitions,
          currentStatus: result.currentStatus,
        }
      );
    }
    if ("error" in result && result.error === "CANCEL_WINDOW_EXPIRED") {
      return sendError(
        reply,
        403,
        "CANCEL_WINDOW_EXPIRED",
        "Cancellation window has expired"
      );
    }
    if ("error" in result && result.error === "CANCEL_NOT_CREATOR") {
      return sendError(
        reply,
        403,
        "CANCEL_NOT_CREATOR",
        "Only the job creator can cancel"
      );
    }
    return reply.send(result);
  });
```

Note the new `{ requestingRole }` option argument and two new error codes (`CANCEL_WINDOW_EXPIRED`, `CANCEL_NOT_CREATOR`); Task 7 implements the service-layer rule.

- [ ] **Step 5: Migrate remaining `jobs:write` preHandlers**

Find/replace in the file. Every occurrence of:

```typescript
{ preHandler: [requirePermission("jobs:write")] },
```

becomes:

```typescript
{ preHandler: [requirePermission({ jobs: ["edit"] })] },
```

(Affects lines 244, 278, 312, 326, 360, 374, 424, 438, 472 — the notes / parts / repairs / photos / waiting-parts routes. They're all edits to an existing job.)

- [ ] **Step 6: Run type-check**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "server/routes/jobs.ts" | head`
Expected: no jobs.ts errors (other routes may still error — handled in later tasks).

- [ ] **Step 7: Add options arg to `transitionStatus` service signature**

Open `server/services/job.service.ts` and locate `transitionStatus` (starts around line 304). Update the signature to accept an options arg; leave the body unchanged for now (Task 7 adds the FD cancel-window check):

```typescript
export async function transitionStatus(
  prisma: PrismaClient,
  id: string,
  newStatus: JobStatusType,
  userId: string,
  _options?: { requestingRole: string }
) {
```

(Underscore prefix marks the param intentionally unused for this commit; Task 7 drops the prefix when adding the cancel-window rule.)

- [ ] **Step 8: Commit**

```bash
git add server/routes/jobs.ts server/services/job.service.ts
git commit -m "refactor(rbac): migrate jobs routes to typed permissions"
```

---

## Task 5: Migrate `server/routes/parts.ts`

**Files:**
- Modify: `server/routes/parts.ts:31, 59, 78, 101`

- [ ] **Step 1: Update top-level hook**

Line 31:

```typescript
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));
```

- [ ] **Step 2: Update write routes**

Lines 59, 78, 101 — replace all three `requirePermission("parts:write")` with:

```typescript
requirePermission({ parts: ["manageCatalog"] })
```

- [ ] **Step 3: Run type-check for this file**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "server/routes/parts.ts"`
Expected: empty output (no errors in this file).

- [ ] **Step 4: Commit**

```bash
git add server/routes/parts.ts
git commit -m "refactor(rbac): migrate parts routes to typed permissions"
```

---

## Task 6: Migrate `customers`, `repairs`, `settings`, `notifications`, `ai` routes

**Files:**
- Modify: `server/routes/customers.ts:28, 32`
- Modify: `server/routes/repairs.ts:30, 58, 77, 100`
- Modify: `server/routes/settings.ts:32, 49, 68, 82, 106`
- Modify: `server/routes/notifications.ts:25, 34`
- Modify: `server/routes/ai.ts:6`

- [ ] **Step 1: `customers.ts`**

Line 28: `requirePermission({ customers: ["view"] })`
Line 32: `requirePermission({ customers: ["create"] })`

- [ ] **Step 2: `repairs.ts`**

Line 30: `requirePermission({ repairs: ["viewCatalog"] })`
Lines 58, 77, 100: `requirePermission({ repairs: ["manageCatalog"] })`

- [ ] **Step 3: `settings.ts`**

Line 32: `requirePermission({ settings: ["view"] })`
Lines 49, 68, 82: `requirePermission({ settings: ["edit"] })`
Line 106: `requirePermission({ notifications: ["manage"] })`

- [ ] **Step 4: `notifications.ts`**

Line 25: `requirePermission({ notifications: ["read"] })`
Line 34: `requirePermission({ notifications: ["manage"] })`

- [ ] **Step 5: `ai.ts`**

Line 6: `requirePermission({ ai: ["access"] })`

- [ ] **Step 6: Run type-check**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "server/routes/" | head`
Expected: only `users.ts` errors remain (Task 7 fixes that).

- [ ] **Step 7: Commit**

```bash
git add server/routes/customers.ts server/routes/repairs.ts server/routes/settings.ts server/routes/notifications.ts server/routes/ai.ts
git commit -m "refactor(rbac): migrate remaining domain routes to typed permissions"
```

---

## Task 7: Migrate `server/routes/users.ts` + implement FD cancel window

**Files:**
- Modify: `server/routes/users.ts:3, 93-115, 122, 145, 173, 245, 278, 476-481, 519-524`
- Modify: `server/services/job.service.ts` (`transitionStatus` body)

- [ ] **Step 1: Replace the `canModifyUser` / `canViewUserActivity` helpers**

In `server/routes/users.ts`, delete the `canModifyUser` and `canViewUserActivity` functions (lines 93-115). Also remove the `ROLE_PERMISSIONS` import from line 3 (keep `RoleType`).

Update line 3 to:

```typescript
import type { RoleType } from "@shared/constants/roles";
```

- [ ] **Step 2: Update route-level `requirePermission` calls**

Replace in `users.ts`:

| Line | Old | New |
|---|---|---|
| 122 | `requirePermission("users:read")` | `requirePermission({ user: ["list"] })` |
| 145 | `requirePermission("users:read")` | `requirePermission({ user: ["get"] })` |
| 173 | `requirePermission("users:write")` | `requirePermission({ user: ["create"] })` |
| 245 | `requirePermission("users:write")` | `requirePermission({ user: ["update"] })` |
| 278 | `requirePermission("users:write")` | `requirePermission({ user: ["update"] })` |

- [ ] **Step 3: Replace inline helper calls with `userHasPermission` checks**

The `PATCH /:id` handler (around line 326) uses `canModifyUser`. Replace that block (lines 326-376) — specifically the auth-check portion — so that a user can modify themselves, else the server asks Better Auth:

```typescript
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (requestingUser.id !== id) {
      const perm = await app.auth.api.userHasPermission({
        body: { role: requestingUser.role, permissions: { user: ["update"] } },
      });
      if (!perm.success) {
        return reply.status(403).send({ error: "Insufficient permissions" });
      }
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, username } = parsed.data;
    const data = buildUpdateData({ name, email, username });

    if (Object.keys(data).length === 0) {
      return reply
        .status(400)
        .send({ error: "At least one field is required" });
    }

    const conflict = await checkProfileUniqueness(
      app.prisma,
      id,
      email,
      username
    );
    if (conflict) {
      return reply.status(409).send({ error: conflict });
    }

    try {
      const updated = await updateProfile(app.prisma, id, data);
      return reply.send(updated);
    } catch (err) {
      const dbConflict = isUniqueViolation(err);
      if (dbConflict) {
        return reply.status(409).send({ error: dbConflict });
      }
      throw err;
    }
  });
```

Apply the same pattern to `GET /:id/activity` (line 378) and `GET /:id/stats` (line 435). Replace each `canViewUserActivity(...)` call with:

```typescript
    if (requestingUser.id !== id) {
      const perm = await app.auth.api.userHasPermission({
        body: { role: requestingUser.role, permissions: { user: ["list"] } },
      });
      if (!perm.success) {
        return reply.status(403).send({ error: "Insufficient permissions" });
      }
    }
```

- [ ] **Step 4: Replace `ROLE_PERMISSIONS.includes("users:write")` in session routes**

Two call sites use the old table inline (lines 476-481, 519-524). Replace each of the three blocks:

```typescript
    const perms = ROLE_PERMISSIONS[requestingUser.role as RoleType] ?? [];
    const isAdmin = perms.includes("users:write");
    if (requestingUser.id !== id && !isAdmin) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }
```

with:

```typescript
    if (requestingUser.id !== id) {
      const perm = await app.auth.api.userHasPermission({
        body: { role: requestingUser.role, permissions: { session: ["revoke"] } },
      });
      if (!perm.success) {
        return reply.status(403).send({ error: "Insufficient permissions" });
      }
    }
```

(The `GET /:id/sessions` case checks `session: ["list"]` instead; the `DELETE /:id/sessions/:sessionId` case uses `session: ["revoke"]`.)

- [ ] **Step 5: Implement the FD cancel-window rule in `job.service.ts`**

Open `server/services/job.service.ts` and locate `transitionStatus` (starts around line 304). The current shape should now accept `options: { requestingRole: string }` from Task 4. Replace the function so it enforces the rule when a FRONT_DESK user cancels:

Add this constant near the top of the file (after imports):

```typescript
const FD_CANCEL_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
```

Add this helper above `transitionStatus`:

```typescript
function canFrontDeskCancel(job: { createdById: string; createdAt: Date }, userId: string): { ok: true } | { ok: false; reason: "CANCEL_NOT_CREATOR" | "CANCEL_WINDOW_EXPIRED" } {
  if (job.createdById !== userId) return { ok: false, reason: "CANCEL_NOT_CREATOR" };
  const elapsed = Date.now() - job.createdAt.getTime();
  if (elapsed > FD_CANCEL_WINDOW_MS) return { ok: false, reason: "CANCEL_WINDOW_EXPIRED" };
  return { ok: true };
}
```

In the body of `transitionStatus`, after loading the job and before applying the transition, add:

```typescript
  if (
    newStatus === "CANCELLED" &&
    options?.requestingRole === "FRONT_DESK"
  ) {
    const check = canFrontDeskCancel(
      { createdById: job.createdById, createdAt: job.createdAt },
      userId
    );
    if (!check.ok) return { error: check.reason };
  }
```

(Rename the unused `_options` param from Task 4 to `options`.)

- [ ] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors anywhere).

- [ ] **Step 7: Run full test suite**

Run: `pnpm vitest run`
Expected: PASS (new `permissions.test.ts` and `rbac.test.ts` both green; existing tests still green — note `shared/__tests__/constants.test.ts` still passes since `ROLE_PERMISSIONS` not yet removed).

- [ ] **Step 8: Commit**

```bash
git add server/routes/users.ts server/services/job.service.ts
git commit -m "refactor(rbac): migrate users routes and add FD cancel window"
```

---

## Task 8: Add client `useCan` hook + `<Can>` component

**Files:**
- Create: `src/hooks/use-can.ts`
- Create: `src/components/modules/can.tsx`
- Create: `src/hooks/__tests__/use-can.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/use-can.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentRole: { value: "FRONT_DESK" },
  checkRolePermission: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { role: string }) => unknown) =>
    selector({ role: mocks.currentRole.value }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    admin: { checkRolePermission: mocks.checkRolePermission },
  },
}));

import { useCan } from "../use-can";

describe("useCan", () => {
  beforeEach(() => {
    mocks.checkRolePermission.mockReset();
  });

  it("returns false when role lacks the permission", () => {
    mocks.currentRole.value = "FRONT_DESK";
    mocks.checkRolePermission.mockReturnValue(false);
    const { result } = renderHook(() => useCan({ jobs: ["edit"] }));
    expect(result.current).toBe(false);
  });

  it("returns true when role has the permission", () => {
    mocks.currentRole.value = "OWNER";
    mocks.checkRolePermission.mockReturnValue(true);
    const { result } = renderHook(() => useCan({ settings: ["edit"] }));
    expect(mocks.checkRolePermission).toHaveBeenCalledWith({
      permissions: { settings: ["edit"] },
      role: "OWNER",
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/__tests__/use-can.test.tsx`
Expected: FAIL — `Cannot find module '../use-can'`.

- [ ] **Step 3: Create the hook + bare helper**

Create `src/hooks/use-can.ts`:

```typescript
import type { PermissionCheck } from "@shared/permissions";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

/**
 * Non-hook variant — safe to call inside `.map` / `.filter`. Caller supplies the role.
 */
export function can(role: string, permissions: PermissionCheck): boolean {
  return authClient.admin.checkRolePermission({
    permissions: permissions as never,
    role: role as never,
  });
}

/**
 * Hook variant — reads role from the auth store, for single checks in component bodies.
 */
export function useCan(permissions: PermissionCheck): boolean {
  const role = useAuthStore((s) => s.role);
  return can(role, permissions);
}
```

- [ ] **Step 4: Create the `<Can>` component**

Create `src/components/modules/can.tsx`:

```tsx
import type { PermissionCheck } from "@shared/permissions";
import type { ReactNode } from "react";
import { useCan } from "@/hooks/use-can";

interface CanProps {
  perm: PermissionCheck;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ perm, children, fallback = null }: CanProps) {
  const allowed = useCan(perm);
  return <>{allowed ? children : fallback}</>;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/__tests__/use-can.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-can.ts src/components/modules/can.tsx src/hooks/__tests__/use-can.test.tsx
git commit -m "feat(rbac): add useCan hook and Can component"
```

---

## Task 9: Add `RequirePermission` route wrapper; migrate `src/app.tsx`

**Files:**
- Modify: `src/components/modules/protected-route.tsx:42-54`
- Modify: `src/app.tsx:6, 63`

- [ ] **Step 1: Add `RequirePermission` alongside `RequireRole`**

In `src/components/modules/protected-route.tsx`, append below the existing `RequireRole`:

```tsx
import type { PermissionCheck } from "@shared/permissions";
import { useCan } from "@/hooks/use-can";

interface RequirePermissionProps {
  perm: PermissionCheck;
}

export function RequirePermission({ perm }: RequirePermissionProps) {
  const allowed = useCan(perm);
  if (!allowed) {
    return <Navigate replace to="/" />;
  }
  return <Outlet />;
}
```

Keep the existing imports (`type { RoleType }`, `Navigate`, `Outlet`, `useAuthStore`) — add the two new imports at the top.

- [ ] **Step 2: Replace `<RequireRole>` in `src/app.tsx` for `/parts` and `/repairs`**

Update the import on line 6:

```tsx
import ProtectedRoute, { RequirePermission } from "@/components/modules/protected-route";
```

Replace the block at line 63:

```tsx
        <Route element={<RequirePermission perm={{ parts: ["viewCatalog"] }} />}>
          <Route
            element={
              <DashboardLayout>
                <PartsCatalogPage />
              </DashboardLayout>
            }
            path="/parts"
          />
        </Route>
        <Route element={<RequirePermission perm={{ repairs: ["viewCatalog"] }} />}>
          <Route
            element={
              <DashboardLayout>
                <RepairsPage />
              </DashboardLayout>
            }
            path="/repairs"
          />
        </Route>
```

(Splitting the two since their required permissions differ — `parts.viewCatalog` vs `repairs.viewCatalog`.)

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/protected-route.tsx src/app.tsx
git commit -m "refactor(rbac): gate parts/repairs routes by permission instead of role"
```

---

## Task 10: Migrate `sidebar.tsx` and `top-bar.tsx` to permission-based checks

**Files:**
- Modify: `src/components/modules/sidebar.tsx:1-50, 59, 115-130`
- Modify: `src/components/modules/top-bar.tsx:1-10, 47-61`

- [ ] **Step 1: Rewrite nav item filtering in `sidebar.tsx`**

The current file has three hardcoded nav arrays keyed by role. Replace with one array whose items declare the permission they require; filter via `useCan`.

Replace the section from line 9 (after `interface NavItem`) down to the `role = useAuthStore(...)` usage. Specifically, replace the three `*_NAV_ITEMS` arrays and `NAV_ITEMS_BY_ROLE` map (lines 15-44) with:

```typescript
interface NavItem {
  icon: string;
  labelKey: string;
  to: string;
  perm: PermissionCheck;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "dashboard", labelKey: "dashboard", to: "/", perm: { jobs: ["view"] } },
  { icon: "build", labelKey: "jobs", to: "/jobs", perm: { jobs: ["view"] } },
  { icon: "inventory_2", labelKey: "parts_inventory", to: "/parts", perm: { parts: ["viewCatalog"] } },
  { icon: "menu_book", labelKey: "repair_services", to: "/repairs", perm: { repairs: ["viewCatalog"] } },
  { icon: "psychology", labelKey: "ai_assistant", to: "/ai-analyst", perm: { ai: ["access"] } },
  { icon: "notifications", labelKey: "notifications", to: "/notifications", perm: { notifications: ["read"] } },
  { icon: "settings", labelKey: "settings", to: "/settings", perm: { settings: ["view"] } },
];
```

Add the imports at the top:

```typescript
import type { PermissionCheck } from "@shared/permissions";
import { can, useCan } from "@/hooks/use-can";
```

Replace line 59 (the `navItems` computation). Use `can(role, perm)` — the non-hook helper — so we can call it inside `.filter` without violating the rules of hooks:

```typescript
  const navItems = NAV_ITEMS.filter((item) => can(role, item.perm));
```

(`role` is already read from `useAuthStore` on line 57; keep that line.)

- [ ] **Step 2: Replace the `role === "TECHNICIAN"` checks in the intake button**

Lines 115-130 currently gate the "new check-in" button by role string. Replace with a permission check:

Add above the `return` statement:

```typescript
  const canCreateJob = useCan({ jobs: ["create"] });
```

Change the `<button onClick>` (line 116):

```tsx
          onClick={() => {
            if (!canCreateJob) return;
            openIntakeModal();
          }}
```

And the icon + label (lines 123-128):

```tsx
          <span aria-hidden="true" className="material-symbols-outlined">
            {canCreateJob ? "add_circle" : "swap_horiz"}
          </span>
          <span>
            {canCreateJob
              ? t("new_checkin")
              : t("tech_dashboard.update_status")}
          </span>
```

(This preserves the old Technician-specific label via semantics: "can create" = owner/FD; "cannot create" = technician who updates status instead. The label/icon branching now reflects capability, not role identity.)

- [ ] **Step 3: Apply the same changes to `top-bar.tsx`**

`top-bar.tsx` has a similar block (lines 47-61). Add imports (same as sidebar) and replace the hardcoded `role === "TECHNICIAN"` logic with `useCan({ jobs: ["create"] })` the same way. Remove the `role = useAuthStore(...)` line (line 10) as it becomes unused.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Smoke-test in the browser**

Run: `pnpm dev` (if the user wants a manual check — ExitPlanMode already granted this)
Log in as each role (OWNER / TECHNICIAN / FRONT_DESK using seeded `admin` + `SEED_ADMIN_PASSWORD` for OWNER, then create two test users via the admin panel for the other roles) and verify:
- Sidebar shows only the correct nav items per role
- "New check-in" button shows `add_circle` + "new_checkin" for OWNER/FD, `swap_horiz` + "update status" for TECHNICIAN
- Navigating to `/parts` as FRONT_DESK redirects to `/`
- Navigating to `/repairs` as FRONT_DESK redirects to `/`
- Navigating to `/settings` as TECHNICIAN or FRONT_DESK redirects (new: FD lost settings access)

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/sidebar.tsx src/components/modules/top-bar.tsx
git commit -m "refactor(rbac): replace role-string checks with useCan in nav components"
```

---

## Task 11: Remove `ROLE_PERMISSIONS` from shared constants

**Files:**
- Modify: `shared/constants/roles.ts:15-57`
- Modify: `shared/constants/index.ts:20`
- Modify: `shared/__tests__/constants.test.ts:7, 41-46`

- [ ] **Step 1: Delete `ROLE_PERMISSIONS` from `shared/constants/roles.ts`**

The final file contents should be:

```typescript
export const Role = {
  OWNER: "OWNER",
  TECHNICIAN: "TECHNICIAN",
  FRONT_DESK: "FRONT_DESK",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<RoleType, string> = {
  OWNER: "Owner",
  TECHNICIAN: "Technician",
  FRONT_DESK: "Front Desk",
};
```

- [ ] **Step 2: Update `shared/constants/index.ts:20`**

Replace:

```typescript
export { ROLE_LABELS, ROLE_PERMISSIONS, Role } from "./roles";
```

with:

```typescript
export { ROLE_LABELS, Role } from "./roles";
```

- [ ] **Step 3: Update the test**

In `shared/__tests__/constants.test.ts`, line 7:

```typescript
import { ROLE_LABELS, Role } from "@shared/constants/roles";
```

Delete the entire `it("every role has permissions", ...)` block (lines 41-46) — covered by `shared/__tests__/permissions.test.ts`.

- [ ] **Step 4: Verify nothing else imports `ROLE_PERMISSIONS`**

Run: `pnpm grep "ROLE_PERMISSIONS"`

Or equivalent (ripgrep):

```bash
pnpm exec tsc --noEmit
```

Expected: no compile errors — all usages were migrated in Tasks 4-10.

- [ ] **Step 5: Run full test suite**

Run: `pnpm vitest run`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/constants/roles.ts shared/constants/index.ts shared/__tests__/constants.test.ts
git commit -m "chore(rbac): delete legacy ROLE_PERMISSIONS table"
```

---

## Verification

Run these in order after all tasks land:

1. **Static checks:**
   - `pnpm exec tsc --noEmit` — must pass
   - `pnpm lint` (ultracite) — must pass
   - `pnpm vitest run` — all tests pass; new tests in `shared/__tests__/permissions.test.ts`, `server/__tests__/rbac.test.ts`, `src/hooks/__tests__/use-can.test.tsx` present

2. **Seed + manual smoke (Chrome DevTools per `CLAUDE.md`):**
   - `pnpm dev`
   - Log in as OWNER (`admin` + `SEED_ADMIN_PASSWORD`). Through admin panel, create a TECHNICIAN user and a FRONT_DESK user (`SEED_ADMIN_PASSWORD` reuse OK).
   - **OWNER**: can navigate to `/`, `/jobs`, `/parts`, `/repairs`, `/ai-analyst`, `/settings`. Sidebar shows all items.
   - **TECHNICIAN**: `/settings` redirects to `/`. Sidebar hides settings + AI. "New check-in" button shows `swap_horiz`. `PATCH /api/jobs/:id/status` with `{ status: "DELIVERED" }` returns 403 `FORBIDDEN_STATUS_TRANSITION`.
   - **FRONT_DESK**: `/parts`, `/repairs`, `/settings` all redirect to `/`. Sidebar hides those + notifications. Can create a job, then call `PATCH /api/jobs/:id/status` with `{ status: "CANCELLED" }` within 30 min — success. Create another job, wait 31 min (or tamper DB `createdAt`), attempt cancel — 403 `CANCEL_WINDOW_EXPIRED`.

3. **Flagged in session notes (per `CLAUDE.md`):** Append any warnings or unexpected behavior to `docs/session-notes.md`.

4. **Follow-up tracked:** `JobPart.unitCost` column + `reports.viewMargin` field stripping is NOT in this plan. File an issue noting that `parts.viewCost`, `parts.setCost`, `reports.viewMargin` permissions exist but have no backing data/field-stripping yet.
