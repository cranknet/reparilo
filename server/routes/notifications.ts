import { AppError } from "@shared/errors/app-error.js";
import {
  listInAppQuerySchema,
  markReadParamSchema,
} from "@shared/schemas/notification.schema";
import { updateNotificationTemplateSchema } from "@shared/schemas/settings.schema";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  getInAppNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification-inapp.service.js";
import { getOutboxLogs } from "../services/notification-outbox.service.js";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
} from "../services/settings.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/templates",
    {
      preHandler: [requirePermission({ notifications: ["read"] })],
      schema: {
        tags: ["notifications"],
        summary: "Get notification templates",
      },
    },
    async (_req, reply) => {
      const templates = await getNotificationTemplates(app.prisma);
      return reply.send(templates);
    }
  );

  app.put(
    "/templates/:id",
    {
      preHandler: [requirePermission({ notifications: ["manage"] })],
      schema: {
        tags: ["notifications"],
        summary: "Update notification template",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateNotificationTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const updated = await updateNotificationTemplate(
        app.prisma,
        id,
        parsed.data
      );
      if (!updated) {
        throw new AppError("TEMPLATE_NOT_FOUND");
      }
      return reply.send(updated);
    }
  );

  app.get(
    "/in-app",
    {
      preHandler: [requirePermission({ notifications: ["read"] })],
      schema: {
        tags: ["notifications"],
        summary: "List in-app notifications",
        querystring: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const parsed = listInAppQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const result = await getInAppNotifications(
        app.prisma,
        req.user.id,
        parsed.data.filter,
        parsed.data.limit
      );
      return reply.send({
        notifications: result.notifications,
        unreadCount: result.unreadCount,
      });
    }
  );

  app.put(
    "/in-app/:id/read",
    {
      preHandler: [requirePermission({ notifications: ["read"] })],
      schema: {
        tags: ["notifications"],
        summary: "Mark notification read",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = markReadParamSchema.safeParse({ id });
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const notification = await markNotificationRead(
        app.prisma,
        parsed.data.id,
        req.user.id
      );
      if (!notification) {
        throw new AppError("NOT_FOUND");
      }
      return reply.send({ id: notification.id, readAt: notification.readAt });
    }
  );

  app.put(
    "/in-app/read-all",
    {
      preHandler: [requirePermission({ notifications: ["read"] })],
      schema: {
        tags: ["notifications"],
        summary: "Mark all notifications read",
      },
    },
    async (req, reply) => {
      const result = await markAllNotificationsRead(app.prisma, req.user.id);
      return reply.send({ count: result.count });
    }
  );

  app.get(
    "/outbox",
    {
      preHandler: [requirePermission({ notifications: ["read"] })],
      schema: { tags: ["notifications"], summary: "Get outbox logs" },
    },
    async (_req, reply) => {
      const logs = await getOutboxLogs(app.prisma);
      return reply.send(logs);
    }
  );

  app.post(
    "/test/:templateId",
    {
      preHandler: [requirePermission({ notifications: ["manage"] })],
      schema: {
        tags: ["notifications"],
        summary: "Send test notification",
        params: {
          type: "object",
          properties: { templateId: { type: "string" } },
          required: ["templateId"],
        },
      },
    },
    async (req, reply) => {
      const { templateId } = req.params as { templateId: string };
      const template = await app.prisma.notificationTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        throw new AppError("TEMPLATE_NOT_FOUND");
      }
      if (template.channel !== "WHATSAPP") {
        throw new AppError("TEMPLATE_NOT_FOUND");
      }
      const shop = await app.prisma.shopSettings.findUnique({
        where: { id: "default" },
      });
      const phone = shop?.phone;
      if (!phone) {
        throw new AppError("NO_SHOP_PHONE");
      }
      const { queueNotification } = await import(
        "../services/notification-outbox.service.js"
      );
      await queueNotification(app.prisma, {
        channel: "WHATSAPP" as const,
        recipientPhone: phone,
        templateBody: template.body,
        templateName: template.name,
        templateVars: {
          customerName: "Test",
          jobCode: "TEST-001",
          shopName: shop?.shopName ?? "Reparilo",
        },
      });
      return reply.send({ message: "Test notification queued", success: true });
    }
  );
};
