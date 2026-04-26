import {
  updateAiSettingsSchema,
  updateNotificationTemplateSchema,
  updateShopSettingsSchema,
  updateWhatsAppSettingsSchema,
} from "@shared/schemas";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  getAiSettings,
  getNotificationTemplates,
  getShopSettings,
  getWhatsAppSettings,
  testAiConnection,
  updateNotificationTemplate,
  upsertAiSettings,
  upsertShopSettings,
  upsertWhatsAppSettings,
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
export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ settings: ["view"] }));

  app.get("/", async (_req, reply) => {
    const [ai, shop] = await Promise.all([
      getAiSettings(app.prisma),
      getShopSettings(app.prisma),
    ]);
    return reply.send({ ai, shop });
  });

  app.get("/ai", async (_req, reply) => {
    const ai = await getAiSettings(app.prisma);
    return reply.send(ai);
  });

  app.put(
    "/ai",
    { preHandler: [requirePermission({ settings: ["edit"] })] },
    async (req, reply) => {
      const parsed = updateAiSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      const updated = await upsertAiSettings(app.prisma, parsed.data);
      return reply.send(updated);
    }
  );

  app.post(
    "/ai/test",
    { preHandler: [requirePermission({ settings: ["edit"] })] },
    async (_req, reply) => {
      const result = await testAiConnection(app.prisma);
      return reply.send(result);
    }
  );

  app.get("/shop", async (_req, reply) => {
    const shop = await getShopSettings(app.prisma);
    return reply.send(shop);
  });

  app.put(
    "/shop",
    { preHandler: [requirePermission({ settings: ["edit"] })] },
    async (req, reply) => {
      const parsed = updateShopSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      const updated = await upsertShopSettings(app.prisma, parsed.data);
      return reply.send(updated);
    }
  );

  app.get("/notifications/templates", async (_req, reply) => {
    const templates = await getNotificationTemplates(app.prisma);
    return reply.send(templates);
  });

  app.put(
    "/notifications/templates/:id",
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

  app.get("/whatsapp", async (_req, reply) => {
    const settings = await getWhatsAppSettings(app.prisma);
    return reply.send(settings);
  });

  app.put(
    "/whatsapp",
    { preHandler: [requirePermission({ settings: ["edit"] })] },
    async (req, reply) => {
      const parsed = updateWhatsAppSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      const updated = await upsertWhatsAppSettings(app.prisma, parsed.data);
      return reply.send(updated);
    }
  );
};
