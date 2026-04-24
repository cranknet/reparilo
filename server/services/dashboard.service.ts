import type { AuditAction, JobStatus, PrismaClient } from "@generated/client";
import type {
  ActiveRepairDTO,
  ActivityItemDTO,
  FinancialTrendPoint,
  OverdueJobDTO,
  PickupReadyDTO,
  PriorityAlertDTO,
  RecentIntakeDTO,
  ScheduleItemDTO,
  Scope,
  WarrantyReturnDTO,
} from "@shared/types/dashboard";
import type { DateRange } from "../utils/time-range.js";
import { toMoney } from "../utils/time-range.js";

const ALL_STATUSES: JobStatus[] = [
  "CANCELLED",
  "DELIVERED",
  "DONE",
  "IN_REPAIR",
  "INTAKE",
  "ON_HOLD",
  "RETURNED",
  "WAITING_FOR_PARTS",
];

const ACTIVE_STATUSES: JobStatus[] = [
  "IN_REPAIR",
  "INTAKE",
  "ON_HOLD",
  "WAITING_FOR_PARTS",
];

function scopeWhere(scope: Scope) {
  return scope.role === "TECHNICIAN" ? { technicianId: scope.userId } : {};
}

export async function pipelineCounts(
  prisma: PrismaClient,
  scope: Scope
): Promise<Record<JobStatus, number>> {
  const groups = await prisma.job.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: scopeWhere(scope),
  });
  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    JobStatus,
    number
  >;
  for (const g of groups) {
    counts[g.status] = g._count._all;
  }
  return counts;
}

export async function activeJobsCount(
  prisma: PrismaClient,
  scope: Scope
): Promise<number> {
  return await prisma.job.count({
    where: {
      ...scopeWhere(scope),
      status: { in: ["INTAKE", "IN_REPAIR", "ON_HOLD", "WAITING_FOR_PARTS"] },
    },
  });
}

export async function completedTodayCount(
  prisma: PrismaClient,
  scope: Scope,
  today: DateRange
): Promise<number> {
  return await prisma.job.count({
    where: {
      ...scopeWhere(scope),
      status: "DELIVERED",
      updatedAt: { gte: today.start, lt: today.end },
    },
  });
}

interface RevCostRow {
  cost: string;
  revenue: string;
}

async function revenueAndCost(
  prisma: PrismaClient,
  scope: Scope,
  range: DateRange
): Promise<{ cost: number; revenue: number }> {
  const techFilter =
    scope.role === "TECHNICIAN" ? `AND j."technicianId" = $3` : "";
  const params: unknown[] = [range.start, range.end];
  if (scope.role === "TECHNICIAN") {
    params.push(scope.userId);
  }

  const rows = await prisma.$queryRawUnsafe<RevCostRow[]>(
    `SELECT
       COALESCE((SELECT SUM("price") FROM "job_repairs" jr WHERE jr."jobId" = j."id"), 0)
       + COALESCE((SELECT SUM("totalCost") FROM "job_parts" jp WHERE jp."jobId" = j."id"), 0)
         AS revenue,
       COALESCE((SELECT SUM("totalCost") FROM "job_parts" jp WHERE jp."jobId" = j."id"), 0)
         AS cost
     FROM "jobs" j
     WHERE j."status" = 'DELIVERED'
       AND j."updatedAt" >= $1 AND j."updatedAt" < $2
       ${techFilter}`,
    ...params
  );
  let revenue = 0;
  let cost = 0;
  for (const r of rows) {
    revenue += Number(r.revenue);
    cost += Number(r.cost);
  }
  return { cost: toMoney(cost), revenue: toMoney(revenue) };
}

export async function revenueThisMonth(
  prisma: PrismaClient,
  scope: Scope,
  month: DateRange
): Promise<number> {
  const { revenue } = await revenueAndCost(prisma, scope, month);
  return revenue;
}

export async function avgProfitMargin(
  prisma: PrismaClient,
  scope: Scope,
  month: DateRange
): Promise<number> {
  const { cost, revenue } = await revenueAndCost(prisma, scope, month);
  if (revenue === 0) {
    return 0;
  }
  return Math.round(((revenue - cost) / revenue) * 100) / 100;
}

export async function financialTrend(
  prisma: PrismaClient,
  scope: Scope,
  days: number
): Promise<FinancialTrendPoint[]> {
  const techClause =
    scope.role === "TECHNICIAN" ? `AND j."technicianId" = $3` : "";
  const params: unknown[] = [scope.shopTz, days - 1];
  if (scope.role === "TECHNICIAN") {
    params.push(scope.userId);
  }
  const rows = await prisma.$queryRawUnsafe<
    Array<{ cost: string; day: Date; revenue: string }>
  >(
    `WITH series AS (
       SELECT generate_series(
         (date_trunc('day', now() AT TIME ZONE $1) - INTERVAL '1 day' * $2)::date,
         (date_trunc('day', now() AT TIME ZONE $1))::date,
         '1 day'::interval
       )::date AS day
     )
     SELECT s.day,
       COALESCE(SUM(
         COALESCE((SELECT SUM(jr."price") FROM "job_repairs" jr WHERE jr."jobId" = j."id"), 0)
         + COALESCE((SELECT SUM(jp."totalCost") FROM "job_parts" jp WHERE jp."jobId" = j."id"), 0)
       ), 0) AS revenue,
       COALESCE(SUM(
         COALESCE((SELECT SUM(jp."totalCost") FROM "job_parts" jp WHERE jp."jobId" = j."id"), 0)
       ), 0) AS cost
     FROM series s
     LEFT JOIN "jobs" j
       ON j."status" = 'DELIVERED'
      AND (j."updatedAt" AT TIME ZONE $1)::date = s.day
      ${techClause}
     GROUP BY s.day
     ORDER BY s.day ASC`,
    ...params
  );
  return rows.map((r) => ({
    cost: toMoney(Number(r.cost)),
    date: new Date(r.day).toISOString().slice(0, 10),
    revenue: toMoney(Number(r.revenue)),
  }));
}

export async function overdueJobs(
  prisma: PrismaClient,
  scope: Scope,
  limit: number
): Promise<OverdueJobDTO[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ...scopeWhere(scope),
      estimatedDate: { lt: new Date() },
      status: { in: [...ACTIVE_STATUSES] },
    },
    include: {
      customer: { select: { name: true } },
      device: { select: { brand: true, model: true } },
      repairs: { take: 1, select: { repairName: true } },
    },
    orderBy: { estimatedDate: "asc" },
    take: limit,
  });
  const now = Date.now();
  return jobs.map((j) => ({
    customerName: j.customer.name,
    device: `${j.device.brand} ${j.device.model}`,
    hoursLate: j.estimatedDate
      ? Math.max(0, Math.floor((now - j.estimatedDate.getTime()) / 3_600_000))
      : 0,
    id: j.id,
    jobCode: j.jobCode,
    repairSummary: j.repairs[0]?.repairName ?? "—",
  }));
}

export async function warrantyReturnsOpen(
  prisma: PrismaClient,
  scope: Scope,
  limit: number
): Promise<WarrantyReturnDTO[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ...scopeWhere(scope),
      isWarrantyReturn: true,
      status: { notIn: ["DELIVERED", "CANCELLED"] },
    },
    select: {
      createdAt: true,
      id: true,
      jobCode: true,
      reportedProblem: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return jobs.map((j) => ({
    createdAt: j.createdAt.toISOString(),
    description: j.reportedProblem.slice(0, 80),
    id: j.id,
    jobCode: j.jobCode,
  }));
}

export async function todayScheduleForTech(
  prisma: PrismaClient,
  userId: string,
  today: DateRange
): Promise<ScheduleItemDTO[]> {
  const scheduled = await prisma.job.findMany({
    where: {
      estimatedDate: { gte: today.start, lt: today.end },
      technicianId: userId,
    },
    include: {
      customer: { select: { name: true } },
      device: { select: { brand: true, model: true } },
      repairs: { take: 1, select: { repairName: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const source =
    scheduled.length > 0
      ? scheduled
      : await prisma.job.findMany({
          where: {
            status: { in: [...ACTIVE_STATUSES] },
            technicianId: userId,
          },
          include: {
            customer: { select: { name: true } },
            device: { select: { brand: true, model: true } },
            repairs: { take: 1, select: { repairName: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 5,
        });
  return source.map((j) => ({
    customerName: j.customer.name,
    device: `${j.device.brand} ${j.device.model}`,
    estimatedDate: j.estimatedDate
      ? j.estimatedDate.toISOString().slice(0, 10)
      : null,
    id: j.id,
    jobCode: j.jobCode,
    repairSummary: j.repairs[0]?.repairName ?? "—",
    status: j.status,
  }));
}

export async function recentActivityForTech(
  prisma: PrismaClient,
  userId: string,
  limit: number
): Promise<ActivityItemDTO[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [{ job: { technicianId: userId } }, { userId }],
    },
    include: { job: { select: { jobCode: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    action: r.action as AuditAction,
    createdAt: r.createdAt.toISOString(),
    fromValue: r.fromValue,
    id: r.id,
    jobCode: r.job?.jobCode ?? null,
    toValue: r.toValue,
  }));
}

export async function avgRepairTimeHours(
  prisma: PrismaClient,
  userId: string,
  days: number
): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.job.findMany({
    where: {
      status: "DELIVERED",
      technicianId: userId,
      updatedAt: { gte: since },
    },
    select: { createdAt: true, updatedAt: true },
  });
  if (rows.length === 0) {
    return 0;
  }
  const hours =
    rows.reduce(
      (acc, r) => acc + (r.updatedAt.getTime() - r.createdAt.getTime()),
      0
    ) /
    rows.length /
    3_600_000;
  return Math.round(hours * 10) / 10;
}

export async function priorityActionsForTech(
  prisma: PrismaClient,
  userId: string
): Promise<{
  jobsNeedingStatusUpdate: number;
  overdueCount: number;
  partsWaitingCount: number;
}> {
  const staleThreshold = new Date(Date.now() - 24 * 3_600_000);
  const [stale, overdue, waiting] = await Promise.all([
    prisma.job.count({
      where: {
        status: "IN_REPAIR",
        technicianId: userId,
        updatedAt: { lt: staleThreshold },
      },
    }),
    prisma.job.count({
      where: {
        estimatedDate: { lt: new Date() },
        status: { in: [...ACTIVE_STATUSES] },
        technicianId: userId,
      },
    }),
    prisma.job.count({
      where: { status: "WAITING_FOR_PARTS", technicianId: userId },
    }),
  ]);
  return {
    jobsNeedingStatusUpdate: stale,
    overdueCount: overdue,
    partsWaitingCount: waiting,
  };
}

export async function activeRepairsQueue(
  prisma: PrismaClient,
  scope: Scope,
  today: DateRange,
  limit: number
): Promise<ActiveRepairDTO[]> {
  const rows = await prisma.job.findMany({
    where: {
      ...scopeWhere(scope),
      OR: [
        { status: { in: [...ACTIVE_STATUSES] } },
        {
          status: "DELIVERED",
          updatedAt: { gte: today.start, lt: today.end },
        },
      ],
    },
    include: {
      customer: { select: { name: true } },
      device: { select: { brand: true, model: true } },
      technician: { select: { name: true, username: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return rows.map((j) => ({
    customerName: j.customer.name,
    deviceModel: `${j.device.brand} ${j.device.model}`,
    estimatedDate: j.estimatedDate
      ? j.estimatedDate.toISOString().slice(0, 10)
      : null,
    id: j.id,
    jobCode: j.jobCode,
    status: j.status,
    technicianName: j.technician?.name || j.technician?.username || null,
    updatedAt: j.updatedAt.toISOString(),
  }));
}

export async function todayOverview(
  prisma: PrismaClient,
  scope: Scope,
  today: DateRange
): Promise<{
  completedToday: number;
  recentIntakes: RecentIntakeDTO[];
  totalToday: number;
}> {
  const [totalToday, completedToday, intakes] = await Promise.all([
    prisma.job.count({
      where: {
        ...scopeWhere(scope),
        createdAt: { gte: today.start, lt: today.end },
      },
    }),
    prisma.job.count({
      where: {
        ...scopeWhere(scope),
        status: "DELIVERED",
        updatedAt: { gte: today.start, lt: today.end },
      },
    }),
    prisma.job.findMany({
      where: {
        ...scopeWhere(scope),
        createdAt: { gte: today.start, lt: today.end },
        status: "INTAKE",
      },
      include: { device: { select: { brand: true, model: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);
  return {
    completedToday,
    recentIntakes: intakes.map((j) => ({
      createdAt: j.createdAt.toISOString(),
      deviceModel: `${j.device.brand} ${j.device.model}`,
      id: j.id,
      jobCode: j.jobCode,
    })),
    totalToday,
  };
}

export async function pickupReady(
  prisma: PrismaClient,
  scope: Scope,
  limit: number
): Promise<PickupReadyDTO[]> {
  const rows = await prisma.job.findMany({
    where: { ...scopeWhere(scope), status: "DONE" },
    include: {
      customer: { select: { name: true, phone: true } },
      device: { select: { brand: true, model: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return rows.map((j) => ({
    customerName: j.customer.name,
    customerPhone: j.customer.phone,
    deviceModel: `${j.device.brand} ${j.device.model}`,
    id: j.id,
    jobCode: j.jobCode,
    readyAt: j.updatedAt.toISOString(),
  }));
}

export async function priorityAlerts(
  prisma: PrismaClient,
  scope: Scope,
  limit: number
): Promise<PriorityAlertDTO[]> {
  const [overdue, warranty, ready] = await Promise.all([
    prisma.job.findMany({
      where: {
        ...scopeWhere(scope),
        estimatedDate: { lt: new Date() },
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { id: true, jobCode: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.job.findMany({
      where: {
        ...scopeWhere(scope),
        isWarrantyReturn: true,
        status: { notIn: ["DELIVERED", "CANCELLED"] },
      },
      select: {
        customer: { select: { name: true } },
        id: true,
        jobCode: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.job.findMany({
      where: { ...scopeWhere(scope), status: "DONE" },
      select: {
        customer: { select: { name: true } },
        id: true,
        jobCode: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);
  const combined: Array<PriorityAlertDTO & { ts: number }> = [
    ...overdue.map((j) => ({
      customerName: null,
      id: `od-${j.id}`,
      jobCode: j.jobCode,
      kind: "OVERDUE" as const,
      ts: j.updatedAt.getTime(),
    })),
    ...warranty.map((j) => ({
      customerName: j.customer.name,
      id: `wr-${j.id}`,
      jobCode: j.jobCode,
      kind: "WARRANTY_RETURN" as const,
      ts: j.updatedAt.getTime(),
    })),
    ...ready.map((j) => ({
      customerName: j.customer.name,
      id: `rp-${j.id}`,
      jobCode: j.jobCode,
      kind: "READY_FOR_PICKUP" as const,
      ts: j.updatedAt.getTime(),
    })),
  ];
  combined.sort((a, b) => b.ts - a.ts);
  return combined.slice(0, limit).map(({ ts: _ts, ...rest }) => rest);
}
