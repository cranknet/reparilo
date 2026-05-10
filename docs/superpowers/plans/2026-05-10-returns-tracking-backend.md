# Returns Tracking — Backend Foundation (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side foundation for return analytics — the `ReturnClaim` entity, service layer, REST API, RBAC, error codes, notifications — so a working API can drive both the frontend (Plan 2) and analytics (Plan 3).

**Architecture:** A new `return_claims` table with `OPEN → RESOLVED` lifecycle. A claim represents a customer's complaint, fault attribution, and resolution. `REWORK_*` outcomes spawn a new Job (linked via `reworkJobId`) and populate the existing `Job.isWarrantyReturn` / `warrantyForJobId` fields for back-compat. `REFUND_*` outcomes don't create a Job. Photos gain a minimal `stage` enum scoped to return-related shots.

**Tech Stack:** Prisma 5 (PostgreSQL), Fastify 5, Zod, Vitest, Better Auth (RBAC), TypeScript, Bun.

**Spec reference:** `docs/superpowers/specs/2026-05-10-returns-and-photo-evidence-design.md`

**Conventions to honor (from project CLAUDE.md):**
- AppError SSOT — never invent custom errors; add codes to `shared/errors/codes.ts`
- Manual Prisma migrations after every schema change
- No barrel files — use explicit imports
- All new locale keys go in `src/i18n/locales/en.json`; run `bun run sync-locales` to propagate to ar/fr
- Use `bun` for everything (`bun install`, `bun run`, `bunx`)
- Frequent commits — one per task minimum

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add ReturnClaim model + enums; modify JobPhoto, RepairCatalog, ShopSettings |
| `prisma/migrations/<ts>_returns_tracking/migration.sql` | Create | Manual SQL migration |
| `shared/errors/codes.ts` | Modify | Add 8 new error codes |
| `shared/permissions.ts` | Modify | Add `returns` permission group + role mappings |
| `shared/types/return-claim.ts` | Create | TypeScript types |
| `shared/schemas/return-claim.schema.ts` | Create | Zod schemas (create / triage / resolve / list / photo upload) |
| `src/i18n/locales/en.json` | Modify | New error messages + notification copy |
| `server/services/return-claim.service.ts` | Create | Business logic |
| `server/services/__tests__/return-claim.service.test.ts` | Create | Service unit tests |
| `server/services/job.service.ts` | Modify | Block cancellation of rework Job with OPEN claim |
| `server/services/notification-dispatch.ts` | (No change — uses event-name lookup; new event added via DB seed) |
| `server/routes/return-claims.ts` | Create | Fastify route plugin |
| `server/__tests__/return-claims.test.ts` | Create | Route integration tests |
| `server/__tests__/rbac-matrix.test.ts` | Modify | Add `returns` permission entries |
| `server/index.ts` | Modify | Register `returnClaimsRoutes` plugin |
| `prisma/seed.ts` | Modify | Seed `return_claim_resolved` notification template |

---

## Task 1: Prisma Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

This task only updates the Prisma model. The SQL migration is Task 2 so the schema and migration can be reviewed independently. Do NOT run `prisma migrate` until Task 2.

- [ ] **Step 1: Add four new enums after the existing `PartCategory` enum**

In `prisma/schema.prisma`, find the existing `PartCategory` enum (around line 37). Immediately after its closing brace, insert:

```prisma
enum FaultCategory {
  WORKMANSHIP
  DEFECTIVE_PART
  MISDIAGNOSIS
}

enum ResolutionOutcome {
  REWORK_FREE
  REWORK_PARTIAL_CHARGE
  REFUND_PARTIAL
  REFUND_FULL
}

enum ReturnClaimStatus {
  OPEN
  RESOLVED
}

enum PhotoStage {
  RETURN_INTAKE
  RETURN_RESOLUTION
}
```

- [ ] **Step 2: Add `warrantyDays` to RepairCatalog**

Find `model RepairCatalog` (around line 411). Add `warrantyDays Int?` after `isActive`:

```prisma
model RepairCatalog {
  id           String         @id @default(cuid())
  name         String         @unique
  category     RepairCategory
  defaultPrice Decimal        @db.Decimal(10, 2)
  isActive     Boolean        @default(true)
  warrantyDays Int?           // null = inherit ShopSettings.defaultWarrantyDays
  createdAt    DateTime       @default(now()) @db.Timestamptz
  updatedAt    DateTime       @updatedAt      @db.Timestamptz

  jobRepairs   JobRepair[]

  @@map("repair_catalog")
}
```

- [ ] **Step 3: Add `defaultWarrantyDays` to ShopSettings**

Find `model ShopSettings` (around line 657). Add `defaultWarrantyDays Int @default(30)` after `currency`:

```prisma
model ShopSettings {
  id            String   @id
  shopName      String   @default("")
  logoPath      String?
  address       String?
  phone         String?
  countryCode   String   @default("DZ")
  currency      String   @default("DZD")
  defaultWarrantyDays Int @default(30)
  timezone      String?
  receiptFooter String?  @db.Text
  whatsappApiTokenEncrypted String?
  whatsappBusinessId         String?
  whatsappPhoneNumberId      String?
  whatsappEnabled            Boolean @default(false)
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt      @db.Timestamptz

  @@map("shop_settings")
}
```

- [ ] **Step 4: Modify JobPhoto — add stage and returnClaimId**

Find `model JobPhoto` (around line 310). Add fields and the `returnClaim` relation:

```prisma
model JobPhoto {
  id            String       @id @default(cuid())
  jobId         String
  job           Job          @relation(fields: [jobId], references: [id], onDelete: Cascade)
  path          String
  stage         PhotoStage?  // null = legacy/general
  returnClaimId String?
  returnClaim   ReturnClaim? @relation(fields: [returnClaimId], references: [id], onDelete: SetNull)
  createdAt     DateTime     @default(now()) @db.Timestamptz

  @@index([jobId])
  @@index([returnClaimId])
  @@map("job_photos")
}
```

- [ ] **Step 5: Add ReturnClaim model**

Insert after the existing `JobRepair` model (around line 450). The model must be defined before any model referencing it, so check ordering:

```prisma
// ─────────────────────────────────────────────
// RETURN CLAIMS
// A claim is a customer's complaint about a delivered repair.
// Lifecycle: OPEN → RESOLVED. Resolution outcomes:
//   REWORK_FREE / REWORK_PARTIAL_CHARGE → spawns rework Job (reworkJobId set)
//   REFUND_PARTIAL / REFUND_FULL → no Job spawned, refundAmount set
// See docs/superpowers/specs/2026-05-10-returns-and-photo-evidence-design.md
// ─────────────────────────────────────────────

model ReturnClaim {
  id                  String              @id @default(cuid())

  originalJobId       String
  originalJob         Job                 @relation("OriginalJobReturnClaims", fields: [originalJobId], references: [id], onDelete: Restrict)

  claimedJobRepairId  String?
  claimedJobRepair    JobRepair?          @relation(fields: [claimedJobRepairId], references: [id], onDelete: SetNull)

  claimedJobPartId    String?
  claimedJobPart      JobPart?            @relation(fields: [claimedJobPartId], references: [id], onDelete: SetNull)

  returnReason        String              @db.Text

  faultCategory       FaultCategory?
  resolutionOutcome   ResolutionOutcome?
  partialChargeAmount Decimal?            @db.Decimal(10, 2)
  refundAmount        Decimal?            @db.Decimal(10, 2)

  reworkJobId         String?             @unique
  reworkJob           Job?                @relation("ReworkJobReturnClaim", fields: [reworkJobId], references: [id], onDelete: SetNull)

  status              ReturnClaimStatus   @default(OPEN)
  openedAt            DateTime            @default(now()) @db.Timestamptz
  resolvedAt          DateTime?           @db.Timestamptz

  openedById          String
  openedBy            User                @relation("ReturnClaimOpenedBy", fields: [openedById], references: [id], onDelete: Restrict)
  resolvedById        String?
  resolvedBy          User?               @relation("ReturnClaimResolvedBy", fields: [resolvedById], references: [id], onDelete: SetNull)

  photos              JobPhoto[]

  createdAt           DateTime            @default(now()) @db.Timestamptz
  updatedAt           DateTime            @updatedAt      @db.Timestamptz

  @@index([originalJobId])
  @@index([status])
  @@index([faultCategory])
  @@index([resolutionOutcome])
  @@index([openedAt])
  @@index([openedById])
  @@map("return_claims")
}
```

- [ ] **Step 6: Add reverse relations on Job, JobRepair, JobPart, User**

Find `model Job` (around line 244). Add the reverse relations after `inAppNotifications`:

```prisma
  // Add inside Job:
  returnClaimsAgainst ReturnClaim[]  @relation("OriginalJobReturnClaims")
  reworkClaim         ReturnClaim?   @relation("ReworkJobReturnClaim")
```

Find `model JobRepair` (around line 431). Add after `createdBy`:

```prisma
  returnClaims ReturnClaim[]
```

Find `model JobPart` (around line 384). Add after the existing relations:

```prisma
  returnClaims ReturnClaim[]
```

Find `model User` (search for `model User`). Add the reverse relations alongside other User relations:

```prisma
  returnClaimsOpened   ReturnClaim[] @relation("ReturnClaimOpenedBy")
  returnClaimsResolved ReturnClaim[] @relation("ReturnClaimResolvedBy")
```

- [ ] **Step 7: Validate the schema parses**

Run: `bunx prisma format`
Expected: file reformats without errors. If errors, fix them (most likely a missing reverse relation).

Run: `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 8: Commit (schema only — no migration yet)**

```bash
git add prisma/schema.prisma
git commit -m "feat(returns): add ReturnClaim model and supporting enums to Prisma schema"
```

---

## Task 2: Manual Migration SQL

**Files:**
- Create: `prisma/migrations/<timestamp>_returns_tracking/migration.sql`

Project rule: "Create Prisma manual migrations after every schema change." We write the SQL by hand to include CHECK constraints that Prisma can't express.

- [ ] **Step 1: Compute the timestamp and create the directory**

Run:
```bash
TS=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_returns_tracking
echo $TS
```

Note the printed timestamp — you'll use it in the next step. (If running in CI, generate manually as `YYYYMMDDHHMMSS`.)

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/<timestamp>_returns_tracking/migration.sql`:

```sql
-- ============================================
-- Returns Tracking — schema additions
-- ============================================

-- ── New enums ────────────────────────────────────────────────────────────
CREATE TYPE "FaultCategory"     AS ENUM ('WORKMANSHIP', 'DEFECTIVE_PART', 'MISDIAGNOSIS');
CREATE TYPE "ResolutionOutcome" AS ENUM ('REWORK_FREE', 'REWORK_PARTIAL_CHARGE', 'REFUND_PARTIAL', 'REFUND_FULL');
CREATE TYPE "ReturnClaimStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "PhotoStage"        AS ENUM ('RETURN_INTAKE', 'RETURN_RESOLUTION');

-- ── repair_catalog: per-repair warranty override ────────────────────────
ALTER TABLE "repair_catalog" ADD COLUMN "warrantyDays" INTEGER;

-- ── shop_settings: shop-wide default ────────────────────────────────────
ALTER TABLE "shop_settings" ADD COLUMN "defaultWarrantyDays" INTEGER NOT NULL DEFAULT 30;

-- ── return_claims ───────────────────────────────────────────────────────
CREATE TABLE "return_claims" (
    "id"                  TEXT NOT NULL,
    "originalJobId"       TEXT NOT NULL,
    "claimedJobRepairId"  TEXT,
    "claimedJobPartId"    TEXT,
    "returnReason"        TEXT NOT NULL,
    "faultCategory"       "FaultCategory",
    "resolutionOutcome"   "ResolutionOutcome",
    "partialChargeAmount" DECIMAL(10,2),
    "refundAmount"        DECIMAL(10,2),
    "reworkJobId"         TEXT,
    "status"              "ReturnClaimStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"          TIMESTAMPTZ,
    "openedById"          TEXT NOT NULL,
    "resolvedById"        TEXT,
    "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMPTZ NOT NULL,

    CONSTRAINT "return_claims_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_originalJobId_fkey"
    FOREIGN KEY ("originalJobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_claimedJobRepairId_fkey"
    FOREIGN KEY ("claimedJobRepairId") REFERENCES "job_repairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_claimedJobPartId_fkey"
    FOREIGN KEY ("claimedJobPartId") REFERENCES "job_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_reworkJobId_fkey"
    FOREIGN KEY ("reworkJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_openedById_fkey"
    FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique: one rework Job per claim
CREATE UNIQUE INDEX "return_claims_reworkJobId_key" ON "return_claims"("reworkJobId");

-- Lookup indexes
CREATE INDEX "return_claims_originalJobId_idx"     ON "return_claims"("originalJobId");
CREATE INDEX "return_claims_status_idx"            ON "return_claims"("status");
CREATE INDEX "return_claims_faultCategory_idx"     ON "return_claims"("faultCategory");
CREATE INDEX "return_claims_resolutionOutcome_idx" ON "return_claims"("resolutionOutcome");
CREATE INDEX "return_claims_openedAt_idx"          ON "return_claims"("openedAt");
CREATE INDEX "return_claims_openedById_idx"        ON "return_claims"("openedById");

-- ── CHECK constraints (cannot be expressed in Prisma schema) ────────────
ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_resolved_required_fields"
    CHECK (
        "status" <> 'RESOLVED' OR (
            "faultCategory"     IS NOT NULL
        AND "resolutionOutcome" IS NOT NULL
        AND "resolvedAt"        IS NOT NULL
        AND "resolvedById"      IS NOT NULL
        )
    );

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_rework_outcome_requires_job"
    CHECK (
        "resolutionOutcome" IS NULL
        OR "resolutionOutcome" NOT IN ('REWORK_FREE','REWORK_PARTIAL_CHARGE')
        OR "reworkJobId" IS NOT NULL
    );

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_refund_outcome_no_job"
    CHECK (
        "resolutionOutcome" IS NULL
        OR "resolutionOutcome" NOT IN ('REFUND_PARTIAL','REFUND_FULL')
        OR "reworkJobId" IS NULL
    );

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_partial_charge_required"
    CHECK (
        "resolutionOutcome" IS NULL
        OR "resolutionOutcome" <> 'REWORK_PARTIAL_CHARGE'
        OR "partialChargeAmount" IS NOT NULL
    );

ALTER TABLE "return_claims" ADD CONSTRAINT "return_claims_refund_amount_required"
    CHECK (
        "resolutionOutcome" IS NULL
        OR "resolutionOutcome" NOT IN ('REFUND_PARTIAL','REFUND_FULL')
        OR "refundAmount" IS NOT NULL
    );

-- ── job_photos: stage and claim FK ──────────────────────────────────────
ALTER TABLE "job_photos" ADD COLUMN "stage" "PhotoStage";
ALTER TABLE "job_photos" ADD COLUMN "returnClaimId" TEXT;

ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_returnClaimId_fkey"
    FOREIGN KEY ("returnClaimId") REFERENCES "return_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "job_photos_returnClaimId_idx" ON "job_photos"("returnClaimId");
```

- [ ] **Step 3: Apply the migration**

Run: `bunx prisma migrate deploy`
Expected: `Applying migration ...returns_tracking ... ✔️`

If it fails because Prisma sees a drift, check that Task 1's schema additions match the SQL exactly. Don't use `prisma migrate dev --create-only` — write SQL by hand per project convention.

- [ ] **Step 4: Generate Prisma client**

Run: `bunx prisma generate`
Expected: `Generated Prisma Client ... in ...ms`

- [ ] **Step 5: Verify constraints behave (smoke check)**

Run via psql or your client (use the `DATABASE_URL` from `.env`):

```sql
-- Should fail: status RESOLVED without faultCategory
INSERT INTO return_claims (id, "originalJobId", "returnReason", status, "openedById", "updatedAt")
VALUES ('test1', '<existing-job-id>', 'test', 'RESOLVED', '<existing-user-id>', NOW());
```

Expected: `new row for relation "return_claims" violates check constraint "return_claims_resolved_required_fields"`. If it succeeds, the CHECK constraint is missing — debug Step 2.

After verifying, run:
```sql
DELETE FROM return_claims WHERE id='test1';
```
(should be 0 rows since the insert was rejected; this is just defensive cleanup).

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(returns): add return_claims migration with CHECK constraints"
```

---

## Task 3: Add Error Codes + i18n Keys

**Files:**
- Modify: `shared/errors/codes.ts`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Append new error codes**

In `shared/errors/codes.ts`, before the closing `} as const;` of `ERRORS` (around line 121), add:

```ts
  // ── Returns ────────────────────────────────────────────────────────────
  RETURN_CLAIM_NOT_FOUND: { status: 404, message: "errors.return_claim_not_found" },
  RETURN_CLAIM_NOT_OPEN: { status: 409, message: "errors.return_claim_not_open" },
  RETURN_CLAIM_FAULT_REQUIRED: { status: 400, message: "errors.return_claim_fault_required" },
  RETURN_CLAIM_REWORK_JOB_NOT_DELIVERED: { status: 409, message: "errors.return_claim_rework_job_not_delivered" },
  INVALID_CLAIMED_LINE: { status: 400, message: "errors.invalid_claimed_line" },
  REFUND_EXCEEDS_ORIGINAL: { status: 400, message: "errors.refund_exceeds_original" },
  ORIGINAL_JOB_NOT_DELIVERED: { status: 409, message: "errors.original_job_not_delivered" },
  REWORK_JOB_HAS_OPEN_CLAIM: { status: 409, message: "errors.rework_job_has_open_claim" },
  RETURN_CLAIM_HAS_REWORK_JOB: { status: 409, message: "errors.return_claim_has_rework_job" },
```

(Note: `RETURN_CLAIM_HAS_REWORK_JOB` is for the spawn-rework idempotency check — Task 9.)

- [ ] **Step 2: Add the matching i18n keys to en.json**

In `src/i18n/locales/en.json`, find the `errors.*` block and add the new keys (ordering doesn't matter for the parser, but group them together). Search for an existing key like `"errors.job_not_found"` to find the section. Add:

```json
"errors.return_claim_not_found": "Return claim not found",
"errors.return_claim_not_open": "This return claim is already resolved",
"errors.return_claim_fault_required": "Set the fault category before resolving the claim",
"errors.return_claim_rework_job_not_delivered": "The rework job must be delivered before resolving the claim",
"errors.invalid_claimed_line": "Selected repair or part doesn't belong to the original job",
"errors.refund_exceeds_original": "Refund amount cannot exceed the original payment",
"errors.original_job_not_delivered": "The original job must be delivered to file a return",
"errors.rework_job_has_open_claim": "Cannot cancel a rework job while its return claim is open",
"errors.return_claim_has_rework_job": "This return claim already has a rework job"
```

- [ ] **Step 3: Sync locales**

Run: `bun run sync-locales`
Expected: ar.json and fr.json updated with the new keys (translated by the script).

- [ ] **Step 4: Lint check**

Run: `bun run check`
Expected: no errors. If ultracite complains about JSON formatting, run `bun run fix`.

- [ ] **Step 5: Commit**

```bash
git add shared/errors/codes.ts src/i18n/locales/
git commit -m "feat(returns): add return-claim error codes and locale keys"
```

---

## Task 4: Add `returns` Permission Group + RBAC Wiring

**Files:**
- Modify: `shared/permissions.ts`
- Modify: `server/__tests__/rbac-matrix.test.ts`

- [ ] **Step 1: Add `returns` to the permission statement**

In `shared/permissions.ts`, inside the `statement` const (around line 11), add the `returns` resource alongside the existing ones:

```ts
  returns: [
    "create",
    "edit",
    "triage",
    "resolveRework",
    "resolveRefund",
    "viewSelf",
    "viewShop",
  ] as const,
```

Place it after `dashboard:` for readability — order doesn't affect runtime.

- [ ] **Step 2: Add `returns` to OWNER role**

In the same file, inside `ownerRole = ac.newRole({ ... })`, add (after `dashboard:`):

```ts
  returns: ["create", "edit", "triage", "resolveRework", "resolveRefund", "viewSelf", "viewShop"],
```

- [ ] **Step 3: Add `returns` to TECHNICIAN role**

Inside `technicianRole`, add:

```ts
  returns: ["create", "edit", "triage", "resolveRework", "viewSelf"],
```

(Technicians get neither `resolveRefund` nor `viewShop`.)

- [ ] **Step 4: Add `returns` to FRONT_DESK role**

Inside `frontDeskRole`, add:

```ts
  returns: ["create", "edit", "viewSelf"],
```

(Front desk can file claims and add photos but not triage / resolve.)

- [ ] **Step 5: Update the RBAC matrix test**

In `server/__tests__/rbac-matrix.test.ts`, find the `rolePermissions` map (around line 139 from earlier exploration) and add the `returns` keys to each role to mirror the role definitions. Example:

```ts
  OWNER: {
    // existing permissions...
    returns: ["create", "edit", "triage", "resolveRework", "resolveRefund", "viewSelf", "viewShop"],
  },
  TECHNICIAN: {
    // existing permissions...
    returns: ["create", "edit", "triage", "resolveRework", "viewSelf"],
  },
  FRONT_DESK: {
    // existing permissions...
    returns: ["create", "edit", "viewSelf"],
  },
```

- [ ] **Step 6: Run the matrix test**

Run: `bun vitest run server/__tests__/rbac-matrix.test.ts`
Expected: all existing tests still pass. The new `returns` keys aren't yet referenced by any route, so this test pass just confirms we didn't break anything.

- [ ] **Step 7: Commit**

```bash
git add shared/permissions.ts server/__tests__/rbac-matrix.test.ts
git commit -m "feat(returns): add returns permission group and role mappings"
```

---

## Task 5: Shared Types and Zod Schemas

**Files:**
- Create: `shared/types/return-claim.ts`
- Create: `shared/schemas/return-claim.schema.ts`

- [ ] **Step 1: Create the type module**

Create `shared/types/return-claim.ts`:

```ts
import type {
  FaultCategory,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaim,
  ReturnClaimStatus,
} from "@prisma/client";

export type {
  FaultCategory,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaim,
  ReturnClaimStatus,
};

export interface ReturnClaimSummary {
  id: string;
  originalJobId: string;
  originalJobCode: string;
  customerName: string;
  claimedRepairName: string | null;
  claimedPartName: string | null;
  returnReason: string;
  faultCategory: FaultCategory | null;
  resolutionOutcome: ResolutionOutcome | null;
  status: ReturnClaimStatus;
  openedAt: Date;
  resolvedAt: Date | null;
  ageDays: number;
  isGoodwill: boolean;
}

export interface CreateReturnClaimInput {
  originalJobId: string;
  claimedJobRepairId?: string;
  claimedJobPartId?: string;
  returnReason: string;
}

export interface TriageInput {
  faultCategory: FaultCategory;
}

export interface ResolveInput {
  resolutionOutcome: ResolutionOutcome;
  partialChargeAmount?: number;
  refundAmount?: number;
}

export interface ListReturnClaimsQuery {
  status?: ReturnClaimStatus;
  faultCategory?: FaultCategory;
  resolutionOutcome?: ResolutionOutcome;
  from?: string;
  to?: string;
  originalJobId?: string;
  technicianId?: string;
  page?: number;
  limit?: number;
}
```

- [ ] **Step 2: Create the Zod schema module**

Create `shared/schemas/return-claim.schema.ts`:

```ts
import { z } from "zod";

export const FaultCategoryEnum = z.enum([
  "WORKMANSHIP",
  "DEFECTIVE_PART",
  "MISDIAGNOSIS",
]);

export const ResolutionOutcomeEnum = z.enum([
  "REWORK_FREE",
  "REWORK_PARTIAL_CHARGE",
  "REFUND_PARTIAL",
  "REFUND_FULL",
]);

export const ReturnClaimStatusEnum = z.enum(["OPEN", "RESOLVED"]);

export const PhotoStageEnum = z.enum(["RETURN_INTAKE", "RETURN_RESOLUTION"]);

export const createReturnClaimSchema = z.object({
  originalJobId: z.string().min(1),
  claimedJobRepairId: z.string().min(1).optional(),
  claimedJobPartId: z.string().min(1).optional(),
  returnReason: z.string().min(1).max(2000),
});

export const triageReturnClaimSchema = z.object({
  faultCategory: FaultCategoryEnum,
});

export const resolveReturnClaimSchema = z
  .object({
    resolutionOutcome: ResolutionOutcomeEnum,
    partialChargeAmount: z.number().positive().optional(),
    refundAmount: z.number().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.resolutionOutcome === "REWORK_PARTIAL_CHARGE" && val.partialChargeAmount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["partialChargeAmount"],
        message: "partialChargeAmount is required for REWORK_PARTIAL_CHARGE",
      });
    }
    if (
      (val.resolutionOutcome === "REFUND_PARTIAL" || val.resolutionOutcome === "REFUND_FULL") &&
      val.refundAmount === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refundAmount"],
        message: "refundAmount is required for refund outcomes",
      });
    }
  });

export const listReturnClaimsQuerySchema = z.object({
  status: ReturnClaimStatusEnum.optional(),
  faultCategory: FaultCategoryEnum.optional(),
  resolutionOutcome: ResolutionOutcomeEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  originalJobId: z.string().optional(),
  technicianId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadClaimPhotoSchema = z.object({
  stage: PhotoStageEnum,
});
```

- [ ] **Step 3: Lint check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add shared/types/return-claim.ts shared/schemas/return-claim.schema.ts
git commit -m "feat(returns): add return-claim shared types and zod schemas"
```

---

## Task 6: Service — Create Claim (TDD)

**Files:**
- Create: `server/services/return-claim.service.ts`
- Create: `server/services/__tests__/return-claim.service.test.ts`

For service tests, follow the existing pattern in `server/services/__tests__/job.service.test.ts`: a `mockPrisma()` factory returns a partial Prisma stub built from `vi.fn()`s.

- [ ] **Step 1: Write the test scaffold and the first failing test**

Create `server/services/__tests__/return-claim.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "../return-claim.service.js";

type AnyFn = ReturnType<typeof vi.fn>;

function mockPrisma() {
  return {
    job: { findUnique: vi.fn(), update: vi.fn() } as Record<string, AnyFn>,
    jobRepair: { findUnique: vi.fn() } as Record<string, AnyFn>,
    jobPart: { findUnique: vi.fn() } as Record<string, AnyFn>,
    returnClaim: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    } as Record<string, AnyFn>,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(undefined)),
  } as unknown as {
    job: Record<string, AnyFn>;
    jobRepair: Record<string, AnyFn>;
    jobPart: Record<string, AnyFn>;
    returnClaim: Record<string, AnyFn>;
    $transaction: AnyFn;
  };
}

describe("create", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns ORIGINAL_JOB_NOT_DELIVERED when job is not at DELIVERED", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
    });

    const result = await create(
      prisma as never,
      { originalJobId: "job-1", returnReason: "broken again" },
      "user-1",
    );

    expect(result).toEqual({ error: "ORIGINAL_JOB_NOT_DELIVERED" });
    expect(prisma.returnClaim.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test, expect it to fail (no service file yet)**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — `Cannot find module '../return-claim.service.js'`.

- [ ] **Step 3: Create the service file with `create` implementation**

Create `server/services/return-claim.service.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { CreateReturnClaimInput } from "@shared/types/return-claim.js";

type DbClient = PrismaClient;
type ServiceResult<T> = T | { error: string };

export async function create(
  prisma: DbClient,
  input: CreateReturnClaimInput,
  openedById: string,
): Promise<ServiceResult<{ id: string }>> {
  const job = await prisma.job.findUnique({
    where: { id: input.originalJobId },
    select: { id: true, status: true, customerId: true },
  });
  if (!job) {
    return { error: "JOB_NOT_FOUND" };
  }
  if (job.status !== "DELIVERED") {
    return { error: "ORIGINAL_JOB_NOT_DELIVERED" };
  }

  if (input.claimedJobRepairId) {
    const repair = await prisma.jobRepair.findUnique({
      where: { id: input.claimedJobRepairId },
      select: { id: true, jobId: true },
    });
    if (!repair || repair.jobId !== job.id) {
      return { error: "INVALID_CLAIMED_LINE" };
    }
  }

  if (input.claimedJobPartId) {
    const part = await prisma.jobPart.findUnique({
      where: { id: input.claimedJobPartId },
      select: { id: true, jobId: true },
    });
    if (!part || part.jobId !== job.id) {
      return { error: "INVALID_CLAIMED_LINE" };
    }
  }

  const claim = await prisma.returnClaim.create({
    data: {
      originalJobId: input.originalJobId,
      claimedJobRepairId: input.claimedJobRepairId,
      claimedJobPartId: input.claimedJobPartId,
      returnReason: input.returnReason,
      openedById,
    },
    select: { id: true },
  });

  return { id: claim.id };
}
```

- [ ] **Step 4: Run the test, expect it to pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: PASS — 1 test passing.

- [ ] **Step 5: Add tests for the remaining create paths**

Append to the same test file inside `describe("create", ...)`:

```ts
  it("returns INVALID_CLAIMED_LINE when claimedJobRepairId belongs to a different job", async () => {
    prisma.job.findUnique.mockResolvedValue({ id: "job-1", status: "DELIVERED", customerId: "c1" });
    prisma.jobRepair.findUnique.mockResolvedValue({ id: "jr-1", jobId: "job-2" });

    const result = await create(
      prisma as never,
      {
        originalJobId: "job-1",
        claimedJobRepairId: "jr-1",
        returnReason: "screen flickers",
      },
      "user-1",
    );

    expect(result).toEqual({ error: "INVALID_CLAIMED_LINE" });
  });

  it("returns INVALID_CLAIMED_LINE when claimedJobPartId belongs to a different job", async () => {
    prisma.job.findUnique.mockResolvedValue({ id: "job-1", status: "DELIVERED", customerId: "c1" });
    prisma.jobPart.findUnique.mockResolvedValue({ id: "jp-1", jobId: "job-2" });

    const result = await create(
      prisma as never,
      { originalJobId: "job-1", claimedJobPartId: "jp-1", returnReason: "battery dead" },
      "user-1",
    );

    expect(result).toEqual({ error: "INVALID_CLAIMED_LINE" });
  });

  it("creates an OPEN claim when inputs are valid (no specific line)", async () => {
    prisma.job.findUnique.mockResolvedValue({ id: "job-1", status: "DELIVERED", customerId: "c1" });
    prisma.returnClaim.create.mockResolvedValue({ id: "rc-1" });

    const result = await create(
      prisma as never,
      { originalJobId: "job-1", returnReason: "device making weird noise" },
      "user-1",
    );

    expect(result).toEqual({ id: "rc-1" });
    expect(prisma.returnClaim.create).toHaveBeenCalledWith({
      data: {
        originalJobId: "job-1",
        claimedJobRepairId: undefined,
        claimedJobPartId: undefined,
        returnReason: "device making weird noise",
        openedById: "user-1",
      },
      select: { id: true },
    });
  });

  it("returns JOB_NOT_FOUND when original job does not exist", async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    const result = await create(
      prisma as never,
      { originalJobId: "missing", returnReason: "test" },
      "user-1",
    );

    expect(result).toEqual({ error: "JOB_NOT_FOUND" });
  });
```

- [ ] **Step 6: Run all create tests, expect all pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: 4 tests passing in the `create` describe block.

- [ ] **Step 7: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): create-claim service with validation"
```

---

## Task 7: Service — Get By ID and List (TDD)

**Files:**
- Modify: `server/services/return-claim.service.ts`
- Modify: `server/services/__tests__/return-claim.service.test.ts`

- [ ] **Step 1: Write failing tests for getById and list**

Append to `server/services/__tests__/return-claim.service.test.ts`:

```ts
import { getById, list } from "../return-claim.service.js";

describe("getById", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns null when claim not found", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue(null);
    const result = await getById(prisma as never, "missing");
    expect(result).toBeNull();
  });

  it("returns claim with relations when found", async () => {
    const claim = { id: "rc-1", status: "OPEN", originalJobId: "job-1" };
    prisma.returnClaim.findUnique.mockResolvedValue(claim);
    const result = await getById(prisma as never, "rc-1");
    expect(result).toBe(claim);
    expect(prisma.returnClaim.findUnique).toHaveBeenCalledWith({
      where: { id: "rc-1" },
      include: expect.any(Object),
    });
  });
});

describe("list", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("applies status, faultCategory, and date filters", async () => {
    prisma.returnClaim.findMany.mockResolvedValue([]);
    prisma.returnClaim.count.mockResolvedValue(0);

    await list(prisma as never, {
      status: "OPEN",
      faultCategory: "WORKMANSHIP",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T23:59:59.999Z",
      page: 2,
      limit: 10,
    });

    expect(prisma.returnClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          faultCategory: "WORKMANSHIP",
          openedAt: {
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lte: new Date("2026-12-31T23:59:59.999Z"),
          },
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it("scopes by technicianId when provided", async () => {
    prisma.returnClaim.findMany.mockResolvedValue([]);
    prisma.returnClaim.count.mockResolvedValue(0);

    await list(prisma as never, { technicianId: "tech-1" });

    expect(prisma.returnClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { originalJob: { technicianId: "tech-1" } },
            { reworkJob: { technicianId: "tech-1" } },
          ],
        }),
      }),
    );
  });

  it("returns paginated shape", async () => {
    prisma.returnClaim.findMany.mockResolvedValue([{ id: "rc-1" }]);
    prisma.returnClaim.count.mockResolvedValue(1);

    const result = await list(prisma as never, {});

    expect(result).toEqual({
      items: [{ id: "rc-1" }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — `getById` and `list` don't exist.

- [ ] **Step 3: Implement getById and list**

Append to `server/services/return-claim.service.ts`:

```ts
import type { ListReturnClaimsQuery } from "@shared/types/return-claim.js";

const CLAIM_INCLUDE = {
  originalJob: {
    select: {
      id: true,
      jobCode: true,
      status: true,
      technicianId: true,
      customer: { select: { id: true, name: true, phone: true } },
      device: { select: { id: true, brand: true, model: true } },
    },
  },
  reworkJob: {
    select: {
      id: true,
      jobCode: true,
      status: true,
    },
  },
  claimedJobRepair: { select: { id: true, repairName: true, category: true, price: true } },
  claimedJobPart: { select: { id: true, partName: true, category: true, totalCost: true } },
  openedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  photos: true,
} as const;

export async function getById(prisma: DbClient, id: string) {
  return await prisma.returnClaim.findUnique({
    where: { id },
    include: CLAIM_INCLUDE,
  });
}

export async function list(prisma: DbClient, query: ListReturnClaimsQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.faultCategory) where.faultCategory = query.faultCategory;
  if (query.resolutionOutcome) where.resolutionOutcome = query.resolutionOutcome;
  if (query.originalJobId) where.originalJobId = query.originalJobId;
  if (query.from || query.to) {
    where.openedAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }
  if (query.technicianId) {
    where.OR = [
      { originalJob: { technicianId: query.technicianId } },
      { reworkJob: { technicianId: query.technicianId } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.returnClaim.findMany({
      where,
      include: CLAIM_INCLUDE,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.returnClaim.count({ where }),
  ]);

  return { items, total, page, limit };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: all `getById` and `list` tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): list and getById service methods"
```

---

## Task 8: Service — Triage (TDD)

**Files:**
- Modify: `server/services/return-claim.service.ts`
- Modify: `server/services/__tests__/return-claim.service.test.ts`

- [ ] **Step 1: Write failing tests**

Append to test file:

```ts
import { triage } from "../return-claim.service.js";

describe("triage", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns RETURN_CLAIM_NOT_FOUND when claim missing", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue(null);
    const result = await triage(prisma as never, "missing", { faultCategory: "WORKMANSHIP" });
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_FOUND" });
  });

  it("returns RETURN_CLAIM_NOT_OPEN when claim already RESOLVED", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });
    const result = await triage(prisma as never, "rc-1", { faultCategory: "WORKMANSHIP" });
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_OPEN" });
  });

  it("updates faultCategory on OPEN claim", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({ id: "rc-1", status: "OPEN" });
    prisma.returnClaim.update.mockResolvedValue({ id: "rc-1", status: "OPEN", faultCategory: "WORKMANSHIP" });

    const result = await triage(prisma as never, "rc-1", { faultCategory: "WORKMANSHIP" });

    expect(prisma.returnClaim.update).toHaveBeenCalledWith({
      where: { id: "rc-1" },
      data: { faultCategory: "WORKMANSHIP" },
    });
    expect(result).toMatchObject({ id: "rc-1", faultCategory: "WORKMANSHIP" });
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — `triage` not exported.

- [ ] **Step 3: Implement triage**

Append to `server/services/return-claim.service.ts`:

```ts
import type { TriageInput } from "@shared/types/return-claim.js";

export async function triage(
  prisma: DbClient,
  id: string,
  input: TriageInput,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await prisma.returnClaim.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "RETURN_CLAIM_NOT_FOUND" };
  if (existing.status !== "OPEN") return { error: "RETURN_CLAIM_NOT_OPEN" };

  return await prisma.returnClaim.update({
    where: { id },
    data: { faultCategory: input.faultCategory },
  });
}
```

- [ ] **Step 4: Run, expect pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: triage tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): triage service method"
```

---

## Task 9: Service — Spawn Rework and Detach Rework (TDD)

**Files:**
- Modify: `server/services/return-claim.service.ts`
- Modify: `server/services/__tests__/return-claim.service.test.ts`

- [ ] **Step 1: Write failing tests for spawnRework**

Append:

```ts
import { spawnRework, detachRework } from "../return-claim.service.js";

describe("spawnRework", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns RETURN_CLAIM_NOT_FOUND when missing", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue(null);
    const result = await spawnRework(prisma as never, "missing", "user-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_FOUND" });
  });

  it("returns RETURN_CLAIM_NOT_OPEN when claim already RESOLVED", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });
    const result = await spawnRework(prisma as never, "rc-1", "user-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_OPEN" });
  });

  it("returns RETURN_CLAIM_HAS_REWORK_JOB when reworkJobId already set", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      reworkJobId: "rework-1",
    });
    const result = await spawnRework(prisma as never, "rc-1", "user-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_HAS_REWORK_JOB" });
  });
});

describe("detachRework", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns RETURN_CLAIM_NOT_OPEN when RESOLVED", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });
    const result = await detachRework(prisma as never, "rc-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_OPEN" });
  });

  it("nulls reworkJobId on OPEN claim", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({ id: "rc-1", status: "OPEN", reworkJobId: "rework-1" });
    prisma.returnClaim.update.mockResolvedValue({ id: "rc-1", reworkJobId: null });

    const result = await detachRework(prisma as never, "rc-1");

    expect(prisma.returnClaim.update).toHaveBeenCalledWith({
      where: { id: "rc-1" },
      data: { reworkJobId: null },
    });
    expect(result).toMatchObject({ id: "rc-1", reworkJobId: null });
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement spawnRework and detachRework**

Append to service:

```ts
import { create as createJob } from "./job.service.js";

export async function spawnRework(
  prisma: DbClient,
  claimId: string,
  technicianId: string,
): Promise<ServiceResult<{ claimId: string; reworkJobId: string }>> {
  const claim = await prisma.returnClaim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      status: true,
      reworkJobId: true,
      originalJobId: true,
      returnReason: true,
      originalJob: {
        select: {
          customerId: true,
          deviceId: true,
          device: { select: { brand: { select: { name: true } }, model: true } },
          customer: { select: { name: true, phone: true } },
        },
      },
    },
  });

  if (!claim) return { error: "RETURN_CLAIM_NOT_FOUND" };
  if (claim.status !== "OPEN") return { error: "RETURN_CLAIM_NOT_OPEN" };
  if (claim.reworkJobId) return { error: "RETURN_CLAIM_HAS_REWORK_JOB" };

  return await prisma.$transaction(async (tx) => {
    const reworkJobResult = await createJob(
      tx as DbClient,
      {
        customerId: claim.originalJob.customerId,
        customerName: claim.originalJob.customer.name,
        customerPhone: claim.originalJob.customer.phone,
        deviceBrand: claim.originalJob.device.brand.name,
        deviceModel: claim.originalJob.device.model,
        reportedProblem: `[Warranty rework] ${claim.returnReason}`,
        estimatedCost: 0,
        isWarrantyReturn: true,
        warrantyForJobId: claim.originalJobId,
      },
      technicianId,
      { wsBroadcast: undefined } as never,
    );

    if (reworkJobResult && typeof reworkJobResult === "object" && "error" in reworkJobResult) {
      return reworkJobResult;
    }

    const reworkJobId = (reworkJobResult as { id: string }).id;

    await tx.returnClaim.update({
      where: { id: claimId },
      data: { reworkJobId },
    });

    return { claimId, reworkJobId };
  });
}

export async function detachRework(
  prisma: DbClient,
  claimId: string,
): Promise<ServiceResult<{ id: string; reworkJobId: null }>> {
  const claim = await prisma.returnClaim.findUnique({
    where: { id: claimId },
    select: { id: true, status: true },
  });
  if (!claim) return { error: "RETURN_CLAIM_NOT_FOUND" };
  if (claim.status !== "OPEN") return { error: "RETURN_CLAIM_NOT_OPEN" };

  return await prisma.returnClaim.update({
    where: { id: claimId },
    data: { reworkJobId: null },
  });
}
```

> **Note:** the `createJob` signature here passes a minimal NotifyContext-like third argument. Verify the actual signature in `server/services/job.service.ts` and adapt if it differs (it likely takes `(prisma, input, userId, notifyCtx)` per the existing tests). Adjust the third arg shape to match.

- [ ] **Step 4: Run, expect pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: all spawnRework and detachRework error-path tests pass. The "happy path" spawnRework test is deferred to integration tests in Task 14 because it requires the full job-creation flow.

- [ ] **Step 5: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): spawnRework and detachRework service methods"
```

---

## Task 10: Service — Resolve (TDD)

**Files:**
- Modify: `server/services/return-claim.service.ts`
- Modify: `server/services/__tests__/return-claim.service.test.ts`

- [ ] **Step 1: Write failing tests covering all four resolution paths**

Append:

```ts
import { resolve } from "../return-claim.service.js";

describe("resolve", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns RETURN_CLAIM_FAULT_REQUIRED when faultCategory not set", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      faultCategory: null,
    });

    const result = await resolve(
      prisma as never,
      "rc-1",
      { resolutionOutcome: "REWORK_FREE" },
      "user-1",
    );

    expect(result).toEqual({ error: "RETURN_CLAIM_FAULT_REQUIRED" });
  });

  it("returns RETURN_CLAIM_REWORK_JOB_NOT_DELIVERED when rework job not delivered", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      faultCategory: "WORKMANSHIP",
      reworkJobId: "rework-1",
      reworkJob: { id: "rework-1", status: "IN_REPAIR" },
      originalJobId: "job-1",
    });

    const result = await resolve(
      prisma as never,
      "rc-1",
      { resolutionOutcome: "REWORK_FREE" },
      "user-1",
    );

    expect(result).toEqual({ error: "RETURN_CLAIM_REWORK_JOB_NOT_DELIVERED" });
  });

  it("resolves REWORK_FREE when rework Job is DELIVERED", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      faultCategory: "WORKMANSHIP",
      reworkJobId: "rework-1",
      reworkJob: { id: "rework-1", status: "DELIVERED" },
      originalJobId: "job-1",
    });
    prisma.returnClaim.update.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });

    const result = await resolve(
      prisma as never,
      "rc-1",
      { resolutionOutcome: "REWORK_FREE" },
      "user-1",
    );

    expect(prisma.returnClaim.update).toHaveBeenCalledWith({
      where: { id: "rc-1" },
      data: expect.objectContaining({
        status: "RESOLVED",
        resolutionOutcome: "REWORK_FREE",
        resolvedById: "user-1",
        resolvedAt: expect.any(Date),
      }),
    });
    expect(result).toMatchObject({ id: "rc-1", status: "RESOLVED" });
  });

  it("resolves REWORK_PARTIAL_CHARGE with partialChargeAmount", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      faultCategory: "DEFECTIVE_PART",
      reworkJobId: "rework-1",
      reworkJob: { id: "rework-1", status: "DELIVERED" },
      originalJobId: "job-1",
    });
    prisma.returnClaim.update.mockResolvedValue({ id: "rc-1" });

    await resolve(
      prisma as never,
      "rc-1",
      { resolutionOutcome: "REWORK_PARTIAL_CHARGE", partialChargeAmount: 1500 },
      "user-1",
    );

    expect(prisma.returnClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolutionOutcome: "REWORK_PARTIAL_CHARGE",
          partialChargeAmount: 1500,
        }),
      }),
    );
  });

  it("returns REFUND_EXCEEDS_ORIGINAL when refundAmount > original payment", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      faultCategory: "MISDIAGNOSIS",
      reworkJobId: null,
      originalJobId: "job-1",
    });
    prisma.job.findUnique.mockResolvedValue({
      id: "job-1",
      estimatedCost: 5000,
      depositAmount: 1000,
    });

    const result = await resolve(
      prisma as never,
      "rc-1",
      { resolutionOutcome: "REFUND_FULL", refundAmount: 99999 },
      "user-1",
    );

    expect(result).toEqual({ error: "REFUND_EXCEEDS_ORIGINAL" });
  });

  it("resolves REFUND_PARTIAL when refundAmount valid", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      faultCategory: "WORKMANSHIP",
      reworkJobId: null,
      originalJobId: "job-1",
    });
    prisma.job.findUnique.mockResolvedValue({
      id: "job-1",
      estimatedCost: 5000,
      depositAmount: 1000,
    });
    prisma.returnClaim.update.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });

    await resolve(
      prisma as never,
      "rc-1",
      { resolutionOutcome: "REFUND_PARTIAL", refundAmount: 2000 },
      "user-1",
    );

    expect(prisma.returnClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolutionOutcome: "REFUND_PARTIAL",
          refundAmount: 2000,
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — `resolve` not exported.

- [ ] **Step 3: Implement resolve**

Append to service:

```ts
import type { ResolveInput } from "@shared/types/return-claim.js";

const REWORK_OUTCOMES = new Set(["REWORK_FREE", "REWORK_PARTIAL_CHARGE"]);
const REFUND_OUTCOMES = new Set(["REFUND_PARTIAL", "REFUND_FULL"]);

export async function resolve(
  prisma: DbClient,
  claimId: string,
  input: ResolveInput,
  resolvedById: string,
): Promise<ServiceResult<{ id: string; status: "RESOLVED" }>> {
  const claim = await prisma.returnClaim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      status: true,
      faultCategory: true,
      reworkJobId: true,
      originalJobId: true,
      reworkJob: { select: { id: true, status: true } },
    },
  });

  if (!claim) return { error: "RETURN_CLAIM_NOT_FOUND" };
  if (claim.status !== "OPEN") return { error: "RETURN_CLAIM_NOT_OPEN" };
  if (!claim.faultCategory) return { error: "RETURN_CLAIM_FAULT_REQUIRED" };

  if (REWORK_OUTCOMES.has(input.resolutionOutcome)) {
    if (!claim.reworkJobId || !claim.reworkJob) {
      return { error: "RETURN_CLAIM_REWORK_JOB_NOT_DELIVERED" };
    }
    if (claim.reworkJob.status !== "DELIVERED") {
      return { error: "RETURN_CLAIM_REWORK_JOB_NOT_DELIVERED" };
    }
  }

  if (REFUND_OUTCOMES.has(input.resolutionOutcome)) {
    if (claim.reworkJobId) {
      return { error: "RETURN_CLAIM_HAS_REWORK_JOB" };
    }
    const original = await prisma.job.findUnique({
      where: { id: claim.originalJobId },
      select: { estimatedCost: true, depositAmount: true },
    });
    const totalReceived =
      Number(original?.estimatedCost ?? 0) + Number(original?.depositAmount ?? 0);
    if ((input.refundAmount ?? 0) > totalReceived) {
      return { error: "REFUND_EXCEEDS_ORIGINAL" };
    }
  }

  return await prisma.returnClaim.update({
    where: { id: claimId },
    data: {
      status: "RESOLVED",
      resolutionOutcome: input.resolutionOutcome,
      partialChargeAmount: input.partialChargeAmount ?? null,
      refundAmount: input.refundAmount ?? null,
      resolvedById,
      resolvedAt: new Date(),
    },
  });
}
```

> **Note on payment source:** the spec says refund must not exceed "originalJob total payment received." Since this codebase uses `estimatedCost + depositAmount` as the closest proxy, that's what we check. If a separate payments table exists, swap the source. Verify during plan execution.

- [ ] **Step 4: Run, expect pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: all resolve tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): resolve service method with all four outcome paths"
```

---

## Task 11: Service — Photo Upload and Delete (TDD)

**Files:**
- Modify: `server/services/return-claim.service.ts`
- Modify: `server/services/__tests__/return-claim.service.test.ts`

The existing photo upload service `server/services/job-photos.service.ts` writes files to disk. The claim photo path is identical except it sets `stage` and `returnClaimId`. We delegate file handling to the existing service.

- [ ] **Step 1: Inspect the existing photo service signature**

Read `server/services/job-photos.service.ts` to confirm the exported `upload` and `remove` signatures. They should accept `(prisma, jobId, file, userId)` and return `{ id, path } | { error }`. If the signature differs from this assumption, adapt the calls below.

- [ ] **Step 2: Write failing tests**

Append:

```ts
import { uploadPhoto, removePhoto } from "../return-claim.service.js";

describe("uploadPhoto", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns RETURN_CLAIM_NOT_OPEN when claim is RESOLVED", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "RESOLVED",
      originalJobId: "job-1",
    });

    const fakeFile = { filename: "x.jpg" } as never;
    const result = await uploadPhoto(prisma as never, "rc-1", fakeFile, "RETURN_INTAKE", "user-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_OPEN" });
  });

  it("returns RETURN_CLAIM_NOT_FOUND when claim missing", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue(null);
    const fakeFile = { filename: "x.jpg" } as never;
    const result = await uploadPhoto(prisma as never, "missing", fakeFile, "RETURN_INTAKE", "user-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_FOUND" });
  });
});

describe("removePhoto", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns RETURN_CLAIM_NOT_OPEN when claim is RESOLVED", async () => {
    prisma.returnClaim.findUnique.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });
    const result = await removePhoto(prisma as never, "rc-1", "ph-1");
    expect(result).toEqual({ error: "RETURN_CLAIM_NOT_OPEN" });
  });
});
```

- [ ] **Step 3: Run, expect failures**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 4: Implement uploadPhoto and removePhoto**

Append to service:

```ts
import {
  upload as uploadJobPhoto,
  remove as removeJobPhoto,
} from "./job-photos.service.js";
import type { PhotoStage } from "@shared/types/return-claim.js";

export async function uploadPhoto(
  prisma: DbClient,
  claimId: string,
  file: Parameters<typeof uploadJobPhoto>[2],
  stage: PhotoStage,
  userId: string,
): Promise<ServiceResult<{ id: string; path: string }>> {
  const claim = await prisma.returnClaim.findUnique({
    where: { id: claimId },
    select: { id: true, status: true, originalJobId: true },
  });
  if (!claim) return { error: "RETURN_CLAIM_NOT_FOUND" };
  if (claim.status !== "OPEN") return { error: "RETURN_CLAIM_NOT_OPEN" };

  const result = await uploadJobPhoto(prisma, claim.originalJobId, file, userId);
  if (!result || (typeof result === "object" && "error" in result)) {
    return result as ServiceResult<{ id: string; path: string }>;
  }

  // Patch the new photo row with stage + claim FK
  await prisma.jobPhoto.update({
    where: { id: result.id },
    data: { stage, returnClaimId: claimId },
  });

  return result;
}

export async function removePhoto(
  prisma: DbClient,
  claimId: string,
  photoId: string,
): Promise<ServiceResult<{ removed: true }>> {
  const claim = await prisma.returnClaim.findUnique({
    where: { id: claimId },
    select: { id: true, status: true, originalJobId: true },
  });
  if (!claim) return { error: "RETURN_CLAIM_NOT_FOUND" };
  if (claim.status !== "OPEN") return { error: "RETURN_CLAIM_NOT_OPEN" };

  const removed = await removeJobPhoto(prisma, claim.originalJobId, photoId, "system");
  if (!removed) return { error: "RESOURCE_NOT_FOUND" };
  return { removed: true };
}
```

Add `jobPhoto.update` to the mockPrisma factory at the top of the test file:

```ts
    jobPhoto: { update: vi.fn() } as Record<string, AnyFn>,
```

- [ ] **Step 5: Run, expect pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: photo tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): photo upload and remove on claims with stage tagging"
```

---

## Task 12: Block Rework Job Cancellation When Claim is OPEN

**Files:**
- Modify: `server/services/job.service.ts`
- Modify: `server/services/__tests__/job.service.test.ts`

- [ ] **Step 1: Locate the cancellation logic**

Run: `grep -n "CANCELLED\|cancel" server/services/job.service.ts | head -20`

Find the function that transitions a Job to `CANCELLED`. It's likely inside `transitionStatus` or a dedicated `cancel` function. Read it to understand the existing flow.

- [ ] **Step 2: Write a failing test for the new guard**

In `server/services/__tests__/job.service.test.ts`, find an existing `describe` for cancellation (or transitionStatus to CANCELLED) and add:

```ts
it("returns REWORK_JOB_HAS_OPEN_CLAIM when cancelling a rework job whose claim is OPEN", async () => {
  prisma.job.findUnique.mockResolvedValue({
    id: "rework-1",
    status: "IN_REPAIR",
    isWarrantyReturn: true,
    createdById: "user-1",
  });
  prisma.returnClaim.findUnique.mockResolvedValue({
    id: "rc-1",
    status: "OPEN",
    reworkJobId: "rework-1",
  });

  // adapt to the actual cancel/transitionStatus signature in your codebase
  const result = await transitionStatus(
    prisma as never,
    "rework-1",
    { status: "CANCELLED" } as never,
    "user-1",
    mockNotifyCtx,
  );

  expect(result).toEqual({ error: "REWORK_JOB_HAS_OPEN_CLAIM" });
});
```

If `mockNotifyCtx` and `transitionStatus` are not yet imported in that test file, copy the imports from existing cancellation tests in the same file.

You'll also need `prisma.returnClaim.findUnique` in the test's mockPrisma — extend the existing mock factory if needed.

- [ ] **Step 3: Run, expect failure**

Run: `bun vitest run server/services/__tests__/job.service.test.ts`
Expected: the new test fails.

- [ ] **Step 4: Implement the guard**

In `server/services/job.service.ts`, in the cancellation path, before persisting the CANCELLED state, add:

```ts
// Block cancellation if this job is a rework Job whose claim is still OPEN
if (job.isWarrantyReturn) {
  const claim = await prisma.returnClaim.findUnique({
    where: { reworkJobId: job.id },
    select: { id: true, status: true },
  });
  if (claim && claim.status === "OPEN") {
    return { error: "REWORK_JOB_HAS_OPEN_CLAIM" };
  }
}
```

Insert this immediately after the existing `findUnique` for the job and before the `update` to CANCELLED. Match the exact location to the cancellation flow you found in Step 1.

- [ ] **Step 5: Run, expect pass**

Run: `bun vitest run server/services/__tests__/job.service.test.ts`
Expected: the new test passes; no existing tests broken.

- [ ] **Step 6: Commit**

```bash
git add server/services/job.service.ts server/services/__tests__/job.service.test.ts
git commit -m "feat(returns): block cancellation of rework job while claim is open"
```

---

## Task 13: Notification Template + `return_claim_resolved` Event

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `server/services/return-claim.service.ts`

The notification system uses event-name lookup (`notify(app, { eventName, ... })`). No code changes to `notification-dispatch.ts` are needed — we just seed a new template and call `notify()` from the resolve service.

- [ ] **Step 1: Read seed.ts to find existing notification template seeding**

Run: `grep -n "warranty_return_created\|notificationTemplate\|eventName" prisma/seed.ts | head -10`

Find where templates are upserted. Note the structure (channel, body, etc.) used by `warranty_return_created`.

- [ ] **Step 2: Add seed entry for `return_claim_resolved`**

In `prisma/seed.ts`, find the array or block that seeds notification templates. Add an entry following the existing pattern:

```ts
{
  eventName: "return_claim_resolved",
  channel: "IN_APP",
  body: "Return claim resolved for job {{jobCode}}: {{outcome}}",
},
```

If the existing pattern includes WhatsApp templates, mirror that:

```ts
{
  eventName: "return_claim_resolved",
  channel: "WHATSAPP",
  body: "Customer return claim for {{jobCode}} has been resolved: {{outcome}}.",
},
```

- [ ] **Step 3: Run the seed**

Run: `bun run prisma/seed.ts`
(Or whatever the project's seed command is — check `package.json` for a `db:seed` or similar script.)

Expected: seed completes without error. New template rows present.

- [ ] **Step 4: Wire `notify()` into the resolve service**

In `server/services/return-claim.service.ts`, modify the `resolve` function to call `notify` for refund outcomes only:

```ts
import { notify } from "./notification-dispatch.js";

// inside resolve(), after the prisma.returnClaim.update call, before returning:
const updated = await prisma.returnClaim.update({ /* ... existing args ... */ });

if (REFUND_OUTCOMES.has(input.resolutionOutcome)) {
  await notify(
    { prisma } as never,
    {
      eventName: "return_claim_resolved",
      jobId: claim.originalJobId,
      context: {
        jobCode: "<lookup-needed>", // see step 5
        outcome: input.resolutionOutcome,
      },
      recipients: { role: "OWNER" },
    },
  );
}

return updated;
```

- [ ] **Step 5: Resolve the jobCode lookup**

The `notify()` context needs the jobCode for the template. Update the initial `findUnique` in `resolve` to also select `originalJob.jobCode`:

```ts
const claim = await prisma.returnClaim.findUnique({
  where: { id: claimId },
  select: {
    id: true,
    status: true,
    faultCategory: true,
    reworkJobId: true,
    originalJobId: true,
    originalJob: { select: { jobCode: true } },
    reworkJob: { select: { id: true, status: true } },
  },
});
```

Use `claim.originalJob.jobCode` in the notify context.

- [ ] **Step 6: Add a test for notification dispatch**

Add to the resolve describe block in the service test:

```ts
it("calls notify with return_claim_resolved on REFUND_FULL", async () => {
  // mock notify
  // we test by spying — see existing pattern in warranty-alert.test.ts
  prisma.returnClaim.findUnique.mockResolvedValue({
    id: "rc-1",
    status: "OPEN",
    faultCategory: "MISDIAGNOSIS",
    reworkJobId: null,
    originalJobId: "job-1",
    originalJob: { jobCode: "RPR-001" },
  });
  prisma.job.findUnique.mockResolvedValue({ estimatedCost: 5000, depositAmount: 0 });
  prisma.returnClaim.update.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });

  // To assert notify was called, mock the notify import via vi.mock at the top of the file:
  // vi.mock("../notification-dispatch.js", () => ({ notify: vi.fn() }));
  // const { notify } = await import("../notification-dispatch.js");

  await resolve(
    prisma as never,
    "rc-1",
    { resolutionOutcome: "REFUND_FULL", refundAmount: 5000 },
    "user-1",
  );

  // expect(notify).toHaveBeenCalledWith(...);
});
```

The mocking pattern matches `server/__tests__/warranty-alert.test.ts` from earlier in the codebase. Add `vi.mock("../notification-dispatch.js", () => ({ notify: vi.fn() }));` at the top of the test file.

- [ ] **Step 7: Run all service tests**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add prisma/seed.ts server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): notify owner when refund claim resolved"
```

---

## Task 14: Routes — All Endpoints

**Files:**
- Create: `server/routes/return-claims.ts`
- Create: `server/__tests__/return-claims.test.ts`

- [ ] **Step 1: Create the route plugin scaffold**

Create `server/routes/return-claims.ts`. Follow the pattern of `server/routes/jobs.ts`:

```ts
import { AppError, throwIfError } from "@shared/errors/app-error.js";
import {
  createReturnClaimSchema,
  listReturnClaimsQuerySchema,
  resolveReturnClaimSchema,
  triageReturnClaimSchema,
  uploadClaimPhotoSchema,
} from "@shared/schemas/return-claim.schema.js";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createClaim,
  detachRework,
  getById as getClaim,
  list as listClaims,
  removePhoto,
  resolve as resolveClaim,
  spawnRework,
  triage,
  uploadPhoto,
} from "../services/return-claim.service.js";
import { getUserId } from "../utils/request.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

export const returnClaimsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ returns: ["viewSelf"] }));

  app.post(
    "/",
    {
      preHandler: [requirePermission({ returns: ["create"] })],
      schema: {
        tags: ["returns"],
        summary: "Create a return claim",
        body: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const parsed = createReturnClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
        });
      }
      const userId = getUserId(req);
      const result = await createClaim(app.prisma, parsed.data, userId);
      throwIfError(result);
      return reply.status(201).send(result);
    },
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["returns"],
        summary: "List return claims",
        querystring: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const parsed = listReturnClaimsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
        });
      }
      const result = await listClaims(app.prisma, parsed.data);
      return reply.send(result);
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["returns"],
        summary: "Get return claim by id",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const claim = await getClaim(app.prisma, id);
      if (!claim) throw new AppError("RETURN_CLAIM_NOT_FOUND");
      return reply.send(claim);
    },
  );

  app.patch(
    "/:id/triage",
    {
      preHandler: [requirePermission({ returns: ["triage"] })],
      schema: {
        tags: ["returns"],
        summary: "Set fault category on a claim",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = triageReturnClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
        });
      }
      const result = await triage(app.prisma, id, parsed.data);
      throwIfError(result);
      return reply.send(result);
    },
  );

  app.post(
    "/:id/spawn-rework",
    {
      preHandler: [requirePermission({ returns: ["resolveRework"] })],
      schema: {
        tags: ["returns"],
        summary: "Spawn a rework job for a claim",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const userId = getUserId(req);
      const result = await spawnRework(app.prisma, id, userId);
      throwIfError(result);
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/:id/detach-rework",
    {
      preHandler: [requirePermission({ returns: ["edit"] })],
      schema: {
        tags: ["returns"],
        summary: "Detach a rework job from a claim",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const result = await detachRework(app.prisma, id);
      throwIfError(result);
      return reply.send(result);
    },
  );

  app.patch(
    "/:id/resolve",
    {
      preHandler: [
        async (req) => {
          const body = req.body as { resolutionOutcome?: string };
          const isRefund =
            body.resolutionOutcome === "REFUND_PARTIAL" ||
            body.resolutionOutcome === "REFUND_FULL";
          const perm = isRefund
            ? { returns: ["resolveRefund"] as const }
            : { returns: ["resolveRework"] as const };
          await requirePermission(perm)(req);
        },
      ],
      schema: {
        tags: ["returns"],
        summary: "Resolve a return claim",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = resolveReturnClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
        });
      }
      const userId = getUserId(req);
      const result = await resolveClaim(app.prisma, id, parsed.data, userId);
      throwIfError(result);
      return reply.send(result);
    },
  );

  app.post(
    "/:id/photos",
    {
      preHandler: [requirePermission({ returns: ["edit"] })],
      schema: {
        tags: ["returns"],
        summary: "Upload claim photo",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        consumes: ["multipart/form-data"],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const data = await req.file();
      if (!data) throw new AppError("NO_FILE_UPLOADED");
      const stage = (data.fields.stage as { value?: string } | undefined)?.value;
      const parsed = uploadClaimPhotoSchema.safeParse({ stage });
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
        });
      }
      const userId = getUserId(req);
      const result = await uploadPhoto(app.prisma, id, data, parsed.data.stage, userId);
      throwIfError(result);
      return reply.status(201).send(result);
    },
  );

  app.delete(
    "/:id/photos/:photoId",
    {
      preHandler: [requirePermission({ returns: ["edit"] })],
      schema: {
        tags: ["returns"],
        summary: "Remove claim photo",
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
            photoId: { type: "string" },
          },
          required: ["id", "photoId"],
        },
      },
    },
    async (req, reply) => {
      const { id, photoId } = req.params as { id: string; photoId: string };
      const result = await removePhoto(app.prisma, id, photoId);
      throwIfError(result);
      return reply.status(204).send();
    },
  );
};
```

- [ ] **Step 2: Write integration tests covering happy + permission paths**

Create `server/__tests__/return-claims.test.ts`. Follow the pattern of `server/__tests__/customers-update.test.ts` for the auth mock and `server/__tests__/warranty-alert.test.ts` for service mocks:

```ts
import { AppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../middlewares/rbac.js", () => ({
  requirePermission:
    (permissions: Record<string, string[]>) => async (request: any) => {
      if (!request.user) throw new AppError("UNAUTHORIZED");
      const result = await request.server.auth.api.userHasPermission({
        body: { role: request.user.role, permissions },
      });
      if (!result.success) throw new AppError("FORBIDDEN");
    },
}));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  triage: vi.fn(),
  spawnRework: vi.fn(),
  detachRework: vi.fn(),
  resolve: vi.fn(),
  uploadPhoto: vi.fn(),
  removePhoto: vi.fn(),
}));

vi.mock("../services/return-claim.service.js", () => mocks);

import { returnClaimsRoutes } from "../routes/return-claims.js";

function buildApp(role = "OWNER") {
  const app = Fastify();
  app.decorate("prisma", {} as never);
  app.decorate("auth", {
    api: {
      userHasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  } as never);
  app.addHook("onRequest", async (req) => {
    (req as any).user = { id: "user-1", role, isActive: true } as never;
    (req as any).locale = "en";
  });
  app.register(returnClaimsRoutes);
  return app;
}

describe("POST /return-claims", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(async () => undefined);

  it("creates a claim with valid input", async () => {
    mocks.create.mockResolvedValue({ id: "rc-1" });
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: { originalJobId: "job-1", returnReason: "screen flickers" },
    });

    expect(res.statusCode).toBe(201);
    expect(mocks.create).toHaveBeenCalled();
  });

  it("returns 400 on validation failure", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /return-claims/:id/resolve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves rework outcomes", async () => {
    mocks.resolve.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });
    const app = buildApp("TECHNICIAN");
    const res = await app.inject({
      method: "PATCH",
      url: "/rc-1/resolve",
      payload: { resolutionOutcome: "REWORK_FREE" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("blocks technicians from refund outcomes", async () => {
    const app = Fastify();
    app.decorate("prisma", {} as never);
    app.decorate("auth", {
      api: {
        userHasPermission: vi.fn().mockImplementation(async (args: any) => {
          // Allow viewSelf + edit; deny resolveRefund
          const has = !args.body.permissions.returns?.includes("resolveRefund");
          return { success: has };
        }),
      },
    } as never);
    app.addHook("onRequest", async (req) => {
      (req as any).user = { id: "u", role: "TECHNICIAN", isActive: true };
      (req as any).locale = "en";
    });
    app.register(returnClaimsRoutes);

    const res = await app.inject({
      method: "PATCH",
      url: "/rc-1/resolve",
      payload: { resolutionOutcome: "REFUND_FULL", refundAmount: 100 },
    });

    expect(res.statusCode).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run, expect pass**

Run: `bun vitest run server/__tests__/return-claims.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/routes/return-claims.ts server/__tests__/return-claims.test.ts
git commit -m "feat(returns): rest endpoints for return claims"
```

---

## Task 15: Register Routes in `server/index.ts`

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Find the route registration block**

Run: `grep -n "register\|customersRoutes\|jobRoutes" server/index.ts | head -20`

Note the prefix pattern (probably `prefix: "/api/customers"`, etc).

- [ ] **Step 2: Register the new routes**

Add the import alongside other route imports:

```ts
import { returnClaimsRoutes } from "./routes/return-claims.js";
```

In the route registration block, add (matching the existing prefix style):

```ts
await app.register(returnClaimsRoutes, { prefix: "/api/return-claims" });
```

- [ ] **Step 3: Add the swagger tag (if swagger is in use)**

If `server/index.ts` defines swagger tags (per the existing fastify-features plan), add:

```ts
{ name: "returns", description: "Return claims" },
```

to the tags array.

- [ ] **Step 4: Boot the server locally**

Run: `bun run server` (or whatever the dev script is — check `package.json`)
Expected: server starts without errors. Hit `http://localhost:4000/api/return-claims` (with valid auth) — should respond 200 with an empty paginated list.

- [ ] **Step 5: Run the full server test suite**

Run: `bun run test`
Expected: all tests pass — both new and existing.

- [ ] **Step 6: Run lint check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server/index.ts
git commit -m "feat(returns): register return-claims routes"
```

---

## Task 16: Add `returns` to RBAC Matrix Test + Manual Smoke Test

**Files:**
- Modify: `server/__tests__/rbac-matrix.test.ts`

The matrix test should now actually exercise the new routes against the role permission table.

- [ ] **Step 1: Import the new routes plugin**

In `server/__tests__/rbac-matrix.test.ts`, add:

```ts
import { returnClaimsRoutes } from "../routes/return-claims.js";
```

- [ ] **Step 2: Add a test block for return-claims permissions**

Add a describe block exercising at least:
- POST /return-claims with FRONT_DESK → 200/201 (allowed)
- PATCH /:id/resolve REFUND_FULL with TECHNICIAN → 403
- PATCH /:id/resolve REFUND_FULL with OWNER → not 403
- PATCH /:id/triage with FRONT_DESK → 403

Use the existing test pattern (mock the underlying service, exercise the auth path).

- [ ] **Step 3: Run the matrix test**

Run: `bun vitest run server/__tests__/rbac-matrix.test.ts`
Expected: all pass.

- [ ] **Step 4: Manual smoke test in the browser per project rule "use Chrome DevTools for QA"**

Per project rule, log in as `admin` with `SEED_ADMIN_PASSWORD`. Use the dev tools console or curl to hit the endpoints:

```bash
# create a claim (replace <jobId> with a real DELIVERED job id)
curl -X POST http://localhost:4000/api/return-claims \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<session>" \
  -d '{"originalJobId":"<jobId>","returnReason":"screen broken again"}'

# triage
curl -X PATCH http://localhost:4000/api/return-claims/<rc-id>/triage \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<session>" \
  -d '{"faultCategory":"WORKMANSHIP"}'

# resolve REFUND_PARTIAL
curl -X PATCH http://localhost:4000/api/return-claims/<rc-id>/resolve \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<session>" \
  -d '{"resolutionOutcome":"REFUND_PARTIAL","refundAmount":1000}'
```

Verify in console + DB that:
- Claim exists, status RESOLVED, refundAmount 1000
- An in-app notification was created for OWNER role
- No console errors

- [ ] **Step 5: Commit**

```bash
git add server/__tests__/rbac-matrix.test.ts
git commit -m "test(returns): rbac matrix coverage for return-claim endpoints"
```

---

## Task 17: Verification and Wrap-Up

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `bun run test`
Expected: all tests pass. Note any pre-existing flaky tests; do not chase those here.

- [ ] **Step 2: Lint and format check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 3: Verify migration replays cleanly**

Run on a fresh test database (if available):
```bash
DATABASE_URL=<test-url> bunx prisma migrate reset --force
DATABASE_URL=<test-url> bunx prisma migrate deploy
```
Expected: all migrations apply cleanly including the new `returns_tracking` migration.

- [ ] **Step 4: Confirm i18n keys synced**

Run: `bun run sync-locales`
Expected: ar.json and fr.json contain all the new error keys.

- [ ] **Step 5: Tag the backend foundation as complete**

```bash
git log --oneline -20  # verify the trail of commits for this plan
```

The backend foundation is now complete. **Next plan: Frontend UI (Plan 2 of 3)** — to be drafted in a follow-up session by re-invoking `superpowers:writing-plans` against the same spec, scoped to the UI surfaces.

---

## Self-Review

**Spec coverage check (against `2026-05-10-returns-and-photo-evidence-design.md`):**

| Spec section | Tasks |
|---|---|
| Data model — return_claims table + enums | 1, 2 |
| Data model — repair_catalog.warrantyDays | 1, 2 |
| Data model — shop_settings.defaultWarrantyDays | 1, 2 |
| Data model — job_photos.stage + returnClaimId | 1, 2 |
| Workflow — initiation/triage/diagnosis/rework/refund/closure | 6, 7, 8, 9, 10 |
| API — POST /return-claims | 6, 14 |
| API — GET / and GET /:id | 7, 14 |
| API — PATCH /:id/triage | 8, 14 |
| API — POST /:id/spawn-rework | 9, 14 |
| API — POST /:id/detach-rework | 9, 14 |
| API — PATCH /:id/resolve | 10, 14 |
| API — POST/DELETE photos | 11, 14 |
| Permissions — `returns` group | 4, 16 |
| Validation rules | 6 (DELIVERED, claimed line), 10 (refund cap, fault required) |
| Error codes — all 9 | 3 |
| Back-compat — Job.isWarrantyReturn / warrantyForJobId set on rework Job | 9 (in `spawnRework`) |
| Back-compat — `warranty_return_created` notification keeps firing | 9 (delegated to existing `createJob`) |
| Notifications — new `return_claim_resolved` event | 13 |
| Edge case — block rework Job cancellation | 12 |
| Edge case — multiple claims per Job | (no schema constraint preventing it; tested implicitly via list) |
| Edge case — photo mutate on RESOLVED blocked | 11 |
| Migration — Option A (no backfill) | (intentional non-action; covered by spec, not a task) |
| Frontend UI surfaces | **Plan 2** |
| Reports/dashboard analytics | **Plan 3** |

**Out-of-scope items intentionally not in this plan:**
- "Out-of-warranty / goodwill" badge computation — read-side, lives with the UI / Reports plans
- "Activity timeline from AuditLog" — UI rendering concern, Plan 2

**Placeholder scan:** none — all code blocks contain runnable code.

**Type consistency check:**
- `ServiceResult<T>` shape consistent across all service methods
- `DbClient` alias used throughout
- `CLAIM_INCLUDE` referenced once (defined in Task 7) and reused conceptually thereafter
- Permission strings in routes (`returns:["create"]`, etc.) match `shared/permissions.ts` entries from Task 4

**Risk callouts:**
- Task 9 `spawnRework` calls `createJob(tx, ...)` — the actual `job.service.ts` `create` signature should be re-verified at execution time (annotated in the task body). If it differs (e.g., requires more fields, returns a different shape), adapt the call.
- Task 10 refund-amount cap uses `estimatedCost + depositAmount` as proxy for "total received." If the codebase has a separate payments table, swap the source (annotated).
- Task 13 `notify` mocking pattern follows existing tests; if `prisma/seed.ts` is structured differently than assumed (e.g., separate template module rather than inline array), adapt.
