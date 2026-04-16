import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import csrf from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type {
  FastifyError,
  FastifyInstance,
  FastifyPluginAsync,
} from "fastify";
import fp from "fastify-plugin";

const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const SENSITIVE_KEYS = new Set([
  "password",
  "isActive",
  "role",
  "mustChangePassword",
]);

const securityPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ── Layer 1: Security Headers ──────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: IS_PROD
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  });

  // ── Layer 2: CORS ───────────────────────────────────────────────────────
  const allowedOrigins = IS_PROD
    ? [FRONTEND_URL]
    : [FRONTEND_URL, "http://localhost:5173"];

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86_400,
  });

  // ── Layer 3: Rate Limiting ──────────────────────────────────────────────
  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.user?.id ?? request.ip,
    exponentialBackoff: true,
    ban: 5,
    allowList: ["/health"],
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // ── Layer 4: CSRF Protection ───────────────────────────────────────────
  // @fastify/cookie must be registered before csrf-protection
  await app.register(cookie);

  await app.register(csrf, {
    cookieOpts: {
      sameSite: IS_PROD ? "strict" : "lax",
      httpOnly: true,
      path: "/",
      secure: IS_PROD,
      signed: IS_PROD,
    },
  });

  // ── Layer 5: Request Sanitization ───────────────────────────────────────
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function sanitizeObject(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.has(key)) {
        delete obj[key];
        continue;
      }
      if (isObject(obj[key])) {
        sanitizeObject(obj[key]);
      } else if (Array.isArray(obj[key])) {
        for (const item of obj[key] as unknown[]) {
          if (isObject(item)) {
            sanitizeObject(item);
          }
        }
      }
    }
  }

  app.addHook("preHandler", (request, _reply, done) => {
    const allowSensitive =
      request.routeOptions?.config?.allowSensitiveKeys ?? false;
    if (isObject(request.body) && !allowSensitive) {
      sanitizeObject(request.body as Record<string, unknown>);
    }
    done();
  });

  // ── Layer 6: Error Obfuscation ─────────────────────────────────────────
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      reply.status(error.statusCode ?? 400).send({
        statusCode: error.statusCode ?? 400,
        error: "Validation Error",
        message: error.message,
      });
      return;
    }

    const statusCode = error.statusCode ?? 500;
    const isServerError = statusCode >= 500;

    let message: string;
    if (IS_PROD) {
      message = isServerError
        ? "An unexpected error occurred"
        : (error.message ?? "Request failed");
    } else {
      message = error.message ?? "Unknown error";
    }

    const payload: Record<string, unknown> = {
      statusCode,
      error: IS_PROD ? "Internal Server Error" : (error.name ?? "Error"),
      message,
    };

    if (!IS_PROD) {
      payload.stack = error.stack;
    }

    reply.status(statusCode).send(payload);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // ── Layer 7: Audit Logging ─────────────────────────────────────────────
  app.addHook("onResponse", async (request, reply) => {
    if (!MUTATION_METHODS.has(request.method)) {
      return;
    }

    const userId = request.user?.id;
    if (!userId) {
      return;
    }

    const action = `${request.method} ${request.routeOptions?.url ?? request.url}`;

    request.log.info({
      audit: { userId, action, statusCode: reply.statusCode },
    });

    try {
      await request.server.prisma.auditLog.create({
        data: {
          userId,
          action: "API_MUTATION",
          toValue: action,
          jobId: null,
          metadata: { statusCode: reply.statusCode },
        },
      });
    } catch (err) {
      request.log.error({ err }, "Failed to write audit log");
    }
  });
};

export default fp(securityPlugin, { name: "security-plugin" });

declare module "fastify" {
  interface FastifyContextConfig {
    allowSensitiveKeys?: boolean;
  }
}
