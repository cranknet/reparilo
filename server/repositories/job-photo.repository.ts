import type { Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export function countPhotos(prisma: DbClient, jobId: string) {
  return prisma.jobPhoto.count({ where: { jobId } });
}

export function createPhoto(
  prisma: DbClient,
  data: Prisma.JobPhotoCreateInput
) {
  return prisma.jobPhoto.create({ data });
}

export function findPhotoByIdAndJob(
  prisma: DbClient,
  photoId: string,
  jobId: string
) {
  return prisma.jobPhoto.findFirst({
    where: { id: photoId, jobId },
  });
}

export function deletePhotoById(prisma: DbClient, photoId: string) {
  return prisma.jobPhoto.delete({ where: { id: photoId } });
}
