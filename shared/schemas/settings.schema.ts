import { z } from "zod";

export const updateAiSettingsSchema = z.object({
  endpointUrl: z.string().min(1, "Endpoint URL is required"),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const updateShopSettingsSchema = z.object({
  shopName: z.string().min(1, "Shop name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  currency: z.string().optional(),
  receiptFooter: z.string().optional(),
});

export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["WHATSAPP", "SMS"]),
  body: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const updateWhatsAppSettingsSchema = z
  .object({
    apiToken: z.string().optional(),
    businessId: z.string().optional(),
    phoneNumberId: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.apiToken !== undefined ||
      data.businessId !== undefined ||
      data.phoneNumberId !== undefined ||
      data.enabled !== undefined,
    { message: "errors.at_least_one_field" }
  );

export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;
export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>;
export type UpdateNotificationTemplateInput = z.infer<
  typeof updateNotificationTemplateSchema
>;
export type UpdateWhatsAppSettingsInput = z.infer<
  typeof updateWhatsAppSettingsSchema
>;
