import type { FastifyPluginAsync } from "fastify";

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", { preHandler: [app.authenticate] }, (_req, _reply) => {
    return { message: "settings" };
  });
};
