import type { PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import type { AddJobNoteInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

export function list(prisma: PrismaClient, jobId: string) {
  return prisma.jobNote.findMany({
    where: { jobId },
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobNoteInput,
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }

  const note = await prisma.jobNote.create({
    data: {
      jobId,
      content: input.content,
      isCustomerVisible: input.isCustomerVisible,
      createdById: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.NOTE_ADDED,
    note: input.isCustomerVisible ? "Customer-visible note" : "Internal note",
    metadata: {
      contentLength: input.content.length,
      isCustomerVisible: input.isCustomerVisible,
    },
  });

  return note;
}
