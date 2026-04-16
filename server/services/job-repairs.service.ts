import type { PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { INACTIVE_STATUSES } from "@shared/constants";
import type { AddJobRepairInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

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
  if (INACTIVE_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const jobRepair = await prisma.$transaction(async (tx) => {
    const created = await tx.jobRepair.create({
      data: {
        jobId,
        repairId: input.repairId ?? null,
        repairName: input.repairName,
        category: input.category,
        price: input.price,
        createdById: userId,
      },
    });

    await createAuditLog(tx, {
      jobId,
      userId,
      action: AuditAction.REPAIR_ADDED,
      toValue: `${input.repairName} — ${input.price}`,
      metadata: { repairId: input.repairId },
    });

    return created;
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
    include: { job: { select: { status: true } } },
  });
  if (!repair) {
    return null;
  }
  if (INACTIVE_STATUSES.includes(repair.job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobRepair.delete({ where: { id: repairId } });
    await createAuditLog(tx, {
      jobId,
      userId,
      action: AuditAction.REPAIR_REMOVED,
      fromValue: `${repair.repairName} — ${repair.price}`,
    });
  });

  return true;
}
