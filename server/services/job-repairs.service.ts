import type { PrismaClient } from "@generated/client";
import { AuditAction, type RepairCategory } from "@generated/client";
import type { AddJobRepairInput } from "@shared/schemas/job.schema";
import {
  createRepair as createRepairRepo,
  deleteRepairById,
  findDuplicateRepair,
  findJobById,
  findRepairWithJob,
} from "../repositories/job-repair.repository.js";
import { assertJobMutable } from "../utils/job-mutations.js";
import { createAuditLog } from "./audit.service.js";

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobRepairInput,
  userId: string
) {
  const job = await findJobById(prisma, jobId);
  if (!job) {
    return null;
  }
  const mutabilityError = assertJobMutable(job);
  if (mutabilityError) {
    return mutabilityError;
  }

  if (input.repairId) {
    const existing = await findDuplicateRepair(prisma, jobId, input.repairId);
    if (existing) {
      return { error: "DUPLICATE_REPAIR" as const };
    }
  }

  const jobRepair = await prisma.$transaction(async (tx) => {
    const created = await createRepairRepo(tx, {
      job: { connect: { id: jobId } },
      repair: input.repairId ? { connect: { id: input.repairId } } : undefined,
      repairName: input.repairName,
      category: input.category as RepairCategory,
      price: input.price,
      createdBy: { connect: { id: userId } },
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
  const repair = await findRepairWithJob(prisma, repairId, jobId);
  if (!repair) {
    return null;
  }
  const mutabilityError = assertJobMutable(repair.job);
  if (mutabilityError) {
    return mutabilityError;
  }

  await prisma.$transaction(async (tx) => {
    await deleteRepairById(tx, repairId);
    await createAuditLog(tx, {
      jobId,
      userId,
      action: AuditAction.REPAIR_REMOVED,
      fromValue: `${repair.repairName} — ${repair.price}`,
    });
  });

  return true;
}
