-- AlterTable
ALTER TABLE "ai_settings" ADD COLUMN     "maxTokens" INTEGER DEFAULT 4096;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "lastOverdueAlertAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "notification_outbox" ADD COLUMN     "nextRetryAt" TIMESTAMPTZ,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ai_agent_definitions_isActive_idx" ON "ai_agent_definitions"("isActive");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "in_app_notifications_userId_type_idx" ON "in_app_notifications"("userId", "type");

-- CreateIndex
CREATE INDEX "notification_outbox_status_nextRetryAt_idx" ON "notification_outbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "parts_catalog_category_idx" ON "parts_catalog"("category");
