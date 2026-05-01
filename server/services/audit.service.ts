import type { AuditAction } from "@generated/client";
import type { DbClient } from "../repositories/audit.repository.js";
import { create } from "../repositories/audit.repository.js";

export type { DbClient } from "../repositories/audit.repository.js";

interface AuditInput {
  action: AuditAction;
  fromValue?: string;
  jobId: string;
  metadata?: Record<string, unknown>;
  note?: string;
  toValue?: string;
  userId: string;
}

export async function createAuditLog(
  prisma: DbClient,
  input: AuditInput
): Promise<void> {
  await create(prisma, input);
}
