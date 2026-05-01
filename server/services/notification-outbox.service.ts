import { OutboxStatus } from "@generated/client";
import type { DbClient } from "../repositories/notification.repository.js";
import {
  createOutboxEntry,
  findManyOutboxEntries,
  updateOutboxEntry,
} from "../repositories/notification.repository.js";
import { findShopSettingsUnique } from "../repositories/settings.repository.js";
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
let isProcessing = false;

export async function queueNotification(
  prisma: DbClient,
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
  await createOutboxEntry(prisma, {
    channel: data.channel,
    jobId: data.jobId ?? null,
    recipientPhone: data.recipientPhone,
    renderedBody,
    status: OutboxStatus.QUEUED,
    templateName: data.templateName,
  });
}

export async function processOutbox(prisma: DbClient): Promise<void> {
  if (isProcessing) {
    return;
  }
  isProcessing = true;
  try {
    const pending = await findManyOutboxEntries(
      prisma,
      { status: OutboxStatus.QUEUED },
      { createdAt: "asc" },
      10
    );

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
        await updateOutboxEntry(
          prisma,
          { id: entry.id },
          {
            error: result.error,
            sentAt: result.success ? new Date() : null,
            status: result.success ? OutboxStatus.SENT : OutboxStatus.FAILED,
          }
        );
      } else {
        logger.warn(
          `Outbox: unexpected channel "${entry.channel}" for entry ${entry.id} — marking FAILED`
        );
        await updateOutboxEntry(
          prisma,
          { id: entry.id },
          {
            error: `Unsupported channel: ${entry.channel}`,
            status: OutboxStatus.FAILED,
          }
        );
      }
    }
  } finally {
    isProcessing = false;
  }
}

export function startOutboxWorker(prisma: DbClient): () => void {
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

async function getWhatsAppConfig(prisma: DbClient): Promise<{
  apiToken: string;
  businessId: string;
  phoneNumberId: string;
} | null> {
  const row = await findShopSettingsUnique(prisma);
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
  prisma: DbClient,
  limit = 50
): Promise<OutboxEntry[]> {
  const entries = await findManyOutboxEntries(
    prisma,
    {},
    { createdAt: "desc" },
    limit
  );
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
