import type { DashboardRole, Scope } from "@shared/types/dashboard";
import type { FastifyReply, FastifyRequest } from "fastify";

const TTL_MS = 60_000;
let cached: { expiresAt: number; value: string } | null = null;

export function __resetTzCache() {
  cached = null;
}

async function getShopTimezone(req: FastifyRequest): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const row = await req.server.prisma.shopSettings.findFirst({
    select: { timezone: true },
  });
  const value = row?.timezone ?? process.env.TZ ?? "UTC";
  cached = { expiresAt: now + TTL_MS, value };
  return value;
}

declare module "fastify" {
  interface FastifyRequest {
    dashboardScope?: Scope;
  }
}

export async function dashboardScope(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    await reply.status(401).send({ error: "Authentication required" });
    return;
  }

  const shopTz = await getShopTimezone(req);
  req.dashboardScope = {
    role: req.user.role as DashboardRole,
    shopTz,
    userId: req.user.id,
  };
}
