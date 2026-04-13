import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);

  app.addHook("preHandler", async (request, reply) => {
    if (process.env.AUTH_BYPASS === "true") {
      request.user = { id: "dev", role: "OWNER", username: "dev" };
      return;
    }
    // TODO: Implement Better Auth session validation (next task)
    // Skip auth for health and tracking routes
    if (request.url === "/health" || request.url.startsWith("/tracking")) {
      return;
    }
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
    }
  });
};

export default fp(authPlugin);

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      role: string;
      username: string;
    } | null;
  }
}
