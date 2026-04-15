import { changePasswordSchema } from "@shared/schemas/auth.schema";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async signature
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/change-password", async (request, reply) => {
    const headers = fromNodeHeaders(request.headers);
    const session = await app.auth.api.getSession({ headers });

    if (!session?.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { oldPassword, newPassword } = parsed.data;

    if (oldPassword === newPassword) {
      return reply.status(400).send({
        error: "New password must be different from current password",
      });
    }

    const account = await app.prisma.account.findFirst({
      where: { userId: session.user.id, providerId: "credential" },
      select: { password: true },
    });
    if (!account?.password) {
      return reply
        .status(400)
        .send({ error: "No password set for this account" });
    }

    const isValid = await verifyPassword({
      hash: account.password,
      password: oldPassword,
    });
    if (!isValid) {
      return reply.status(400).send({ error: "Current password is incorrect" });
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await app.prisma.account.updateMany({
      where: { userId: session.user.id, providerId: "credential" },
      data: { password: hashedNewPassword },
    });

    await app.prisma.user.update({
      where: { id: session.user.id },
      data: { mustChangePassword: false },
    });

    return reply.send({ success: true });
  });

  app.get("/api/auth/must-change-password", async (request, reply) => {
    const headers = fromNodeHeaders(request.headers);
    const session = await app.auth.api.getSession({ headers });

    if (!session?.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    return reply.send({
      mustChangePassword: session.user.mustChangePassword,
    });
  });
};
