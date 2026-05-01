import {
  AuditAction,
  type JobStatus,
  Prisma,
  type PrismaClient,
} from "@generated/client";
import type { Scope } from "@shared/types/dashboard";
import type {
  InsightsReportDTO,
  OperationsReportDTO,
  RevenueReportDTO,
  TimeRangePreset,
} from "@shared/types/reports";
import type { DateRange } from "../utils/time-range.js";
import { monthRange, todayRange, toMoney } from "../utils/time-range.js";

function scopeWhere(scope: Scope) {
  return scope.role === "TECHNICIAN" ? { technicianId: scope.userId } : {};
}

export function resolveRange(
  preset: TimeRangePreset | undefined,
  from: string | undefined,
  to: string | undefined,
  shopTz: string,
  now: Date = new Date()
): DateRange {
  if (from && to) {
    return { start: new Date(from), end: new Date(to) };
  }
  switch (preset) {
    case "7d": {
      const start = new Date(now.getTime() - 7 * 86_400_000);
      return { start, end: now };
    }
    case "30d": {
      const start = new Date(now.getTime() - 30 * 86_400_000);
      return { start, end: now };
    }
    case "month":
      return monthRange(shopTz, now);
    case "year": {
      const today = todayRange(shopTz, now);
      const yearStart = new Date(today.start);
      yearStart.setMonth(0, 1);
      return { start: yearStart, end: today.end };
    }
    default:
      return monthRange(shopTz, now);
  }
}

function previousRange(range: DateRange): DateRange {
  const duration = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - duration),
    end: range.start,
  };
}

export async function revenueReport(
  prisma: PrismaClient,
  scope: Scope,
  range: DateRange,
  includeMargin: boolean
): Promise<RevenueReportDTO> {
  const prev = previousRange(range);
  const baseWhere = {
    ...scopeWhere(scope),
    status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
    updatedAt: { gte: range.start, lt: range.end },
  };

  const [currentRevenue, depositSum, outstandingRows, prevRevenue] =
    await Promise.all([
      prisma.job.aggregate({
        _sum: { estimatedCost: true },
        where: baseWhere,
      }),
      prisma.job.aggregate({
        _sum: { depositAmount: true },
        where: {
          ...scopeWhere(scope),
          createdAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.job.findMany({
        where: {
          ...scopeWhere(scope),
          status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
        },
        select: {
          estimatedCost: true,
          depositAmount: true,
        },
      }),
      prisma.job.aggregate({
        _sum: { estimatedCost: true },
        where: {
          ...scopeWhere(scope),
          status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
          updatedAt: { gte: prev.start, lt: prev.end },
        },
      }),
    ]);

  const totalRevenue = toMoney(currentRevenue._sum.estimatedCost);
  const totalDeposits = toMoney(depositSum._sum.depositAmount);
  const prevTotalRevenue = toMoney(prevRevenue._sum.estimatedCost);

  let outstandingBalance = 0;
  let outstandingJobCount = 0;
  for (const row of outstandingRows) {
    const balance = toMoney(row.estimatedCost) - toMoney(row.depositAmount);
    if (balance > 0) {
      outstandingBalance += balance;
      outstandingJobCount++;
    }
  }
  outstandingBalance = toMoney(outstandingBalance);

  const revenueChangePercent =
    prevTotalRevenue > 0
      ? Math.round(
          ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 10_000
        ) / 100
      : undefined;

  let avgProfitMargin: number | undefined;
  if (includeMargin) {
    const costRows = await prisma.$queryRaw<{ cost: string }[]>`
      SELECT COALESCE(SUM(pt."totalCost"), 0) AS cost
      FROM "jobs" j
      LEFT JOIN (SELECT "jobId", SUM("totalCost") AS "totalCost" FROM "job_parts" GROUP BY "jobId") pt
        ON pt."jobId" = j."id"
      WHERE j."status" IN ('DONE', 'DELIVERED')
        AND j."updatedAt" >= ${range.start} AND j."updatedAt" < ${range.end}
        ${scope.role === "TECHNICIAN" ? Prisma.sql`AND j."technicianId" = ${scope.userId}` : Prisma.empty}
    `;
    const cost = toMoney(Number(costRows[0]?.cost ?? 0));
    avgProfitMargin =
      totalRevenue > 0
        ? Math.round(((totalRevenue - cost) / totalRevenue) * 10_000) / 100
        : 0;
  }

  const breakdownRows = await prisma.job.findMany({
    where: baseWhere,
    select: {
      jobCode: true,
      estimatedCost: true,
      depositAmount: true,
      updatedAt: true,
      customer: { select: { name: true } },
      device: {
        select: { model: true, brand: { select: { name: true } } },
      },
      partsUsed: { select: { totalCost: true } },
      repairs: { select: { price: true } },
      auditLogs: {
        where: {
          action: AuditAction.STATUS_CHANGED,
          toValue: { in: ["DONE", "DELIVERED"] },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const breakdown = breakdownRows.map((j) => {
    const partsCost = toMoney(
      j.partsUsed.reduce((s, p) => s + toMoney(p.totalCost), 0)
    );
    const repairsTotal = toMoney(
      j.repairs.reduce((s, r) => s + toMoney(r.price), 0)
    );
    const row: RevenueReportDTO["breakdown"][number] = {
      jobCode: j.jobCode,
      customerName: j.customer.name,
      deviceName: `${j.device.brand.name} ${j.device.model}`,
      estimatedCost: toMoney(j.estimatedCost),
      depositAmount: toMoney(j.depositAmount),
      partsCost,
      repairsTotal,
      completedAt:
        j.auditLogs[0]?.createdAt?.toISOString() ?? j.updatedAt.toISOString(),
    };
    if (includeMargin && repairsTotal > 0) {
      row.margin =
        Math.round(((repairsTotal - partsCost) / repairsTotal) * 10_000) / 100;
    }
    return row;
  });

  return {
    summary: {
      totalRevenue,
      totalDeposits,
      ...(includeMargin && { avgProfitMargin }),
      outstandingBalance,
      outstandingJobCount,
      revenueChangePercent,
    },
    breakdown,
  };
}

export async function operationsReport(
  prisma: PrismaClient,
  scope: Scope,
  range: DateRange,
  includeShopWide: boolean
): Promise<OperationsReportDTO> {
  const prev = previousRange(range);
  const baseWhere = {
    ...scopeWhere(scope),
    status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
    updatedAt: { gte: range.start, lt: range.end },
  };

  const [jobsCompleted, prevCompleted, inProgressJobs, turnaroundRows] =
    await Promise.all([
      prisma.job.count({ where: baseWhere }),
      prisma.job.count({
        where: {
          ...scopeWhere(scope),
          status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
          updatedAt: { gte: prev.start, lt: prev.end },
        },
      }),
      prisma.job.count({
        where: {
          ...scopeWhere(scope),
          status: { in: ["IN_REPAIR", "ON_HOLD"] as JobStatus[] },
        },
      }),
      prisma.job.findMany({
        where: baseWhere,
        select: {
          createdAt: true,
          auditLogs: {
            where: {
              action: AuditAction.STATUS_CHANGED,
              toValue: { in: ["DONE", "DELIVERED"] },
            },
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

  const jobsCompletedChangePercent =
    prevCompleted > 0
      ? Math.round(((jobsCompleted - prevCompleted) / prevCompleted) * 10_000) /
        100
      : undefined;

  let totalTurnaroundMs = 0;
  let turnaroundCount = 0;
  for (const row of turnaroundRows) {
    const completionTime = row.auditLogs[0]?.createdAt?.getTime();
    if (completionTime) {
      totalTurnaroundMs += completionTime - row.createdAt.getTime();
      turnaroundCount++;
    }
  }
  const avgTurnaroundHours =
    turnaroundCount > 0
      ? Math.round((totalTurnaroundMs / turnaroundCount / 3_600_000) * 10) / 10
      : 0;

  let warrantyReturnRate: number | undefined;
  if (includeShopWide) {
    const [warrantyCount, totalCount] = await Promise.all([
      prisma.job.count({
        where: {
          isWarrantyReturn: true,
          status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
          updatedAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.job.count({
        where: {
          status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
          updatedAt: { gte: range.start, lt: range.end },
        },
      }),
    ]);
    warrantyReturnRate =
      totalCount > 0
        ? Math.round((warrantyCount / totalCount) * 10_000) / 100
        : 0;
  }

  const topRepairsRaw = await prisma.jobRepair.groupBy({
    by: ["repairName", "category"],
    where: {
      job: {
        ...scopeWhere(scope),
        status: { in: ["DONE", "DELIVERED"] as JobStatus[] },
        updatedAt: { gte: range.start, lt: range.end },
      },
    },
    _count: { _all: true },
    _avg: { price: true },
    _sum: { price: true },
  });

  const topRepairs = topRepairsRaw
    .map((r) => ({
      repairName: r.repairName,
      category: r.category ?? "",
      count: typeof r._count === "object" ? (r._count._all ?? 0) : 0,
      avgPrice: toMoney(r._avg?.price),
      revenue: toMoney(r._sum?.price),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const statusGroups = await prisma.job.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: {
      ...scopeWhere(scope),
      updatedAt: { gte: range.start, lt: range.end },
    },
  });

  const statusBreakdown: OperationsReportDTO["statusBreakdown"] =
    statusGroups.map((g) => ({
      status: g.status,
      count: typeof g._count === "object" ? (g._count._all ?? 0) : 0,
      avgDays: 0,
    }));

  for (const sb of statusBreakdown) {
    const statusEntries = await prisma.auditLog.findMany({
      where: {
        action: AuditAction.STATUS_CHANGED,
        toValue: sb.status,
        job: {
          ...scopeWhere(scope),
          updatedAt: { gte: range.start, lt: range.end },
        },
      },
      select: { createdAt: true, job: { select: { createdAt: true } } },
      take: 200,
    });
    if (statusEntries.length > 0) {
      const totalDays = statusEntries.reduce((acc, entry) => {
        if (!entry.job) {
          return acc;
        }
        const days = Math.max(
          0,
          (entry.createdAt.getTime() - entry.job.createdAt.getTime()) /
            86_400_000
        );
        return acc + days;
      }, 0);
      sb.avgDays =
        statusEntries.filter((e) => e.job).length > 0
          ? Math.round(
              (totalDays / statusEntries.filter((e) => e.job).length) * 10
            ) / 10
          : 0;
    }
  }

  return {
    summary: {
      jobsCompleted,
      jobsCompletedChangePercent,
      avgTurnaroundHours,
      jobsInProgress: inProgressJobs,
      ...(includeShopWide && { warrantyReturnRate }),
    },
    topRepairs,
    statusBreakdown,
  };
}

export async function insightsReport(
  prisma: PrismaClient,
  scope: Scope,
  range: DateRange
): Promise<InsightsReportDTO> {
  const baseWhere = {
    ...scopeWhere(scope),
    createdAt: { gte: range.start, lt: range.end },
  };

  const [customerJobGroups, newCustomerIds, totalJobs, topCustomersRaw] =
    await Promise.all([
      prisma.job.groupBy({
        by: ["customerId"],
        where: baseWhere,
        _count: { _all: true },
        _sum: { estimatedCost: true },
      }),
      prisma.job.groupBy({
        by: ["customerId"],
        where: baseWhere,
        _min: { createdAt: true },
        having: {
          customerId: { _count: { gt: 0 } },
        },
      }),
      prisma.job.count({ where: baseWhere }),
      prisma.job.groupBy({
        by: ["customerId"],
        where: baseWhere,
        _count: { _all: true },
        _sum: { estimatedCost: true },
        _max: { createdAt: true },
        orderBy: { _sum: { estimatedCost: "desc" } },
        take: 20,
      }),
    ]);

  let newCount = 0;
  let returningCount = 0;
  for (const g of newCustomerIds) {
    const earliestJob = g._min.createdAt;
    if (earliestJob && earliestJob >= range.start && earliestJob < range.end) {
      newCount++;
    } else {
      returningCount++;
    }
  }

  const totalCustomers = customerJobGroups.length;
  const repeatRate =
    totalCustomers > 0
      ? Math.round(
          (customerJobGroups.filter((g) => g._count._all >= 2).length /
            totalCustomers) *
            10_000
        ) / 100
      : 0;
  const avgSpendPerVisit =
    totalJobs > 0
      ? toMoney(
          customerJobGroups.reduce(
            (s, g) => s + toMoney(g._sum.estimatedCost),
            0
          ) / totalJobs
        )
      : 0;

  const topCustomerIds = topCustomersRaw.map((g) => g.customerId);
  const customers = await prisma.customer.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, name: true, phone: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const topCustomers = topCustomersRaw.map((g) => {
    const c = customerMap.get(g.customerId);
    return {
      customerId: g.customerId,
      customerName: c?.name ?? "\u2014",
      phone: c?.phone ?? "",
      totalJobs: g._count._all,
      totalRevenue: toMoney(g._sum.estimatedCost),
      lastVisit: g._max.createdAt?.toISOString() ?? "",
      avgSpend:
        g._count._all > 0
          ? toMoney(toMoney(g._sum.estimatedCost) / g._count._all)
          : 0,
    };
  });

  return {
    summary: {
      totalCustomers,
      newCustomers: newCount,
      returningCustomers: returningCount,
      repeatRate,
      avgSpendPerVisit,
      totalJobs,
    },
    topCustomers,
  };
}
