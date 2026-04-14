import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("settings:read"));
  app.get("/", (_req, reply) => {
    return reply.send({ message: "settings" });
  });
};
