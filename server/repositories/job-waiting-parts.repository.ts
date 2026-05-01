import type { Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

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
