import type { FastifyPluginAsync } from "fastify";

export const aiRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/", (_req, reply) => {
    return reply.send({ message: "ai analyst" });
  });
};
