import type { DbClient } from "../repositories/avatar.repository.js";
import {
  findUserImage,
  updateUserImage,
} from "../repositories/avatar.repository.js";
import { validateMagicBytes } from "../utils/file-validation.js";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

export async function uploadAvatar(
  prisma: DbClient,
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

  const user = await findUserImage(prisma, userId);
  if (!user) {
    return null;
  }

  const dataUrl = `data:${file.mimetype};base64,${buffer.toString("base64")}`;

  await updateUserImage(prisma, userId, dataUrl);

  return { image: dataUrl };
}

export async function deleteAvatar(prisma: DbClient, userId: string) {
  const user = await findUserImage(prisma, userId);
  if (!user) {
    return null;
  }
  if (!user.image) {
    return { image: null };
  }

  await updateUserImage(prisma, userId, null);

  return { image: null };
}
