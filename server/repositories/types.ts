import type { PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;
