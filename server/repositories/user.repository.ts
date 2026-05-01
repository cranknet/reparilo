import type { PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findFailedAttempts(prisma: DbClient, userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });
}

export async function incrementFailedAttempt(
  prisma: DbClient,
  userId: string,
  data: { failedLoginAttempts: { increment: number }; lockedUntil?: Date }
) {
  return await prisma.user.update({
    data,
    where: { id: userId },
  });
}

export async function resetFailedAttempts(prisma: DbClient, userId: string) {
  return await prisma.user.updateMany({
    data: { failedLoginAttempts: 0, lockedUntil: null },
    where: { id: userId },
  });
}
