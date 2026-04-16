import type { PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { INACTIVE_STATUSES } from "@shared/constants";
import type { AddWaitingPartInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddWaitingPartInput,
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }
  if (INACTIVE_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const waitingPart = await prisma.jobPartsWaiting.create({
    data: {
      jobId,
      partName: input.partName,
      supplier: input.supplier ?? null,
    },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PART_ADDED,
    note: `Waiting part added: ${input.partName}`,
    toValue: input.partName,
  });

  return waitingPart;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  waitingId: string,
  userId: string
) {
  const waitingPart = await prisma.jobPartsWaiting.findFirst({
    where: { id: waitingId, jobId },
  });
  if (!waitingPart) {
    return null;
  }

  await prisma.jobPartsWaiting.delete({ where: { id: waitingId } });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PART_REMOVED,
    note: `Waiting part removed: ${waitingPart.partName}`,
    fromValue: waitingPart.partName,
  });

  return true;
}
