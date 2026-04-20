# Route Security: Config Map + Global Auto-Apply

**Date:** 2026-04-16  
**Status:** Approved  
**Scope:** `server/config/routeSecurity.ts`, `server/plugins/security.ts`, all route files

## Problem

Security configuration is scattered across individual route files, leading to inconsistencies:

1. **6 mutation routes lack CSRF protection** — DELETE `/:id/photos/:photoId`, POST `/:id/waiting-parts`, DELETE `/:id/waiting-parts/:waitingId` in `jobs.ts`; POST `/`, PATCH `/:id/status`, POST `/:id/reset-password` in `users.ts`
2. **Rate limiting is opt-in** (`global: false`) — any route that forgets it has zero protection. Better Auth wildcard routes (`/api/auth/*`) have no rate limiting.
3. **`allowSensitiveKeys` and `csrfProtection` are applied manually per-route** — easy to forget on new routes
4. **No single source of truth** — auditing security requires grepping every route file

## Approach

**Auto-apply + opt-out with a centralized config map.** All routes get secure defaults automatically. Overrides live in one auditable file.

### Design Principles

- **Secure by default**: every route gets rate limiting, CSRF (mutations), and sanitization automatically
- **Explicit exemptions**: only routes that need different settings list an override
- **Single source of truth**: `server/config/routeSecurity.ts` is the only file you touch for security config
- **Zero-trust route files**: route handlers focus on business logic (schema + handler + RBAC); security is injected by hooks

## Architecture

### 1. `server/config/routeSecurity.ts`

A typed, ordered list of route-pattern overrides. First match wins (more specific patterns listed first).

```ts
interface RouteSecurityOverride {
  rateLimit?: { max: number; timeWindow: string } | false
  csrf?: boolean
  allowSensitiveKeys?: boolean
}

export const routeSecurity: [string, RouteSecurityOverride][] = [
  // Health check — no security needed
  ['/health',                   { rateLimit: false, csrf: false }],

  // Auth — Better Auth manages its own CSRF; strict rate limits on mutations
  ['/api/auth/change-password', { rateLimit: { max: 5, timeWindow: '1 minute' }, allowSensitiveKeys: true }],
  ['/api/auth/must-change-password', { rateLimit: { max: 20, timeWindow: '1 minute' }, csrf: false }],
  ['/api/auth/*',               { csrf: false }],

  // Users — sensitive keys on create/status toggle/password reset
  ['/api/users/:id/reset-password', { rateLimit: { max: 10, timeWindow: '1 minute' }, allowSensitiveKeys: true }],
  ['/api/users/:id/status',         { allowSensitiveKeys: true }],
  ['/api/users',                    { rateLimit: { max: 10, timeWindow: '1 minute' }, allowSensitiveKeys: true }],

  // Jobs — tighter rate limits on mutations
  ['/api/jobs',   { rateLimit: { max: 30, timeWindow: '1 minute' } }],

  // AI — stricter rate limit
  ['/api/ai',     { rateLimit: { max: 30, timeWindow: '1 minute' } }],

  // Catch-all: defaults apply
  ['/api/*',      {}],
]
```

**Defaults when no override matches:**

| Setting | Default |
|---------|---------|
| `rateLimit` | `{ max: 100, timeWindow: '1 minute' }` |
| `csrf` | `true` for POST/PATCH/PUT/DELETE; `false` for GET/OPTIONS/HEAD |
| `allowSensitiveKeys` | `false` |

### 2. Pattern matching

A helper `matchRoute(pattern, url)` function handles wildcard matching:

- `*` matches any single path segment
- Exact segments must match exactly
- Patterns are matched in declaration order; first match wins
- The function is tested with a small unit test covering edge cases

### 3. Modified `server/plugins/security.ts`

Three changes to the existing plugin:

**a) Rate limiting → `global: true`**

Change from `global: false` to `global: true`. All routes get the default 100 req/min. The `onRoute` hook reads from the config map and applies per-route overrides (stricter limits or `false` to disable via `allowList`).

**b) CSRF auto-applied via `onRoute` hook**

Remove the requirement for routes to manually call `app.csrfProtection()`. Instead, an `onRoute` hook:
1. Checks if the route's method is a mutation (POST/PATCH/PUT/DELETE)
2. Looks up the route URL in the config map
3. If `csrf` is not explicitly `false`, appends `app.csrfProtection()` to the route's `preHandler` array
4. Routes that already have `csrfProtection` in their preHandler are not double-applied

**c) `allowSensitiveKeys` applied from config map**

The existing sanitization `preHandler` reads `routeOptions.config.allowSensitiveKeys`. The `onRoute` hook sets this config from the config map, so route files never need to set it directly.

### 4. Route file cleanup

All route files undergo the same cleanup:

| Remove | Reason |
|--------|--------|
| `app.csrfProtection()` calls | Now auto-injected by `onRoute` hook |
| `config: { rateLimit: { ... } }` | Now handled by config map + `onRoute` hook |
| `config: { allowSensitiveKeys: true }` | Now handled by config map + `onRoute` hook |

Route files retain only: handler, schema, and RBAC `preHandler` (e.g. `requirePermission(...)`).

### 5. Audit logging — unchanged

The `onResponse` hook in the security plugin that logs mutations to `AuditLog` stays as-is. No changes needed.

## Files Changed

| File | Change |
|------|--------|
| `server/config/routeSecurity.ts` | **New** — config map + `matchRoute` helper |
| `server/plugins/security.ts` | Modified — `global: true`, `onRoute` hook for CSRF/rate-limit/sensitive-keys |
| `server/routes/jobs.ts` | Remove `csrfProtection()` calls, rate limit configs |
| `server/routes/auth.ts` | Remove `csrfProtection()`, rate limit config, `allowSensitiveKeys` |
| `server/routes/users.ts` | Remove rate limit configs, `allowSensitiveKeys` |
| `server/routes/health.ts` | Remove any security config (handled by config map) |
| `server/routes/settings.ts` | Remove any rate limit config |
| `server/routes/notifications.ts` | Remove any rate limit config |
| `server/routes/customers.ts` | Remove any rate limit config |
| `server/routes/parts.ts` | Remove any rate limit config |
| `server/routes/ai.ts` | Remove any rate limit config |

## Security Guarantees

After this change:

1. **Every mutation route has CSRF protection** unless explicitly exempted in the config map
2. **Every route has rate limiting** unless explicitly set to `false` in the config map
3. **No route can silently lack security** — the `onRoute` hook catches all registrations
4. **Auditing security is a one-file review** — `routeSecurity.ts`
5. **Adding a new route is safe by default** — no need to remember security hooks