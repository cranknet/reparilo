import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate(
    "authenticate",
    // biome-ignore lint/suspicious/noExplicitAny: Fastify decorate requires loose typing
    async (_request: any, _reply: any) => {
      // TODO: Implement Better Auth session validation
      if (process.env.NODE_ENV === "development") {
        return;
      }
      await _reply.status(401).send({ error: "Unauthorized" });
    }
  );
};

declare module "fastify" {
  interface FastifyInstance {
    // biome-ignore lint/suspicious/noExplicitAny: Fastify authenticate hook signature
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
