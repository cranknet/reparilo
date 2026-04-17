import type { PrismaClient } from "@prisma/client";
import { ac, roles } from "@shared/permissions";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders } from "better-auth/node";
import { admin, username } from "better-auth/plugins";
import { sendPasswordResetEmail } from "./email.js";

/**
 * Creates a Better Auth instance configured for Reparilo.
 * Must be called after Prisma is initialized.
 */
export function createAuth(prisma: PrismaClient) {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
    basePath: "/api/auth",
    trustedOrigins: (
      process.env.TRUSTED_ORIGINS ||
      "http://localhost:5173,http://localhost:4000"
    )
      .split(",")
      .map((origin) => origin.trim()),
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      sendResetPassword: async ({ user, url }) => {
        try {
          await sendPasswordResetEmail(user.email, url);
        } catch (error) {
          console.error("[auth] Failed to send password reset email", error);
          throw error;
        }
      },
      onPasswordReset: async ({ user }) => {
        try {
          await prisma.auditLog.create({
            data: {
              jobId: null,
              userId: user.id,
              action: "PASSWORD_RESET",
              toValue: `Password reset for ${user.email}`,
            },
          });
        } catch {
          console.error("[auth] Failed to audit password reset");
        }
      },
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
        image: {
          type: "string",
          required: false,
          defaultValue: null,
          input: false,
        },
      },
    },
    plugins: [
      username(),
      admin({
        adminRoles: ["OWNER"],
        ac,
        roles,
      }),
    ],
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

  if (!(session?.user && session.session)) {
    return null;
  }

  return {
    id: session.user.id,
    name: (session.user.name as string) ?? "",
    username: session.user.username as string,
    email: session.user.email as string,
    role: session.user.role as string,
    isActive: session.user.isActive as boolean,
    mustChangePassword: session.user.mustChangePassword as boolean,
    sessionId: session.session.id,
  };
}
