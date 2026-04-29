import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
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

function sanitizeSignInResponse(
  text: string,
  method: string,
  pathname: string
): string {
  if (!text || method !== "POST" || !pathname.includes("sign-in")) {
    return text;
  }
  try {
    const json = JSON.parse(text);
    if (json.user) {
      const { image: _image, ...userWithoutImage } = json.user;
      json.user = userWithoutImage;
    }
    return JSON.stringify(json);
  } catch {
    // Non-JSON response, return as-is
    return text;
  }
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
        if (key.toLowerCase() !== "content-length") {
          reply.header(key, value);
        }
      }

      const text = await response.text();
      const sanitized = sanitizeSignInResponse(
        text,
        request.method,
        url.pathname
      );
      reply.send(sanitized ?? null);
    } catch (err) {
      app.log.error(err, "Better Auth handler error");
      throw new AppError("INTERNAL_ERROR");
    }
  });

  app.addHook("preHandler", async (request, _reply) => {
    const url = request.url;
    const pathname = url.split("?")[0];

    if (
      pathname === "/health" ||
      pathname === "/api/csrf-token" ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/jobs/lookup")
    ) {
      return;
    }

    if (!pathname.startsWith("/api")) {
      return;
    }

    const session = await getSessionFromRequest(auth, request);

    if (!session) {
      throw new AppError("UNAUTHORIZED");
    }

    if (!session.isActive) {
      throw new AppError("ACCOUNT_DISABLED");
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
      sessionId: string;
    } | null;
  }
}
