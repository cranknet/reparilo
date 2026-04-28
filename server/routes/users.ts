import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";
import type { RoleType } from "@shared/constants/roles";
import {
  activityListQuerySchema,
  createUserSchema,
  resetPasswordSchema,
  toggleUserStatusSchema,
  updateProfileSchema,
  userIdParamSchema,
  userListQuerySchema,
} from "@shared/schemas/auth.schema";
import { hashPassword } from "better-auth/crypto";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { deleteAvatar, uploadAvatar } from "../services/avatar.service.js";
import {
  resolveValidationMessage,
  resolveZodErrors,
} from "../utils/resolve-validation-messages.js";
import { sendError } from "../utils/send-error.js";

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
    Object.entries(fields).filter(([, v]) => v !== undefined)
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

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const usersRoutes: FastifyPluginAsync = async (app) => {
  async function canAccessUser(
    requestingUser: { id: string; role: string } | undefined,
    targetId: string,
    permission: Record<string, string[]>
  ): Promise<boolean> {
    if (!requestingUser) {
      return false;
    }
    if (requestingUser.id === targetId) {
      return true;
    }
    const result = await app.auth.api.userHasPermission({
      body: {
        role: requestingUser.role as RoleType,
        permissions: permission,
      },
    });
    return result.success;
  }

  const userSelect = {
    id: true,
    username: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    mustChangePassword: true,
    image: true,
    createdAt: true,
  } as const;

  app.get(
    "/",
    {
      preHandler: [requirePermission({ user: ["list"] })],
    },
    async (request, reply) => {
      const parsed = userListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid query parameters",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              request.locale
            ),
          }
        );
      }
      const { cursor, limit, search } = parsed.data;
      const where: Prisma.UserWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }
      if (cursor) {
        where.id = { lt: cursor };
      }

      const [users, totalCount] = await Promise.all([
        app.prisma.user.findMany({
          where,
          select: userSelect,
          orderBy: { id: "desc" },
          take: limit + 1,
        }),
        cursor ? Promise.resolve(null) : app.prisma.user.count({ where }),
      ]);

      let nextCursor: string | null = null;
      if (users.length > limit) {
        users.pop();
        nextCursor = users.at(-1)?.id ?? null;
      }

      return reply.send({ users, nextCursor, totalCount });
    }
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission({ user: ["get"] })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = await app.prisma.user.findUnique({
        where: { id },
        select: userSelect,
      });
      if (!user) {
        return sendError(reply, 404, "NOT_FOUND", "User not found");
      }
      return reply.send(user);
    }
  );

  app.post(
    "/",
    {
      preHandler: [requirePermission({ user: ["create"] })],
    },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              request.locale
            ),
          }
        );
      }

      const { username, email, password, role } = parsed.data;

      const existing = await app.prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });
      if (existing) {
        const message =
          existing.username === username
            ? "Username already exists"
            : "Email already exists";
        return sendError(reply, 409, "CONFLICT", message);
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
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to create user");
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
      preHandler: [requirePermission({ user: ["update"] })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = toggleUserStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              request.locale
            ),
          }
        );
      }
      const { isActive } = parsed.data;

      if (id === request.user?.id && !isActive) {
        return sendError(
          reply,
          400,
          "BAD_REQUEST",
          "Cannot deactivate your own account"
        );
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
      preHandler: [requirePermission({ user: ["update"] })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              request.locale
            ),
          }
        );
      }

      const targetUser = await app.prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        return sendError(reply, 404, "NOT_FOUND", "User not found");
      }

      const hashedPassword = await hashPassword(parsed.data.password);

      await app.prisma.$transaction([
        app.prisma.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password: hashedPassword },
        }),
        app.prisma.user.update({
          where: { id },
          data: { mustChangePassword: true },
        }),
        app.prisma.session.deleteMany({
          where: { userId: id },
        }),
      ]);

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

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (!(await canAccessUser(request.user, id, { user: ["update"] }))) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient permissions");
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body", {
        errors: resolveZodErrors(
          parsed.error.flatten().fieldErrors,
          request.locale
        ),
      });
    }

    const { name, email, username } = parsed.data;

    const data = buildUpdateData({ name, email, username });

    if (Object.keys(data).length === 0) {
      return sendError(
        reply,
        400,
        "BAD_REQUEST",
        "At least one field is required"
      );
    }

    const conflict = await checkProfileUniqueness(
      app.prisma,
      id,
      email,
      username
    );
    if (conflict) {
      return sendError(reply, 409, "CONFLICT", conflict);
    }

    try {
      const updated = await updateProfile(app.prisma, id, data);
      return reply.send(updated);
    } catch (err) {
      const conflictMsg = isUniqueViolation(err);
      if (conflictMsg) {
        return sendError(reply, 409, "CONFLICT", conflictMsg);
      }
      throw err;
    }
  });

  app.get("/:id/activity", async (request, reply) => {
    const paramParsed = userIdParamSchema.safeParse(
      (request.params as { id: string }).id
    );
    if (!paramParsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid user ID", {
        id: paramParsed.error
          .flatten()
          .formErrors.map((m) => resolveValidationMessage(m, request.locale)),
      });
    }
    const id = paramParsed.data;
    const queryParsed = activityListQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        {
          errors: resolveZodErrors(
            queryParsed.error.flatten().fieldErrors,
            request.locale
          ),
        }
      );
    }
    const take = queryParsed.data.limit;
    const cursor = queryParsed.data.cursor;

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (!(await canAccessUser(request.user, id, { user: ["list"] }))) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient permissions");
    }

    let cursorFilter = {};
    if (cursor) {
      const cursorLog = await app.prisma.auditLog.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (!cursorLog) {
        return sendError(reply, 400, "BAD_REQUEST", "Invalid cursor");
      }
      cursorFilter = {
        OR: [
          { createdAt: { lt: cursorLog.createdAt } },
          {
            createdAt: cursorLog.createdAt,
            id: { lt: cursor },
          },
        ],
      };
    }

    const logs = await app.prisma.auditLog.findMany({
      where: { userId: id, ...cursorFilter },
      select: {
        id: true,
        action: true,
        fromValue: true,
        toValue: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });

    const nextCursor = logs.length === take ? logs.at(-1)?.id : null;

    return reply.send({ items: logs, nextCursor });
  });

  app.get("/:id/stats", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (!(await canAccessUser(request.user, id, { user: ["list"] }))) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient permissions");
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

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (!(await canAccessUser(request.user, id, { session: ["list"] }))) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient permissions");
    }

    const currentSessionId = request.user.sessionId;

    const sessions = await app.prisma.session.findMany({
      where: { userId: id, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSessionId,
    }));

    return reply.send(result);
  });

  app.delete("/:id/sessions/:sessionId", async (request, reply) => {
    const { id, sessionId } = request.params as {
      id: string;
      sessionId: string;
    };

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (!(await canAccessUser(request.user, id, { session: ["revoke"] }))) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient permissions");
    }

    const session = await app.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });

    if (!session || session.userId !== id) {
      return sendError(reply, 404, "NOT_FOUND", "Session not found");
    }

    if (sessionId === request.user.sessionId) {
      return sendError(reply, 400, "BAD_REQUEST", "Cannot end current session");
    }

    await app.prisma.session.delete({ where: { id: sessionId } });

    return reply.send({ success: true });
  });

  app.post("/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (request.user.id !== id) {
      return sendError(reply, 403, "FORBIDDEN", "Can only update own avatar");
    }

    const data = await request.file();
    if (!data) {
      return sendError(reply, 400, "BAD_REQUEST", "No file provided");
    }

    const result = await uploadAvatar(app.prisma, id, data);
    if (!result) {
      return sendError(reply, 404, "NOT_FOUND", "User not found");
    }
    if ("error" in result) {
      const status = result.error === "FILE_TOO_LARGE" ? 413 : 400;
      return sendError(reply, status, result.error, result.error);
    }

    return reply.send(result);
  });

  app.delete("/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (request.user.id !== id) {
      return sendError(reply, 403, "FORBIDDEN", "Can only delete own avatar");
    }

    const result = await deleteAvatar(app.prisma, id);
    if (!result) {
      return sendError(reply, 404, "NOT_FOUND", "User not found");
    }

    return reply.send(result);
  });
};
