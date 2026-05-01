import type { PrismaClient } from "@generated/client";
import { AuditAction } from "@generated/client";
import type { AddJobNoteInput } from "@shared/schemas/job.schema";
import {
  createNote as createNoteRepo,
  findJobById,
  findManyNotes,
} from "../repositories/job-note.repository.js";
import { assertJobMutable } from "../utils/job-mutations.js";
import { createAuditLog } from "./audit.service.js";

export async function list(prisma: PrismaClient, jobId: string) {
  const job = await findJobById(prisma, jobId);
  if (!job) {
    return null;
  }
  return findManyNotes(prisma, jobId);
}

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobNoteInput,
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

  const note = await prisma.$transaction(async (tx) => {
    const created = await createNoteRepo(tx, {
      jobId,
      content: input.content,
      isCustomerVisible: input.isCustomerVisible,
      createdById: userId,
    });

    await createAuditLog(tx, {
      jobId,
      userId,
      action: AuditAction.NOTE_ADDED,
      note: input.isCustomerVisible ? "Customer-visible note" : "Internal note",
      metadata: {
        contentLength: input.content.length,
        isCustomerVisible: input.isCustomerVisible,
      },
    });

    return created;
  });

  return note;
}
