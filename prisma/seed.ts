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

if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error("SEED_ADMIN_PASSWORD env var is required");
}

const SEED_ADMIN_USERNAME = "admin";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const SEED_ADMIN_EMAIL = "admin@reparilo.local";

async function main() {
  console.log("Seeding database...");

  const existing = await prisma.user.findUnique({
    where: { username: SEED_ADMIN_USERNAME },
  });

  if (existing) {
    console.log(`Admin user already exists: ${existing.username}`);
    console.log("Skipping admin seed. Seeding notification templates...");
    await seedNotificationTemplates();
    await seedAgentDefinitions();
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

  await seedNotificationTemplates();
  await seedAgentDefinitions();
}

async function seedNotificationTemplates() {
  const templates = [
    {
      name: "job_created",
      channel: "WHATSAPP" as const,
      body: "Hello {{customerName}}, your repair {{jobCode}} has been registered at {{shopName}}. You can track it at {{shopName}}/tracking/{{jobCode}}",
      isDefault: true,
    },
    {
      name: "job_done",
      channel: "WHATSAPP" as const,
      body: "Hello {{customerName}}, your device {{jobCode}} repair is complete and ready for pickup at {{shopName}}.",
      isDefault: true,
    },
    {
      name: "job_in_repair",
      channel: "WHATSAPP" as const,
      body: "Hello {{customerName}}, your device {{jobCode}} is now being repaired at {{shopName}}.",
      isDefault: true,
    },
    {
      name: "job_waiting_parts",
      channel: "WHATSAPP" as const,
      body: "Hello {{customerName}}, we are waiting for parts for your device {{jobCode}} at {{shopName}}.",
      isDefault: true,
    },
    {
      name: "job_delivered",
      channel: "WHATSAPP" as const,
      body: "Hello {{customerName}}, your device {{jobCode}} has been delivered. Thank you for choosing {{shopName}}!",
      isDefault: true,
    },
  ];

  for (const tmpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { name_channel: { name: tmpl.name, channel: tmpl.channel } },
      create: tmpl,
      update: {},
    });
  }
  console.log("Notification templates seeded.");
}

async function seedAgentDefinitions() {
  const agents = [
    {
      name: "general_assistant",
      displayName: "General Assistant",
      instructions:
        "You are a helpful AI assistant for a phone repair shop called Reparilo.\nYou have access to the shop's database and can answer questions about repairs, parts, customers, revenue, and more.\nAlways respond in the language the user writes in. Be concise and data-driven.\nWhen showing numbers, format them as currency when appropriate.",
      toolNames: ["queryDatabase", "getSchema"],
      isActive: true,
      isBuiltIn: true,
    },
    {
      name: "data_analyst",
      displayName: "Data Analyst",
      instructions:
        "You are a data analyst for a phone repair shop. You specialize in business insights, revenue analysis, and trend detection.\nAlways start by understanding the time period the user is interested in.\nUse charts-friendly formats when possible (tables with clear headers).\nRespond in the user's language.",
      toolNames: ["queryDatabase", "getSchema"],
      isActive: true,
      isBuiltIn: true,
    },
  ];

  for (const agent of agents) {
    await prisma.aiAgentDefinition.upsert({
      where: { name: agent.name },
      update: {},
      create: agent,
    });
  }
  console.log("Agent definitions seeded.");
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
