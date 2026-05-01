import type { PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findUserImage(prisma: DbClient, userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
}

export async function updateUserImage(
  prisma: DbClient,
  userId: string,
  image: string | null
) {
  return await prisma.user.update({
    where: { id: userId },
    data: { image },
  });
}
