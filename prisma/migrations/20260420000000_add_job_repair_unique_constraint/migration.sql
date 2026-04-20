-- AlterTable
-- Add unique constraint to prevent duplicate repairs on the same job
-- Null repairId values (ad-hoc repairs) are excluded from the constraint
CREATE UNIQUE INDEX "job_repairs_jobId_repairId_key" ON "job_repairs" ("jobId", "repairId") WHERE "repairId" IS NOT NULL;
