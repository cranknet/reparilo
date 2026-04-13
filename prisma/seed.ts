import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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
      password: "$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder",
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
