import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    { preHandler: [requirePermission("notifications:read")] },
    (_req, reply) => {
      return reply.send({ message: "notifications list" });
    }
  );
};
