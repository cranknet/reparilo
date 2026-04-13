import type { FastifyPluginAsync } from "fastify";

export const partsRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", (_req, _reply) => {
    return { message: "parts list" };
  });
};
