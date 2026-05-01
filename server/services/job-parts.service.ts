import type { PrismaClient } from "@generated/client";
import { AuditAction } from "@generated/client";
import type { AddJobPartInput } from "@shared/schemas/job.schema";
import {
  createPart as createPartRepo,
  deletePartById,
  findJobById,
  findPartWithJob,
} from "../repositories/job-part.repository.js";
import { assertJobMutable } from "../utils/job-mutations.js";
import { createAuditLog } from "./audit.service.js";

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobPartInput,
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

  const totalCost = input.unitPrice * input.quantity;

  const jobPart = await createPartRepo(prisma, {
    category: input.category,
    jobId,
    partId: input.partId ?? null,
    partName: input.partName,
    quantity: input.quantity,
    supplier: input.supplier ?? null,
    totalCost,
    unitPrice: input.unitPrice,
    createdById: userId,
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
  const part = await findPartWithJob(prisma, partId, jobId);
  if (!part) {
    return null;
  }
  const mutabilityError = assertJobMutable(part.job);
  if (mutabilityError) {
    return mutabilityError;
  }

  await prisma.$transaction(async (tx) => {
    await deletePartById(tx, partId);
    await createAuditLog(tx, {
      action: AuditAction.PART_REMOVED,
      fromValue: `${part.partName} x${part.quantity}`,
      jobId,
      userId,
    });
  });

  return true;
}
