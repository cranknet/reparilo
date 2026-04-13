import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
const prismaPlugin: FastifyPluginAsync = async (app) => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
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
  }
}
