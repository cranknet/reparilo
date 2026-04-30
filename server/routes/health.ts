import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
      },
    },
    async (_req, reply) => {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        return { status: "ok", timestamp: new Date().toISOString() };
      } catch {
        return reply
          .status(503)
          .send({ status: "unhealthy", timestamp: new Date().toISOString() });
      }
    }
  );
};
