import type { Prisma } from "@generated/client";
import type { DbClient } from "./types.js";

export function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export function findManyNotes(prisma: DbClient, jobId: string) {
  return prisma.jobNote.findMany({
    where: { jobId },
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function createNote(prisma: DbClient, data: Prisma.JobNoteCreateInput) {
  return prisma.jobNote.create({
    data,
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
  });
}
