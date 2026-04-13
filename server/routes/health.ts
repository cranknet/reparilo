import type { FastifyPluginAsync } from "fastify";
import "../plugins/prisma";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/health", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", timestamp: new Date().toISOString() };
  });
};
