import type { PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export function findCredentialAccount(prisma: DbClient, userId: string) {
  return prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
}

export function changePasswordTransaction(
  prisma: DbClient,
  userId: string,
  hashedPassword: string
) {
  return prisma.$transaction([
    prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashedPassword },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    }),
  ]);
}
