import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { PrismaClient } from "../generated/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "FRONT_DESK",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  plugins: [username()],
});

const SEED_ADMIN_USERNAME = "admin";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";
const SEED_ADMIN_EMAIL = "admin@reparilo.local";

async function main() {
  console.log("Seeding database...");

  const existing = await prisma.user.findUnique({
    where: { username: SEED_ADMIN_USERNAME },
  });

  if (existing) {
    console.log(`Admin user already exists: ${existing.username}`);
    console.log("Skipping seed. Use the admin settings to manage users.");
    return;
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        username: SEED_ADMIN_USERNAME,
        email: SEED_ADMIN_EMAIL,
        password: SEED_ADMIN_PASSWORD,
        name: "Admin",
      },
    });

    await prisma.user.update({
      where: { id: result.user.id },
      data: {
        role: "OWNER",
        mustChangePassword: true,
      },
    });

    console.log(`Admin user created: ${result.user.username}`);
    console.log(
      "Seed complete. Login with the configured password and change it on first access."
    );
  } catch (error) {
    console.error("Failed to create admin user:", error);
    process.exit(1);
  }
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
