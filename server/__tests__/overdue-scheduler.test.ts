import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/constants", () => ({
  INACTIVE_STATUSES: ["DELIVERED", "RETURNED", "CANCELLED"],
}));

vi.useFakeTimers();

const broadcastCalls: Array<{
  predicate: (client: { role: string }) => boolean;
  payload: Record<string, unknown>;
}> = [];

const mockFindMany = vi.fn();
const mockLog = { error: vi.fn() };

const mockApp = {
  log: mockLog,
  prisma: { job: { findMany: mockFindMany } },
  wsBroadcast: (
    predicate: (client: { role: string }) => boolean,
    payload: Record<string, unknown>
  ) => {
    broadcastCalls.push({ payload, predicate });
  },
} as any;

import { startOverdueScheduler } from "../jobs/overdue-scheduler.js";

describe("startOverdueScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broadcastCalls.length = 0;
  });

  it("broadcasts JOB_OVERDUE for overdue jobs not in terminal status", async () => {
    mockFindMany.mockResolvedValue([
      { id: "j1", jobCode: "RPR-001" },
      { id: "j2", jobCode: "RPR-002" },
    ]);

    const stop = startOverdueScheduler(mockApp);

    await vi.advanceTimersByTimeAsync(50);

    expect(broadcastCalls.length).toBe(2);
    expect(broadcastCalls[0].payload.type).toBe("JOB_OVERDUE");
    expect(broadcastCalls[0].predicate({ role: "OWNER" })).toBe(true);
    expect(broadcastCalls[0].predicate({ role: "TECHNICIAN" })).toBe(false);

    stop();
  });

  it("deduplicates already-alerted jobs on second tick", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "j1", jobCode: "RPR-001" }])
      .mockResolvedValueOnce([{ id: "j1", jobCode: "RPR-001" }]);

    const stop = startOverdueScheduler(mockApp);

    await vi.advanceTimersByTimeAsync(50);
    expect(broadcastCalls.length).toBe(1);

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(broadcastCalls.length).toBe(1);

    stop();
  });

  it("clears interval on stop without error", () => {
    mockFindMany.mockResolvedValue([]);
    const stop = startOverdueScheduler(mockApp);
    stop();
    expect(true).toBe(true);
  });
});
