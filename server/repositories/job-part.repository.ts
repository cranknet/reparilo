import type { Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export function createPart(prisma: DbClient, data: Prisma.JobPartCreateInput) {
  return prisma.jobPart.create({ data });
}

export function findPartWithJob(
  prisma: DbClient,
  partId: string,
  jobId: string
) {
  return prisma.jobPart.findFirst({
    where: { id: partId, jobId },
    include: { job: { select: { status: true } } },
  });
}

export function deletePartById(prisma: DbClient, partId: string) {
  return prisma.jobPart.delete({ where: { id: partId } });
}
