# Auth & RBAC Design

**Date:** 2026-04-14  
**Status:** Approved  
**Approach:** Better Auth with Prisma adapter, cookie sessions, PRD 3-role model

## Context

Reparilo has a complete frontend shell and database schema but zero backend logic. All 11 pages display mock data, all API routes are stubs, and auth is a bypass flag. This spec covers the first subsystem: authentication and role-based access control.

## Section 1: Server-Side Auth Plugin

**Better Auth** with Prisma adapter, registered in `server/plugins/auth.ts`.

- Better Auth config: `database` uses existing Prisma adapter, `emailAndPassword` plugin + `username` plugin enabled
- Users sign in with **username + password** (not email). The `username` plugin allows this natively.
- Session: cookie-based (`httpOnly`, `secure` in production, `sameSite: lax`), 7-day max expiry, 1-day rolling refresh
- Auth routes mounted at `/api/auth/*` via Better Auth's built-in Fastify handler:
  - `POST /api/auth/sign-in` — username + password
  - `POST /api/auth/sign-up` — disabled (see Section 4)
  - `POST /api/auth/sign-out` — clears session
  - `GET /api/auth/session` — returns current session + user
- The existing `preHandler` hook is replaced: calls Better Auth session validation, populates `request.user` with `{ id, role, username, isActive }`
- **Dev bypass preserved**: `AUTH_BYPASS=true` only works when `NODE_ENV !== 'production'`
- Public routes (`/health`, `/tracking`) skip auth as they do now

### Files to modify/create

| File | Action |
|------|--------|
| `server/plugins/auth.ts` | Rewrite — Better Auth setup + session hook |
| `package.json` | Add `better-auth` dependency |

## Section 2: Role-Based Access Control

**Middleware** at `server/middlewares/rbac.ts` — a Fastify preHandler hook factory.

- `requirePermission(permission: string)` — checks `request.user.role` against `ROLE_PERMISSIONS` from `shared/constants/roles.ts`
- Usage per route: `app.addHook('preHandler', requirePermission('jobs:write'))` or per-route config
- Permission denied = 403 with JSON error `{ error: 'Insufficient permissions' }`
- Owner-only endpoints use `requirePermission('users:write')` or `requirePermission('settings:write')`

### Admin password reset endpoint

- `POST /api/users/:id/reset-password`
- Protected by `requirePermission('users:write')` (owner only)
- Body: `{ password: string }` (min 8 chars, validated by Zod)
- Server hashes with Better Auth's `hashPassword`, updates user row
- Invalidates all sessions for that user

### Self-service password change

- `POST /api/auth/change-password`
- Requires `{ oldPassword: string, newPassword: string }`
- Verifies old password first, then updates
- Available to all authenticated users for their own account

### Files to modify/create

| File | Action |
|------|--------|
| `server/middlewares/rbac.ts` | Create — permission check factory |
| `server/routes/users.ts` | Implement — user management + reset-password endpoint |

## Section 3: Frontend Auth Integration

### Zustand store upgrade (`src/stores/auth.ts`)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: RoleType;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}
```

- On app mount: `checkSession()` calls `GET /api/auth/session` — if 200, populate store; if 401, set `isAuthenticated = false`
- `login()`: POST to `/api/auth/sign-in`, then `checkSession()`, then redirect to `/`
- `logout()`: POST to `/api/auth/sign-out`, clear store, redirect to `/login`

### ProtectedRoute component (`src/components/modules/protected-route.tsx`)

- Checks `isAuthenticated` — if false, redirect to `/login`
- Checks `isLoading` — if true, show full-page spinner
- Wraps all dashboard routes except `/login` and `/tracking`

### Route updates (`src/App.tsx`)

- Login page accessible without auth
- All dashboard routes wrapped in `<ProtectedRoute>`
- Sign-up mode disabled on login page (remove the tab toggle, always show sign-in form)

### API client updates

- `src/lib/api.ts`: Keep 401 interceptor, no changes needed (it already redirects to `/login`)
- `src/pages/auth/login.tsx`: Replace raw `fetch()` calls with `api` axios instance so cookies flow automatically

### Profile page security tab

- "Change password" form calls `POST /api/auth/change-password`
- Owner's "Users" settings tab gets "Reset password" button that calls `POST /api/users/:id/reset-password`

### Files to modify/create

| File | Action |
|------|--------|
| `src/stores/auth.ts` | Rewrite — full auth state |
| `src/components/modules/protected-route.tsx` | Create |
| `src/App.tsx` | Modify — wrap dashboard routes in ProtectedRoute |
| `src/pages/auth/login.tsx` | Modify — use api client, remove sign-up mode |
| `src/pages/settings/index.tsx` | Modify — add reset-password action to users tab |
| `src/pages/profile/index.tsx` | Modify — wire change-password form to API |

## Section 4: Sign-up Flow & Better Auth Schema

### Database migration adds:

- `Session` table: `id`, `userId` (FK → users), `token` (unique), `expiresAt`
- `Verification` table: `id`, `identifier`, `value`, `expiresAt`, `createdAt`
- `mustChangePassword` boolean field on `User` model (default: `false`)
- New `AuditAction` enum values: `USER_SIGN_IN`, `USER_SIGN_OUT`, `USER_CREATED`, `PASSWORD_RESET`

### Sign-up is disabled

- Public sign-up form is **removed** from the login page
- Better Auth's `/api/auth/sign-up` route is disabled in config (`disabled: true`)
- New users are created by the owner from **Settings > Users**: `POST /api/users` with `{ username, email, password, role }`, protected by `requirePermission('users:write')`
- Default password is temporary; `mustChangePassword` is set to `true` on user creation

### First-run experience

1. `pnpm db:seed` creates the admin user with the configured `SEED_ADMIN_PASSWORD`
2. Admin logs in; if `mustChangePassword === true`, they're forced to the change-password screen before accessing the dashboard
3. Admin creates other staff from Settings > Users

### Files to modify/create

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add Session, Verification, mustChangePassword, new AuditAction values |
| `prisma/migrations/` | Create — new migration |
| `prisma/seed.ts` | Modify — set `mustChangePassword: true` on seed user |
| `server/routes/users.ts` | Implement — `POST /api/users` (owner creates user) |

## Section 5: Session Lifecycle & Security

### Session management

- Better Auth creates session on sign-in, sets cookie, validates on every request
- Duration: 7-day max, 1-day rolling refresh (max expiry extends by 1 day per request, capped at 7 days from sign-in)
- Sign-out: Better Auth deletes session row + clears cookie
- Admin password reset: all sessions for that user are invalidated

### Security hardening

| Measure | Implementation |
|---------|---------------|
| Cookie flags | `httpOnly`, `secure` (prod), `sameSite=lax`, `path=/` |
| Rate limiting | Sign-in: 5 req/min per IP (override global 100/min) |
| Password policy | Min 8 chars, enforced in Zod schema |
| CSRF |Handled by `sameSite=lax` cookies — no CSRF token needed |
| Dev bypass | `AUTH_BYPASS=true` only when `NODE_ENV !== 'production'` |

### Audit trail

| Action | AuditAction | Trigger |
|--------|-------------|---------|
| Sign in | `USER_SIGN_IN` | Every successful login |
| Sign out | `USER_SIGN_OUT` | Explicit logout |
| User created | `USER_CREATED` | Owner creates staff member |
| Password reset | `PASSWORD_RESET` | Admin reset or self-service change |

### Files to modify/create

| File | Action |
|------|--------|
| `server/plugins/auth.ts` | Add rate limiting on auth routes, audit hooks |
| `server/middlewares/rate-limit.ts` | Create — tighter limits for auth endpoints |

## Out of Scope

- Email verification flow (Verification table created but not used yet)
- OAuth / social login
- Two-factor authentication
- Session management UI (list/revoke sessions)
- Password complexity beyond min-length