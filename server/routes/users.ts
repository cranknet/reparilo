import type { FastifyPluginAsync } from "fastify";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", (_req, _reply) => {
    return { message: "users list" };
  });
};
