import type { PrismaClient } from "@generated/client";
import { AuditAction } from "@generated/client";
import { INACTIVE_STATUSES } from "@shared/constants";
import type { AddJobPartInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobPartInput,
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }
  if (INACTIVE_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const totalCost = input.unitPrice * input.quantity;

  const jobPart = await prisma.jobPart.create({
    data: {
      category: input.category,
      jobId,
      partId: input.partId ?? null,
      partName: input.partName,
      quantity: input.quantity,
      supplier: input.supplier ?? null,
      totalCost,
      unitPrice: input.unitPrice,
      createdById: userId,
    },
  });

  await createAuditLog(prisma, {
    action: AuditAction.PART_ADDED,
    jobId,
    metadata: { partId: input.partId, totalCost },
    toValue: `${input.partName} x${input.quantity}`,
    userId,
  });

  return jobPart;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  partId: string,
  userId: string
) {
  const part = await prisma.jobPart.findFirst({
    where: { id: partId, jobId },
    include: { job: { select: { status: true } } },
  });
  if (!part) {
    return null;
  }
  if (INACTIVE_STATUSES.includes(part.job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobPart.delete({ where: { id: partId } });
    await createAuditLog(tx, {
      action: AuditAction.PART_REMOVED,
      fromValue: `${part.partName} x${part.quantity}`,
      jobId,
      userId,
    });
  });

  return true;
}
