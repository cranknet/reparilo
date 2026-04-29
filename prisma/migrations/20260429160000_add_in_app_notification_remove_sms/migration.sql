-- AlterEnum
BEGIN;
CREATE TYPE "NotifyChannel_new" AS ENUM ('WHATSAPP', 'IN_APP');
ALTER TABLE "notification_templates" ALTER COLUMN "channel" TYPE "NotifyChannel_new" USING ("channel"::text::"NotifyChannel_new");
ALTER TABLE "notification_outbox" ALTER COLUMN "channel" TYPE "NotifyChannel_new" USING ("channel"::text::"NotifyChannel_new");
ALTER TYPE "NotifyChannel" RENAME TO "NotifyChannel_old";
ALTER TYPE "NotifyChannel_new" RENAME TO "NotifyChannel";
DROP TYPE "public"."NotifyChannel_old";
COMMIT;

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "in_app_notifications_userId_readAt_idx" ON "in_app_notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "in_app_notifications_readAt_createdAt_idx" ON "in_app_notifications"("readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;