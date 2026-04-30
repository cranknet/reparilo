# Fastify Native Features: Request Timeout + Swagger API Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add request timeout configuration and auto-generated Swagger API documentation to the Reparilo Fastify server.

**Architecture:** Two independent additions: (1) Configure Fastify's built-in `connectionTimeout` and `requestTimeout` in the server constructor, with a per-route override for the AI streaming endpoint. (2) Register `@fastify/swagger` and `@fastify/swagger-ui` plugins, then add `schema` options to all route handlers across 12 route files.

**Tech Stack:** Fastify 5, @fastify/swagger, @fastify/swagger-ui, OpenAPI 3.0

---

## Task 1: Install Swagger Dependencies

**Files:**
- Modify: `package.json` (via `pnpm add`)

- [ ] **Step 1: Install packages**

Run: `pnpm add @fastify/swagger @fastify/swagger-ui`

- [ ] **Step 2: Verify installation**

Run: `pnpm ls @fastify/swagger @fastify/swagger-ui`
Expected: Both packages listed with versions.

---

## Task 2: Configure Request Timeouts

**Files:**
- Modify: `server/index.ts:34-42`
- Modify: `server/routes/ai.ts:118-128`

Fastify 5 constructor options:
- `connectionTimeout` — TCP socket idle timeout (default: 0 = no timeout). Set to 60s.
- `requestTimeout` — total request processing time (default: 0 = no timeout). Set to 30s.
- The AI streaming endpoint (`/api/ai/chat/stream`) must override to 0 (no timeout) because it holds a long-lived SSE connection.

- [ ] **Step 1: Add timeout config to Fastify constructor**

In `server/index.ts`, add `connectionTimeout` and `requestTimeout` to the Fastify options object:

```ts
const app = Fastify({
  logger: { level: env.LOG_LEVEL },
  trustProxy: env.TRUST_PROXY ?? IS_PROD,
  requestIdHeader: false,
  requestIdLogLabel: "reqId",
  connectionTimeout: 60_000,
  requestTimeout: 30_000,
  genReqId: () =>
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36),
});
```

- [ ] **Step 2: Disable timeout for AI streaming endpoint**

In `server/routes/ai.ts`, add `requestTimeout` to the AI stream route config at line ~118:

```ts
app.post(
  "/chat/stream",
  {
    preHandler: [requireAiEnabled],
    requestTimeout: 0,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60_000,
      },
    },
  },
  // ... handler unchanged
);
```

Note: `requestTimeout: 0` is a per-route override that Fastify 5 supports directly on the route options object (top-level, not inside `config`).

- [ ] **Step 3: Verify the server starts**

Run: `pnpm run server` (start and Ctrl+C after seeing "running on" log)
Expected: Server starts without errors.

---

## Task 3: Register Swagger Plugins

**Files:**
- Modify: `server/index.ts` (add imports + register calls)

The swagger plugins should be registered early, after security but before routes. In development only — no need to expose API docs in production.

- [ ] **Step 1: Add imports**

At the top of `server/index.ts`, add:

```ts
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
```

- [ ] **Step 2: Register swagger plugins**

After the `await app.register(securityPlugin)` line (line 49), add the swagger registration:

```ts
if (!IS_PROD) {
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Reparilo API",
        description: "Repair shop management system API",
        version: "1.0.0",
      },
      tags: [
        { name: "auth", description: "Authentication" },
        { name: "jobs", description: "Job management" },
        { name: "customers", description: "Customer management" },
        { name: "users", description: "User management" },
        { name: "parts", description: "Parts catalog" },
        { name: "repairs", description: "Repair catalog" },
        { name: "notifications", description: "Notifications" },
        { name: "settings", description: "Settings" },
        { name: "dashboard", description: "Dashboard" },
        { name: "ai", description: "AI analyst" },
        { name: "receipts", description: "Receipts and labels" },
        { name: "health", description: "Health check" },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });
}
```

- [ ] **Step 3: Verify swagger UI loads**

Run: `pnpm run server` then open `http://localhost:4000/docs`
Expected: Swagger UI renders with the API title and empty tag list (routes have no schemas yet). Ctrl+C the server.

---

## Task 4: Add Schema to Health Route (Pilot)

**Files:**
- Modify: `server/routes/health.ts`

Start with the simplest route to validate the pattern. Each route gets a `schema` property with `response` (and optionally `tags`).

- [ ] **Step 1: Add schema to health route**

Replace `server/routes/health.ts` with:

```ts
import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        return { status: "ok", timestamp: new Date().toISOString() };
      } catch {
        return reply.status(503).send({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};
```

- [ ] **Step 2: Verify**

Run: `pnpm run server` → `http://localhost:4000/docs`
Expected: Health endpoint appears under "health" tag with response schemas.

---

## Task 5: Add Schemas to Auth Routes

**Files:**
- Modify: `server/routes/auth.ts`

- [ ] **Step 1: Add schemas to both auth routes**

Add `schema` to each route definition in `server/routes/auth.ts`:

For `POST /api/auth/change-password` (line 10):
```ts
app.post(
  "/api/auth/change-password",
  {
    schema: {
      tags: ["auth"],
      summary: "Change password",
      body: {
        type: "object",
        required: ["oldPassword", "newPassword"],
        properties: {
          oldPassword: { type: "string" },
          newPassword: { type: "string", minLength: 8 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: { success: { type: "boolean" } },
        },
      },
    },
  },
  // ... handler unchanged
);
```

For `GET /api/auth/must-change-password` (line 66):
```ts
app.get(
  "/api/auth/must-change-password",
  {
    schema: {
      tags: ["auth"],
      summary: "Check if user must change password",
      response: {
        200: {
          type: "object",
          properties: { mustChangePassword: { type: "boolean" } },
        },
      },
    },
  },
  // ... handler unchanged
);
```

- [ ] **Step 2: Verify docs render**

Run: `pnpm run server` → `http://localhost:4000/docs`
Expected: Auth endpoints appear under "auth" tag.

---

## Task 6: Add Schemas to Jobs Routes

**Files:**
- Modify: `server/routes/jobs.ts`

This is the largest route file (509 lines, 18 endpoints). Add `schema` with `tags`, `summary`, `querystring`/`body`/`params` (minimal — just `type: "object"` with `additionalProperties: true`), and `response` to each route.

Because adding full JSON Schema for every Zod schema would be a massive duplication (the project deliberately uses Zod for validation), we take a pragmatic approach: document the **shape** at a high level for Swagger UI readability, but keep Zod as the validation SSOT.

- [ ] **Step 1: Add schema to each route in jobs.ts**

For every route in the file, add a `schema` property. Here is the pattern applied to each route:

```ts
app.get("/lookup", {
  schema: {
    tags: ["jobs"],
    summary: "Public job lookup by code + phone4",
    querystring: {
      type: "object",
      required: ["code", "phone4"],
      properties: {
        code: { type: "string" },
        phone4: { type: "string" },
      },
    },
    response: { 200: { type: "object", additionalProperties: true } },
  },
  preHandler: [],
  config: { /* ... existing config ... */ },
  handler: async (req, reply) => { /* unchanged */ },
});
```

Apply the same pattern to all other routes in the file. Key fields for each:

| Route | Method | Summary | Schema Fields |
|---|---|---|---|
| `/lookup` | GET | Public job lookup by code + phone4 | querystring, response |
| `/by-code/:jobCode` | GET | Get job by code (authenticated) | params, response |
| `/metrics` | GET | Job metrics | response |
| `/` | GET | List jobs | querystring, response |
| `/:id` | GET | Get job by ID | params, response |
| `/:id/history` | GET | Get job audit history | params, response |
| `/` | POST | Create job | body, response |
| `/:id` | PATCH | Update job | params, body, response |
| `/:id/status` | PATCH | Transition job status | params, body, response |
| `/:id/notes` | GET | List job notes | params, response |
| `/:id/notes` | POST | Add job note | params, body, response |
| `/:id/parts` | POST | Add part to job | params, body, response |
| `/:id/parts/:partId` | DELETE | Remove part from job | params, response |
| `/:id/repairs` | POST | Add repair to job | params, body, response |
| `/:id/repairs/:repairId` | DELETE | Remove repair from job | params, response |
| `/:id/photos` | POST | Upload job photo | params, response (consumes: multipart) |
| `/:id/photos/:photoId` | DELETE | Delete job photo | params, response |
| `/:id/waiting-parts` | POST | Add waiting part | params, body, response |
| `/:id/waiting-parts/:waitingId` | DELETE | Remove waiting part | params, response |

For params schemas, use: `{ type: "object", properties: { id: { type: "string" } }, required: ["id"] }`
For body schemas, use: `{ type: "object", additionalProperties: true }` (Zod handles real validation)
For response schemas, use: `{ type: "object", additionalProperties: true }`

For the photo upload route, add `consumes: ["multipart/form-data"]`.

- [ ] **Step 2: Verify docs render**

Run: `pnpm run server` → `http://localhost:4000/docs`
Expected: All 18 job endpoints appear under "jobs" tag.

---

## Task 7: Add Schemas to Customers Routes

**Files:**
- Modify: `server/routes/customers.ts`

- [ ] **Step 1: Add schema to each of the 5 routes**

Same pattern as Task 6. Routes:

| Route | Method | Summary |
|---|---|---|
| `/` | POST | Create customer |
| `/:id` | PATCH | Update customer |
| `/search` | GET | Search customers |
| `/:id` | GET | Get customer by ID |
| `/` | GET | List customers |

Add `schema: { tags: ["customers"], summary, ... }` to each.

- [ ] **Step 2: Verify**

---

## Task 8: Add Schemas to Users Routes

**Files:**
- Modify: `server/routes/users.ts`

- [ ] **Step 1: Add schema to each of the 14 routes**

Routes:

| Route | Method | Summary |
|---|---|---|
| `/` | GET | List users |
| `/:id` | GET | Get user by ID |
| `/` | POST | Create user |
| `/:id/status` | PATCH | Toggle user active status |
| `/:id/reset-password` | POST | Reset user password |
| `/:id` | PATCH | Update user profile |
| `/:id/activity` | GET | Get user activity log |
| `/:id/stats` | GET | Get user stats |
| `/:id/sessions` | GET | List user sessions |
| `/:id/sessions/:sessionId` | DELETE | Revoke user session |
| `/:id/avatar` | POST | Upload user avatar |
| `/:id/avatar` | DELETE | Delete user avatar |

- [ ] **Step 2: Verify**

---

## Task 9: Add Schemas to Remaining Routes

**Files:**
- Modify: `server/routes/parts.ts` (6 routes)
- Modify: `server/routes/repairs.ts` (6 routes)
- Modify: `server/routes/notifications.ts` (7 routes)
- Modify: `server/routes/settings.ts` (7 routes)
- Modify: `server/routes/dashboard.ts` (3 routes)
- Modify: `server/routes/receipts.ts` (2 routes)
- Modify: `server/routes/ai.ts` (22 routes)

- [ ] **Step 1: Add schemas to parts routes** (tags: ["parts"])
- [ ] **Step 2: Add schemas to repairs routes** (tags: ["repairs"])
- [ ] **Step 3: Add schemas to notifications routes** (tags: ["notifications"])
- [ ] **Step 4: Add schemas to settings routes** (tags: ["settings"])
- [ ] **Step 5: Add schemas to dashboard routes** (tags: ["dashboard"])
- [ ] **Step 6: Add schemas to receipts routes** (tags: ["receipts"])
- [ ] **Step 7: Add schemas to ai routes** (tags: ["ai"])
  - For `/chat/stream`, add `produces: ["text/event-stream"]` to the schema.

- [ ] **Step 8: Verify all routes appear in Swagger UI**

Run: `pnpm run server` → `http://localhost:4000/docs`
Expected: All endpoints appear under their respective tags. No routes missing.

---

## Task 10: Lint and Typecheck

**Files:** All modified files.

- [ ] **Step 1: Run lint + fix**

Run: `pnpm fix`
Expected: No errors.

- [ ] **Step 2: Run check**

Run: `pnpm check`
Expected: Passes with no warnings.

- [ ] **Step 3: Final smoke test**

Run: `pnpm run server` → verify:
1. Server starts without errors
2. `http://localhost:4000/docs` shows Swagger UI with all 12 tags
3. `http://localhost:4000/health` returns `{ status: "ok", timestamp: "..." }`
4. `curl -X POST http://localhost:4000/api/ai/chat/stream` → should timeout after 30s (not hang forever), confirming the global timeout works
