import type { PrismaClient } from "@generated/client";
import type {
  UpdateAiSettingsInput,
  UpdateNotificationTemplateInput,
  UpdateShopSettingsInput,
  UpdateWhatsAppSettingsInput,
} from "@shared/schemas";
import { decryptSecret, encryptSecret, isEncrypted } from "../lib/crypto.js";

function publicAiSettings<
  T extends { apiKeyEncrypted: string } | null | undefined,
>(row: T) {
  if (!row) {
    return row;
  }
  const { apiKeyEncrypted, ...rest } = row;
  return { ...rest, hasApiKey: Boolean(apiKeyEncrypted) };
}

export async function getAiSettings(prisma: PrismaClient) {
  const row = await prisma.aiSettings.findUnique({ where: { id: "default" } });
  return publicAiSettings(row);
}

export async function upsertAiSettings(
  prisma: PrismaClient,
  input: UpdateAiSettingsInput
) {
  const data: Record<string, unknown> = {
    endpointUrl: input.endpointUrl,
  };
  // Treat empty apiKey as "no change" to avoid wiping the stored key when the
  // form is saved without the user re-entering it. To clear the key, the
  // caller must send a dedicated signal (not supported by the current UI).
  if (input.apiKey !== undefined && input.apiKey !== "") {
    data.apiKeyEncrypted = encryptSecret(input.apiKey);
  }
  if (input.model !== undefined) {
    data.model = input.model;
  }
  if (input.temperature !== undefined) {
    data.temperature = input.temperature;
  }

  const row = await prisma.aiSettings.upsert({
    create: {
      id: "default",
      apiKeyEncrypted: (data.apiKeyEncrypted as string) ?? "",
      endpointUrl: input.endpointUrl,
      model: input.model ?? null,
      temperature: input.temperature ?? 0.7,
    },
    update: data,
    where: { id: "default" },
  });
  return publicAiSettings(row);
}

export async function getShopSettings(prisma: PrismaClient) {
  return await prisma.shopSettings.findUnique({ where: { id: "default" } });
}

export async function upsertShopSettings(
  prisma: PrismaClient,
  input: UpdateShopSettingsInput
) {
  return await prisma.shopSettings.upsert({
    create: {
      address: input.address ?? null,
      currency: input.currency ?? "DZD",
      id: "default",
      phone: input.phone ?? null,
      receiptFooter: input.receiptFooter ?? null,
      shopName: input.shopName,
    },
    update: {
      address: input.address,
      currency: input.currency,
      phone: input.phone,
      receiptFooter: input.receiptFooter,
      shopName: input.shopName,
    },
    where: { id: "default" },
  });
}

export async function getNotificationTemplates(prisma: PrismaClient) {
  return await prisma.notificationTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updateNotificationTemplate(
  prisma: PrismaClient,
  id: string,
  input: UpdateNotificationTemplateInput
) {
  const existing = await prisma.notificationTemplate.findUnique({
    where: { id },
  });
  if (!existing) {
    return null;
  }

  return await prisma.notificationTemplate.update({
    data: {
      body: input.body,
      channel: input.channel,
      isDefault: input.isDefault,
      name: input.name,
    },
    where: { id },
  });
}

export async function testAiConnection(prisma: PrismaClient) {
  const settings = await prisma.aiSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings) {
    return { message: "AI settings not configured", success: false };
  }
  if (!settings.endpointUrl) {
    return { message: "Endpoint URL is not set", success: false };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (settings.apiKeyEncrypted) {
      const apiKey = isEncrypted(settings.apiKeyEncrypted)
        ? decryptSecret(settings.apiKeyEncrypted)
        : settings.apiKeyEncrypted; // legacy plaintext — re-encrypted on next write
      if (!apiKey) {
        return {
          message: "Stored API key could not be decrypted",
          success: false,
        };
      }
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(settings.endpointUrl, {
      body: JSON.stringify({
        max_tokens: 1,
        messages: [{ content: "ping", role: "user" }],
        model: settings.model ?? "gpt-4",
      }),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      return { message: "Connection successful", success: true };
    }
    return {
      message: `HTTP ${response.status}: ${response.statusText}`,
      success: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { message, success: false };
  }
}

export async function getWhatsAppSettings(prisma: PrismaClient) {
  const row = await prisma.shopSettings.findUnique({
    where: { id: "default" },
  });
  if (!row) {
    return {
      businessId: null,
      enabled: false,
      hasApiToken: false,
      phoneNumberId: null,
    };
  }
  return {
    businessId: row.whatsappBusinessId,
    enabled: row.whatsappEnabled,
    hasApiToken: Boolean(row.whatsappApiTokenEncrypted),
    phoneNumberId: row.whatsappPhoneNumberId,
  };
}

export async function upsertWhatsAppSettings(
  prisma: PrismaClient,
  input: UpdateWhatsAppSettingsInput
) {
  const data: {
    whatsappApiTokenEncrypted?: string;
    whatsappBusinessId?: string;
    whatsappEnabled?: boolean;
    whatsappPhoneNumberId?: string;
  } = {};
  if (input.enabled !== undefined) {
    data.whatsappEnabled = input.enabled;
  }
  if (input.businessId !== undefined) {
    data.whatsappBusinessId = input.businessId;
  }
  if (input.phoneNumberId !== undefined) {
    data.whatsappPhoneNumberId = input.phoneNumberId;
  }
  if (input.apiToken !== undefined && input.apiToken !== "") {
    data.whatsappApiTokenEncrypted = encryptSecret(input.apiToken);
  }

  return await prisma.shopSettings.upsert({
    create: {
      id: "default",
      shopName: "",
      whatsappApiTokenEncrypted: data.whatsappApiTokenEncrypted ?? null,
      whatsappBusinessId: data.whatsappBusinessId ?? null,
      whatsappEnabled: data.whatsappEnabled ?? false,
      whatsappPhoneNumberId: data.whatsappPhoneNumberId ?? null,
    },
    update: data,
    where: { id: "default" },
  });
}
