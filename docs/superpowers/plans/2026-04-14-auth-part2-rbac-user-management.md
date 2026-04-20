# Auth & RBAC Part 2: RBAC Middleware + User Management + Password Endpoints

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement role-based access control middleware, user CRUD endpoints, admin password reset, and self-service password change.

**Architecture:** RBAC is enforced via a `requirePermission()` preHandler factory that checks the user's role against the `ROLE_PERMISSIONS` map. User management is an owner-only feature exposed through `/api/users`. Password endpoints live under `/api/auth`.

**Tech Stack:** Fastify, Zod, Prisma 7, Better Auth

---

### Task 1: RBAC Middleware

**Files:**
- Create: `server/middlewares/rbac.ts`

- [ ] **Step 1: Create the RBAC middleware**

```typescript
// server/middlewares/rbac.ts
import { ROLE_PERMISSIONS, type RoleType } from "@shared/constants/roles";
import type { FastifyInstance } from "fastify";

type Permission = string;

const ROLE_PERMS: Record<RoleType, Permission[]> = ROLE_PERMISSIONS;

export function requirePermission(permission: Permission) {
  return async (request: FastifyInstance["request"], reply: FastifyInstance["reply"]) => {
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    const userPermissions = ROLE_PERMS[request.user.role as RoleType] ?? [];

    if (!userPermissions.includes(permission)) {
      await reply.status(403).send({ error: "Insufficient permissions" });
      return;
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/middlewares/rbac.ts
git commit -m "feat: add RBAC middleware with requirePermission factory"
```

---

### Task 2: User Management Routes

**Files:**
- Rewrite: `server/routes/users.ts`

- [ ] **Step 1: Implement user management routes**

Replace the entire stub `server/routes/users.ts` with:

```typescript
// server/routes/users.ts
import { Prisma } from "@prisma/client";
import { ROLE_LABELS, type RoleType } from "@shared/constants/roles";
import { resetPasswordSchema, createUserSchema } from "@shared/schemas/auth.schema";
import type { FastifyPluginAsync } from "fastify";
import { hashPassword } from "better-auth/crypto";
import { requirePermission } from "../middlewares/rbac.js";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // List all users (owner + front_desk with users:read)
  app.get("/", {
    preHandler: [requirePermission("users:read")],
  }, async (_request, reply) => {
    const users = await app.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        mustChangePassword: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(users);
  });

  // Create a new user (owner only)
  app.post("/", {
    preHandler: [requirePermission("users:write")],
  }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { username, email, password, role } = parsed.data;

    const existing = await app.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });
    if (existing) {
      return reply.status(409).send({
        error: existing.username === username
          ? "Username already exists"
          : "Email already exists",
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await app.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: role as RoleType,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        mustChangePassword: true,
      },
    });

    await app.prisma.auditLog.create({
      data: {
        jobId: "0",
        userId: request.user!.id,
        action: "USER_CREATED",
        toValue: `${username} (${role})`,
      },
    });

    return reply.status(201).send(user);
  });

  // Toggle user active status (owner only)
  app.patch("/:id/status", {
    preHandler: [requirePermission("users:write")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { isActive } = request.body as { isActive: boolean };

    const user = await app.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        mustChangePassword: true,
      },
    });

    return reply.send(user);
  });

  // Admin reset password (owner only)
  app.post("/:id/reset-password", {
    preHandler: [requirePermission("users:write")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const targetUser = await app.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    const hashedPassword = await hashPassword(parsed.data.password);

    await app.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    // Invalidate all sessions for this user
    await app.prisma.session.deleteMany({
      where: { userId: id },
    });

    await app.prisma.auditLog.create({
      data: {
        jobId: "0",
        userId: request.user!.id,
        action: "PASSWORD_RESET",
        toValue: `Password reset for ${targetUser.username}`,
      },
    });

    return reply.send({ success: true });
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: implement user management routes with RBAC and audit logging"
```

---

### Task 3: Change Password + Sign-Out with Audit

**Files:**
- Modify: `server/plugins/auth.ts` (add post-auth hooks)

The sign-in and session endpoints are handled by Better Auth's built-in handler. We need custom endpoints for **change password** and to add audit logging around auth events.

- [ ] **Step 1: Create `server/routes/auth.ts` with change-password and audit hooks**

```typescript
// server/routes/auth.ts
import { changePasswordSchema } from "@shared/schemas/auth.schema";
import type { FastifyPluginAsync } from "fastify";
import { hashPassword } from "better-auth/crypto";

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Self-service password change (any authenticated user)
  app.post("/change-password", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { oldPassword, newPassword } = parsed.data;

    // Fetch current password hash
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { password: true },
    });
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Verify old password using Better Auth's verifyPassword
    const { verifyPassword } = await import("better-auth/crypto");
    const isValid = await verifyPassword({ hash: user.password, password: oldPassword });
    if (!isValid) {
      return reply.status(400).send({ error: "Current password is incorrect" });
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await app.prisma.user.update({
      where: { id: request.user.id },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
      },
    });

    await app.prisma.auditLog.create({
      data: {
        jobId: "0",
        userId: request.user.id,
        action: "PASSWORD_RESET",
        toValue: "Self-service password change",
      },
    });

    return reply.send({ success: true });
  });

  // Force password change check endpoint
  app.get("/must-change-password", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    return reply.send({ mustChangePassword: request.user.mustChangePassword });
  });
};
```

- [ ] **Step 2: Register auth routes in `server/index.ts`**

Add the import:

```typescript
import { authRoutes } from "./routes/auth.js";
```

And register **after** the auth plugin, with a different prefix to avoid collision with Better Auth's `/api/auth/*`:

```typescript
app.register(authRoutes, { prefix: "/api/auth" });
```

Note: This works because Better Auth handles specific paths like `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/session`, `/api/auth/sign-out`, while our custom routes are `/api/auth/change-password` and `/api/auth/must-change-password` — no collision.

However, the catch-all route in the auth plugin may intercept these before they reach our custom routes. The solution is to register our custom routes **before** the catch-all. Let's adjust: register `authRoutes` in `server/index.ts` **before** `authPlugin`.

In `server/index.ts`, move the auth routes registration to come before the auth plugin:

```typescript
app.register(authRoutes, { prefix: "/api/auth" });
await app.register(authPlugin);
```

This ensures Fastify matches our specific routes before the catch-all.

- [ ] **Step 3: Commit**

```bash
git add server/routes/auth.ts server/index.ts
git commit -m "feat: add change-password endpoint and must-change-password check"
```

---

### Task 4: Audit Logging on Auth Events

**Files:**
- Modify: `server/plugins/auth.ts`

We need to log `USER_SIGN_IN` events. Better Auth doesn't have a built-in hook for this in the Fastify integration, so we add a lightweight post-sign-in audit via a response check.

- [ ] **Step 1: Add sign-in audit hook to the auth plugin**

In `server/plugins/auth.ts`, inside the auth catch-all handler, after we get the response from `auth.handler(req)`, add audit logging for successful sign-ins:

Find this block in the handler:

```typescript
const response = await auth.handler(req);
reply.status(response.status);
```

Add after it:

```typescript
// Audit successful sign-in
if (
  url.pathname === "/api/auth/sign-in" &&
  request.method === "POST" &&
  response.status === 200
) {
  try {
    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      await app.prisma.auditLog.create({
        data: {
          jobId: "0",
          userId: session.user.id,
          action: "USER_SIGN_IN",
          toValue: `Sign-in for ${session.user.username}`,
        },
      });
    }
  } catch {
    // Audit logging failure should not block sign-in
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/plugins/auth.ts
git commit -m "feat: add USER_SIGN_IN audit logging on successful authentication"
```

---

### Task 5: Wire RBAC into Existing Route Stubs

**Files:**
- Modify: `server/routes/jobs.ts`
- Modify: `server/routes/parts.ts`
- Modify: `server/routes/customers.ts`
- Modify: `server/routes/notifications.ts`
- Modify: `server/routes/settings.ts`
- Modify: `server/routes/ai.ts`

Each route file is currently a stub. Add `requirePermission` preHandlers so RBAC is enforced even while the routes are still stubs.

- [ ] **Step 1: Add RBAC to each route stub**

For each route file, add the import and preHandler. Example pattern for `jobs.ts`:

```typescript
import { requirePermission } from "../middlewares/rbac.js";

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("jobs:read"));

  app.get("/", async (_request, reply) => {
    return reply.send({ message: "jobs list" });
  });
  // ... existing stubs
};
```

Apply the appropriate permission to each:

| Route File | Permission |
|------------|-----------|
| `jobs.ts` | `jobs:read` |
| `parts.ts` | `parts:read` |
| `customers.ts` | `customers:read` |
| `notifications.ts` | `notifications:manage` (owner) |
| `settings.ts` | `settings:read` |
| `ai.ts` | `ai:access` |

- [ ] **Step 2: Commit**

```bash
git add server/routes/jobs.ts server/routes/parts.ts server/routes/customers.ts server/routes/notifications.ts server/routes/settings.ts server/routes/ai.ts
git commit -m "feat: add RBAC preHandlers to all route stubs"
```