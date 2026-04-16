import type { PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import type { AddJobRepairInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobRepairInput,
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }
  if (TERMINAL_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const jobRepair = await prisma.jobRepair.create({
    data: {
      jobId,
      repairId: input.repairId ?? null,
      repairName: input.repairName,
      category: input.category,
      price: input.price,
      createdById: userId,
    },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.REPAIR_ADDED,
    toValue: `${input.repairName} — ${input.price}`,
    metadata: { repairId: input.repairId },
  });

  return jobRepair;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  repairId: string,
  userId: string
) {
  const repair = await prisma.jobRepair.findFirst({
    where: { id: repairId, jobId },
  });
  if (!repair) {
    return null;
  }

  await prisma.jobRepair.delete({ where: { id: repairId } });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.REPAIR_REMOVED,
    fromValue: `${repair.repairName} — ${repair.price}`,
  });

  return true;
}
