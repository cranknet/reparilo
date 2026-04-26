/*
  Warnings:

  - The `status` column on the `notification_outbox` table would be dropped and recreated. This will lead to data loss if there is data in the column.

  SAFETY NOTE: This migration is safe because the `notification_outbox` table was
  created in the immediately prior migration (20260426171433) and contains no
  production data at the time of this migration. Any existing rows would have
  their status reset to the default 'QUEUED'. If this migration needs to run
  against a table with existing SENT/FAILED rows, convert it to:
    ALTER TABLE notification_outbox ALTER COLUMN status TYPE OutboxStatus
      USING status::OutboxStatus;
*/
-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "notification_outbox" DROP COLUMN "status",
ADD COLUMN     "status" "OutboxStatus" NOT NULL DEFAULT 'QUEUED';

-- CreateIndex
CREATE INDEX "notification_outbox_status_createdAt_idx" ON "notification_outbox"("status", "createdAt");
