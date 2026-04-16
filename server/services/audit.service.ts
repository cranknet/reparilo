import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

type PrismaOrTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

interface AuditInput {
  action: AuditAction;
  fromValue?: string;
  jobId: string;
  metadata?: Record<string, unknown>;
  note?: string;
  toValue?: string;
  userId: string;
}

export async function createAuditLog(
  prisma: PrismaOrTx,
  input: AuditInput
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      jobId: input.jobId,
      userId: input.userId,
      action: input.action,
      fromValue: input.fromValue,
      toValue: input.toValue,
      note: input.note,
      metadata: (input.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}
