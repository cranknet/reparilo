import type { Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

interface AiSettingsUpsertInput {
  create: Prisma.AiSettingsCreateInput;
  update: Record<string, unknown>;
  where: Prisma.AiSettingsWhereUniqueInput;
}

interface ShopSettingsUpsertInput {
  create: Prisma.ShopSettingsCreateInput;
  update: Record<string, unknown>;
  where: Prisma.ShopSettingsWhereUniqueInput;
}

interface NotificationTemplateUpdateInput {
  body?: string;
  channel?: string;
  isDefault?: boolean;
  name?: string;
}

export async function findAiSettingsUnique(prisma: DbClient) {
  return await prisma.aiSettings.findUnique({ where: { id: "default" } });
}

export async function upsertAiSettings(
  prisma: DbClient,
  input: AiSettingsUpsertInput
) {
  return await prisma.aiSettings.upsert(input);
}

export async function findShopSettingsUnique(prisma: DbClient) {
  return await prisma.shopSettings.findUnique({ where: { id: "default" } });
}

export async function upsertShopSettings(
  prisma: DbClient,
  input: ShopSettingsUpsertInput
) {
  return await prisma.shopSettings.upsert(input);
}

export async function findManyNotificationTemplates(prisma: DbClient) {
  return await prisma.notificationTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function findNotificationTemplateUnique(
  prisma: DbClient,
  id: string
) {
  return await prisma.notificationTemplate.findUnique({ where: { id } });
}

export async function updateNotificationTemplate(
  prisma: DbClient,
  id: string,
  data: NotificationTemplateUpdateInput
) {
  return await prisma.notificationTemplate.update({ where: { id }, data });
}
