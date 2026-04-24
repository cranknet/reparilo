import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@generated/client";
import { AuditAction } from "@generated/client";
import { INACTIVE_STATUSES } from "@shared/constants";
import { createAuditLog } from "./audit.service.js";

const UPLOAD_DIR = path.resolve("uploads/job-photos");
const MAX_PHOTOS = 5;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

function extFromMime(mime: string): string {
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  return "jpg";
}

function validateMagicBytes(buffer: Buffer, mime: string): boolean {
  const expected = MAGIC_BYTES[mime];
  if (!expected) {
    return false;
  }
  const headerMatch = expected.every((byte, i) => buffer[i] === byte);
  if (!headerMatch) {
    return false;
  }
  if (mime === "image/webp") {
    const offset = 8;
    return WEBP_MARKER.every((byte, i) => buffer[offset + i] === byte);
  }
  return true;
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
  if (INACTIVE_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
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
