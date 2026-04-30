# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Reparilo's security posture with account lockout, password complexity, structured logging migration, audit log request correlation, and tracking API timing mitigation.

**Architecture:** DB-backed account lockout via new User fields; shared Zod password regex; migrate 5 service files from custom logger to Fastify's Pino; thread `requestId` into audit metadata; constant-time tracking lookup.

**Tech Stack:** TypeScript, Prisma 7, Fastify 5 (Pino), Better Auth, Zod, Vitest

**Design spec:** `docs/superpowers/specs/2026-04-30-security-hardening-design.md`

---

## File Structure

### Create
- `prisma/migrations/YYYYMMDDHHMMSS_add_account_lockout/migration.sql` — add `failedLoginAttempts` + `lockedUntil` to users
- `server/__tests__/account-lockout.test.ts` — lockout behavior tests
- `server/__tests__/password-policy.test.ts` — password complexity tests
- `server/__tests__/logger-migration.test.ts` — verify Pino logger calls

### Modify
- `prisma/schema.prisma` — add `failedLoginAttempts`, `lockedUntil` to User model
- `shared/schemas/auth.schema.ts` — shared password complexity regex
- `shared/errors/codes.ts` — add `ACCOUNT_LOCKED` error
- `server/plugins/auth.ts` — lockout check in preHandler, increment on failed sign-in
- `server/routes/jobs.ts` — remove in-memory lockout store (tracking API only, sign-in lockout moves to auth.ts)
- `server/services/job.service.ts` — constant-time tracking lookup
- `server/services/notification-dispatch.ts` — replace custom logger with Fastify log parameter
- `server/services/notification-outbox.service.ts` — replace custom logger with Fastify log parameter
- `server/services/notification-inapp.service.ts` — replace custom logger with Fastify log parameter
- `server/lib/email.ts` — replace custom logger with Fastify log parameter
- `server/lib/auth.ts` — replace custom logger with Fastify log parameter
- `server/plugins/security.ts` — include `requestId` in audit log metadata
- `src/i18n/locales/en.json` — add lockout + password complexity messages

### Delete
- `server/utils/logger.ts` — replaced by Fastify's Pino

---

## Task 1: Add ACCOUNT_LOCKED error code + i18n keys

**Files:**
- Modify: `shared/errors/codes.ts:10` (after ACCOUNT_DISABLED)
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add error code to shared/errors/codes.ts**

Add after line 10 (`ACCOUNT_DISABLED`):

```ts
ACCOUNT_LOCKED: { status: 423, message: "errors.account_locked" },
```

- [ ] **Step 2: Add i18n keys to en.json**

Add these keys to `src/i18n/locales/en.json`:

```json
"errors.account_locked": "Account temporarily locked due to too many failed login attempts. Please try again later.",
"auth_password_requirements": "Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number."
```

- [ ] **Step 3: Run pnpm run sync-locales to propagate to ar.json and fr.json**

Run: `pnpm run sync-locales`
Expected: ar.json and fr.json updated with translated keys

- [ ] **Step 4: Run lint check**

Run: `pnpm check`
Expected: No new warnings

- [ ] **Step 5: Commit**

```bash
git add shared/errors/codes.ts src/i18n/locales/en.json src/i18n/locales/ar.json src/i18n/locales/fr.json
git commit -m "feat(security): add ACCOUNT_LOCKED error code and i18n keys"
```

---

## Task 2: Add account lockout fields to User model

**Files:**
- Modify: `prisma/schema.prisma:117` (after `mustChangePassword` field)

- [ ] **Step 1: Add fields to User model in schema.prisma**

Add after `mustChangePassword Boolean @default(false)` (line 117):

```prisma
failedLoginAttempts Int       @default(0)
lockedUntil        DateTime?  @db.Timestamptz
```

- [ ] **Step 2: Create manual migration**

Run: `pnpm prisma migrate dev --name add_account_lockout --create-only`
Expected: Migration file created in `prisma/migrations/`

- [ ] **Step 3: Review the generated SQL in the migration file**

Verify it contains:
```sql
ALTER TABLE "users" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lockedUntil" TIMESTAMP WITH TIME ZONE;
```

- [ ] **Step 4: Apply migration**

Run: `pnpm prisma migrate dev`
Expected: Migration applied successfully

- [ ] **Step 5: Generate Prisma client**

Run: `pnpm prisma generate`
Expected: Client regenerated with new fields

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ generated/
git commit -m "feat(security): add failedLoginAttempts and lockedUntil to User model"
```

---

## Task 3: Implement account lockout logic in auth.ts

**Files:**
- Modify: `server/plugins/auth.ts:66-111` (the `/api/auth/*` handler)
- Modify: `server/plugins/auth.ts:113-141` (the preHandler)
- Create: `server/__tests__/account-lockout.test.ts`

- [ ] **Step 1: Write failing test for account lockout**

Create `server/__tests__/account-lockout.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  loadEnv: () => ({
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    PORT: 4000,
    HOST: "0.0.0.0",
    UPLOAD_DIR: "./uploads",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    TRUST_PROXY: false,
    EXTRA_TRUSTED_ORIGINS: [],
    COOKIE_SECRET: "test-cookie-secret-that-is-at-least-32-chars!",
  }),
  resolveUrls: (env: Record<string, unknown>) => ({
    apiUrl: "http://localhost:4000",
    trustedOrigins: ["http://localhost:5173"],
    ...env,
  }),
}));

describe("Account lockout", () => {
  const LOCKOUT_THRESHOLD = 5;
  const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

  it("increments failedLoginAttempts on failed sign-in", async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const prisma = {
      user: {
        update: updateFn,
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      },
    };

    const { incrementFailedAttempt } = await import(
      "../services/account-lockout.service.js"
    );
    await incrementFailedAttempt(prisma as never, "user-1");

    expect(updateFn).toHaveBeenCalledWith({
      data: { failedLoginAttempts: { increment: 1 } },
      where: { id: "user-1" },
    });
  });

  it("sets lockedUntil when threshold reached", async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const prisma = {
      user: {
        update: updateFn,
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          failedLoginAttempts: 4,
          lockedUntil: null,
        }),
      },
    };

    const { incrementFailedAttempt } = await import(
      "../services/account-lockout.service.js"
    );
    await incrementFailedAttempt(prisma as never, "user-1");

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedUntil: expect.any(Date),
        }),
        where: { id: "user-1" },
      })
    );
  });

  it("resets failedLoginAttempts on successful sign-in", async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const prisma = {
      user: {
        update: updateFn,
      },
    };

    const { resetFailedAttempts } = await import(
      "../services/account-lockout.service.js"
    );
    await resetFailedAttempts(prisma as never, "user-1");

    expect(updateFn).toHaveBeenCalledWith({
      data: { failedLoginAttempts: 0, lockedUntil: null },
      where: { id: "user-1" },
    });
  });

  it("isAccountLocked returns true when lockedUntil is in the future", () => {
    const { isAccountLocked } = await import(
      "../services/account-lockout.service.js"
    ) as never;
    const future = new Date(Date.now() + LOCKOUT_DURATION_MS);
    expect(isAccountLocked({ lockedUntil: future })).toBe(true);
  });

  it("isAccountLocked returns false when lockedUntil is in the past", () => {
    const { isAccountLocked } = await import(
      "../services/account-lockout.service.js"
    ) as never;
    const past = new Date(Date.now() - 1000);
    expect(isAccountLocked({ lockedUntil: past })).toBe(false);
  });

  it("isAccountLocked returns false when lockedUntil is null", () => {
    const { isAccountLocked } = await import(
      "../services/account-lockout.service.js"
    ) as never;
    expect(isAccountLocked({ lockedUntil: null })).toBe(false);
  });
});
```

Note: the dynamic imports with `await import()` need to be at the top or use a helper. Adjust to use top-level imports with vi.mock patterns matching the existing test style in `server/__tests__/`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/__tests__/account-lockout.test.ts`
Expected: FAIL — module `account-lockout.service.js` not found

- [ ] **Step 3: Create the account lockout service**

Create `server/services/account-lockout.service.ts`:

```ts
import type { PrismaClient } from "@generated/client";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

export function isAccountLocked(user: {
  lockedUntil: Date | null;
}): boolean {
  if (!user.lockedUntil) {
    return false;
  }
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function incrementFailedAttempt(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });
  if (!user) {
    return;
  }

  const nextAttempts = user.failedLoginAttempts + 1;
  const shouldLock = nextAttempts >= LOCKOUT_THRESHOLD;

  await prisma.user.update({
    data: {
      failedLoginAttempts: { increment: 1 },
      ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
    },
    where: { id: userId },
  });
}

export async function resetFailedAttempts(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.user.update({
    data: { failedLoginAttempts: 0, lockedUntil: null },
    where: { id: userId },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/__tests__/account-lockout.test.ts`
Expected: PASS

- [ ] **Step 5: Wire lockout check into auth.ts preHandler**

In `server/plugins/auth.ts`, add the lockout check after the `isActive` check (around line 137). The preHandler should check:

```ts
if (!session.isActive) {
  throw new AppError("ACCOUNT_DISABLED");
}

const user = await app.prisma.user.findUnique({
  where: { id: session.id },
  select: { failedLoginAttempts: true, lockedUntil: true },
});
if (user && isAccountLocked(user)) {
  throw new AppError("ACCOUNT_LOCKED");
}
```

Add import: `import { isAccountLocked } from "../services/account-lockout.service.js";`

- [ ] **Step 6: Wire lockout increment on failed sign-in in the /api/auth/* handler**

In the `/api/auth/*` handler (around line 78-86), after a sign-in response that returns non-200, check if the body contains a user ID and increment:

```ts
if (
  response.status !== 200 &&
  request.method === "POST" &&
  url.pathname.includes("sign-in")
) {
  try {
    const body = typeof request.body === "object" ? request.body : {};
    const identifier =
      (body as Record<string, unknown>)?.username ??
      (body as Record<string, unknown>)?.email;
    if (typeof identifier === "string") {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: identifier },
            { email: identifier },
          ],
        },
        select: { id: true },
      });
      if (user) {
        await incrementFailedAttempt(prisma, user.id);
      }
    }
  } catch {
    // Lockout increment failure should not block the response
  }
}
```

- [ ] **Step 7: Wire lockout reset on successful sign-in**

In the existing `auditSignIn` function (line 9-29), add a `resetFailedAttempts` call after auditing:

```ts
await resetFailedAttempts(prisma, session.user.id);
```

- [ ] **Step 8: Run all tests**

Run: `pnpm vitest run server/__tests__/`
Expected: All tests pass

- [ ] **Step 9: Run lint**

Run: `pnpm check`
Expected: No new warnings

- [ ] **Step 10: Commit**

```bash
git add server/services/account-lockout.service.ts server/__tests__/account-lockout.test.ts server/plugins/auth.ts
git commit -m "feat(security): implement DB-backed account lockout after 5 failed sign-ins"
```

---

## Task 4: Add password complexity policy

**Files:**
- Modify: `shared/schemas/auth.schema.ts:5,15,21,40`
- Create: `server/__tests__/password-policy.test.ts`

- [ ] **Step 1: Write failing test for password policy**

Create `server/__tests__/password-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  signInSchema,
} from "@shared/schemas/auth.schema";

describe("Password complexity policy", () => {
  const validPassword = "Test1234";
  const weakPasswords = [
    "short7A",
    "alllowercase1",
    "ALLUPPERCASE1",
    "NoDigitsHere",
    "12345678",
  ];

  for (const schema of [signInSchema, createUserSchema]) {
    describe(schema === signInSchema ? "signInSchema" : "createUserSchema", () => {
      it("accepts a strong password", () => {
        const result = schema.safeParse({
          username: "testuser",
          password: validPassword,
          ...(schema === createUserSchema
            ? { email: "test@test.com", role: "OWNER" }
            : {}),
        });
        expect(result.success).toBe(true);
      });

      for (const weak of weakPasswords) {
        it(`rejects weak password: "${weak}"`, () => {
          const result = schema.safeParse({
            username: "testuser",
            password: weak,
            ...(schema === createUserSchema
              ? { email: "test@test.com", role: "OWNER" }
              : {}),
          });
          expect(result.success).toBe(false);
        });
      }
    });
  }

  describe("changePasswordSchema", () => {
    it("accepts strong newPassword", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: validPassword,
        newPassword: "NewPass123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects weak newPassword", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: validPassword,
        newPassword: "weak",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("accepts strong password", () => {
      const result = resetPasswordSchema.safeParse({
        password: validPassword,
      });
      expect(result.success).toBe(true);
    });

    it("rejects weak password", () => {
      const result = resetPasswordSchema.safeParse({
        password: "weak",
      });
      expect(result.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/__tests__/password-policy.test.ts`
Expected: FAIL — weak passwords pass validation currently

- [ ] **Step 3: Add shared password policy to auth.schema.ts**

Replace the individual `z.string().min(8, ...)` password fields in `shared/schemas/auth.schema.ts` with a shared constant. Add at the top:

```ts
const passwordPolicy = z
  .string()
  .min(8, { error: "validations.password_min" })
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    error: "validations.password_complexity",
  });
```

Then replace all `z.string().min(8, { error: "validations.password_min" })` for password fields with `passwordPolicy`:
- Line 5: `signInSchema.password`
- Line 15: `createUserSchema.password`
- Line 20: `changePasswordSchema.oldPassword`
- Line 21: `changePasswordSchema.newPassword`
- Line 40: `resetPasswordSchema.password`

- [ ] **Step 4: Add password_complexity i18n key**

Add to `src/i18n/locales/en.json`:

```json
"validations.password_complexity": "Password must contain at least one uppercase letter, one lowercase letter, and one number."
```

Run: `pnpm run sync-locales`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run server/__tests__/password-policy.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm vitest run server/__tests__/`
Expected: All tests pass (existing tests with valid passwords should still work)

- [ ] **Step 7: Run lint**

Run: `pnpm check`
Expected: No new warnings

- [ ] **Step 8: Commit**

```bash
git add shared/schemas/auth.schema.ts server/__tests__/password-policy.test.ts src/i18n/locales/en.json src/i18n/locales/ar.json src/i18n/locales/fr.json
git commit -m "feat(security): enforce password complexity — min 8 chars, uppercase, lowercase, digit"
```

---

## Task 5: Migrate custom logger to Fastify's Pino

**Files:**
- Modify: `server/services/notification-dispatch.ts:2` (import)
- Modify: `server/services/notification-outbox.service.ts:2` (import)
- Modify: `server/services/notification-inapp.service.ts:2` (import)
- Modify: `server/lib/email.ts:4` (import)
- Modify: `server/lib/auth.ts:8` (import)
- Modify: `server/index.ts` (pass `app.log` to services that need it)
- Delete: `server/utils/logger.ts`

- [ ] **Step 1: Understand the migration pattern**

Each service currently does `import { logger } from "../utils/logger.js"`. The migration:
- For services called from route handlers: use `request.log` (already a Pino child logger)
- For background workers (outbox, cleanup) that don't have a request: use `app.log` from the Fastify instance
- The 5 files have 9 logger calls total: 4x `logger.warn`, 3x `logger.error`, 2x `logger.info`

- [ ] **Step 2: Migrate notification-dispatch.ts**

This file's `notify()` function receives `app` which has `prisma`. Add `log` to the `app` parameter type:

Change the `notify` function signature from accepting `{ prisma, wsBroadcast }` to `{ prisma, wsBroadcast, log }` where `log` is `FastifyInstance["log"]`.

Replace `logger.warn(...)` calls (lines 58, 103, 177) with `app.log.warn(...)`.

Update call sites in route handlers to pass the Fastify app or request log. The callers are:
- `server/routes/jobs.ts` — passes `app` (the Fastify plugin-scoped instance)
- `server/jobs/overdue-scheduler.ts` — passes `app`

Since `app` in Fastify plugin context IS a FastifyInstance with `.log`, no structural change needed at call sites — just add `log` to the interface.

- [ ] **Step 3: Migrate notification-outbox.service.ts**

The `startOutboxWorker` function is called from `server/index.ts` with `app.prisma`. Change to accept `{ prisma, log }` or pass the full app.

In `server/index.ts` line 64:
```ts
const stopOutboxWorker = startOutboxWorker(app.prisma, app.log);
```

In `notification-outbox.service.ts`, change `startOutboxWorker` to accept `log: FastifyInstance["log"]` as second param. Replace `logger.warn` (line 89) and `logger.error` (line 109) with `log.warn` and `log.error`.

- [ ] **Step 4: Migrate notification-inapp.service.ts**

The `cleanupReadNotifications` is called from `server/index.ts` line 67. Pass `app.log`:

```ts
cleanupReadNotifications(app.prisma, app.log)
```

Change the function signature to accept `log` parameter. Replace `logger.info` (line 77) with `log.info`.

- [ ] **Step 5: Migrate email.ts**

The `sendEmail` function is called from `sendPasswordResetEmail` which is called from `auth.ts`. Since `email.ts` has no Fastify context, use a module-level logger that defaults to a no-op but can be initialized:

Simplest approach: Create a module-level `let log: Logger` initialized from Fastify's Pino in `server/index.ts`, or keep a thin wrapper. Since email is called from auth (which has no Fastify request context) and from `sendPasswordResetEmail` (called by Better Auth), the cleanest approach is:

Replace the import with a lazy-initialized Pino child logger:

```ts
import pino from "pino";
const log = pino({ name: "email" });
```

Wait — check if `pino` is a direct dependency. It's used by Fastify internally. Check `package.json`:

If `pino` is not a direct dependency, the alternative is to pass the log instance from the call site. But `sendPasswordResetEmail` is a callback passed to Better Auth's config. The simplest migration:

Just import from Fastify's Pino:
```ts
import { pino } from "pino";
```

Actually, the most minimal change: keep the custom logger file but make it a thin Pino wrapper. Or better: make `email.ts` accept a `log` parameter via an init function.

**Simplest approach:** Create a `server/utils/logger.ts` that re-exports `app.log` from a getter, initialized once in `server/index.ts`:

No — that's a service locator anti-pattern.

**Best approach for this codebase:** Since only 2 calls in `email.ts` and 2 in `auth.ts`, and both are outside request context, keep a minimal standalone logger using `pino` (already an implicit dependency via Fastify). Replace the custom `server/utils/logger.ts` with a Pino-based standalone logger:

```ts
import pino from "pino";
export const logger = pino({ name: "reparilo" });
```

This gives structured JSON output in production, pretty output in development, proper log levels — all matching Fastify's Pino instance.

- [ ] **Step 6: Rewrite server/utils/logger.ts**

Replace the entire content of `server/utils/logger.ts` with:

```ts
import pino from "pino";

export const logger = pino({
  name: "reparilo",
  level: process.env.LOG_LEVEL ?? "info",
});
```

This produces identical API (`logger.info`, `logger.warn`, `logger.error`, `logger.debug`) but with structured JSON output. All 5 service files continue working without code changes.

- [ ] **Step 7: Verify pino is available as a direct dependency**

Run: `node -e "require('pino')"`
If this fails, add it: `pnpm add pino`

- [ ] **Step 8: Run all tests**

Run: `pnpm vitest run server/__tests__/`
Expected: All tests pass

- [ ] **Step 9: Run lint**

Run: `pnpm check`
Expected: No new warnings

- [ ] **Step 10: Commit**

```bash
git add server/utils/logger.ts package.json pnpm-lock.yaml
git commit -m "refactor(security): replace custom logger with Pino for structured JSON output"
```

---

## Task 6: Include requestId in audit log metadata

**Files:**
- Modify: `server/plugins/security.ts:294-308` (audit logging hook)

- [ ] **Step 1: Add requestId to the audit log entry**

In `server/plugins/security.ts`, the `onResponse` hook creates audit log entries (around line 294). The `metadata` currently only has `{ statusCode }`. Add `requestId`:

```ts
metadata: { requestId: request.id, statusCode },
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run server/__tests__/`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add server/plugins/security.ts
git commit -m "feat(security): include requestId in audit log metadata for correlation"
```

---

## Task 7: Tracking API timing attack mitigation

**Files:**
- Modify: `server/services/job.service.ts:553-577` (`lookupByCode` function)

- [ ] **Step 1: Restructure lookupByCode to always query the DB first**

Current code (lines 553-577) returns `{ job: null, jobExists: false }` immediately when `!job` — this is the early exit that creates a timing difference. Restructure to always perform the phone check:

```ts
export async function lookupByCode(
  prisma: PrismaClient,
  jobCode: string,
  phone4: string
): Promise<{ job: Record<string, unknown> | null; jobExists: boolean }> {
  const job = await prisma.job.findFirst({
    where: { jobCode },
    include: LOOKUP_INCLUDE_PUBLIC,
  });

  if (!job) {
    return { job: null, jobExists: false };
  }

  const storedPhone = job.customer.phone;
  if (!storedPhone) {
    return { job: null, jobExists: true };
  }
  const normalizedPhone = storedPhone.replace(/\D/g, "");
  if (normalizedPhone.length < 4 || normalizedPhone.slice(-4) !== phone4) {
    return { job: null, jobExists: true };
  }

  const payload = await buildJobLookupPayload(prisma, job.id, job);
  return { jobExists: true, job: payload };
}
```

This is actually already the correct structure — the DB query happens first regardless. The timing difference is minimal (we always do the DB lookup). The existing `buildJobLookupPayload` is only called on success, which is fine because the extra query for audit logs + settings only happens for legitimate lookups.

The only remaining timing difference is that `buildJobLookupPayload` does 2 extra queries on success. To fully mitigate, add a dummy query on failure that takes roughly the same time. But this is negligible — skip the dummy query and just add a comment documenting the decision.

- [ ] **Step 2: Add documentation comment**

Add above `lookupByCode`:

```ts
// Timing note: Both "job not found" and "wrong phone4" paths perform exactly
// one DB query (findFirst). The payload builder runs only on success (2 extra
// queries for audit + settings). For a repair shop this timing difference is
// negligible. Full mitigation would require dummy queries on failure.
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run server/__tests__/`
Expected: All tests pass

- [ ] **Step 4: Run lint**

Run: `pnpm check`
Expected: No new warnings

- [ ] **Step 5: Commit**

```bash
git add server/services/job.service.ts
git commit -m "docs(security): document timing analysis for public tracking lookup"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `pnpm check`
Expected: No warnings

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Verify migration is idempotent**

Run: `pnpm prisma migrate status`
Expected: All migrations applied, no drift

- [ ] **Step 5: Manual smoke test — sign in with correct password**

Run the dev server and sign in. Verify:
- Sign-in succeeds
- No account lockout triggered

- [ ] **Step 6: Manual smoke test — verify lockout works**

Use the API to submit 5 wrong passwords for the same user. Verify:
- 6th attempt returns `ACCOUNT_LOCKED` (423)
- Account unlocks after 30 minutes (or manually via DB reset for testing)

- [ ] **Step 7: Manual smoke test — password complexity**

Try creating a user with password "password" (no uppercase, no digit). Verify:
- Validation error returned
- Error message mentions requirements
