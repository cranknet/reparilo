import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { Auth } from "../lib/auth.js";
import { createAuth, getSessionFromRequest } from "../lib/auth.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
const authPlugin: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma;
  const auth = createAuth(prisma);

  app.decorate("auth", auth);
  app.decorateRequest("user", null);

  // Mount Better Auth handler at /api/auth/*
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const headers = fromNodeHeaders(request.headers);

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.method === "POST" && request.body
            ? { body: JSON.stringify(request.body) }
            : {}),
        });

        const response = await auth.handler(req);

        reply.status(response.status);
        for (const [key, value] of response.headers.entries()) {
          reply.header(key, value);
        }
        reply.send(response.body ? await response.text() : null);
      } catch (error) {
        app.log.error(error, "Better Auth handler error");
        reply.status(500).send({ error: "Internal authentication error" });
      }
    },
  });

  // Pre-handler: auth bypass, session validation, inactive check
  app.addHook("preHandler", async (request, reply) => {
    // Dev bypass
    if (
      process.env.AUTH_BYPASS === "true" &&
      process.env.NODE_ENV !== "production"
    ) {
      request.user = {
        id: "dev",
        role: "OWNER",
        username: "dev",
        isActive: true,
        mustChangePassword: false,
      };
      return;
    }

    // Skip auth for health, tracking, and /api/auth routes
    if (
      request.url === "/health" ||
      request.url.startsWith("/tracking") ||
      request.url.startsWith("/api/auth")
    ) {
      return;
    }

    const session = await getSessionFromRequest(auth, request);

    if (!session) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    if (!session.isActive) {
      await reply.status(403).send({ error: "Account is disabled" });
      return;
    }

    request.user = session;
  });
};

export default fp(authPlugin);

declare module "fastify" {
  interface FastifyInstance {
    auth: Auth;
  }
  interface FastifyRequest {
    user: {
      id: string;
      role: string;
      username: string;
      isActive: boolean;
      mustChangePassword: boolean;
    } | null;
  }
}
