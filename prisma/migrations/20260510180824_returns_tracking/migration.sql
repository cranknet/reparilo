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

-- resolvedById uses SET NULL intentionally: when a resolving user is deleted,
-- the claim record must remain intact (it's a business artifact), but the
-- resolver reference is simply nulled rather than preventing user deletion.
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
