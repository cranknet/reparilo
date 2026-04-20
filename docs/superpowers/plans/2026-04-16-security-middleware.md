# Security Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single security plugin (`server/plugins/security.ts`) that composes all 7 security layers (helmet, CORS, rate-limit, CSRF, sanitization, error obfuscation, audit logging) and integrate it into the Fastify app.

**Architecture:** One `fastify-plugin` file that registers all security concerns in correct order. Routes opt into rate limiting via `config.rateLimit`. Existing `server/index.ts` delegates to this plugin instead of registering `@fastify/cors` and `@fastify/rate-limit` separately. The sign-in rate limiter in `auth.ts` is removed (replaced by per-route rate limit config).

**Tech Stack:** Fastify 5, @fastify/helmet, @fastify/cors (existing), @fastify/rate-limit (existing), @fastify/csrf-protection, @fastify/cookie, fastify-plugin

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| CREATE | `server/plugins/security.ts` | All 7 security layers composed as one plugin |
| MODIFY | `server/index.ts` | Remove separate cors/rate-limit, register security plugin |
| MODIFY | `server/plugins/auth.ts` | Remove custom in-memory rate limiter (lines 10-54, 97-99, 106-115) |
| MODIFY | `server/routes/jobs.ts` | Add rate-limit config to routes |
| MODIFY | `server/routes/auth.ts` | Add rate-limit + allowSensitiveKeys config |
| MODIFY | `server/routes/users.ts` | Add rate-limit + allowSensitiveKeys config |
| MODIFY | `prisma/schema.prisma` | Add `API_MUTATION` to AuditAction enum |

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install @fastify/helmet, @fastify/csrf-protection, @fastify/cookie**

```bash
pnpm add @fastify/helmet @fastify/csrf-protection @fastify/cookie
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls @fastify/helmet @fastify/csrf-protection @fastify/cookie
```

Expected: All three packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add security plugin dependencies"
```

---

### Task 2: Add `API_MUTATION` to AuditAction enum

**Files:**
- Modify: `prisma/schema.prisma:61-80`

The auto-audit hook needs an AuditAction value for generic API mutations that don't map to existing enum values. We'll add `API_MUTATION` as a catch-all.

- [ ] **Step 1: Add `API_MUTATION` to the enum**

In `prisma/schema.prisma`, add `API_MUTATION` at the end of the `AuditAction` enum (after `PASSWORD_RESET` on line 79):

```prisma
enum AuditAction {
  JOB_CREATED
  STATUS_CHANGED
  TECHNICIAN_ASSIGNED
  COST_UPDATED
  PART_ADDED
  PART_REMOVED
  REPAIR_ADDED
  REPAIR_REMOVED
  NOTE_ADDED
  PHOTO_ADDED
  PHOTO_REMOVED
  JOB_UPDATED
  WARRANTY_RETURN_CREATED
  NOTIFICATION_SENT
  USER_SIGN_IN
  USER_SIGN_OUT
  USER_CREATED
  PASSWORD_RESET
  API_MUTATION
}
```

- [ ] **Step 2: Generate and run the migration**

```bash
pnpm db:migrate -- --name add_api_mutation_audit_action
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm db:generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add API_MUTATION to AuditAction enum"
```

---

### Task 3: Create the security plugin

**Files:**
- Create: `server/plugins/security.ts`

This is the core file. All 7 layers in one plugin, registered in execution order.

- [ ] **Step 1: Write `server/plugins/security.ts`**

```typescript
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import csrf from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

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
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  });

  // ── Layer 2: CORS ───────────────────────────────────────────────────────
  const allowedOrigins = IS_PROD
    ? [FRONTEND_URL]
    : [FRONTEND_URL, "http://localhost:5173"];

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86400,
  });

  // ── Layer 3: Rate Limiting ──────────────────────────────────────────────
  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
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
  // @fastify/cookie must be registered before csrf-protection
  await app.register(cookie);

  await app.register(csrf, {
    cookieOptions: {
      sameSite: IS_PROD ? "strict" : "lax",
      httpOnly: true,
      path: "/",
      secure: IS_PROD,
      signed: IS_PROD,
    },
  });

  // ── Layer 5: Request Sanitization ───────────────────────────────────────
  app.addHook("preHandler", (request, _reply, done) => {
    if (request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
      const allowSensitiveKeys = (request.routeConfig as { allowSensitiveKeys?: boolean })
        .allowSensitiveKeys;

      if (!allowSensitiveKeys) {
        for (const key of Object.keys(request.body as Record<string, unknown>)) {
          if (SENSITIVE_KEYS.has(key)) {
            delete (request.body as Record<string, unknown>)[key];
          }
        }
      }
    }
    done();
  });

  // ── Layer 6: Error Obfuscation ─────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      void reply.status(error.statusCode ?? 400).send({
        statusCode: error.statusCode ?? 400,
        error: "Validation Error",
        message: error.message,
      });
      return;
    }

    const statusCode = error.statusCode ?? 500;

    void reply.status(statusCode).send({
      statusCode,
      error: IS_PROD ? "Internal Server Error" : error.name ?? "Error",
      message: IS_PROD
        ? statusCode >= 500
          ? "An unexpected error occurred"
          : error.message ?? "Request failed"
        : error.message ?? "Unknown error",
      ...(IS_PROD ? {} : { stack: error.stack }),
    });
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // ── Layer 7: Audit Logging ─────────────────────────────────────────────
  app.addHook("onResponse", async (request, reply) => {
    if (!MUTATION_METHODS.has(request.method)) return;

    const userId = request.user?.id;
    if (!userId) return;

    const action = `${request.method} ${request.routeOptions?.url ?? request.url}`;

    request.log.info({ audit: { userId, action, statusCode: reply.statusCode } });

    request.server.prisma.auditLog
      .create({
        data: {
          userId,
          action: "API_MUTATION",
          toValue: action,
          jobId: null,
          metadata: { statusCode: reply.statusCode },
        },
      })
      .catch((err) =>
        request.log.error({ err }, "Failed to write audit log")
      );
  });
};

export default fp(securityPlugin, { name: "security-plugin" });

declare module "fastify" {
  interface FastifyContextConfig {
    allowSensitiveKeys?: boolean;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit server/plugins/security.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/plugins/security.ts
git commit -m "feat: add security plugin with 7 layers"
```

---

### Task 4: Update `server/index.ts` — remove separate cors/rate-limit, add security plugin

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Update `server/index.ts`**

The full file after changes:

```typescript
import "dotenv/config";
import path from "node:path";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import authPlugin from "./plugins/auth.js";
import prismaPlugin from "./plugins/prisma.js";
import securityPlugin from "./plugins/security.js";
import { websocketPlugin } from "./plugins/websocket.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { customersRoutes } from "./routes/customers.js";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { partsRoutes } from "./routes/parts.js";
import { settingsRoutes } from "./routes/settings.js";
import { usersRoutes } from "./routes/users.js";

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(securityPlugin);
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
await app.register(websocket);

await app.register(prismaPlugin);
app.register(authRoutes);
await app.register(authPlugin);
await app.register(websocketPlugin);

app.register(healthRoutes);
app.register(jobRoutes, { prefix: "/api/jobs" });
app.register(partsRoutes, { prefix: "/api/parts" });
app.register(customersRoutes, { prefix: "/api/customers" });
app.register(usersRoutes, { prefix: "/api/users" });
app.register(notificationsRoutes, { prefix: "/api/notifications" });
app.register(settingsRoutes, { prefix: "/api/settings" });
app.register(aiRoutes, { prefix: "/api/ai" });

if (process.env.NODE_ENV === "production") {
  await app.register(staticPlugin, {
    root: path.resolve("dist"),
    wildcard: false,
  });
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile("index.html");
  });
}

await app.register(staticPlugin, {
  root: path.resolve("uploads"),
  prefix: "/api/uploads/",
  decorateReply: false,
});

process.on("uncaughtException", (err) => {
  app.log.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  app.log.fatal({ err }, "Unhandled rejection");
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Reparilo server running on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

Changes summary:
- Removed `import cors` and `import rateLimit`
- Removed `await app.register(cors, { origin: true })` and `await app.register(rateLimit, { max: 100, timeWindow: "1 minute" })`
- Added `import securityPlugin from "./plugins/security.js"`
- Added `await app.register(securityPlugin)` as the FIRST plugin registration (before multipart, before auth)

- [ ] **Step 2: Verify the server starts**

```bash
pnpm run server
```

Expected: Server starts without errors. No import resolution failures.

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: register security plugin, remove separate cors/rate-limit"
```

---

### Task 5: Remove custom rate limiter from `server/plugins/auth.ts`

**Files:**
- Modify: `server/plugins/auth.ts`

The custom in-memory rate limiter (lines 10-54, and the usage on lines 97-99, 106-115) is now handled by `@fastify/rate-limit` in the security plugin with per-route config.

- [ ] **Step 1: Edit `server/plugins/auth.ts`**

Remove the following sections:

1. **Lines 9-54** (the entire sign-in rate limiter block): Delete `// Sign-in rate limiter` comment, `SIGN_IN_PATHS`, `MAX_SIGN_IN_ATTEMPTS`, `SIGN_IN_WINDOW_MS`, `RateLimitEntry` interface, `signInRateLimitStore`, `RATE_LIMIT_CLEANUP_MS`, `cleanupInterval`, `isRateLimited`, `isSignInPath`.

2. **Line 97-99** (`app.addHook("onClose", ...)`): Delete the `clearInterval(cleanupInterval)` hook.

3. **Lines 106-115** (the rate-limit check inside the `/api/auth/*` handler): Delete the `if (isSignInPath(url.pathname) && request.method === "POST" && isRateLimited(request.ip)) { ... }` block.

The cleaned `auth.ts` should look like this:

```typescript
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { Auth } from "../lib/auth.js";
import { createAuth, getSessionFromRequest } from "../lib/auth.js";

async function auditSignIn(
  auth: Auth,
  headers: Headers,
  prisma: { auditLog: { create: (args: { data: { jobId: null; userId: string; action: "USER_SIGN_IN"; toValue: string } }) => Promise<void> } } 
): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      await prisma.auditLog.create({
        data: {
          jobId: null,
          userId: session.user.id,
          action: "USER_SIGN_IN",
          toValue: `Sign-in for ${session.user.username ?? session.user.email}`,
        },
      });
    }
  } catch {
    // Audit failure should not block sign-in
  }
}

function extractBody(method: string, body: unknown): string | undefined {
  const isMutation = method === "POST" || method === "PUT" || method === "PATCH";
  return isMutation && body ? JSON.stringify(body) : undefined;
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
const authPlugin: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma;
  const auth = createAuth(prisma);

  app.decorate("auth", auth);
  app.decorateRequest("user", null);

  app.all("/api/auth/*", async (request, reply) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);
      const body = extractBody(request.method, request.body);

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body ? { body } : {}),
      });

      const response = await auth.handler(req);

      if (
        response.status === 200 &&
        request.method === "POST" &&
        url.pathname.includes("sign-in")
      ) {
        await auditSignIn(auth, headers, prisma);
      }

      app.log.info(
        { status: response.status, path: url.pathname, method: request.method },
        "Better Auth handler response"
      );

      reply.status(response.status);
      for (const [key, value] of response.headers.entries()) {
        reply.header(key, value);
      }
      const text = await response.text();
      reply.send(text || null);
    } catch (err) {
      app.log.error(err, "Better Auth handler error");
      reply.status(500).send({ error: "Internal authentication error" });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (
      process.env.AUTH_BYPASS === "true" &&
      process.env.NODE_ENV !== "production"
    ) {
      request.user = {
        id: "dev",
        role: "OWNER",
        username: "dev",
        isActive: true,
        mustChangePassword: false,
      };
      return;
    }

    if (
      request.url === "/health" ||
      request.url.startsWith("/tracking") ||
      request.url.startsWith("/api/auth")
    ) {
      return;
    }

    const session = await getSessionFromRequest(auth, request);

    if (!session) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    if (!session.isActive) {
      await reply.status(403).send({ error: "Account is disabled" });
      return;
    }

    request.user = session;
  });
};

export default fp(authPlugin);

declare module "fastify" {
  interface FastifyInstance {
    auth: Auth;
  }
  interface FastifyRequest {
    user: {
      id: string;
      role: string;
      username: string;
      isActive: boolean;
      mustChangePassword: boolean;
    } | null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add server/plugins/auth.ts
git commit -m "refactor: remove custom rate limiter from auth plugin"
```

---

### Task 6: Add rate-limit config to route files

**Files:**
- Modify: `server/routes/auth.ts`
- Modify: `server/routes/jobs.ts`
- Modify: `server/routes/users.ts`

Each route file that has mutation endpoints needs `config.rateLimit` additions.

- [ ] **Step 1: Update `server/routes/auth.ts`**

Add `allowSensitiveKeys: true` to the change-password route config, and add rate limits. The full file:

```typescript
import { changePasswordSchema } from "@shared/schemas/auth.schema";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async signature
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/change-password", {
    config: {
      rateLimit: { max: 5, timeWindow: "1 minute" },
      allowSensitiveKeys: true,
    },
  }, async (request, reply) => {
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
      return reply.status(400).send({ error: "Current password is incorrect" });
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
  });

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

- [ ] **Step 2: Update `server/routes/jobs.ts` — add rate-limit to mutation routes**

For each mutation route in `jobs.ts`, add `config: { rateLimit: { max: 30, timeWindow: "1 minute" } }`. For the list/get routes, add `config: { rateLimit: { max: 100, timeWindow: "1 minute" } }`.

Read the existing file and add the `config` property to each route definition. Example pattern for a POST route:

```typescript
app.post("/", {
  config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  preHandler: requirePermission("jobs:write"),
}, async (request, reply) => { ... });
```

And for GET routes:

```typescript
app.get("/", {
  config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
}, async (request, reply) => { ... });
```

Only add to routes that don't already have a `config` property. For routes that already use `preHandler`, add `config` alongside it.

- [ ] **Step 3: Update `server/routes/users.ts` — add rate-limit config**

Same pattern. Mutation routes (POST, PATCH) get `max: 30`, read routes (GET) get `max: 100`. The `POST /` (create user) route needs `allowSensitiveKeys: true` because it sets `role` and `isActive` fields. The `POST /:id/reset-password` route needs `allowSensitiveKeys: true` because it sets `password`.

```typescript
app.post("/", {
  config: { rateLimit: { max: 10, timeWindow: "1 minute" }, allowSensitiveKeys: true },
  preHandler: requirePermission("users:write"),
}, async (request, reply) => { ... });
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.ts server/routes/jobs.ts server/routes/users.ts
git commit -m "feat: add rate-limit and allowSensitiveKeys config to route files"
```

---

### Task 7: Smoke test — verify all security layers work

**Files:**
- None (testing only)

- [ ] **Step 1: Start the server**

```bash
pnpm run server
```

- [ ] **Step 2: Test Layer 1 — Helmet headers**

```bash
curl -s -I http://localhost:4000/health | grep -iE "x-frame-options|x-content-type|strict-transport|content-security-policy|referrer-policy"
```

Expected: Multiple security headers present (x-frame-options, x-content-type-options, content-security-policy, etc.)

- [ ] **Step 3: Test Layer 2 — CORS**

```bash
curl -s -I -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" http://localhost:4000/api/jobs
```

Expected: `access-control-allow-origin: http://localhost:5173` header present.

```bash
curl -s -I -X OPTIONS -H "Origin: http://evil.example.com" -H "Access-Control-Request-Method: POST" http://localhost:4000/api/jobs
```

Expected: No `access-control-allow-origin` header (origin rejected).

- [ ] **Step 4: Test Layer 3 — Rate limiting**

```bash
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/auth/sign-in/username; done
```

Expected: First 5 return 4xx (auth error), 6th+ should return 429 (rate limited).

- [ ] **Step 5: Test Layer 5 — Sanitization**

```bash
curl -s -X POST http://localhost:4000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"test12345678","newPassword":"test12345678","role":"OWNER"}' \
  | jq .
```

Expected: `role` key is stripped by the sanitizer (not present in any error message). Note: auth might fail since we're not authenticated, but the point is `role` never reaches the handler.

- [ ] **Step 6: Test Layer 6 — Error obfuscation**

```bash
curl -s http://localhost:4000/api/nonexistent-route | jq .
```

Expected: `{"statusCode": 404, "error": "Not Found", "message": "Route GET /api/nonexistent-route not found"}`

- [ ] **Step 7: Test login still works**

Login via the frontend with `admin` and the seed password. Verify the session persists and API calls succeed.

- [ ] **Step 8: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: adjustments from smoke testing"
```

---

### Task 8: Run lint and type check

**Files:**
- None (validation only)

- [ ] **Step 1: Run lint**

```bash
pnpm check
```

Expected: No lint errors.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: All existing tests pass (no regressions).

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Layer 1: Security headers (helmet) | Task 3 |
| Layer 2: CORS (tightened) | Task 3 |
| Layer 3: Rate limiting (per-user, per-route) | Task 3 + Task 6 |
| Layer 4: CSRF protection | Task 3 |
| Layer 5: Request sanitization (mass assignment) | Task 3 |
| Layer 6: Error obfuscation | Task 3 |
| Layer 7: Audit logging (auto) | Task 3 |
| Remove old cors/rate-limit from index.ts | Task 4 |
| Remove custom sign-in rate limiter from auth.ts | Task 5 |
| Add rate-limit config to route files | Task 6 |
| AuditAction enum update | Task 2 |
| New dependencies (helmet, csrf, cookie) | Task 1 |
| Smoke testing | Task 7 |
| Lint/typecheck | Task 8 |

### Placeholder Scan

- No TBDs, TODOs, or "implement later" statements found.

### Type Consistency

- `request.routeConfig.allowSensitiveKeys` → declared in `FastifyContextConfig` interface in security.ts
- `request.user?.id` → matches `FastifyRequest.user` type in auth.ts declaration
- `AuditAction.API_MUTATION` → added to enum in Task 2
- `request.server.prisma` → matches `FastifyInstance.prisma` decoration from prisma plugin