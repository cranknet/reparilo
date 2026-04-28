import type { FastifyRequest } from "fastify";

export interface RateLimitConfig {
  keyGenerator?: (req: FastifyRequest) => string;
  max: number;
  timeWindow: string;
}

export interface RouteSecurityOverride {
  allowSensitiveKeys?: boolean;
  csrf?: boolean;
  rateLimit?: RateLimitConfig | false;
}

// Rate-limit keyed on the identifier the attacker is targeting (email/username)
// to prevent one IP from locking a NAT'd office out of sign-in, and to make
// credential-stuffing attacks wait per-account.
const signInKeyGenerator = (req: FastifyRequest): string => {
  const body = req.body as Record<string, unknown> | undefined;
  let identifier = "";
  if (typeof body?.email === "string") {
    identifier = body.email;
  } else if (typeof body?.username === "string") {
    identifier = body.username;
  }
  if (identifier) {
    return `signin:${identifier.toLowerCase().trim()}`;
  }
  return `signin:ip:${req.ip}`;
};

export const DEFAULT_SECURITY: RouteSecurityOverride = {
  rateLimit: { max: 100, timeWindow: "1 minute" },
  allowSensitiveKeys: false,
};

export const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function isMutation(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}

export function matchRoute(
  url: string,
  rules: [string, RouteSecurityOverride][]
): RouteSecurityOverride | undefined {
  for (const [pattern, config] of rules) {
    if (routeMatchesPattern(url, pattern)) {
      return config;
    }
  }
  return;
}

function routeMatchesPattern(url: string, pattern: string): boolean {
  const urlSegments = url.split("/");
  const patternSegments = pattern.split("/");

  // URL must have at least as many segments as the pattern
  // (prefix match: /api/jobs matches /api/jobs/:id)
  if (urlSegments.length < patternSegments.length) {
    return false;
  }

  for (let i = 0; i < patternSegments.length; i++) {
    const patSeg = patternSegments[i];
    if (patSeg === "*") {
      continue;
    }
    if (patSeg.startsWith(":")) {
      continue;
    }
    if (urlSegments[i] !== patSeg) {
      return false;
    }
  }

  return true;
}

export const routeSecurity: [string, RouteSecurityOverride][] = [
  ["/health", { rateLimit: false, csrf: false }],
  [
    "/api/csrf-token",
    { rateLimit: { max: 60, timeWindow: "1 minute" }, csrf: false },
  ],
  [
    "/api/auth/change-password",
    {
      rateLimit: { max: 5, timeWindow: "1 minute" },
      allowSensitiveKeys: true,
    },
  ],
  [
    "/api/auth/must-change-password",
    { rateLimit: { max: 20, timeWindow: "1 minute" }, csrf: false },
  ],
  [
    "/api/auth/sign-in/email",
    {
      csrf: false,
      allowSensitiveKeys: true,
      rateLimit: {
        max: 5,
        timeWindow: "5 minute",
        keyGenerator: signInKeyGenerator,
      },
    },
  ],
  [
    "/api/auth/sign-in/username",
    {
      csrf: false,
      allowSensitiveKeys: true,
      rateLimit: {
        max: 5,
        timeWindow: "5 minute",
        keyGenerator: signInKeyGenerator,
      },
    },
  ],
  ["/api/auth/*", { csrf: false, allowSensitiveKeys: true }],
  [
    "/api/users/:id/reset-password",
    {
      rateLimit: { max: 10, timeWindow: "1 minute" },
      allowSensitiveKeys: true,
    },
  ],
  [
    "/api/users/:id/status",
    {
      rateLimit: { max: 30, timeWindow: "1 minute" },
      allowSensitiveKeys: true,
    },
  ],
  [
    "/api/users",
    {
      rateLimit: { max: 10, timeWindow: "1 minute" },
      allowSensitiveKeys: true,
    },
  ],
  ["/api/jobs", { rateLimit: { max: 30, timeWindow: "1 minute" } }],
  ["/api/ai", { rateLimit: { max: 30, timeWindow: "1 minute" } }],
  ["/api/*", {}],
];
