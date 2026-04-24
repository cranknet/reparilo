import { describe, expect, it, vi } from "vitest";
import { emitDashboardChanged } from "../lib/dashboard-events.js";

describe("emitDashboardChanged — integration with wsBroadcast", () => {
  it("delivers to owner, front-desk, and assigned tech on job create", () => {
    const calls: { role: string; userId: string }[][] = [];
    const broadcast = vi.fn(
      (predicate: (c: { role: string; userId: string }) => boolean) => {
        const audience = [
          { role: "OWNER", userId: "o1" },
          { role: "FRONT_DESK", userId: "f1" },
          { role: "TECHNICIAN", userId: "t1" },
          { role: "TECHNICIAN", userId: "t2" },
        ];
        calls.push(audience.filter(predicate));
      }
    );
    const app = { wsBroadcast: broadcast } as never;
    emitDashboardChanged(app, ["OWNER", "FRONT_DESK", { technicianId: "t1" }]);
    expect(broadcast).toHaveBeenCalledTimes(3);
    expect(calls[0]).toEqual([{ role: "OWNER", userId: "o1" }]);
    expect(calls[1]).toEqual([{ role: "FRONT_DESK", userId: "f1" }]);
    expect(calls[2]).toEqual([{ role: "TECHNICIAN", userId: "t1" }]);
  });

  it("delivers to both old and new tech on reassignment", () => {
    const broadcast = vi.fn();
    const app = { wsBroadcast: broadcast } as never;
    emitDashboardChanged(app, [
      "OWNER",
      "FRONT_DESK",
      { technicianId: "old" },
      { technicianId: "new" },
    ]);
    expect(broadcast).toHaveBeenCalledTimes(4);
  });
});
