import type { Prisma } from "@generated/client";
import type { DbClient } from "./types.js";

export function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export function createWaitingPart(
  prisma: DbClient,
  data: Prisma.JobPartsWaitingCreateInput
) {
  return prisma.jobPartsWaiting.create({ data });
}

export function findWaitingPartByIdAndJob(
  prisma: DbClient,
  waitingId: string,
  jobId: string
) {
  return prisma.jobPartsWaiting.findFirst({
    where: { id: waitingId, jobId },
  });
}

export function deleteWaitingPart(prisma: DbClient, waitingId: string) {
  return prisma.jobPartsWaiting.delete({ where: { id: waitingId } });
}
