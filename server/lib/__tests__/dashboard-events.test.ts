import { describe, expect, it, vi } from "vitest";
import { emitDashboardChanged } from "../dashboard-events.js";

describe("emitDashboardChanged", () => {
  it("calls wsBroadcast once per unique target", () => {
    const broadcast = vi.fn();
    const app = { wsBroadcast: broadcast } as never;
    emitDashboardChanged(app, ["FRONT_DESK", "OWNER", { technicianId: "t1" }]);
    expect(broadcast).toHaveBeenCalledTimes(3);
  });

  it("deduplicates repeated targets", () => {
    const broadcast = vi.fn();
    const app = { wsBroadcast: broadcast } as never;
    emitDashboardChanged(app, [
      "OWNER",
      "OWNER",
      { technicianId: "t1" },
      { technicianId: "t1" },
    ]);
    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when wsBroadcast is not available", () => {
    expect(() => emitDashboardChanged({} as never, ["OWNER"])).not.toThrow();
  });

  it("technician predicate matches only the right userId", () => {
    const broadcast = vi.fn();
    const app = { wsBroadcast: broadcast } as never;
    emitDashboardChanged(app, [{ technicianId: "t1" }]);
    const [predicate] = broadcast.mock.calls[0];
    expect(predicate({ role: "TECHNICIAN", userId: "t1" })).toBe(true);
    expect(predicate({ role: "TECHNICIAN", userId: "t2" })).toBe(false);
    expect(predicate({ role: "OWNER", userId: "t1" })).toBe(false);
  });
});
