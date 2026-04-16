import { ROLE_PERMISSIONS, type RoleType } from "@shared/constants/roles";
import {
  createUserSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "@shared/schemas/auth.schema";
import { hashPassword } from "better-auth/crypto";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";

function canModifyUser(
  requestingUserId: string,
  targetId: string,
  requestingRole: string
): boolean {
  if (requestingUserId === targetId) {
    return true;
  }
  const perms = ROLE_PERMISSIONS[requestingRole as RoleType] ?? [];
  return perms.includes("users:write");
}

function canViewUserActivity(
  requestingUserId: string,
  targetId: string,
  requestingRole: string
): boolean {
  if (requestingUserId === targetId) {
    return true;
  }
  const perms = ROLE_PERMISSIONS[requestingRole as RoleType] ?? [];
  return perms.includes("users:read");
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("users:read")],
    },
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
    {
      preHandler: [requirePermission("users:write")],
    },
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

      const created = await app.auth.api.createUser({
        headers: request.headers as unknown as Headers,
        body: {
          email,
          password,
          name: username,
          role: role as RoleType,
          data: {
            username,
            mustChangePassword: true,
          },
        },
      });

      if (!created?.user?.id) {
        return reply.status(500).send({ error: "Failed to create user" });
      }

      const user = await app.prisma.user.findUnique({
        where: { id: created.user.id },
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
    {
      preHandler: [requirePermission("users:write")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { isActive } = request.body as { isActive: boolean };

      if (id === request.user?.id && !isActive) {
        return reply
          .status(400)
          .send({ error: "Cannot deactivate your own account" });
      }

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
    {
      preHandler: [requirePermission("users:write")],
    },
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

      await app.prisma.account.updateMany({
        where: { userId: id, providerId: "credential" },
        data: { password: hashedPassword },
      });

      await app.prisma.user.update({
        where: { id },
        data: {
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

  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!canModifyUser(requestingUser.id, id, requestingUser.role)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email } = parsed.data;

    if (name === undefined && email === undefined) {
      return reply
        .status(400)
        .send({ error: "At least one field is required" });
    }

    if (email) {
      const existing = await app.prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return reply.status(409).send({ error: "Email already in use" });
      }
    }

    const data: { name?: string; email?: string } = {};
    if (name) {
      data.name = name;
    }
    if (email) {
      data.email = email;
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    return reply.send(updated);
  });

  app.get("/:id/activity", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!canViewUserActivity(requestingUser.id, id, requestingUser.role)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const logs = await app.prisma.auditLog.findMany({
      where: { userId: id },
      select: {
        id: true,
        action: true,
        fromValue: true,
        toValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return reply.send(logs);
  });
};
