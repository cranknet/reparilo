import crypto from "node:crypto";
import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";

const MAX_SEQ = 999_999;

export async function generateJobCode(prisma: PrismaClient): Promise<{
  jobCode: string;
  accessCode: string;
}> {
  const year = new Date().getFullYear();
  const accessCode = crypto.randomBytes(8).toString("hex");

  const counter = await prisma.jobCounter.upsert({
    where: { year },
    update: { lastSeq: { increment: 1 } },
    create: { year, lastSeq: 1 },
  });

  if (counter.lastSeq > MAX_SEQ) {
    throw new AppError("JOB_CODE_OVERFLOW");
  }

  const seq = counter.lastSeq.toString().padStart(6, "0");
  const suffix = crypto
    .randomBytes(2)
    .toString("hex")
    .slice(0, 3)
    .toUpperCase();
  const jobCode = `REP-${year}-${seq}-${suffix}`;

  return { jobCode, accessCode };
}
