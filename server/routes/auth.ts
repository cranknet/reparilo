import { AppError } from "@shared/errors/app-error.js";
import { changePasswordSchema } from "@shared/schemas/auth.schema";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async signature
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/auth/change-password",
    {
      schema: {
        tags: ["auth"],
        summary: "Change password",
        body: {
          type: "object",
          required: ["oldPassword", "newPassword"],
          properties: {
            oldPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const headers = fromNodeHeaders(request.headers);
      const session = await app.auth.api.getSession({ headers });

      if (!session?.user) {
        throw new AppError("UNAUTHORIZED");
      }

      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
      }

      const { oldPassword, newPassword } = parsed.data;

      if (oldPassword === newPassword) {
        throw new AppError("PASSWORD_SAME_AS_OLD");
      }

      const account = await app.prisma.account.findFirst({
        where: { userId: session.user.id, providerId: "credential" },
        select: { password: true },
      });
      if (!account?.password) {
        throw new AppError("NO_PASSWORD_SET");
      }

      const isValid = await verifyPassword({
        hash: account.password,
        password: oldPassword,
      });
      if (!isValid) {
        throw new AppError("CURRENT_PASSWORD_INCORRECT");
      }

      const hashedNewPassword = await hashPassword(newPassword);

      await app.prisma.$transaction([
        app.prisma.account.updateMany({
          where: { userId: session.user.id, providerId: "credential" },
          data: { password: hashedNewPassword },
        }),
        app.prisma.user.update({
          where: { id: session.user.id },
          data: { mustChangePassword: false },
        }),
      ]);

      return reply.send({ success: true });
    }
  );

  app.get(
    "/api/auth/must-change-password",
    {
      schema: {
        tags: ["auth"],
        summary: "Check if user must change password",
      },
    },
    async (request, reply) => {
      const headers = fromNodeHeaders(request.headers);
      const session = await app.auth.api.getSession({ headers });

      if (!session?.user) {
        throw new AppError("UNAUTHORIZED");
      }
      return reply.send({
        mustChangePassword: session.user.mustChangePassword,
      });
    }
  );
};
