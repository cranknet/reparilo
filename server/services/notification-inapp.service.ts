import type { PrismaClient } from "@generated/client";
import { logger } from "../utils/logger.js";

const CLEANUP_THRESHOLD_DAYS = 30;

export async function getInAppNotifications(
  prisma: PrismaClient,
  userId: string,
  filter: "all" | "unread" | "read" = "all",
  limit = 50
) {
  const where: Record<string, unknown> = { userId };
  if (filter === "unread") {
    where.readAt = null;
  } else if (filter === "read") {
    where.readAt = { not: null };
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.inAppNotification.findMany({
      include: { job: { select: { id: true, jobCode: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      where,
    }),
    prisma.inAppNotification.count({
      where: { userId, readAt: null },
    }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationRead(
  prisma: PrismaClient,
  id: string,
  userId: string
) {
  const notification = await prisma.inAppNotification.findFirst({
    where: { id, userId },
  });
  if (!notification) {
    return null;
  }
  if (notification.readAt) {
    return notification;
  }
  return await prisma.inAppNotification.update({
    data: { readAt: new Date() },
    where: { id },
  });
}

export async function markAllNotificationsRead(
  prisma: PrismaClient,
  userId: string
) {
  const result = await prisma.inAppNotification.updateMany({
    data: { readAt: new Date() },
    where: { readAt: null, userId },
  });
  return { count: result.count };
}

export async function cleanupReadNotifications(prisma: PrismaClient) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CLEANUP_THRESHOLD_DAYS);

  const result = await prisma.inAppNotification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      readAt: { not: null },
    },
  });

  if (result.count > 0) {
    logger.info(
      `[cleanup] Deleted ${result.count} read notifications older than ${CLEANUP_THRESHOLD_DAYS} days`
    );
  }
}
