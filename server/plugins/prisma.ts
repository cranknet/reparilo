import { PrismaPg } from "@prisma/adapter-pg";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { PrismaClient } from "../../generated/client";
import { loadEnv } from "../config/env.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
const prismaPlugin: FastifyPluginAsync = async (app) => {
  const adapter = new PrismaPg({
    connectionString: loadEnv().DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  app.decorate("prisma", prisma);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin);

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    wsBroadcast?: (
      predicate: (client: {
        role: string;
        socket: import("ws").WebSocket;
        userId: string;
      }) => boolean,
      payload: Record<string, unknown>
    ) => void;
  }
}
