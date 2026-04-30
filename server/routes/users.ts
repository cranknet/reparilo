import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";
import type { RoleType } from "@shared/constants/roles";
import { AppError } from "@shared/errors/app-error.js";
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
    requestingUser: { id: string; role: string },
    targetId: string,
    permission: Record<string, string[]>
  ): Promise<boolean> {
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
      schema: {
        tags: ["users"],
        summary: "List users",
        querystring: { type: "object", additionalProperties: true },
      },
      preHandler: [requirePermission({ user: ["list"] })],
    },
    async (request, reply) => {
      const parsed = userListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
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
      schema: {
        tags: ["users"],
        summary: "Get user by ID",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      preHandler: [requirePermission({ user: ["get"] })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = await app.prisma.user.findUnique({
        where: { id },
        select: userSelect,
      });
      if (!user) {
        throw new AppError("USER_NOT_FOUND");
      }
      return reply.send(user);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["users"],
        summary: "Create user",
        body: { type: "object", additionalProperties: true },
      },
      preHandler: [requirePermission({ user: ["create"] })],
    },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
      }

      const { username, email, password, role } = parsed.data;

      const existing = await app.prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });
      if (existing) {
        const errorCode =
          existing.username === username ? "USERNAME_EXISTS" : "EMAIL_EXISTS";
        throw new AppError(errorCode);
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
        throw new AppError("INTERNAL_ERROR");
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
          userId: request.user.id,
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
      schema: {
        tags: ["users"],
        summary: "Toggle user active status",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: { type: "object", additionalProperties: true },
      },
      preHandler: [requirePermission({ user: ["update"] })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = toggleUserStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
      }
      const { isActive } = parsed.data;

      if (id === request.user?.id && !isActive) {
        throw new AppError("CANNOT_DEACTIVATE_OWN");
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
      schema: {
        tags: ["users"],
        summary: "Reset user password",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: { type: "object", additionalProperties: true },
      },
      preHandler: [requirePermission({ user: ["update"] })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
      }

      const targetUser = await app.prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        throw new AppError("USER_NOT_FOUND");
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
          userId: request.user.id,
          action: "PASSWORD_RESET",
          toValue: `Password reset for ${targetUser.username}`,
        },
      });

      return reply.send({ success: true });
    }
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["users"],
        summary: "Update user profile",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: { type: "object", additionalProperties: true },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!(await canAccessUser(request.user, id, { user: ["update"] }))) {
        throw new AppError("FORBIDDEN");
      }

      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
      }

      const { name, email, username } = parsed.data;

      const data = buildUpdateData({ name, email, username });

      if (Object.keys(data).length === 0) {
        throw new AppError("AT_LEAST_ONE_FIELD");
      }

      const conflict = await checkProfileUniqueness(
        app.prisma,
        id,
        email,
        username
      );
      if (conflict) {
        throw new AppError("CONFLICT", { message: conflict });
      }

      try {
        const updated = await updateProfile(app.prisma, id, data);
        return reply.send(updated);
      } catch (err) {
        const conflictMsg = isUniqueViolation(err);
        if (conflictMsg) {
          throw new AppError("CONFLICT", { message: conflictMsg });
        }
        throw err;
      }
    }
  );

  app.get(
    "/:id/activity",
    {
      schema: {
        tags: ["users"],
        summary: "Get user activity log",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        querystring: { type: "object", additionalProperties: true },
      },
    },
    async (request, reply) => {
      const paramParsed = userIdParamSchema.safeParse(
        (request.params as { id: string }).id
      );
      if (!paramParsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: paramParsed.error
            .flatten()
            .formErrors.map((m) => resolveValidationMessage(m, request.locale)),
        });
      }
      const id = paramParsed.data;
      const queryParsed = activityListQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            queryParsed.error.flatten().fieldErrors,
            request.locale
          ),
        });
      }
      const take = queryParsed.data.limit;
      const cursor = queryParsed.data.cursor;

      if (!(await canAccessUser(request.user, id, { user: ["list"] }))) {
        throw new AppError("FORBIDDEN");
      }

      let cursorFilter = {};
      if (cursor) {
        const cursorLog = await app.prisma.auditLog.findUnique({
          where: { id: cursor },
          select: { createdAt: true },
        });
        if (!cursorLog) {
          throw new AppError("INVALID_CURSOR");
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
    }
  );

  app.get(
    "/:id/stats",
    {
      schema: {
        tags: ["users"],
        summary: "Get user stats",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!(await canAccessUser(request.user, id, { user: ["list"] }))) {
        throw new AppError("FORBIDDEN");
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
    }
  );

  app.get(
    "/:id/sessions",
    {
      schema: {
        tags: ["users"],
        summary: "List user sessions",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!(await canAccessUser(request.user, id, { session: ["list"] }))) {
        throw new AppError("FORBIDDEN");
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
    }
  );

  app.delete(
    "/:id/sessions/:sessionId",
    {
      schema: {
        tags: ["users"],
        summary: "Revoke user session",
        params: {
          type: "object",
          properties: { id: { type: "string" }, sessionId: { type: "string" } },
          required: ["id", "sessionId"],
        },
      },
    },
    async (request, reply) => {
      const { id, sessionId } = request.params as {
        id: string;
        sessionId: string;
      };

      if (!(await canAccessUser(request.user, id, { session: ["revoke"] }))) {
        throw new AppError("FORBIDDEN");
      }

      const session = await app.prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true },
      });

      if (!session || session.userId !== id) {
        throw new AppError("SESSION_NOT_FOUND");
      }

      if (sessionId === request.user.sessionId) {
        throw new AppError("CANNOT_END_CURRENT_SESSION");
      }

      await app.prisma.session.delete({ where: { id: sessionId } });

      return reply.send({ success: true });
    }
  );

  app.post(
    "/:id/avatar",
    {
      schema: {
        tags: ["users"],
        summary: "Upload user avatar",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (request.user.id !== id) {
        throw new AppError("AVATAR_NOT_OWN");
      }

      const data = await request.file();
      if (!data) {
        throw new AppError("NO_FILE_UPLOADED");
      }

      const result = await uploadAvatar(app.prisma, id, data);
      if (!result) {
        throw new AppError("USER_NOT_FOUND");
      }
      if ("error" in result && result.error) {
        throw new AppError(result.error);
      }

      return reply.send(result);
    }
  );

  app.delete(
    "/:id/avatar",
    {
      schema: {
        tags: ["users"],
        summary: "Delete user avatar",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (request.user.id !== id) {
        throw new AppError("AVATAR_NOT_OWN");
      }

      const result = await deleteAvatar(app.prisma, id);
      if (!result) {
        throw new AppError("USER_NOT_FOUND");
      }

      return reply.send(result);
    }
  );
};
