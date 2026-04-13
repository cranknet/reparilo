import type { FastifyPluginAsync } from "fastify";

export const aiRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", { preHandler: [app.authenticate] }, (_req, _reply) => {
    return { message: "ai analyst" };
  });
};
