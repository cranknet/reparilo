import { AppError } from "@shared/errors/app-error.js";
import {
  updateAiSettingsSchema,
  updateShopSettingsSchema,
  updateWhatsAppSettingsSchema,
} from "@shared/schemas/settings.schema";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  getAiSettings,
  getShopSettings,
  getWhatsAppSettings,
  testAiConnection,
  upsertAiSettings,
  upsertShopSettings,
  upsertWhatsAppSettings,
} from "../services/settings.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

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
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
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
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const updated = await upsertShopSettings(app.prisma, parsed.data);
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
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const updated = await upsertWhatsAppSettings(app.prisma, parsed.data);
      return reply.send(updated);
    }
  );
};
