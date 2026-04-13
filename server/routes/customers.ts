import type { FastifyPluginAsync } from "fastify";

export const customersRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", (_req, reply) => {
    return reply.send({ message: "customers list" });
  });
};
