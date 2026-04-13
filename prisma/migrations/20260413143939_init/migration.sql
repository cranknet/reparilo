-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'TECHNICIAN', 'FRONT_DESK');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('INTAKE', 'WAITING_FOR_PARTS', 'IN_REPAIR', 'ON_HOLD', 'DONE', 'DELIVERED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('SCREEN', 'BATTERY', 'CHARGING_PORT', 'CAMERA', 'SPEAKER', 'MICROPHONE', 'MOTHERBOARD', 'HOUSING', 'BUTTON', 'OTHER');

-- CreateEnum
CREATE TYPE "RepairCategory" AS ENUM ('HARDWARE', 'SOFTWARE', 'DIAGNOSTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "NotifyChannel" AS ENUM ('WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('JOB_CREATED', 'STATUS_CHANGED', 'TECHNICIAN_ASSIGNED', 'COST_UPDATED', 'PART_ADDED', 'PART_REMOVED', 'REPAIR_ADDED', 'REPAIR_REMOVED', 'NOTE_ADDED', 'PHOTO_ADDED', 'WARRANTY_RETURN_CREATED', 'NOTIFICATION_SENT');

-- CreateEnum
CREATE TYPE "AiRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_counters" (
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobCode" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "color" TEXT,
    "reportedProblem" TEXT NOT NULL,
    "conditionNotes" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'INTAKE',
    "estimatedCost" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2),
    "estimatedDate" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isWarrantyReturn" BOOLEAN NOT NULL DEFAULT false,
    "warrantyForJobId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "technicianId" TEXT,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_photos" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_notes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_parts_waiting" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "supplier" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_parts_waiting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PartCategory" NOT NULL,
    "defaultPrice" DECIMAL(10,2) NOT NULL,
    "supplier" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "parts_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_parts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "partId" TEXT,
    "partName" TEXT NOT NULL,
    "category" "PartCategory" NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "supplier" TEXT,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RepairCategory" NOT NULL,
    "defaultPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "repair_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_repairs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "repairId" TEXT,
    "repairName" TEXT NOT NULL,
    "category" "RepairCategory" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_repairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotifyChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL DEFAULT '',
    "apiKeyEncrypted" TEXT NOT NULL DEFAULT '',
    "model" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AiRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL,
    "shopName" TEXT NOT NULL DEFAULT '',
    "logoPath" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "receiptFooter" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "devices_brand_idx" ON "devices"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "devices_brand_model_key" ON "devices"("brand", "model");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobCode_key" ON "jobs"("jobCode");

-- CreateIndex
CREATE INDEX "jobs_customerId_idx" ON "jobs"("customerId");

-- CreateIndex
CREATE INDEX "jobs_deviceId_idx" ON "jobs"("deviceId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_technicianId_idx" ON "jobs"("technicianId");

-- CreateIndex
CREATE INDEX "jobs_createdById_idx" ON "jobs"("createdById");

-- CreateIndex
CREATE INDEX "jobs_warrantyForJobId_idx" ON "jobs"("warrantyForJobId");

-- CreateIndex
CREATE INDEX "jobs_status_createdAt_idx" ON "jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_status_estimatedDate_idx" ON "jobs"("status", "estimatedDate");

-- CreateIndex
CREATE INDEX "job_photos_jobId_idx" ON "job_photos"("jobId");

-- CreateIndex
CREATE INDEX "job_notes_jobId_isCustomerVisible_idx" ON "job_notes"("jobId", "isCustomerVisible");

-- CreateIndex
CREATE INDEX "job_parts_waiting_jobId_idx" ON "job_parts_waiting"("jobId");

-- CreateIndex
CREATE INDEX "parts_catalog_name_idx" ON "parts_catalog"("name");

-- CreateIndex
CREATE INDEX "job_parts_jobId_idx" ON "job_parts"("jobId");

-- CreateIndex
CREATE INDEX "repair_catalog_name_idx" ON "repair_catalog"("name");

-- CreateIndex
CREATE INDEX "job_repairs_jobId_idx" ON "job_repairs"("jobId");

-- CreateIndex
CREATE INDEX "audit_logs_jobId_idx" ON "audit_logs"("jobId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notification_templates_channel_idx" ON "notification_templates"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_name_channel_key" ON "notification_templates"("name", "channel");

-- CreateIndex
CREATE INDEX "ai_chat_history_userId_createdAt_idx" ON "ai_chat_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_chat_history_createdAt_idx" ON "ai_chat_history"("createdAt");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_warrantyForJobId_fkey" FOREIGN KEY ("warrantyForJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts_waiting" ADD CONSTRAINT "job_parts_waiting_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_repairs" ADD CONSTRAINT "job_repairs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_repairs" ADD CONSTRAINT "job_repairs_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "repair_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_repairs" ADD CONSTRAINT "job_repairs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_history" ADD CONSTRAINT "ai_chat_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
