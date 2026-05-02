import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";
import type { DbClient } from "./types.js";

type JobWhereInput = Prisma.JobWhereInput;
type AuditLogWhereInput = Prisma.AuditLogWhereInput;

export function aggregateJobRevenue(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.aggregate({
    _sum: { estimatedCost: true },
    where,
  });
}

export function aggregateJobDeposits(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.aggregate({
    _sum: { depositAmount: true },
    where,
  });
}

export function findOutstandingJobs(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.findMany({
    where,
    select: {
      estimatedCost: true,
      depositAmount: true,
    },
  });
}

export function findRevenueBreakdown(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.findMany({
    where,
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
          action: "STATUS_CHANGED",
          toValue: { in: ["DONE", "DELIVERED"] },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export function countJobs(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.count({ where });
}

export function findTurnaroundJobs(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.findMany({
    where,
    select: {
      createdAt: true,
      auditLogs: {
        where: {
          action: "STATUS_CHANGED",
          toValue: { in: ["DONE", "DELIVERED"] },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export function groupJobRepairs(
  prisma: DbClient,
  where: Prisma.JobRepairWhereInput
) {
  return prisma.jobRepair.groupBy({
    by: ["repairName", "category"],
    where,
    _count: { _all: true },
    _avg: { price: true },
    _sum: { price: true },
  });
}

export function findAuditLogsForStatus(
  prisma: DbClient,
  where: AuditLogWhereInput,
  take: number
) {
  return prisma.auditLog.findMany({
    where,
    select: {
      toValue: true,
      createdAt: true,
      job: { select: { createdAt: true } },
    },
    take,
  });
}

export function groupJobsByStatus(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.groupBy({
    by: ["status"],
    _count: { _all: true },
    where,
  });
}

export function groupJobsByCustomer(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.groupBy({
    by: ["customerId"],
    where,
    _count: { _all: true },
    _sum: { estimatedCost: true },
  });
}

export function groupJobsByCustomerWithMinDate(
  prisma: DbClient,
  where: JobWhereInput
) {
  return prisma.job.groupBy({
    by: ["customerId"],
    where,
    _min: { createdAt: true },
  });
}

export function countJobsSimple(prisma: DbClient, where: JobWhereInput) {
  return prisma.job.count({ where });
}

export function groupTopCustomersByRevenue(
  prisma: DbClient,
  where: JobWhereInput
) {
  return prisma.job.groupBy({
    by: ["customerId"],
    where,
    _count: { _all: true },
    _sum: { estimatedCost: true },
    _max: { createdAt: true },
    orderBy: { _sum: { estimatedCost: "desc" } },
    take: 20,
  });
}

export function findCustomersByIds(prisma: DbClient, ids: string[]) {
  return prisma.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, phone: true },
  });
}

export function queryRawProfitMargin(
  prisma: PrismaClient,
  rangeStart: Date,
  rangeEnd: Date,
  isTechnician: boolean,
  technicianId?: string
) {
  return prisma.$queryRaw<{ cost: string }[]>`
    SELECT COALESCE(SUM(pt."totalCost"), 0) AS cost
    FROM "jobs" j
    INNER JOIN "audit_logs" al ON al."jobId" = j."id"
      AND al."action" = 'STATUS_CHANGED'
      AND al."toValue" IN ('DONE', 'DELIVERED')
      AND al."createdAt" >= ${rangeStart} AND al."createdAt" < ${rangeEnd}
    LEFT JOIN (SELECT "jobId", SUM("totalCost") AS "totalCost" FROM "job_parts" GROUP BY "jobId") pt
      ON pt."jobId" = j."id"
    WHERE j."status" IN ('DONE', 'DELIVERED')
      ${
        isTechnician
          ? Prisma.sql`AND j."technicianId" = ${technicianId}`
          : Prisma.empty
      }
  `;
}
