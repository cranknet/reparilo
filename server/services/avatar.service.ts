import type { PrismaClient } from "@generated/client";
import { validateMagicBytes } from "../utils/file-validation.js";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB — prevents DB bloat from large base64 avatars

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

  const dataUrl = `data:${file.mimetype};base64,${buffer.toString("base64")}`;

  await prisma.user.update({
    where: { id: userId },
    data: { image: dataUrl },
  });

  return { image: dataUrl };
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

  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  });

  return { image: null };
}
