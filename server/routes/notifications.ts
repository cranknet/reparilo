import { updateNotificationTemplateSchema } from "@shared/schemas";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
} from "../services/settings.service.js";

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return reply
    .status(status)
    .send({ error: code, message, details: details ?? {} });
}

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
          { errors: parsed.error.flatten().fieldErrors }
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
};
