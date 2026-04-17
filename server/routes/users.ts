import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ROLE_PERMISSIONS, type RoleType } from "@shared/constants/roles";
import {
  createUserSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "@shared/schemas/auth.schema";
import { hashPassword } from "better-auth/crypto";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { deleteAvatar, uploadAvatar } from "../services/avatar.service.js";

async function checkUniqueFields(
  prisma: PrismaClient,
  checks: Array<{ field: "email" | "username"; value: string }>,
  excludeId: string
): Promise<string | null> {
  for (const { field, value } of checks) {
    const existing = await prisma.user.findFirst({
      where: { [field]: value, NOT: { id: excludeId } },
    });
    if (existing) {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      return `${label} already in use`;
    }
  }
  return null;
}

function updateProfile(
  prisma: PrismaClient,
  id: string,
  data: { name?: string; email?: string; username?: string }
) {
  return prisma.user.update({
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
}

function buildUpdateData(
  fields: Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v)
  ) as Record<string, string>;
}

function checkProfileUniqueness(
  prisma: PrismaClient,
  id: string,
  email?: string,
  username?: string
): Promise<string | null> {
  const checks: Array<{ field: "email" | "username"; value: string }> = [];
  if (email) {
    checks.push({ field: "email", value: email });
  }
  if (username) {
    checks.push({ field: "username", value: username });
  }
  if (checks.length === 0) {
    return Promise.resolve(null);
  }
  return checkUniqueFields(prisma, checks, id);
}

function isUniqueViolation(err: unknown): string | null {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return null;
  }
  const target = (err.meta as { target: string[] })?.target?.[0];
  const label = target
    ? target.charAt(0).toUpperCase() + target.slice(1)
    : "Field";
  return `${label} already in use`;
}

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
          image: true,
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

    const { name, email, username } = parsed.data;

    const data = buildUpdateData({ name, email, username });

    if (Object.keys(data).length === 0) {
      return reply
        .status(400)
        .send({ error: "At least one field is required" });
    }

    const conflict = await checkProfileUniqueness(
      app.prisma,
      id,
      email,
      username
    );
    if (conflict) {
      return reply.status(409).send({ error: conflict });
    }

    try {
      const updated = await updateProfile(app.prisma, id, data);
      return reply.send(updated);
    } catch (err) {
      const conflict = isUniqueViolation(err);
      if (conflict) {
        return reply.status(409).send({ error: conflict });
      }
      throw err;
    }
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

  app.get("/:id/stats", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!canViewUserActivity(requestingUser.id, id, requestingUser.role)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [completedJobs, monthlyJobs] = await Promise.all([
      app.prisma.job.count({
        where: {
          technicianId: id,
          status: { in: ["DONE", "DELIVERED"] },
        },
      }),
      app.prisma.job.count({
        where: {
          technicianId: id,
          status: { in: ["DONE", "DELIVERED"] },
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return reply.send({ completedJobs, monthlyJobs });
  });

  app.get("/:id/sessions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (requestingUser.id !== id) {
      return reply.status(403).send({ error: "Can only view own sessions" });
    }

    const currentToken =
      request.headers.authorization?.replace("Bearer ", "") ?? "";

    const sessions = await app.prisma.session.findMany({
      where: { userId: id, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        token: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.token === currentToken,
    }));

    return reply.send(result);
  });

  app.delete("/:id/sessions/:sessionId", async (request, reply) => {
    const { id, sessionId } = request.params as {
      id: string;
      sessionId: string;
    };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (requestingUser.id !== id) {
      return reply.status(403).send({ error: "Can only revoke own sessions" });
    }

    const session = await app.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, token: true },
    });

    if (!session || session.userId !== id) {
      return reply.status(404).send({ error: "Session not found" });
    }

    const currentToken =
      request.headers.authorization?.replace("Bearer ", "") ?? "";
    if (session.token === currentToken) {
      return reply.status(400).send({ error: "Cannot end current session" });
    }

    await app.prisma.session.delete({ where: { id: sessionId } });

    return reply.send({ success: true });
  });

  app.post(
    "/:id/avatar",
    {
      preHandler: [requirePermission("users:write")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestingUser = request.user;

      if (!requestingUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      if (requestingUser.id !== id) {
        return reply.status(403).send({ error: "Can only update own avatar" });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No file provided" });
      }

      const result = await uploadAvatar(app.prisma, id, data);
      if (!result) {
        return reply.status(404).send({ error: "User not found" });
      }
      if ("error" in result) {
        const status = result.error === "FILE_TOO_LARGE" ? 413 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return reply.send(result);
    }
  );

  app.delete(
    "/:id/avatar",
    {
      preHandler: [requirePermission("users:write")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestingUser = request.user;

      if (!requestingUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      if (requestingUser.id !== id) {
        return reply.status(403).send({ error: "Can only delete own avatar" });
      }

      const result = await deleteAvatar(app.prisma, id);
      if (!result) {
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send(result);
    }
  );
};
