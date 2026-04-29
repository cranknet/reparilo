import { OutboxStatus, type PrismaClient } from "@generated/client";
import { logger } from "../utils/logger.js";
import { renderTemplate } from "./notification-renderer.js";
import { decryptWhatsAppConfig, sendWhatsApp } from "./notification-sender.js";

interface OutboxEntry {
  channel: string;
  createdAt: Date;
  error: string | null;
  id: string;
  jobId: string | null;
  recipientPhone: string;
  renderedBody: string;
  status: OutboxStatus;
  templateName: string;
}

const POLL_INTERVAL_MS = 5000;
let intervalRef: ReturnType<typeof setInterval> | null = null;
// NOTE: isProcessing is per-process state — it will NOT prevent concurrent
// processing across multiple server instances. For Reparilo's single-location
// deployment (one server) this is acceptable. If multi-instance deployment is
// ever needed, this should be replaced with a DB-level advisory lock
// (e.g. SELECT pg_advisory_lock(id) per outbox batch).
// TODO: Add DB-level advisory lock for multi-instance support.
let isProcessing = false;

export async function findTemplate(
  prisma: PrismaClient,
  name: string,
  channel: "WHATSAPP"
) {
  return await prisma.notificationTemplate.findFirst({
    where: { name, channel },
  });
}

export async function queueNotification(
  prisma: PrismaClient,
  data: {
    jobId?: string;
    templateName: string;
    channel: "WHATSAPP";
    recipientPhone: string;
    templateVars: Record<string, string>;
    templateBody: string;
  }
): Promise<void> {
  const renderedBody = renderTemplate(data.templateBody, data.templateVars);
  await prisma.notificationOutbox.create({
    data: {
      channel: data.channel,
      jobId: data.jobId ?? null,
      recipientPhone: data.recipientPhone,
      renderedBody,
      status: OutboxStatus.QUEUED,
      templateName: data.templateName,
    },
  });
}

export async function processOutbox(prisma: PrismaClient): Promise<void> {
  if (isProcessing) {
    return;
  }
  isProcessing = true;
  try {
    const pending = await prisma.notificationOutbox.findMany({
      where: { status: OutboxStatus.QUEUED },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    if (pending.length === 0) {
      return;
    }

    const config = await getWhatsAppConfig(prisma);
    if (!config) {
      return;
    }

    for (const entry of pending) {
      if (entry.channel === "WHATSAPP") {
        const result = await sendWhatsApp(
          config,
          entry.recipientPhone,
          entry.renderedBody
        );
        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            error: result.error,
            sentAt: result.success ? new Date() : null,
            status: result.success ? OutboxStatus.SENT : OutboxStatus.FAILED,
          },
        });
      }
    }
  } finally {
    isProcessing = false;
  }
}

export function startOutboxWorker(prisma: PrismaClient): () => void {
  intervalRef = setInterval(() => {
    processOutbox(prisma).catch((err) => {
      logger.error("Outbox worker error:", err);
    });
  }, POLL_INTERVAL_MS);
  if (intervalRef.unref) {
    intervalRef.unref();
  }
  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
    }
  };
}

async function getWhatsAppConfig(prisma: PrismaClient): Promise<{
  apiToken: string;
  businessId: string;
  phoneNumberId: string;
} | null> {
  const row = await prisma.shopSettings.findUnique({
    where: { id: "default" },
  });
  if (!row) {
    return null;
  }

  if (
    !(
      row.whatsappApiTokenEncrypted &&
      row.whatsappBusinessId &&
      row.whatsappPhoneNumberId
    )
  ) {
    return null;
  }

  return decryptWhatsAppConfig({
    apiTokenEncrypted: row.whatsappApiTokenEncrypted,
    businessId: row.whatsappBusinessId,
    phoneNumberId: row.whatsappPhoneNumberId,
  });
}

export async function getOutboxLogs(
  prisma: PrismaClient,
  limit = 50
): Promise<OutboxEntry[]> {
  const entries = await prisma.notificationOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map((e) => ({
    channel: e.channel,
    createdAt: e.createdAt,
    error: e.error,
    id: e.id,
    jobId: e.jobId,
    renderedBody: e.renderedBody,
    recipientPhone: e.recipientPhone,
    status: e.status,
    templateName: e.templateName,
  }));
}
