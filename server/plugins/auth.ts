import type { PrismaClient } from "@prisma/client";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { Auth } from "../lib/auth.js";
import { createAuth, getSessionFromRequest } from "../lib/auth.js";

async function auditSignIn(
  auth: Auth,
  headers: Headers,
  prisma: PrismaClient
): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      await prisma.auditLog.create({
        data: {
          jobId: null,
          userId: session.user.id,
          action: "USER_SIGN_IN",
          toValue: `Sign-in for ${session.user.username ?? session.user.email}`,
        },
      });
    }
  } catch {
    // Audit failure should not block sign-in
  }
}

function extractBody(method: string, body: unknown): string | undefined {
  const isMutation =
    method === "POST" || method === "PUT" || method === "PATCH";
  return isMutation && body ? JSON.stringify(body) : undefined;
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
const authPlugin: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma;
  const auth = createAuth(prisma);

  app.decorate("auth", auth);
  app.decorateRequest("user", null);

  app.all("/api/auth/*", async (request, reply) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);
      const body = extractBody(request.method, request.body);

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body ? { body } : {}),
      });

      const response = await auth.handler(req);

      if (
        response.status === 200 &&
        request.method === "POST" &&
        url.pathname.includes("sign-in")
      ) {
        await auditSignIn(auth, headers, prisma);
      }

      app.log.info(
        { status: response.status, path: url.pathname, method: request.method },
        "Better Auth handler response"
      );

      reply.status(response.status);
      for (const [key, value] of response.headers.entries()) {
        reply.header(key, value);
      }
      const text = await response.text();
      reply.send(text || null);
    } catch (err) {
      app.log.error(err, "Better Auth handler error");
      reply.status(500).send({ error: "Internal authentication error" });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (
      process.env.AUTH_BYPASS === "true" &&
      process.env.NODE_ENV !== "production"
    ) {
      request.user = {
        id: "dev",
        name: "Developer",
        username: "dev",
        email: "dev@reparilo.local",
        role: "OWNER",
        isActive: true,
        mustChangePassword: false,
      };
      return;
    }

    if (
      request.url === "/health" ||
      request.url === "/api/csrf-token" ||
      request.url.startsWith("/tracking") ||
      request.url.startsWith("/api/auth") ||
      request.url.startsWith("/api/jobs/lookup")
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
      name: string;
      username: string;
      email: string;
      role: string;
      isActive: boolean;
      mustChangePassword: boolean;
    } | null;
  }
}
