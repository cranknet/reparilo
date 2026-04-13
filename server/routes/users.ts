import type { FastifyPluginAsync } from "fastify";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", { preHandler: [app.authenticate] }, (_req, _reply) => {
    return { message: "users list" };
  });
};
