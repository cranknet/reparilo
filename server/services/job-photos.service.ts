import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@generated/client";
import { AuditAction } from "@generated/client";
import { validateMagicBytes } from "../utils/file-validation.js";
import { assertJobMutable } from "../utils/job-mutations.js";
import { createAuditLog } from "./audit.service.js";

const UPLOAD_DIR = path.resolve("uploads/job-photos");
const MAX_PHOTOS = 5;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

function extFromMime(mime: string): string {
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  return "jpg";
}

export async function upload(
  prisma: PrismaClient,
  jobId: string,
  file: { mimetype: string; toBuffer: () => Promise<Buffer> },
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }
  const mutabilityError = assertJobMutable(job);
  if (mutabilityError) {
    return mutabilityError;
  }

  const photoCount = await prisma.jobPhoto.count({ where: { jobId } });
  if (photoCount >= MAX_PHOTOS) {
    return { error: "PHOTO_LIMIT_REACHED" as const };
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return { error: "INVALID_FILE_TYPE" as const };
  }

  const buffer = await file.toBuffer();
  if (!validateMagicBytes(buffer, file.mimetype)) {
    return { error: "INVALID_FILE_CONTENT" as const };
  }

  const ext = extFromMime(file.mimetype);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const jobDir = path.join(UPLOAD_DIR, jobId);
  const filePath = path.join(jobDir, filename);

  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(filePath, buffer);

  const relativePath = `job-photos/${jobId}/${filename}`;
  let photo: Awaited<ReturnType<typeof prisma.jobPhoto.create>>;
  try {
    photo = await prisma.jobPhoto.create({
      data: { jobId, path: relativePath },
    });
  } catch (err) {
    await fs.unlink(filePath).catch(() => {
      /* intentionally ignored */
    });
    throw err;
  }

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PHOTO_ADDED,
    toValue: filename,
  });

  return photo;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  photoId: string,
  userId: string
) {
  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, jobId },
  });
  if (!photo) {
    return null;
  }

  const fullPath = path.resolve("uploads", photo.path);
  try {
    await fs.unlink(fullPath);
  } catch {
    // File already deleted or missing — not an error
  }

  await prisma.jobPhoto.delete({ where: { id: photoId } });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PHOTO_REMOVED,
    fromValue: photo.path,
    note: `Photo deleted: ${photo.path}`,
  });

  return true;
}
