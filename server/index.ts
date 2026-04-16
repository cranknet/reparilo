import "dotenv/config";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import authPlugin from "./plugins/auth.js";
import prismaPlugin from "./plugins/prisma.js";
import { websocketPlugin } from "./plugins/websocket.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { customersRoutes } from "./routes/customers.js";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { partsRoutes } from "./routes/parts.js";
import { settingsRoutes } from "./routes/settings.js";
import { usersRoutes } from "./routes/users.js";

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
await app.register(websocket);

await app.register(prismaPlugin);
app.register(authRoutes);
await app.register(authPlugin);
await app.register(websocketPlugin);

app.register(healthRoutes);
app.register(jobRoutes, { prefix: "/api/jobs" });
app.register(partsRoutes, { prefix: "/api/parts" });
app.register(customersRoutes, { prefix: "/api/customers" });
app.register(usersRoutes, { prefix: "/api/users" });
app.register(notificationsRoutes, { prefix: "/api/notifications" });
app.register(settingsRoutes, { prefix: "/api/settings" });
app.register(aiRoutes, { prefix: "/api/ai" });

if (process.env.NODE_ENV === "production") {
  await app.register(staticPlugin, {
    root: path.resolve("dist"),
    wildcard: false,
  });
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile("index.html");
  });
}

if (process.env.NODE_ENV !== "production") {
  await app.register(staticPlugin, {
    root: path.resolve("uploads"),
    prefix: "/api/uploads/",
    decorateReply: false,
  });
}

process.on("uncaughtException", (err) => {
  app.log.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  app.log.fatal({ err }, "Unhandled rejection");
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Reparilo server running on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
