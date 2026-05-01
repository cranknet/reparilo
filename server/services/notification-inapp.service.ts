import type { DbClient } from "../repositories/notification.repository.js";
import {
  countInAppNotifications,
  deleteManyInAppNotifications,
  findFirstInAppNotification,
  findManyInAppNotifications,
  updateInAppNotification,
  updateManyInAppNotifications,
} from "../repositories/notification.repository.js";
import { logger } from "../utils/logger.js";

const CLEANUP_THRESHOLD_DAYS = 30;

export async function getInAppNotifications(
  prisma: DbClient,
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
    findManyInAppNotifications(
      prisma,
      where,
      { job: { select: { id: true, jobCode: true } } },
      { createdAt: "desc" },
      limit
    ),
    countInAppNotifications(prisma, { userId, readAt: null }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationRead(
  prisma: DbClient,
  id: string,
  userId: string
) {
  const notification = await findFirstInAppNotification(prisma, {
    id,
    userId,
  });
  if (!notification) {
    return null;
  }
  if (notification.readAt) {
    return notification;
  }
  return await updateInAppNotification(prisma, { id }, { readAt: new Date() });
}

export async function markAllNotificationsRead(
  prisma: DbClient,
  userId: string
) {
  const result = await updateManyInAppNotifications(
    prisma,
    { readAt: null, userId },
    { readAt: new Date() }
  );
  return { count: result.count };
}

export async function cleanupReadNotifications(prisma: DbClient) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CLEANUP_THRESHOLD_DAYS);

  const result = await deleteManyInAppNotifications(prisma, {
    createdAt: { lt: cutoff },
    readAt: { not: null },
  });

  if (result.count > 0) {
    logger.info(
      `[cleanup] Deleted ${result.count} read notifications older than ${CLEANUP_THRESHOLD_DAYS} days`
    );
  }
}
