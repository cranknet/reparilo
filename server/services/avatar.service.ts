import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

const UPLOAD_DIR = path.resolve("uploads/avatars");
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

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

export async function uploadAvatar(
  prisma: PrismaClient,
  userId: string,
  file: { mimetype: string; toBuffer: () => Promise<Buffer> }
) {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return { error: "INVALID_FILE_TYPE" as const };
  }

  const buffer = await file.toBuffer();
  if (buffer.length > MAX_SIZE) {
    return { error: "FILE_TOO_LARGE" as const };
  }
  if (!validateMagicBytes(buffer, file.mimetype)) {
    return { error: "INVALID_FILE_CONTENT" as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (!user) {
    return null;
  }

  if (user.image) {
    const oldPath = path.resolve("uploads", user.image);
    await fs.unlink(oldPath).catch(() => {
      /* intentionally ignored */
    });
  }

  const ext = extFromMime(file.mimetype);
  const filename = `${userId}_${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);

  const relativePath = `avatars/${filename}`;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { image: relativePath },
    });
  } catch (err) {
    await fs.unlink(filePath).catch(() => {
      /* intentionally ignored */
    });
    throw err;
  }

  return { image: relativePath };
}

export async function deleteAvatar(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (!user) {
    return null;
  }
  if (!user.image) {
    return { image: null };
  }

  const fullPath = path.resolve("uploads", user.image);
  await fs.unlink(fullPath).catch(() => {
    /* intentionally ignored */
  });

  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  });

  return { image: null };
}
