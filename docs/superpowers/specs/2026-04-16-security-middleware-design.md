# Security Middleware — Single Source of Truth Plugin

**Date:** 2026-04-16
**Status:** Approved
**Deployment:** Single shop, cloud-hosted

---

## Overview

Create a single `server/plugins/security.ts` that composes all 7 security layers into one Fastify plugin. Every API route automatically gets perimeter protection, input sanitization, error obfuscation, and mutation audit logging. Routes opt into rate limiting via `config.rateLimit`.

## Architecture

```
Request → [Helmet] → [CORS] → [Rate Limit] → [CSRF] → [Sanitize] → [Auth] → [RBAC] → Handler → [Audit] → Response
```

All layers live in one file. Registration order = execution order. Each layer is a clearly labeled section.

## Approach

**Approach A: Security Plugin Suite** — single `server/plugins/security.ts` composing all concerns via `fastify-plugin`. Routes stay clean. Security config lives in one auditable place.

Rejected alternatives:
- **B (Decoupled Files):** Too scattered for a single-shop app. Harder to audit. More files for what are mostly 5-line registrations.
- **C (Hybrid Plugin + SSOT Enforcer):** SSOT enforcement is already handled by the existing service layer pattern.

---

## Layer Details

### Layer 1 — Security Headers (`@fastify/helmet`)

```typescript
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind needs inline
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:"],               // API + WebSocket
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
});
```

- Sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, etc. automatically
- CSP configured for the app's actual needs (Tailwind, WebSocket, images)
- HSTS enabled for 1 year with subdomain preload
- Per-route override available via `{ helmet: false }` or `{ helmet: { ... } }`

### Layer 2 — CORS (tightened from `origin: true`)

```typescript
await app.register(cors, {
  origin: [process.env.FRONTEND_URL ?? "http://localhost:5173"],
  credentials: true,        // allow cookies (session)
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400,            // preflight cache 24h
});
```

- Locked down to specific origin (env-based)
- Credentials enabled for cookie-based session auth
- Only allows methods the app uses
- Preflight cached for 24h to reduce OPTIONS overhead

### Layer 3 — Rate Limiting (`@fastify/rate-limit`, per-user + per-route)

```typescript
await app.register(rateLimit, {
  global: false,            // opt-in per route
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (req) => req.user?.id ?? req.ip,  // per-user when authed
  exponentialBackoff: true,
  ban: 5,                  // ban after 5 consecutive overages
  allowList: ["/health"],
  errorResponseBuilder: (req, ctx) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Rate limit exceeded. Try again later.",
    retryAfter: Math.ceil(ctx.ttl / 1000),
  }),
});
```

- Opt-in per route (not global) — each route declares its own limit
- Keyed by user ID when authenticated, IP when not
- Exponential backoff prevents retry storms
- Ban threshold (5 consecutive overages = temporary ban)
- `/health` allowlisted
- Auth routes get stricter limits (5/min)
- Default mutations get moderate limits (100/min)

Per-route example:
```typescript
app.post("/api/auth/sign-in", {
  config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
}, handler);
```

### Layer 4 — CSRF Protection (`@fastify/csrf-protection`)

```typescript
await app.register(csrf, {
  cookieOptions: { sameSite: "strict", httpOnly: true, path: "/" },
});
```

- Double-submit cookie pattern
- CSRF token generated on first GET, required on all state-changing requests (POST/PATCH/DELETE)
- Works with Better Auth's cookie-based sessions
- `sameSite: "strict"` provides additional CSRF protection at the cookie level

### Layer 5 — Request Sanitization (mass assignment protection)

```typescript
const SENSITIVE_KEYS = new Set(["password", "isActive", "role", "mustChangePassword"]);

function sanitizeRequest(req, _reply, done) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (SENSITIVE_KEYS.has(key) && !req.routeConfig.allowSensitiveKeys) {
        delete req.body[key];
      }
    }
  }
  done();
}

app.addHook("preHandler", sanitizeRequest);
```

- Strips sensitive keys from request bodies unless the route explicitly opts in via `config.allowSensitiveKeys`
- Prevents mass assignment attacks (e.g., a client sending `{ role: "OWNER" }` in a job update)
- Routes that need sensitive keys (change-password, admin user creation) set `config.allowSensitiveKeys: true`

### Layer 6 — Error Obfuscation (hide internals in production)

```typescript
function obfuscateErrors(error, req, reply) {
  const isDev = process.env.NODE_ENV !== "production";

  if (error.validation) {
    // Zod/Fastify schema validation errors — safe to return
    reply.status(error.statusCode ?? 400).send({
      statusCode: error.statusCode ?? 400,
      error: "Validation Error",
      message: error.message,
    });
    return;
  }

  // All other errors — hide internals in production
  reply.status(error.statusCode ?? 500).send({
    statusCode: error.statusCode ?? 500,
    error: isDev ? error.name : "Internal Server Error",
    message: isDev ? error.message : "An unexpected error occurred",
    ...(isDev && { stack: error.stack }),
  });
}
```

- Validation errors (400) are always returned — they're client problems, not leaks
- All other errors are obfuscated in production: no stack traces, no internal error names
- In development, full error details are shown for debugging
- Consistent error shape: `{ statusCode, error, message }`

### Layer 7 — Audit Logging (auto-tracks all mutations)

```typescript
async function auditMutations(request, reply) {
  const mutationMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);
  if (!mutationMethods.includes(request.method)) return;

  const userId = request.user?.id ?? "anonymous";
  const action = `${request.method} ${request.routeOptions?.url ?? request.url}`;

  request.log.info({ audit: { userId, action, statusCode: reply.statusCode } });
  // Also write to AuditLog table (async, non-blocking, fire-and-forget)
  request.server.prisma.auditLog.create({
    data: { userId, action, statusCode: reply.statusCode, metadata: {} },
  }).catch((err) => request.log.error({ err }, "Failed to write audit log"));
}

app.addHook("onResponse", auditMutations);
```

- Automatically logs every mutation request (POST/PATCH/PUT/DELETE)
- Records who did what, and the result (statusCode)
- Uses the existing `AuditLog` Prisma model
- Async write — mutation doesn't wait for the DB insert
- Failure to write audit log logs an error but doesn't fail the request

---

## Impact on Existing Files

| File | Change |
|------|--------|
| `server/index.ts` | Remove separate `@fastify/cors` and `@fastify/rate-limit` registrations. Add `await app.register(securityPlugin)`. |
| `server/plugins/auth.ts` | Remove custom in-memory sign-in rate limiter (replaced by Layer 3). Keep everything else. |
| `server/plugins/security.ts` | **NEW** — The security plugin containing all 7 layers. |
| `server/middlewares/rbac.ts` | No changes — stays as-is. |
| All route files | Add `config.rateLimit` overrides where needed. Routes that handle sensitive keys add `config.allowSensitiveKeys: true`. |

### Route Config Examples

```typescript
// Standard mutation route
app.post("/", {
  config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  preHandler: requirePermission("jobs:write"),
}, handler);

// Auth route — strict rate limit, needs sensitive keys
app.post("/api/auth/sign-in", {
  config: {
    rateLimit: { max: 5, timeWindow: "1 minute" },
    allowSensitiveKeys: true,
    helmet: { contentSecurityPolicy: false },  // auth pages may need different CSP
  },
}, handler);

// Read-only route — moderate rate limit
app.get("/", {
  config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  preHandler: requirePermission("jobs:read"),
}, handler);

// Health check — no rate limit (allowListed), no auth
app.get("/health", handler);
```

---

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@fastify/helmet` | latest | Security headers |
| `@fastify/csrf-protection` | latest | CSRF token protection |

`@fastify/cors` and `@fastify/rate-limit` are already installed.

---

## What We're NOT Doing (YAGNI)

| Skip | Reason |
|------|--------|
| Redis for rate-limit | In-memory is fine for single-instance deployment. Add when scaling. |
| Idempotency keys | No concurrent clients mutating same resource yet. Add when needed. |
| Optimistic concurrency / version checks | Low contention for single shop. Add when needed. |
| Per-field encryption | Not required for repair shop data. |
| IP allowlisting | Cloud-hosted with auth — not needed. |
| Row-level security (multi-tenant) | Single shop — no tenant isolation needed. |
| Custom sanitization library | Zod validation + key stripping covers the attack surface. Add DOMPurify when rendering HTML. |

---

## Testing Strategy

- Unit tests for each layer (sanitizer, error obfuscation, audit formatting)
- Integration tests for the full security plugin (request lifecycle)
- Manual smoke test: `curl` requests to verify headers, CORS, rate limits, CSRF
- Login with `admin` / `SEED_ADMIN_PASSWORD` to verify auth flow still works after plugin registration