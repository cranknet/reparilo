import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export async function generateJobCode(prisma: PrismaClient): Promise<{
  jobCode: string;
  accessCode: string;
}> {
  const year = new Date().getFullYear();
  const accessCode = crypto.randomBytes(8).toString("hex");

  const counter = await prisma.$transaction(async (tx) => {
    const existing = await tx.jobCounter.findUnique({ where: { year } });
    if (existing) {
      return tx.jobCounter.update({
        where: { year },
        data: { lastSeq: { increment: 1 } },
      });
    }
    return tx.jobCounter.create({
      data: { year, lastSeq: 1 },
    });
  });

  const seq = counter.lastSeq.toString().padStart(4, "0");
  const suffix = crypto
    .randomBytes(2)
    .toString("hex")
    .slice(0, 3)
    .toUpperCase();
  const jobCode = `REP-${year}-${seq}-${suffix}`;

  return { jobCode, accessCode };
}
