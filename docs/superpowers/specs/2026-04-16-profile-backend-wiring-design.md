# Profile Backend Wiring — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Summary

Wire the existing profile page to real backend data. Add user stats and session management endpoints. Enhance dashboard with a greeting banner and sidebar profile link.

## Backend Changes

### 1. `GET /api/users/:id/stats`

Returns real job counts for the profile sidebar.

**Response:**
```json
{
  "completedJobs": 12,
  "monthlyJobs": 3
}
```

**Logic:**
- `completedJobs`: count of jobs where `technicianId = userId` AND `status IN (DONE, DELIVERED)`
- `monthlyJobs`: same filter but `createdAt` within current calendar month (1st to now)
- Auth: user can view own stats, users with `users:read` can view others

### 2. `GET /api/users/:id/sessions`

Returns active sessions for the profile security tab.

**Response:**
```json
[
  {
    "id": "sess_abc",
    "ipAddress": "192.168.1.42",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "2026-04-16T10:00:00Z",
    "expiresAt": "2026-04-23T10:00:00Z",
    "isCurrent": true
  }
]
```

**Logic:**
- Query `Session` table where `userId = :id` AND `expiresAt > now()`
- Mark `isCurrent` by comparing session token to request's session token
- Auth: user can view own sessions only

### 3. `PATCH /api/users/:id` — Extend

Add `username` to `updateProfileSchema`:
```ts
username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional()
```

Add uniqueness check for username (same pattern as existing email uniqueness check).

### 4. `DELETE /api/users/:id/sessions/:sessionId`

Revoke a specific session (for "End session" button).

**Logic:**
- Delete session by ID, scoped to `userId` for safety
- Cannot delete current session (return 400)
- Auth: user can revoke own sessions only

## Auth Store Changes

### `AuthUser` interface — add `name` and `email`

```ts
interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: RoleType;
}
```

### `getSessionFromRequest` — return `name` and `email`

Add `name` and `email` from `session.user`.

### Fastify request `user` type — add `name` and `email`

Update the FastifyRequest interface declaration.

## Frontend Changes

### Profile Page (`src/pages/profile/index.tsx`)

- **Personal form**: Add `username` field alongside `name` and `email`. Submit all three via `PATCH /users/:id`.
- **Sidebar stats**: Fetch from `GET /users/:id/stats` on mount. Replace hardcoded `127` and `43`.
- **Sessions list**: Fetch from `GET /users/:id/sessions` on security tab. Render real data with "End session" button calling `DELETE /users/:id/sessions/:sessionId`.
- **Form initialization**: Read `name`, `email`, `username` from auth store instead of hardcoding.

### Dashboard (`src/pages/dashboard/index.tsx`)

- Add greeting banner at top: "Welcome back, {name}" with user's `name` from auth store.
- Show quick stat line: "{pendingJobs} jobs pending" using existing metrics.

### Sidebar (`src/components/modules/sidebar.tsx`)

- Make the user card at bottom a `NavLink` to `/profile`.
- Show user's `name` (or `username` fallback) instead of role label as primary text.

## Scope Exclusions

- Avatar upload (button exists but no backend — deferred)
- Language preference persistence (no `language` field on User model — deferred)
- Full audit log pagination (currently capped at 20, sufficient for profile)
