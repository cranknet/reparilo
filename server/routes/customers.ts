import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const customersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("customers:read"));
  app.get("/", (_req, reply) => {
    return reply.send({ message: "customers list" });
  });
};
