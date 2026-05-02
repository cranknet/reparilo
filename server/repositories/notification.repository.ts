import type { Prisma } from "@generated/client";
import type { DbClient } from "./types.js";

export async function findManyInAppNotifications(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereInput,
  include: Prisma.InAppNotificationInclude,
  orderBy: Prisma.InAppNotificationOrderByWithRelationInput,
  take: number
) {
  return await prisma.inAppNotification.findMany({
    where,
    include,
    orderBy,
    take,
  });
}

export async function countInAppNotifications(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereInput
) {
  return await prisma.inAppNotification.count({ where });
}

export async function findFirstInAppNotification(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereInput
) {
  return await prisma.inAppNotification.findFirst({ where });
}

export async function updateInAppNotification(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereUniqueInput,
  data: Prisma.InAppNotificationUpdateInput
) {
  return await prisma.inAppNotification.update({ where, data });
}

export async function updateManyInAppNotifications(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereInput,
  data: Prisma.InAppNotificationUpdateInput
) {
  return await prisma.inAppNotification.updateMany({ where, data });
}

export async function deleteInAppNotification(prisma: DbClient, id: string) {
  return await prisma.inAppNotification.delete({ where: { id } });
}

export async function deleteOutboxEntry(prisma: DbClient, id: string) {
  return await prisma.notificationOutbox.delete({ where: { id } });
}

export async function deleteManyInAppNotifications(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereInput
) {
  return await prisma.inAppNotification.deleteMany({ where });
}

export async function createManyAndReturnInAppNotifications(
  prisma: DbClient,
  data: Prisma.InAppNotificationCreateManyInput[]
) {
  return await prisma.inAppNotification.createManyAndReturn({ data });
}

export async function createOutboxEntry(
  prisma: DbClient,
  data: Prisma.NotificationOutboxCreateInput
) {
  return await prisma.notificationOutbox.create({ data });
}

export async function findManyOutboxEntries(
  prisma: DbClient,
  where: Prisma.NotificationOutboxWhereInput,
  orderBy: Prisma.NotificationOutboxOrderByWithRelationInput,
  take: number
) {
  return await prisma.notificationOutbox.findMany({ where, orderBy, take });
}

export async function updateOutboxEntry(
  prisma: DbClient,
  where: Prisma.NotificationOutboxWhereUniqueInput,
  data: Prisma.NotificationOutboxUpdateInput
) {
  return await prisma.notificationOutbox.update({ where, data });
}

export async function findManyNotificationTemplatesByName(
  prisma: DbClient,
  name: string
) {
  return await prisma.notificationTemplate.findMany({
    where: { name },
  });
}

export async function findManyUsers(
  prisma: DbClient,
  where: Prisma.UserWhereInput,
  select: Prisma.UserSelect
) {
  return await prisma.user.findMany({ where, select });
}

export async function findNotificationTemplateUnique(
  prisma: DbClient,
  id: string
) {
  return await prisma.notificationTemplate.findUnique({ where: { id } });
}
