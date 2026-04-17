import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ ai: ["access"] }));
  app.get("/", (_req, reply) => reply.send({ message: "ai analyst" }));
};
