import type { PrismaClient } from "@prisma/client";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { Auth } from "../lib/auth.js";
import { createAuth, getSessionFromRequest } from "../lib/auth.js";

// ─────────────────────────────────────────────
// Sign-in rate limiter (in-memory, per IP)
// ─────────────────────────────────────────────

const SIGN_IN_PATHS = new Set([
  "/api/auth/sign-in/username",
  "/api/auth/sign-in/email",
  "/api/auth/request-password-reset",
]);
const MAX_SIGN_IN_ATTEMPTS = 5;
const SIGN_IN_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  start: number;
}

const signInRateLimitStore: Record<string, RateLimitEntry> = {};

const RATE_LIMIT_CLEANUP_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(signInRateLimitStore)) {
    if (now - signInRateLimitStore[ip].start > SIGN_IN_WINDOW_MS) {
      delete signInRateLimitStore[ip];
    }
  }
}, RATE_LIMIT_CLEANUP_MS);

/** Returns true if the IP is rate-limited (too many attempts). */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = signInRateLimitStore[ip];

  if (!entry || now - entry.start > SIGN_IN_WINDOW_MS) {
    signInRateLimitStore[ip] = { start: now, count: 1 };
    return false;
  }

  entry.count++;
  return entry.count > MAX_SIGN_IN_ATTEMPTS;
}

function isSignInPath(pathname: string): boolean {
  return SIGN_IN_PATHS.has(pathname);
}

// ─────────────────────────────────────────────
// Audit log helper for sign-in events
// ─────────────────────────────────────────────

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

/** Extract request body as JSON string for mutation methods. */
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

      // Rate limit sign-in attempts (5 per minute per IP)
      if (
        isSignInPath(url.pathname) &&
        request.method === "POST" &&
        isRateLimited(request.ip)
      ) {
        await reply.status(429).send({
          error: "Too many sign-in attempts. Try again later.",
        });
        return;
      }

      const body = extractBody(request.method, request.body);

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body ? { body } : {}),
      });

      const response = await auth.handler(req);

      // Audit successful sign-in
      if (
        isSignInPath(url.pathname) &&
        request.method === "POST" &&
        response.status === 200
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
        role: "OWNER",
        username: "dev",
        isActive: true,
        mustChangePassword: false,
      };
      return;
    }

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
