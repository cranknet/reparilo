import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate(
    "authenticate",
    // biome-ignore lint/suspicious/noExplicitAny: Fastify decorate requires loose typing
    async (request: any, reply: any) => {
      if (process.env.AUTH_BYPASS === "true") {
        request.user = { id: "dev", role: "OWNER", username: "dev" };
        return;
      }
      // TODO: Implement Better Auth session validation (next task)
      await reply.status(401).send({ error: "Unauthorized" });
    }
  );
};

declare module "fastify" {
  interface FastifyInstance {
    // biome-ignore lint/suspicious/noExplicitAny: Fastify authenticate hook signature
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
