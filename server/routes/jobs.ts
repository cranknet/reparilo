import type { FastifyPluginAsync } from "fastify";

export const jobRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", (_req, _reply) => {
    return { message: "jobs list" };
  });
};
