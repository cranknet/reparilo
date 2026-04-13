import { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const prismaPlugin: FastifyPluginAsync = async (app) => {
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
