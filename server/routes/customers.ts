import type { FastifyPluginAsync } from "fastify";

export const customersRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", { preHandler: [app.authenticate] }, (_req, _reply) => {
    return { message: "customers list" };
  });
};
