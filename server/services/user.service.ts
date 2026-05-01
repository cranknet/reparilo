import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";
import type { RoleType } from "@shared/constants/roles";
import { AppError } from "@shared/errors/app-error.js";
import type {
  ActivityListQueryInput,
  UserListQueryInput,
} from "@shared/schemas/auth.schema";
import { hashPassword } from "better-auth/crypto";
import {
  create as auditCreate,
  findMany as auditFindMany,
  findUnique as auditFindUnique,
} from "../repositories/audit.repository.js";
import {
  deleteSession,
  findSessionById,
  findSessions,
  jobCount,
  resetPasswordTransaction,
  USER_SELECT,
  USER_SELECT_NO_IMAGE,
  count as userCount,
  findFirst as userFindFirst,
  findMany as userFindMany,
  findUniqueById as userFindUniqueById,
  updateUserProfile as userUpdateProfile,
  updateStatus as userUpdateStatus,
} from "../repositories/user.repository.js";

async function checkUniqueFields(
  prisma: PrismaClient,
  checks: Array<{ field: "email" | "username"; value: string }>,
  excludeId: string
): Promise<string | null> {
  for (const { field, value } of checks) {
    const where: Record<string, unknown> = {
      [field]: value,
      NOT: { id: excludeId },
    };
    const existing = await userFindFirst(prisma, where);
    if (existing) {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      return `${label} already in use`;
    }
  }
  return null;
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

function buildUpdateData(
  fields: Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  ) as Record<string, string>;
}

export async function list(prisma: PrismaClient, query: UserListQueryInput) {
  const { cursor, limit, search } = query;

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
    userFindMany(prisma, where, USER_SELECT, { id: "desc" }, limit + 1),
    cursor ? Promise.resolve(null) : userCount(prisma, where),
  ]);

  let nextCursor: string | null = null;
  if (users.length > limit) {
    users.pop();
    nextCursor = users.at(-1)?.id ?? null;
  }

  return { users, nextCursor, totalCount };
}

export async function getById(prisma: PrismaClient, id: string) {
  const user = await userFindUniqueById(prisma, id, USER_SELECT);
  if (!user) {
    throw new AppError("USER_NOT_FOUND");
  }
  return user;
}

export async function createUser(
  prisma: PrismaClient,
  authApi: {
    createUser: (args: unknown) => Promise<{ user?: { id: string } }>;
  },
  headers: unknown,
  data: { username: string; email: string; password: string; role: string },
  userId: string
) {
  const { username, email, password, role } = data;

  const existing = await userFindFirst(prisma, {
    OR: [{ username }, { email }],
  });
  if (existing) {
    const errorCode =
      existing.username === username ? "USERNAME_EXISTS" : "EMAIL_EXISTS";
    throw new AppError(errorCode);
  }

  const created = await authApi.createUser({
    headers,
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

  const user = await userFindUniqueById(
    prisma,
    created.user.id,
    USER_SELECT_NO_IMAGE
  );

  await auditCreate(prisma, {
    action: "USER_CREATED" as Parameters<typeof auditCreate>[1]["action"],
    jobId: null as unknown as string,
    toValue: `${username} (${role})`,
    userId,
  });

  return user;
}

export async function toggleStatus(
  prisma: PrismaClient,
  id: string,
  isActive: boolean
) {
  return await userUpdateStatus(prisma, id, isActive, USER_SELECT_NO_IMAGE);
}

export async function resetPassword(
  prisma: PrismaClient,
  id: string,
  newPassword: string,
  userId: string
) {
  const targetUser = await userFindUniqueById(prisma, id, {
    id: true,
    username: true,
  });
  if (!targetUser) {
    throw new AppError("USER_NOT_FOUND");
  }

  const hashed = await hashPassword(newPassword);

  await resetPasswordTransaction(prisma, id, hashed);

  await auditCreate(prisma, {
    action: "PASSWORD_RESET" as Parameters<typeof auditCreate>[1]["action"],
    jobId: null as unknown as string,
    toValue: `Password reset for ${targetUser.username}`,
    userId,
  });
}

export async function updateUserProfileService(
  prisma: PrismaClient,
  id: string,
  data: { name?: string; email?: string; username?: string }
) {
  const { name, email, username } = data;

  const updateData = buildUpdateData({ name, email, username });

  if (Object.keys(updateData).length === 0) {
    throw new AppError("AT_LEAST_ONE_FIELD");
  }

  const checks: Array<{ field: "email" | "username"; value: string }> = [];
  if (email) {
    checks.push({ field: "email", value: email });
  }
  if (username) {
    checks.push({ field: "username", value: username });
  }
  if (checks.length > 0) {
    const conflict = await checkUniqueFields(prisma, checks, id);
    if (conflict) {
      throw new AppError("CONFLICT", { message: conflict });
    }
  }

  try {
    const updated = await userUpdateProfile(
      prisma,
      id,
      updateData,
      USER_SELECT_NO_IMAGE
    );
    return updated;
  } catch (err) {
    const conflictMsg = isUniqueViolation(err);
    if (conflictMsg) {
      throw new AppError("CONFLICT", { message: conflictMsg });
    }
    throw err;
  }
}

export async function getActivity(
  prisma: PrismaClient,
  id: string,
  query: ActivityListQueryInput
) {
  const take = query.limit;
  const cursor = query.cursor;

  let cursorFilter: Record<string, unknown> = {};
  if (cursor) {
    const cursorLog = await auditFindUnique(
      prisma,
      { id: cursor },
      { createdAt: true }
    );
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

  const logs = await auditFindMany(
    prisma,
    { userId: id, ...cursorFilter },
    {
      id: true,
      action: true,
      fromValue: true,
      toValue: true,
      metadata: true,
      createdAt: true,
    },
    [{ createdAt: "desc" }, { id: "desc" }],
    take
  );

  const nextCursor = logs.length === take ? logs.at(-1)?.id : null;

  return { items: logs, nextCursor };
}

export async function getStats(prisma: PrismaClient, id: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [completedJobs, monthlyJobs] = await Promise.all([
    jobCount(prisma, {
      technicianId: id,
      status: { in: ["DONE", "DELIVERED"] },
    }),
    jobCount(prisma, {
      technicianId: id,
      status: { in: ["DONE", "DELIVERED"] },
      createdAt: { gte: monthStart },
    }),
  ]);

  return { completedJobs, monthlyJobs };
}

export async function getSessions(
  prisma: PrismaClient,
  id: string,
  currentSessionId: string
) {
  const sessions = await findSessions(prisma, id);

  return sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.id === currentSessionId,
  }));
}

export async function revokeSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  currentSessionId: string
) {
  const session = await findSessionById(prisma, sessionId);

  if (!session || session.userId !== userId) {
    throw new AppError("SESSION_NOT_FOUND");
  }

  if (sessionId === currentSessionId) {
    throw new AppError("CANNOT_END_CURRENT_SESSION");
  }

  await deleteSession(prisma, sessionId);
}
