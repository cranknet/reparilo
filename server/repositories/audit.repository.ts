import type { AuditAction, Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

type AuditLogWhereInput = Prisma.AuditLogWhereInput;
type AuditLogOrderByWithRelationInput = Prisma.AuditLogOrderByWithRelationInput;
type AuditLogSelect = Prisma.AuditLogSelect;
type AuditLogInclude = Prisma.AuditLogInclude;

interface CreateAuditLogInput {
  action: AuditAction;
  fromValue?: string;
  jobId: string;
  metadata?: Record<string, unknown>;
  note?: string;
  toValue?: string;
  userId: string;
}

export async function create(
  prisma: DbClient,
  data: CreateAuditLogInput
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      jobId: data.jobId,
      userId: data.userId,
      action: data.action,
      fromValue: data.fromValue,
      toValue: data.toValue,
      note: data.note,
      metadata: (data.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}

export function findMany(
  prisma: DbClient,
  where: AuditLogWhereInput,
  select?: AuditLogSelect,
  orderBy?:
    | AuditLogOrderByWithRelationInput
    | AuditLogOrderByWithRelationInput[],
  take?: number
) {
  return prisma.auditLog.findMany({
    where,
    ...(select ? { select } : {}),
    ...(orderBy ? { orderBy } : {}),
    ...(take == null ? {} : { take }),
  });
}

export function findManyWithInclude(
  prisma: DbClient,
  where: AuditLogWhereInput,
  include: AuditLogInclude,
  orderBy?:
    | AuditLogOrderByWithRelationInput
    | AuditLogOrderByWithRelationInput[],
  take?: number
) {
  return prisma.auditLog.findMany({
    where,
    include,
    ...(orderBy ? { orderBy } : {}),
    ...(take == null ? {} : { take }),
  });
}

export function findUnique(
  prisma: DbClient,
  where: Prisma.AuditLogWhereUniqueInput,
  select?: AuditLogSelect
) {
  return prisma.auditLog.findUnique({
    where,
    ...(select ? { select } : {}),
  });
}
