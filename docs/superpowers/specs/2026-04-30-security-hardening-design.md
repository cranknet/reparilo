# Security Hardening — Minimal Production Hardening

**Date**: 2026-04-30 | **Approach**: A (Minimal Production Hardening) | **Deployment**: Single-server VPS

## Summary

Full security pass for a single-location repair shop (1-10 concurrent users). Addresses practical threats: credential stuffing, weak passwords, file upload abuse, operational blind spots. Skips 2FA/MFA (unnecessary for small team on trusted network) and multi-instance stores (single server).

## Scope

| Area | Priority | Effort |
|------|----------|--------|
| Account lockout | P0 | S |
| Password complexity | P0 | S |
| Session management (list/revoke) | P1 | M |
| File upload hardening | P0 | M |
| Structured logging (Pino) | P1 | M |
| Request ID correlation | P2 | S |
| Tracking API timing fix | P2 | S |

## Section 1: Account Lockout & Password Policy

### Account Lockout

**Problem:** Sign-in has per-identifier rate limiting (5 req/5 min) but no account lockout. An attacker can resume credential stuffing after the rate limit window resets.

**Solution:**
- Add `failedLoginAttempts Int @default(0)` and `lockedUntil DateTime? @db.Timestamptz` to User model
- After 5 consecutive failed sign-in attempts, set `lockedUntil = now() + 30 minutes`
- Successful login resets `failedLoginAttempts` to 0 and clears `lockedUntil`
- Check in `auth.ts` preHandler: if `lockedUntil > now()`, throw `ACCOUNT_LOCKED`
- OWNER-admins can unlock via the existing user status endpoint (set `lockedUntil = null, failedLoginAttempts = 0`)
- Separate from the existing `banned`/`banReason` fields (admin-initiated bans vs auto-lockout)

**Files changed:**
- `prisma/schema.prisma` — add fields + migration
- `server/plugins/auth.ts` — check lockout in preHandler, increment on failure
- `server/routes/users.ts` — admin unlock endpoint
- `shared/errors/codes.ts` — add `ACCOUNT_LOCKED` error code
- `src/i18n/locales/en.json` — add lockout messages

### Password Complexity

**Problem:** `z.string().min(8)` only enforces length. No complexity requirements.

**Solution:**
- Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
- Create a shared `passwordPolicy` helper in `shared/schemas/auth.schema.ts`:
  ```
  z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  ```
- Reference from `createUserSchema`, `changePasswordSchema`, `resetPasswordSchema`, `signInSchema`
- Extend frontend error message to describe requirements
- No change to Better Auth hashing (Argon2id already in use)

**Files changed:**
- `shared/schemas/auth.schema.ts` — shared password regex
- `src/i18n/locales/en.json` — extended password message
- Frontend auth pages — update validation display

## Section 2: Session Management

**Problem:** No endpoint to list or revoke sessions. If a device is compromised or a user forgets to sign out, there's no recovery path.

**Solution:**
- **GET `/api/auth/sessions`** — list current user's active sessions (id, ipAddress, userAgent, createdAt, expiresAt, isCurrent). Exclude token values.
- **DELETE `/api/auth/sessions/:id`** — revoke a specific session. User can only revoke their own. OWNER can revoke any user's session.
- **DELETE `/api/auth/sessions`** — "sign out everywhere" — revoke all sessions except current
- Add routes to `route-security.ts` with rate limit 10 req/min
- Frontend: Add "Active Sessions" section to Profile page with revoke buttons
- Extend existing admin session listing in `users.ts` rather than duplicate

**Files changed:**
- `server/plugins/auth.ts` — add session management routes
- `server/config/route-security.ts` — rate limit config
- `src/pages/profile/` — sessions UI section
- `src/i18n/locales/en.json` — session management messages

**Session config:** No changes — 7-day expiry with 1-day rolling update is appropriate.

## Section 3: File Upload Hardening

**Problem:** Only a 5MB size limit. No MIME validation, no magic byte check, user-provided filenames stored on disk.

**Solution:**
- **MIME whitelist:** `image/jpeg`, `image/png`, `image/webp`, `image/heic` for job photos and avatars
- **Magic byte check:** Read first 8 bytes, verify against known magic bytes:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47`
  - WebP: `52 49 46 46 ... 57 45 42 50`
  - HEIC: varies (ftyp box with `heic`/`mif1`)
- **Filename sanitization:** Generate server-side filenames: `crypto.randomUUID() + validatedExtension`. Never use user-provided filenames on disk.
- **Upload size in config:** Move 5MB limit to `route-security.ts` for visibility
- **Path traversal:** Already safe — `UPLOAD_DIR` defaults to `./uploads`

**Files changed:**
- `server/services/job-photos.service.ts` — MIME + magic byte validation, filename sanitization
- `server/services/avatar.service.ts` — same
- `server/config/route-security.ts` — upload size config
- `shared/errors/codes.ts` — add `INVALID_FILE_TYPE` error code

## Section 4: Structured Logging & Request Tracing

### Structured Logging

**Problem:** Custom console-based logger (`server/utils/logger.ts`). No structured output, no proper level control.

**Solution:**
- Remove `server/utils/logger.ts`
- Use Fastify's built-in Pino logger (already configured in `server/index.ts` with `logger: { level: env.LOG_LEVEL }`)
- Update 6 service files that import the custom logger to accept a `log` parameter or use the Fastify request's `app.log`:
  - `notification-outbox.service.ts`
  - `notification-inapp.service.ts`
  - `notification-dispatch.ts`
  - `email.ts`
  - `auth.ts`
- Pino produces structured JSON in production, `pino-pretty` in development
- Log rotation: OS-level `logrotate` (document in deployment)

### Request ID Correlation

**Solution:**
- Use Fastify's built-in `requestIdHeader` config (set to `"X-Request-Id"`)
- Generate UUID per request, attach to `request.id`
- Include `requestId` in Pino log entries via serializers
- Send `X-Request-Id` in response headers (already in CORS `exposedHeaders`)
- Include `requestId` in audit log `metadata` field

**Files changed:**
- `server/utils/logger.ts` — DELETE
- `server/index.ts` — enable `requestIdHeader`, add Pino serializers
- `server/plugins/security.ts` — add `X-Request-Id` response header hook
- `server/plugins/security.ts` — include `requestId` in audit log
- 6 service files — switch from custom logger to Fastify's `app.log`

## Section 5: Tracking API Security

**Confirmed safe:**
- `LOOKUP_INCLUDE_PUBLIC` selects `customer.phone` for verification but `buildJobLookupPayload` does NOT return it — only `customer.name`
- Input validation is solid (`JOB_CODE_RE`, `PHONE4_RE`)
- Rate limiting fires correctly via `@fastify/rate-limit` config
- No SQL injection risk (Prisma parameterizes)

**Timing attack mitigation:**
- Current: "job not found" returns immediately without DB hit; "wrong phone4" hits DB first
- Fix: always perform the DB lookup, then check phone4. Both code paths take roughly the same time.
- Low priority — negligible risk for a repair shop, but trivial to fix.

**Files changed:**
- `server/services/job.service.ts` — `lookupByCode`: restructure to always query DB first
