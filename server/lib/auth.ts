import type { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders } from "better-auth/node";
import { username } from "better-auth/plugins";

/**
 * Creates a Better Auth instance configured for Reparilo.
 * Must be called after Prisma is initialized.
 */
export function createAuth(prisma: PrismaClient) {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 604_800, // 7 days
      updateAge: 86_400, // 1 day rolling
      cookieCache: {
        enabled: true,
        maxAge: 300, // 5 minutes
      },
    },
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
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Extracts session info from a Fastify request via Better Auth.
 * Returns null if no valid session, otherwise the user identity fields.
 */
export async function getSessionFromRequest(
  auth: Auth,
  request: { headers: Record<string, string | string[] | undefined> }
) {
  const headers = fromNodeHeaders(request.headers);
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
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
