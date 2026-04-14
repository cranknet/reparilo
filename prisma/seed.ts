import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SEED_ADMIN_USERNAME = "admin";

async function main() {
  console.log("Seeding database...");

  console.log("Creating owner role...");
  const ownerRole = await prisma.user.upsert({
    where: { username: SEED_ADMIN_USERNAME },
    update: {},
    create: {
      username: SEED_ADMIN_USERNAME,
      email: "admin@reparilo.local",
      password: await hashPassword(
        process.env.SEED_ADMIN_PASSWORD || "admin123"
      ),
      role: "OWNER",
      isActive: true,
    },
  });

  console.log(`Admin user seeded: ${ownerRole.username}`);
  console.log("Seed complete. Set a real password via the app on first login.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
