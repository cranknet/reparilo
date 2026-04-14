import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("notifications:manage"));
  app.get("/", (_req, reply) => {
    return reply.send({ message: "notifications list" });
  });
};
