import type { Scope } from "@shared/types/dashboard";
import { describe, expect, it, vi } from "vitest";
import { operationsReport, returnsReport } from "../reports.service.js";

const ownerScope: Scope = {
  role: "OWNER",
  shopTz: "UTC",
  userId: "owner-1",
};

const techScope: Scope = {
  role: "TECHNICIAN",
  shopTz: "UTC",
  userId: "tech-1",
};

const range = {
  start: new Date("2025-04-01T00:00:00Z"),
  end: new Date("2025-05-01T00:00:00Z"),
};

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    job: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { depositAmount: 0 } }),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    jobRepair: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    jobPart: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 0 } }),
    },
    returnClaim: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({
        _sum: { refundAmount: 0, partialChargeAmount: 0 },
      }),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}

describe("operationsReport — warrantyReturnRate", () => {
  it("computes rate from return_claims opened in range, not isWarrantyReturn jobs", async () => {
    const claimCount = vi.fn().mockResolvedValue(5);
    const prisma = makePrisma({ returnClaim: { count: claimCount } });

    const result = await operationsReport(prisma, ownerScope, range, true);

    expect(result.summary.warrantyReturnRate).toBeDefined();
    expect(claimCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          openedAt: expect.objectContaining({
            gte: range.start,
            lt: range.end,
          }),
        }),
      })
    );
  });

  it("returns 0 when no jobs delivered in range", async () => {
    const claimCount = vi.fn().mockResolvedValue(3);
    const prisma = makePrisma({ returnClaim: { count: claimCount } });

    const result = await operationsReport(prisma, ownerScope, range, true);

    expect(result.summary.warrantyReturnRate).toBe(0);
  });

  it("does not include warrantyReturnRate when includeShopWide is false", async () => {
    const prisma = makePrisma();

    const result = await operationsReport(prisma, techScope, range, false);

    expect(result.summary.warrantyReturnRate).toBeUndefined();
  });

  it("computes rate as (claims / delivered jobs) * 100 with 2 decimal precision", async () => {
    const claimCount = vi.fn().mockResolvedValue(3);
    const jobCount = vi.fn().mockResolvedValue(50);
    const prisma = makePrisma({
      returnClaim: { count: claimCount },
      job: {
        count: jobCount,
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { depositAmount: 0 } }),
      },
    });

    const result = await operationsReport(prisma, ownerScope, range, true);

    expect(result.summary.warrantyReturnRate).toBe(6);
  });
});

describe("returnsReport", () => {
  it("computes summary with total returns, warranty rate, net cost, avg time to return", async () => {
    const claimCount = vi.fn().mockResolvedValue(8);
    const claimAggregate = vi.fn().mockResolvedValue({
      _sum: { refundAmount: 5000, partialChargeAmount: 1000 },
    });
    const claimGroupBy = vi.fn().mockResolvedValue([]);
    const claimFindMany = vi.fn().mockResolvedValue([]);
    const jobCount = vi.fn().mockResolvedValue(100);

    const prisma = makePrisma({
      returnClaim: {
        count: claimCount,
        aggregate: claimAggregate,
        groupBy: claimGroupBy,
        findMany: claimFindMany,
      },
      job: {
        count: jobCount,
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { depositAmount: 0 } }),
      },
    });

    const result = await returnsReport(prisma, ownerScope, range);

    expect(result.summary.totalReturns).toBe(8);
    expect(result.summary.netWarrantyCost).toBeDefined();
    expect(claimCount).toHaveBeenCalled();
  });

  it("excludes shop-wide fields (warrantyReturnRate, netWarrantyCost, byTechnician) for viewSelf", async () => {
    const prisma = makePrisma();

    const result = await returnsReport(prisma, techScope, range);

    expect(result.summary.warrantyReturnRate).toBeUndefined();
    expect(result.summary.netWarrantyCostChangePercent).toBeUndefined();
    expect(result.byTechnician).toEqual([]);
  });

  it("computes net warranty cost as refunds + rework parts - partial charges", async () => {
    const claimCount = vi.fn().mockResolvedValue(5);
    const claimAggregate = vi.fn().mockResolvedValue({
      _sum: { refundAmount: 3000, partialChargeAmount: 500 },
    });
    const jobAggregate = vi.fn().mockResolvedValue({
      _sum: { totalCost: 2000 },
    });
    const jobCount = vi.fn().mockResolvedValue(100);

    const prisma = makePrisma({
      returnClaim: {
        count: claimCount,
        aggregate: claimAggregate,
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      job: {
        count: jobCount,
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: jobAggregate,
      },
      jobPart: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 1200 } }),
      },
    });

    const result = await returnsReport(prisma, ownerScope, range);

    expect(result.summary.netWarrantyCost).toBe(3700);
  });

  it("computes avg time to return from claims with originalJob delivery date", async () => {
    const claimCount = vi.fn().mockResolvedValue(2);
    const claimFindMany = vi.fn().mockResolvedValue([
      {
        openedAt: new Date("2025-04-20T00:00:00Z"),
        originalJob: {
          auditLogs: [{ createdAt: new Date("2025-04-10T00:00:00Z") }],
        },
      },
      {
        openedAt: new Date("2025-04-25T00:00:00Z"),
        originalJob: {
          auditLogs: [{ createdAt: new Date("2025-04-10T00:00:00Z") }],
        },
      },
    ]);

    const prisma = makePrisma({
      returnClaim: {
        count: claimCount,
        aggregate: vi.fn().mockResolvedValue({
          _sum: { refundAmount: 0, partialChargeAmount: 0 },
        }),
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: claimFindMany,
      },
    });

    const result = await returnsReport(prisma, ownerScope, range);

    expect(result.summary.avgTimeToReturnDays).toBe(12.5);
  });

  it("groups fault categories from claims", async () => {
    const claimGroupBy = vi.fn().mockResolvedValue([
      { faultCategory: "WORKMANSHIP", _count: { _all: 5 } },
      { faultCategory: "DEFECTIVE_PART", _count: { _all: 3 } },
    ]);

    const prisma = makePrisma({
      returnClaim: {
        count: vi.fn().mockResolvedValue(8),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { refundAmount: 0, partialChargeAmount: 0 },
        }),
        groupBy: claimGroupBy,
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await returnsReport(prisma, ownerScope, range);

    expect(result.byFaultCategory).toEqual([
      { faultCategory: "WORKMANSHIP", count: 5 },
      { faultCategory: "DEFECTIVE_PART", count: 3 },
    ]);
  });

  it("computes changePercent vs previous period", async () => {
    const claimCount = vi
      .fn()
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6);

    const prisma = makePrisma({
      returnClaim: {
        count: claimCount,
        aggregate: vi.fn().mockResolvedValue({
          _sum: { refundAmount: 0, partialChargeAmount: 0 },
        }),
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await returnsReport(prisma, ownerScope, range);

    expect(result.summary.totalReturnsChangePercent).toBeCloseTo(66.67, 1);
  });
});
