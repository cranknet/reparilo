import type { PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import type { AddJobPartInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

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
  if (TERMINAL_STATUSES.includes(job.status)) {
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
  });
  if (!part) {
    return null;
  }

  await prisma.jobPart.delete({ where: { id: partId } });

  await createAuditLog(prisma, {
    action: AuditAction.PART_REMOVED,
    fromValue: `${part.partName} x${part.quantity}`,
    jobId,
    userId,
  });

  return true;
}
