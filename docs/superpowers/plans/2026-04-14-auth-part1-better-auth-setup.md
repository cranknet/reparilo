# Auth & RBAC Part 1: Better Auth Setup + Schema Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Better Auth with Prisma adapter, username plugin, cookie sessions, and create the required database migration.

**Architecture:** Better Auth is configured as a Fastify plugin that exposes auth routes at `/api/auth/*` and validates sessions on every request. The Prisma adapter connects to our existing PostgreSQL database. The `username` plugin enables username-based sign-in.

**Tech Stack:** Better Auth 1.6+, Prisma 7, Fastify, PostgreSQL 17

---

### Task 1: Create Better Auth Configuration

**Files:**
- Create: `server/lib/auth.ts`

- [ ] **Step 1: Create the auth config file**

```typescript
// server/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import type { FastifyRequest } from "fastify";

export const auth = betterAuth({
  database: prismaAdapter(
    // Lazy — Prisma client is decorated on Fastify instance at runtime.
    // This function is called only after the plugin registers it.
    // We pass a getter so Better Auth can resolve it when needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis as any,
    {
      provider: "postgresql",
    },
  ),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 604800, // 7 days in seconds
    updateAge: 86400, // 1 day rolling refresh
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 minutes
    },
  },
  plugins: [username()],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "FRONT_DESK",
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
    },
  },
});

export type Auth = typeof auth;

/**
 * Validate a request session and return the user, or null if unauthenticated.
 */
export async function getSessionFromRequest(request: FastifyRequest) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value[0] : value);
    }
  }
  const req = new Request(url.toString(), {
    method: request.method,
    headers,
  });
  const session = await auth.api.getSession({
    headers,
  });
  if (!session) {
    return null;
  }
  return {
    id: session.user.id,
    role: session.user.role as string,
    username: session.user.username as string,
    isActive: session.user.isActive as boolean,
    mustChangePassword: session.user.mustChangePassword as boolean,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/auth.ts
git commit -m "feat: add Better Auth configuration with username plugin and session helpers"
```

---

### Task 2: Rewrite Auth Plugin

**Files:**
- Modify: `server/plugins/auth.ts`

- [ ] **Step 1: Rewrite the auth plugin to use Better Auth**

The existing auth plugin at `server/plugins/auth.ts` has a bypass + TODO stub. Replace it entirely:

```typescript
// server/plugins/auth.ts
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { auth, getSessionFromRequest } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);

  // Mount Better Auth handler at /api/auth/*
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);
      let body: string | undefined;
      if (request.method === "POST" && request.body) {
        body = JSON.stringify(request.body);
      }
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body,
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      const responseBody = response.body ? await response.text() : null;
      reply.send(responseBody);
    },
  });

  // Global session validation for all other routes
  app.addHook("preHandler", async (request, reply) => {
    // Dev bypass
    if (
      process.env.AUTH_BYPASS === "true" &&
      process.env.NODE_ENV !== "production"
    ) {
      request.user = { id: "dev", role: "OWNER", username: "dev", isActive: true, mustChangePassword: false };
      return;
    }

    // Skip auth for public routes
    if (
      request.url === "/health" ||
      request.url.startsWith("/tracking")
    ) {
      return;
    }

    // Skip auth for Better Auth's own routes (already handled above)
    if (request.url.startsWith("/api/auth")) {
      return;
    }

    const user = await getSessionFromRequest(request);
    if (!user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }
    if (!user.isActive) {
      await reply.status(403).send({ error: "Account disabled" });
      return;
    }
    request.user = user;
  });
};

export default fp(authPlugin);

declare module "fastify" {
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
```

- [ ] **Step 2: Commit**

```bash
git add server/plugins/auth.ts
git commit -m "feat: rewrite auth plugin with Better Auth session validation and route handler"
```

---

### Task 3: Prisma Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Better Auth required models and fields to the schema**

Add these changes to `prisma/schema.prisma`:

1. Add `mustChangePassword` field to the `User` model (before `@@map("users")`):

```prisma
  mustChangePassword Boolean  @default(false)
```

2. Add `USER_SIGN_IN`, `USER_SIGN_OUT`, `USER_CREATED`, `PASSWORD_RESET` values to the `AuditAction` enum:

```prisma
enum AuditAction {
  JOB_CREATED
  STATUS_CHANGED
  TECHNICIAN_ASSIGNED
  COST_UPDATED
  PART_ADDED
  PART_REMOVED
  REPAIR_ADDED
  REPAIR_REMOVED
  NOTE_ADDED
  PHOTO_ADDED
  WARRANTY_RETURN_CREATED
  NOTIFICATION_SENT
  USER_SIGN_IN
  USER_SIGN_OUT
  USER_CREATED
  PASSWORD_RESET
}
```

3. Add `Session` and `Verification` models at the end of the file, before the closing:

```prisma
// ─────────────────────────────────────────────
// SESSION (Better Auth)
// ─────────────────────────────────────────────

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  @@index([userId])
  @@index([token])
  @@map("sessions")
}

// ─────────────────────────────────────────────
// VERIFICATION (Better Auth)
// ─────────────────────────────────────────────

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @db.Timestamptz

  @@index([identifier])
  @@map("verifications")
}
```

4. Add `sessions` and `verifications` relations to the `User` model:

```prisma
  sessions      Session[]
  verifications Verification[]
```

- [ ] **Step 2: Create the migration**

```bash
pnpm prisma migrate dev --name add_auth_tables
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Session, Verification models and mustChangePassword field for auth"
```

---

### Task 4: Wire Better Auth to Prisma at Runtime

**Files:**
- Modify: `server/plugins/auth.ts` (small tweak)
- Modify: `server/lib/auth.ts` (replace globalThis hack with proper adapter)

The Prisma adapter needs the actual PrismaClient instance. Fastify decorates it via the `prismaPlugin`. Better Auth needs it at config time. The cleanest approach: initialize auth inside the plugin after Prisma is available.

- [ ] **Step 1: Rewrite `server/lib/auth.ts` to export a factory function**

```typescript
// server/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { PrismaPg } from "@prisma/adapter-pg";

export function createAuth(prisma: PrismaClient<never, never, PrismaPg>) {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 604800,
      updateAge: 86400,
      cookieCache: {
        enabled: true,
        maxAge: 300,
      },
    },
    plugins: [username()],
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "FRONT_DESK",
        },
        isActive: {
          type: "boolean",
          required: true,
          defaultValue: true,
        },
        mustChangePassword: {
          type: "boolean",
          required: true,
          defaultValue: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export async function getSessionFromRequest(auth: Auth, request: FastifyRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value[0] : value);
    }
  }
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return {
    id: session.user.id,
    role: session.user.role as string,
    username: session.user.username as string,
    isActive: session.user.isActive as boolean,
    mustChangePassword: session.user.mustChangePassword as boolean,
  };
}
```

- [ ] **Step 2: Update `server/plugins/auth.ts` to use the factory**

```typescript
// server/plugins/auth.ts
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createAuth, getSessionFromRequest } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../lib/auth.js";

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
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);
      let body: string | undefined;
      if (request.method === "POST" && request.body) {
        body = JSON.stringify(request.body);
      }
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body,
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      const responseBody = response.body ? await response.text() : null;
      reply.send(responseBody);
    },
  });

  app.addHook("preHandler", async (request, reply) => {
    if (
      process.env.AUTH_BYPASS === "true" &&
      process.env.NODE_ENV !== "production"
    ) {
      request.user = { id: "dev", role: "OWNER", username: "dev", isActive: true, mustChangePassword: false };
      return;
    }

    if (
      request.url === "/health" ||
      request.url.startsWith("/tracking")
    ) {
      return;
    }

    if (request.url.startsWith("/api/auth")) {
      return;
    }

    const user = await getSessionFromRequest(auth, request);
    if (!user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }
    if (!user.isActive) {
      await reply.status(403).send({ error: "Account disabled" });
      return;
    }
    request.user = user;
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
```

- [ ] **Step 3: Verify the server starts**

```bash
pnpm dev
```

Expected: Server starts on port 4000, no errors. Better Auth routes mounted.

- [ ] **Step 4: Commit**

```bash
git add server/lib/auth.ts server/plugins/auth.ts
git commit -m "feat: wire Better Auth to Prisma at runtime via factory function"
```

---

### Task 5: Update Seed Script

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update seed to set mustChangePassword and use Better Auth's password hashing**

Replace the existing `prisma/seed.ts` with:

```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SEED_ADMIN_USERNAME = "admin";

async function main() {
  console.log("Seeding database...");

  const owner = await prisma.user.upsert({
    where: { username: SEED_ADMIN_USERNAME },
    update: {},
    create: {
      username: SEED_ADMIN_USERNAME,
      email: "admin@reparilo.local",
      password: await hashPassword(
        process.env.SEED_ADMIN_PASSWORD || "admin123"
      ),
      role: "OWNER",
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log(`Admin user seeded: ${owner.username}`);
  console.log("Seed complete. Login with the seeded credentials and change your password.");
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
```

- [ ] **Step 2: Run the seed**

```bash
pnpm db:seed
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: set mustChangePassword on seed admin user"
```

---

### Task 6: Auth Rate Limiting

**Files:**
- Create: `server/middlewares/rate-limit.ts`

- [ ] **Step 1: Create tighter rate limiting for auth endpoints**

```typescript
// server/middlewares/rate-limit.ts
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const authRateLimit: FastifyPluginAsync = async (app) => {
  await app.register(
    async (instance) => {
      instance.addHook("onRequest", async (request, reply) => {
        const authRoutes = ["/api/auth/sign-in", "/api/auth/sign-up"];
        if (authRoutes.includes(request.url)) {
          const ip = request.ip;
          const key = `auth-rate:${ip}`;
          const existing = (request.server as any).__authRateLimit?.[key];
          const now = Date.now();
          const windowMs = 60_000;
          const maxAttempts = 5;

          if (!existing || now - existing.start > windowMs) {
            if (!(request.server as any).__authRateLimit) {
              (request.server as any).__authRateLimit = {};
            }
            (request.server as any).__authRateLimit[key] = { start: now, count: 1 };
            return;
          }

          existing.count++;
          if (existing.count > maxAttempts) {
            await reply.status(429).send({
              error: "Too many attempts. Please try again later.",
            });
            return;
          }
        }
      });
    },
  );
};

export default fp(authRateLimit);
```

- [ ] **Step 2: Register rate limit middleware in `server/index.ts`**

Add the import at the top of `server/index.ts`:

```typescript
import authRateLimit from "./middlewares/rate-limit.js";
```

And register it after the auth plugin:

```typescript
await app.register(authPlugin);
await app.register(authRateLimit);
```

- [ ] **Step 3: Commit**

```bash
git add server/middlewares/rate-limit.ts server/index.ts
git commit -m "feat: add auth rate limiting middleware (5 attempts per minute per IP)"
```

---

### Task 7: Shared Schemas for Auth

**Files:**
- Create: `shared/schemas/auth.schema.ts`
- Modify: `shared/schemas/index.ts` (create barrel if needed)

- [ ] **Step 1: Create auth Zod schemas**

```typescript
// shared/schemas/auth.schema.ts
import { z } from "zod";

export const signInSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["OWNER", "TECHNICIAN", "FRONT_DESK"]),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, "Password must be at least 8 characters"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add shared/schemas/auth.schema.ts
git commit -m "feat: add Zod validation schemas for auth endpoints"
```