import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("jobs:read"));
  app.get("/", (_req, reply) => {
    return reply.send({ message: "jobs list" });
  });
};
