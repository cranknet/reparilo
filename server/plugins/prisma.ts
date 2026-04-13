import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

export const prismaPlugin: FastifyPluginAsync = async (app) => {
  await app;
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  app.decorate("prisma", prisma);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
