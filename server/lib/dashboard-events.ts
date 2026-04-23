import type { DashboardInvalidateEvent } from "@shared/types/dashboard";
import type { FastifyInstance } from "fastify";

export type DashboardTarget = "FRONT_DESK" | "OWNER" | { technicianId: string };

interface WsClientLike {
  role: string;
  userId: string;
}

const PAYLOAD: DashboardInvalidateEvent = { type: "dashboard:invalidate" };

export function emitDashboardChanged(
  app: FastifyInstance,
  targets: DashboardTarget[]
): void {
  const broadcast = (
    app as unknown as {
      wsBroadcast?: (
        predicate: (c: WsClientLike) => boolean,
        payload: Record<string, unknown>
      ) => void;
    }
  ).wsBroadcast;
  if (!broadcast) {
    return;
  }

  const roles = new Set<string>();
  const techIds = new Set<string>();
  for (const t of targets) {
    if (t === "FRONT_DESK") {
      roles.add("FRONT_DESK");
    } else if (t === "OWNER") {
      roles.add("OWNER");
    } else {
      techIds.add(t.technicianId);
    }
  }

  for (const role of roles) {
    broadcast((c) => c.role === role, PAYLOAD);
  }
  for (const id of techIds) {
    broadcast((c) => c.role === "TECHNICIAN" && c.userId === id, PAYLOAD);
  }
}
