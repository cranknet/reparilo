import type { PrismaClient } from "@generated/client";
import { AuditAction, type RepairCategory } from "@generated/client";
import type { AddJobRepairInput } from "@shared/schemas";
import { assertJobMutable } from "../utils/job-mutations.js";
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
  const mutabilityError = assertJobMutable(job);
  if (mutabilityError) {
    return mutabilityError;
  }

  if (input.repairId) {
    const existing = await prisma.jobRepair.findFirst({
      where: { jobId, repairId: input.repairId },
    });
    if (existing) {
      return { error: "DUPLICATE_REPAIR" as const };
    }
  }

  const jobRepair = await prisma.$transaction(async (tx) => {
    const created = await tx.jobRepair.create({
      data: {
        jobId,
        repairId: input.repairId ?? null,
        repairName: input.repairName,
        category: input.category as RepairCategory,
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
  const mutabilityError = assertJobMutable(repair.job);
  if (mutabilityError) {
    return mutabilityError;
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
