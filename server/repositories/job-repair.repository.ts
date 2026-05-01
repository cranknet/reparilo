import type { Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export function findDuplicateRepair(
  prisma: DbClient,
  jobId: string,
  repairId: string
) {
  return prisma.jobRepair.findFirst({
    where: { jobId, repairId },
  });
}

export function createRepair(
  prisma: DbClient,
  data: Prisma.JobRepairCreateInput
) {
  return prisma.jobRepair.create({ data });
}

export function findRepairWithJob(
  prisma: DbClient,
  repairId: string,
  jobId: string
) {
  return prisma.jobRepair.findFirst({
    where: { id: repairId, jobId },
    include: { job: { select: { status: true } } },
  });
}

export function deleteRepairById(prisma: DbClient, repairId: string) {
  return prisma.jobRepair.delete({ where: { id: repairId } });
}
