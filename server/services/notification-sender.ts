import { decryptSecret, isEncrypted } from "../lib/crypto.js";

interface WhatsAppConfig {
  apiToken: string;
  businessId: string;
  phoneNumberId: string;
}

interface SendResult {
  error?: string;
  success: boolean;
}

export async function sendWhatsApp(
  config: WhatsAppConfig,
  to: string,
  message: string
): Promise<SendResult> {
  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatPhone(to),
    type: "text",
    text: { body: message },
  };

  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      return { success: true };
    }
    const body = await response.text();
    return {
      success: false,
      error: `WhatsApp API ${response.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function decryptWhatsAppConfig(encrypted: {
  apiTokenEncrypted: string;
  businessId: string;
  phoneNumberId: string;
}): WhatsAppConfig | null {
  if (
    !(
      encrypted.apiTokenEncrypted &&
      encrypted.phoneNumberId &&
      encrypted.businessId
    )
  ) {
    return null;
  }
  const apiToken = isEncrypted(encrypted.apiTokenEncrypted)
    ? decryptSecret(encrypted.apiTokenEncrypted)
    : encrypted.apiTokenEncrypted;
  if (!apiToken) {
    return null;
  }
  return {
    apiToken,
    businessId: encrypted.businessId,
    phoneNumberId: encrypted.phoneNumberId,
  };
}

function formatPhone(phone: string): string {
  // NOTE: Currently only handles Algerian numbers (strips leading 0, adds 213 prefix).
  // International numbers passed as-is. Consider E.164 validation for multi-country support.
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `213${digits.slice(1)}`;
  }
  return digits;
}
