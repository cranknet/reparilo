import type { PrismaClient } from "@generated/client";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

export function isAccountLocked(user: { lockedUntil: Date | null }): boolean {
  if (!user.lockedUntil) {
    return false;
  }
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function incrementFailedAttempt(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });
  if (!user) {
    return;
  }

  const nextAttempts = user.failedLoginAttempts + 1;
  const shouldLock = nextAttempts >= LOCKOUT_THRESHOLD;

  await prisma.user.update({
    data: {
      failedLoginAttempts: { increment: 1 },
      ...(shouldLock
        ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
        : {}),
    },
    where: { id: userId },
  });
}

export async function resetFailedAttempts(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.user.updateMany({
    data: { failedLoginAttempts: 0, lockedUntil: null },
    where: { id: userId },
  });
}
