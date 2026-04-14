import { changePasswordSchema } from "@shared/schemas/auth.schema";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/change-password", async (request, reply) => {
    if (!request.user) {
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

    const user = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { password: true },
    });
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const isValid = await verifyPassword({
      hash: user.password,
      password: oldPassword,
    });
    if (!isValid) {
      return reply.status(400).send({ error: "Current password is incorrect" });
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await app.prisma.user.update({
      where: { id: request.user.id },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
      },
    });

    await app.prisma.auditLog.create({
      data: {
        jobId: "0",
        userId: request.user.id,
        action: "PASSWORD_RESET",
        toValue: "Self-service password change",
      },
    });

    return reply.send({ success: true });
  });

  // biome-ignore lint/suspicious/useAwait: Fastify async route handler without await
  app.get("/api/auth/must-change-password", async (_request, reply) => {
    if (!_request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    return reply.send({ mustChangePassword: _request.user.mustChangePassword });
  });
};
