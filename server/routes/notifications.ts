import { updateNotificationTemplateSchema } from "@shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { getOutboxLogs } from "../services/notification-outbox.service.js";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
} from "../services/settings.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";
import { sendError } from "../utils/send-error.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/templates",
    { preHandler: [requirePermission({ notifications: ["read"] })] },
    async (_req, reply) => {
      const templates = await getNotificationTemplates(app.prisma);
      return reply.send(templates);
    }
  );

  app.put(
    "/templates/:id",
    { preHandler: [requirePermission({ notifications: ["manage"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateNotificationTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
          }
        );
      }
      const updated = await updateNotificationTemplate(
        app.prisma,
        id,
        parsed.data
      );
      if (!updated) {
        return sendError(
          reply,
          404,
          "TEMPLATE_NOT_FOUND",
          "Notification template not found"
        );
      }
      return reply.send(updated);
    }
  );

  app.get(
    "/outbox",
    { preHandler: [requirePermission({ notifications: ["read"] })] },
    async (_req, reply) => {
      const logs = await getOutboxLogs(app.prisma);
      return reply.send(logs);
    }
  );

  app.post(
    "/test/:templateId",
    { preHandler: [requirePermission({ notifications: ["manage"] })] },
    async (req, reply) => {
      const { templateId } = req.params as { templateId: string };
      const template = await app.prisma.notificationTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        return sendError(
          reply,
          404,
          "TEMPLATE_NOT_FOUND",
          "Template not found"
        );
      }
      // NOTE: Test sends to the shop's own phone number. This validates the
      // WhatsApp connection works end-to-end but doesn't prove delivery to a customer.
      const shop = await app.prisma.shopSettings.findUnique({
        where: { id: "default" },
      });
      const phone = shop?.phone;
      if (!phone) {
        return sendError(
          reply,
          400,
          "NO_SHOP_PHONE",
          "Shop phone not configured"
        );
      }
      const { queueNotification } = await import(
        "../services/notification-outbox.service.js"
      );
      await queueNotification(app.prisma, {
        channel: template.channel,
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
