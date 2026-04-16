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

export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;
export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>;
export type UpdateNotificationTemplateInput = z.infer<
  typeof updateNotificationTemplateSchema
>;
