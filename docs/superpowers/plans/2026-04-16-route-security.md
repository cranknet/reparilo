# Route Security Auto-Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize all route security config into one file and auto-apply CSRF, rate limiting, and sensitive-key sanitization to all routes by default.

**Architecture:** Create a `routeSecurity.ts` config map with per-route overrides. Modify the security plugin to use `onRoute` hooks that read from this map, applying CSRF and rate-limiting automatically and setting `allowSensitiveKeys` from the config. Then strip all inline security config from route files.

**Tech Stack:** Fastify, @fastify/csrf-protection, @fastify/rate-limit, TypeScript

---

## File Structure

| File | Action |
|------|--------|
| `server/config/routeSecurity.ts` | **Create** — config map + `matchRoute` helper |
| `server/plugins/security.ts` | **Modify** — add `onRoute` hook, change rate limit to global |
| `server/routes/jobs.ts` | **Modify** — remove `csrfProtection`, `rateLimit` configs |
| `server/routes/auth.ts` | **Modify** — remove `csrfProtection`, `rateLimit`, `allowSensitiveKeys` |
| `server/routes/users.ts` | **Modify** — remove `rateLimit`, `allowSensitiveKeys` |
| `server/routes/health.ts` | **Modify** — remove inline config (if any) |
| `server/routes/settings.ts` | **Modify** — remove `rateLimit` config |
| `server/routes/notifications.ts` | **Modify** — remove `rateLimit` config |
| `server/routes/customers.ts` | **Modify** — remove `rateLimit` config |
| `server/routes/parts.ts` | **Modify** — remove `rateLimit` config |
| `server/routes/ai.ts` | **Modify** — remove `rateLimit` config |
| `server/__tests__/routeSecurity.test.ts` | **Create** — unit tests for `matchRoute` |

---

### Task 1: Create routeSecurity config map and matchRoute helper

**Files:**
- Create: `server/config/routeSecurity.ts`
- Create: `server/__tests__/routeSecurity.test.ts`

- [ ] **Step 1: Write the failing test for matchRoute**

Create `server/__tests__/routeSecurity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchRoute, DEFAULT_SECURITY, routeSecurity } from "../../config/routeSecurity.js";

describe("matchRoute", () => {
  it("matches exact paths", () => {
    expect(matchRoute("/health", routeSecurity)).toBeDefined();
    expect(matchRoute("/health", routeSecurity)?.csrf).toBe(false);
  });

  it("matches wildcard patterns", () => {
    expect(matchRoute("/api/auth/sign-in", routeSecurity)?.csrf).toBe(false);
    expect(matchRoute("/api/auth/anything", routeSecurity)?.csrf).toBe(false);
  });

  it("returns first match (more specific wins)", () => {
    const result = matchRoute("/api/auth/change-password", routeSecurity);
    expect(result?.allowSensitiveKeys).toBe(true);
    expect(result?.rateLimit).toEqual({ max: 5, timeWindow: "1 minute" });
  });

  it("returns undefined for unmatched routes", () => {
    expect(matchRoute("/api/unknown/route", routeSecurity)).toBeUndefined();
  });

  it("returns undefined for partial segment matches", () => {
    expect(matchRoute("/api/authx", routeSecurity)).toBeUndefined();
  });

  it("wildcard matches any single segment", () => {
    expect(matchRoute("/api/jobs", routeSecurity)).toBeDefined();
    expect(matchRoute("/api/parts", routeSecurity)).toBeDefined();
  });
});

describe("DEFAULT_SECURITY", () => {
  it("has correct defaults", () => {
    expect(DEFAULT_SECURITY.rateLimit).toEqual({ max: 100, timeWindow: "1 minute" });
    expect(DEFAULT_SECURITY.csrf).toBeUndefined();
    expect(DEFAULT_SECURITY.allowSensitiveKeys).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- server/__tests__/routeSecurity.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the config map and matchRoute implementation**

Create `server/config/routeSecurity.ts`:

```ts
export interface RateLimitConfig {
  max: number;
  timeWindow: string;
}

export interface RouteSecurityOverride {
  rateLimit?: RateLimitConfig | false;
  csrf?: boolean;
  allowSensitiveKeys?: boolean;
}

export const DEFAULT_SECURITY: RouteSecurityOverride = {
  rateLimit: { max: 100, timeWindow: "1 minute" },
  allowSensitiveKeys: false,
};

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function isMutation(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}

export function matchRoute(
  url: string,
  rules: [string, RouteSecurityOverride][]
): RouteSecurityOverride | undefined {
  for (const [pattern, config] of rules) {
    if (routeMatchesPattern(url, pattern)) {
      return config;
    }
  }
  return undefined;
}

function routeMatchesPattern(url: string, pattern: string): boolean {
  const urlSegments = url.split("/");
  const patternSegments = pattern.split("/");

  if (urlSegments.length !== patternSegments.length) {
    return false;
  }

  for (let i = 0; i < patternSegments.length; i++) {
    if (patternSegments[i] === "*") {
      continue;
    }
    if (urlSegments[i] !== patternSegments[i]) {
      return false;
    }
  }

  return true;
}

export const routeSecurity: [string, RouteSecurityOverride][] = [
  ["/health", { rateLimit: false, csrf: false }],
  ["/api/auth/change-password", { rateLimit: { max: 5, timeWindow: "1 minute" }, allowSensitiveKeys: true }],
  ["/api/auth/must-change-password", { rateLimit: { max: 20, timeWindow: "1 minute" }, csrf: false }],
  ["/api/auth/*", { csrf: false }],
  ["/api/users/:id/reset-password", { rateLimit: { max: 10, timeWindow: "1 minute" }, allowSensitiveKeys: true }],
  ["/api/users/:id/status", { rateLimit: { max: 30, timeWindow: "1 minute" }, allowSensitiveKeys: true }],
  ["/api/users", { rateLimit: { max: 10, timeWindow: "1 minute" }, allowSensitiveKeys: true }],
  ["/api/jobs", { rateLimit: { max: 30, timeWindow: "1 minute" } }],
  ["/api/ai", { rateLimit: { max: 30, timeWindow: "1 minute" } }],
  ["/api/*", {}],
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- server/__tests__/routeSecurity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/config/routeSecurity.ts server/__tests__/routeSecurity.test.ts
git commit -m "feat: add routeSecurity config map and matchRoute helper"
```

---

### Task 2: Modify security plugin to auto-apply from config map

**Files:**
- Modify: `server/plugins/security.ts`

- [ ] **Step 1: Update the security plugin**

Replace the entire content of `server/plugins/security.ts` with:

```ts
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import csrf from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type {
  FastifyError,
  FastifyInstance,
  FastifyPluginAsync,
} from "fastify";
import fp from "fastify-plugin";
import {
  DEFAULT_SECURITY,
  isMutation,
  matchRoute,
  routeSecurity,
} from "../config/routeSecurity.js";

const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const SENSITIVE_KEYS = new Set([
  "password",
  "isActive",
  "role",
  "mustChangePassword",
]);

const securityPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ── Layer 1: Security Headers ──────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: IS_PROD
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  });

  // ── Layer 2: CORS ───────────────────────────────────────────────────────
  const allowedOrigins = IS_PROD
    ? [FRONTEND_URL]
    : [FRONTEND_URL, "http://localhost:5173"];

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86_400,
  });

  // ── Layer 3: Rate Limiting (global) ───────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: DEFAULT_SECURITY.rateLimit && typeof DEFAULT_SECURITY.rateLimit === "object"
      ? (DEFAULT_SECURITY.rateLimit as { max: number }).max
      : 100,
    timeWindow: DEFAULT_SECURITY.rateLimit && typeof DEFAULT_SECURITY.rateLimit === "object"
      ? (DEFAULT_SECURITY.rateLimit as { timeWindow: string }).timeWindow
      : "1 minute",
    keyGenerator: (request) => request.user?.id ?? request.ip,
    exponentialBackoff: true,
    ban: 5,
    allowList: ["/health"],
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // ── Layer 4: CSRF Protection ───────────────────────────────────────────
  await app.register(cookie);

  await app.register(csrf, {
    cookieOpts: {
      sameSite: IS_PROD ? "strict" : "lax",
      httpOnly: true,
      path: "/",
      secure: IS_PROD,
      signed: IS_PROD,
    },
  });

  // ── Layer 5: Auto-apply route security from config map ────────────────
  app.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.path;
    const method = routeOptions.method;
    const methodStr = Array.isArray(method) ? method[0] : method;

    const override = matchRoute(url, routeSecurity);
    const normalizedOverride: Record<string, unknown> = {
      ...DEFAULT_SECURITY,
      ...override,
    };

    if (isMutation(methodStr)) {
      const csrfEnabled = override?.csrf !== false;
      if (csrfEnabled) {
        const existing = routeOptions.preHandler;
        const csrfFn = app.csrfProtection;
        if (Array.isArray(existing)) {
          if (!existing.includes(csrfFn)) {
            routeOptions.preHandler = [...existing, csrfFn];
          }
        } else if (existing) {
          routeOptions.preHandler = [existing, csrfFn];
        } else {
          routeOptions.preHandler = [csrfFn];
        }
      }
    }

    if (override?.rateLimit === false) {
      normalizedOverride.rateLimit = false;
    } else if (override?.rateLimit && typeof override.rateLimit === "object") {
      normalizedOverride.rateLimit = override.rateLimit;
    }

    const config = routeOptions.config ?? {};
    routeOptions.config = { ...config, ...normalizedOverride };
  });

  // ── Layer 6: Request Sanitization ───────────────────────────────────────
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function sanitizeObject(
    obj: Record<string, unknown>,
    path: string,
    log: FastifyInstance["log"]
  ): void {
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.has(key)) {
        log.warn({ key, path }, "Sanitized sensitive key from request body");
        delete obj[key];
        continue;
      }
      if (isObject(obj[key])) {
        sanitizeObject(obj[key], `${path}.${key}`, log);
      } else if (Array.isArray(obj[key])) {
        for (const [i, item] of (obj[key] as unknown[]).entries()) {
          if (isObject(item)) {
            sanitizeObject(item, `${path}.${key}[${i}]`, log);
          }
        }
      }
    }
  }

  app.addHook("preHandler", (request, _reply, done) => {
    const allowSensitive =
      request.routeOptions?.config?.allowSensitiveKeys ?? false;
    if (isObject(request.body) && !allowSensitive) {
      request.log.debug(
        { url: request.url, allowSensitive },
        "Applying request body sanitization"
      );
      sanitizeObject(
        request.body as Record<string, unknown>,
        "body",
        request.log
      );
    }
    done();
  });

  // ── Layer 7: Error Obfuscation ─────────────────────────────────────────
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      reply.status(error.statusCode ?? 400).send({
        statusCode: error.statusCode ?? 400,
        error: "Validation Error",
        message: error.message,
      });
      return;
    }

    const statusCode = error.statusCode ?? 500;
    const isServerError = statusCode >= 500;

    let message: string;
    if (IS_PROD) {
      message = isServerError
        ? "An unexpected error occurred"
        : (error.message ?? "Request failed");
    } else {
      message = error.message ?? "Unknown error";
    }

    const payload: Record<string, unknown> = {
      statusCode,
      error:
        IS_PROD && isServerError
          ? "Internal Server Error"
          : (error.name ?? "Error"),
      message,
    };

    if (!IS_PROD) {
      payload.stack = error.stack;
    }

    reply.status(statusCode).send(payload);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // ── Layer 8: Audit Logging ─────────────────────────────────────────────
  const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

  app.addHook("onResponse", async (request, reply) => {
    if (!MUTATION_METHODS.has(request.method)) {
      return;
    }

    const userId = request.user?.id;
    if (!userId) {
      return;
    }

    const action = `${request.method} ${request.routeOptions?.url ?? request.url}`;

    request.log.info({
      audit: { userId, action, statusCode: reply.statusCode },
    });

    try {
      await request.server.prisma.auditLog.create({
        data: {
          userId,
          action: "API_MUTATION",
          toValue: action,
          jobId: null,
          metadata: { statusCode: reply.statusCode },
        },
      });
    } catch (err) {
      request.log.error({ err }, "Failed to write audit log");
    }
  });
};

export default fp(securityPlugin, { name: "security-plugin" });

declare module "fastify" {
  interface FastifyContextConfig {
    allowSensitiveKeys?: boolean;
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 3: Run existing tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/plugins/security.ts
git commit -m "feat: security plugin auto-applies route security from config map"
```

---

### Task 3: Clean up jobs routes — remove inline security config

**Files:**
- Modify: `server/routes/jobs.ts`

- [ ] **Step 1: Remove all `rateLimit` configs and `csrfProtection` from jobs.ts**

In `server/routes/jobs.ts`, make these changes:

1. Remove all `config: { rateLimit: { max: N, timeWindow: "1 minute" } }` from every route
2. Remove `app.csrfProtection` from all `preHandler` arrays — keep only `requirePermission(...)` calls
3. Where `preHandler` has only `requirePermission(...)`, change from array syntax `[app.csrfProtection, requirePermission(...)]` to just `requirePermission(...)` or keep as array with just `requirePermission(...)`

The resulting route options blocks should look like:

- GET routes: `{}` (empty or no options object)
- Mutation routes with RBAC: `{ preHandler: [requirePermission("perm")] }` (no csrfProtection, no rateLimit)

Apply these specific changes in `server/routes/jobs.ts`:

- Line 69: Remove `config: { rateLimit: { max: 100, timeWindow: "1 minute" } }` from GET `/metrics`
- Line 80: Remove `config: { rateLimit: { max: 100, timeWindow: "1 minute" } }` from GET `/`
- Line 103: Remove `config: { rateLimit: { max: 100, timeWindow: "1 minute" } }` from GET `/:id`
- Line 117-119: Change `{ config: { rateLimit: ... }, preHandler: [app.csrfProtection, requirePermission("jobs:write")] }` to `{ preHandler: [requirePermission("jobs:write")] }`
- Line 150-152: Same pattern for PATCH `/:id`
- Line 196-198: Same pattern for PATCH `/:id/status` (jobs:update_status)
- Line 242: Remove `config: { rateLimit: ... }` from GET `/:id/notes`
- Line 257-258: Change `{ config: { rateLimit: ... }, preHandler: [app.csrfProtection, requirePermission("jobs:write")] }` to `{ preHandler: [requirePermission("jobs:write")] }`
- Line 294-295: Same for POST `/:id/parts`
- Line 331: Change `{ config: { rateLimit: ... }, preHandler: [app.csrfProtection, requirePermission("jobs:write")] }` to `{ preHandler: [requirePermission("jobs:write")] }` for DELETE `/:id/parts/:partId`
- Line 348-349: Same for POST `/:id/repairs`
- Line 385-386: Same for DELETE `/:id/repairs/:repairId`
- Line 402-403: Same for POST `/:id/photos`
- Line 455: Change `{ config: { rateLimit: ... }, preHandler: requirePermission("jobs:write") }` to `{ preHandler: [requirePermission("jobs:write")] }` for DELETE `/:id/photos/:photoId`
- Line 472: Same for POST `/:id/waiting-parts`
- Line 509: Same for DELETE `/:id/waiting-parts/:waitingId`

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm run typecheck && pnpm test`
Expected: No errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add server/routes/jobs.ts
git commit -m "refactor: remove inline security config from jobs routes"
```

---

### Task 4: Clean up auth routes — remove inline security config

**Files:**
- Modify: `server/routes/auth.ts`

- [ ] **Step 1: Remove `rateLimit`, `allowSensitiveKeys`, and `csrfProtection` from auth.ts**

In `server/routes/auth.ts`, make these changes:

1. POST `/api/auth/change-password`: Change the options block from:
```ts
{
  config: {
    rateLimit: { max: 5, timeWindow: "1 minute" },
    allowSensitiveKeys: true,
  },
  preHandler: [app.csrfProtection],
}
```
to just `{}` (empty options — all security is now auto-applied)

2. GET `/api/auth/must-change-password`: No change needed (already no inline config)

The resulting file should look like:

```ts
import { changePasswordSchema } from "@shared/schemas/auth.schema";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/auth/change-password",
    {},
    async (request, reply) => {
      const headers = fromNodeHeaders(request.headers);
      const session = await app.auth.api.getSession({ headers });

      if (!session?.user) {
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

      if (oldPassword === newPassword) {
        return reply.status(400).send({
          error: "New password must be different from current password",
        });
      }

      const account = await app.prisma.account.findFirst({
        where: { userId: session.user.id, providerId: "credential" },
        select: { password: true },
      });
      if (!account?.password) {
        return reply
          .status(400)
          .send({ error: "No password set for this account" });
      }

      const isValid = await verifyPassword({
        hash: account.password,
        password: oldPassword,
      });
      if (!isValid) {
        return reply
          .status(400)
          .send({ error: "Current password is incorrect" });
      }

      const hashedNewPassword = await hashPassword(newPassword);

      await app.prisma.$transaction([
        app.prisma.account.updateMany({
          where: { userId: session.user.id, providerId: "credential" },
          data: { password: hashedNewPassword },
        }),
        app.prisma.user.update({
          where: { id: session.user.id },
          data: { mustChangePassword: false },
        }),
      ]);

      return reply.send({ success: true });
    }
  );

  app.get("/api/auth/must-change-password", async (request, reply) => {
    const headers = fromNodeHeaders(request.headers);
    const session = await app.auth.api.getSession({ headers });

    if (!session?.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    return reply.send({
      mustChangePassword: session.user.mustChangePassword,
    });
  });
};
```

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm run typecheck && pnpm test`
Expected: No errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add server/routes/auth.ts
git commit -m "refactor: remove inline security config from auth routes"
```

---

### Task 5: Clean up users routes — remove inline security config

**Files:**
- Modify: `server/routes/users.ts`

- [ ] **Step 1: Remove all `rateLimit` and `allowSensitiveKeys` from users.ts**

In `server/routes/users.ts`, make these changes:

1. GET `/`: Remove `config: { rateLimit: { max: 100, timeWindow: "1 minute" } }` — change options to just `{ preHandler: [requirePermission("users:read")] }`

2. POST `/`: Remove `config: { rateLimit: { max: 10, timeWindow: "1 minute" }, allowSensitiveKeys: true }` — change options to just `{ preHandler: [requirePermission("users:write")] }`

3. PATCH `/:id/status`: Remove `config: { rateLimit: { max: 30, timeWindow: "1 minute" }, allowSensitiveKeys: true }` — change options to just `{ preHandler: [requirePermission("users:write")] }`

4. POST `/:id/reset-password`: Remove `config: { rateLimit: { max: 10, timeWindow: "1 minute" }, allowSensitiveKeys: true }` — change options to just `{ preHandler: [requirePermission("users:write")] }`

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm run typecheck && pnpm test`
Expected: No errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add server/routes/users.ts
git commit -m "refactor: remove inline security config from users routes"
```

---

### Task 6: Clean up remaining route files — remove inline security config

**Files:**
- Modify: `server/routes/health.ts`
- Modify: `server/routes/settings.ts`
- Modify: `server/routes/notifications.ts`
- Modify: `server/routes/customers.ts`
- Modify: `server/routes/parts.ts`
- Modify: `server/routes/ai.ts`

- [ ] **Step 1: Remove `rateLimit` configs from all remaining route files**

**health.ts** — No inline config to remove. The `/health` route has no options block. Leave as-is.

**settings.ts** — Change:
```ts
app.get(
  "/",
  {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  },
```
to:
```ts
app.get("/", {},
```
or simply remove the options object entirely.

**notifications.ts** — Change:
```ts
app.get(
  "/",
  {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
    preHandler: [requirePermission("notifications:read")],
  },
```
to:
```ts
app.get(
  "/",
  {
    preHandler: [requirePermission("notifications:read")],
  },
```

**customers.ts** — Remove `config: { rateLimit: ... }` from the GET `/` route. Keep the group `addHook` preHandler.

**parts.ts** — Remove `config: { rateLimit: ... }` from the GET `/` route. Keep the group `addHook` preHandler.

**ai.ts** — Remove `config: { rateLimit: { max: 30, timeWindow: "1 minute" } }` from the GET `/` route. Keep the group `addHook` preHandler.

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm run typecheck && pnpm test`
Expected: No errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add server/routes/settings.ts server/routes/notifications.ts server/routes/customers.ts server/routes/parts.ts server/routes/ai.ts
git commit -m "refactor: remove inline security config from remaining routes"
```

---

### Task 7: Run full verification

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: No errors

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 3: Run test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Start server and smoke-test**

Run: `pnpm dev` and verify:
1. Server starts without errors
2. `GET /health` returns 200 (no auth required, no rate limit)
3. Login works
4. CSRF token is returned in cookie
5. Job listing works (GET with default rate limit)

- [ ] **Step 5: Commit any lint fixes if needed**

If lint made formatting changes:

```bash
git add -A
git commit -m "style: lint fixes after route security refactor"
```