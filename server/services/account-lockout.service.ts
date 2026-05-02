import type { DbClient } from "../repositories/types.js";
import {
  findFailedAttempts,
  incrementFailedAttempt as repoIncrementFailedAttempt,
  resetFailedAttempts as repoResetFailedAttempts,
} from "../repositories/user.repository.js";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

export function isAccountLocked(user: { lockedUntil: Date | null }): boolean {
  if (!user.lockedUntil) {
    return false;
  }
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function incrementFailedAttempt(
  prisma: DbClient,
  userId: string
): Promise<void> {
  const user = await findFailedAttempts(prisma, userId);
  if (!user) {
    return;
  }

  const nextAttempts = user.failedLoginAttempts + 1;
  const shouldLock = nextAttempts >= LOCKOUT_THRESHOLD;

  await repoIncrementFailedAttempt(prisma, userId, {
    failedLoginAttempts: { increment: 1 },
    ...(shouldLock
      ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
      : {}),
  });
}

export async function resetFailedAttempts(
  prisma: DbClient,
  userId: string
): Promise<void> {
  await repoResetFailedAttempts(prisma, userId);
}
