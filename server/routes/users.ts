import type { RoleType } from "@shared/constants/roles";
import {
  createUserSchema,
  resetPasswordSchema,
} from "@shared/schemas/auth.schema";
import { hashPassword } from "better-auth/crypto";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    { preHandler: [requirePermission("users:read")] },
    async (_request, reply) => {
      const users = await app.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return reply.send(users);
    }
  );

  app.post(
    "/",
    { preHandler: [requirePermission("users:write")] },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { username, email, password, role } = parsed.data;

      const existing = await app.prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });
      if (existing) {
        return reply.status(409).send({
          error:
            existing.username === username
              ? "Username already exists"
              : "Email already exists",
        });
      }

      const hashedPassword = await hashPassword(password);

      const user = await app.prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role: role as RoleType,
          isActive: true,
          mustChangePassword: true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      await app.prisma.auditLog.create({
        data: {
          jobId: null,
          userId: request.user?.id ?? "unknown",
          action: "USER_CREATED",
          toValue: `${username} (${role})`,
        },
      });

      return reply.status(201).send(user);
    }
  );

  app.patch(
    "/:id/status",
    { preHandler: [requirePermission("users:write")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { isActive } = request.body as { isActive: boolean };

      const user = await app.prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      return reply.send(user);
    }
  );

  app.post(
    "/:id/reset-password",
    { preHandler: [requirePermission("users:write")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const targetUser = await app.prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);

      await app.prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
        },
      });

      await app.prisma.session.deleteMany({
        where: { userId: id },
      });

      await app.prisma.auditLog.create({
        data: {
          jobId: null,
          userId: request.user?.id ?? "unknown",
          action: "PASSWORD_RESET",
          toValue: `Password reset for ${targetUser.username}`,
        },
      });

      return reply.send({ success: true });
    }
  );
};
