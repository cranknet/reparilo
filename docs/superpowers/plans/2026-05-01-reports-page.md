# Reports Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a /reports page with Revenue, Operations, and Customer Insights tabs, backed by 3 API endpoints, role-scoped via existing RBAC permissions.

**Architecture:** Single page with tab switcher, shared time-range selector. Backend follows the dashboard pattern — dedicated route file + service file, using `dashboardScope` preHandler and `scopeWhere()` for row-level filtering. No Prisma schema changes needed; all data derived from existing tables via aggregation.

**Tech Stack:** Fastify (backend), React + Zustand (frontend), Zod (validation), Prisma (queries), Tailwind (styling), i18n (trilingual)

**Design spec:** `docs/superpowers/specs/2026-05-01-reports-page-design.md`

---

## File Structure

**Create:**
- `shared/types/reports.ts` — DTOs for all three report endpoints
- `shared/schemas/reports.schema.ts` — Zod validation for query params
- `server/services/reports.service.ts` — all report query logic
- `server/routes/reports.ts` — 3 GET endpoints
- `src/stores/reports.ts` — Zustand store for reports state
- `src/pages/reports/index.tsx` — page shell with tabs + time range
- `src/pages/reports/revenue-tab.tsx` — Revenue & Financial tab
- `src/pages/reports/operations-tab.tsx` — Repair Operations tab
- `src/pages/reports/insights-tab.tsx` — Customer Insights tab

**Modify:**
- `server/index.ts` — register `reportsRoutes`
- `server/index.ts` — add `"reports"` swagger tag
- `src/app.tsx` — add `/reports` route with `RequirePermission`
- `src/components/modules/sidebar.tsx` — add Reports nav item
- `src/components/modules/bottom-nav.tsx` — add Reports to `MORE_ITEMS`
- `src/i18n/locales/en.json` — add `reports.*` translation keys

---

### Task 1: Shared Types

**Files:**
- Create: `shared/types/reports.ts`

- [ ] **Step 1: Create the reports types file**

```typescript
export type TimeRangePreset = "7d" | "30d" | "month" | "year";

export interface RevenueSummary {
  totalRevenue: number;
  totalDeposits: number;
  avgProfitMargin?: number;
  outstandingBalance: number;
  outstandingJobCount: number;
  revenueChangePercent?: number;
}

export interface RevenueBreakdownRow {
  jobCode: string;
  customerName: string;
  deviceName: string;
  estimatedCost: number;
  depositAmount: number;
  partsCost: number;
  repairsTotal: number;
  margin?: number;
  completedAt: string;
}

export interface RevenueReportDTO {
  summary: RevenueSummary;
  breakdown: RevenueBreakdownRow[];
}

export interface OperationsSummary {
  jobsCompleted: number;
  jobsCompletedChangePercent?: number;
  avgTurnaroundHours: number;
  jobsInProgress: number;
  warrantyReturnRate?: number;
}

export interface TopRepairRow {
  repairName: string;
  category: string;
  count: number;
  avgPrice: number;
  revenue: number;
}

export interface StatusBreakdownRow {
  status: string;
  count: number;
  avgDays: number;
}

export interface OperationsReportDTO {
  summary: OperationsSummary;
  topRepairs: TopRepairRow[];
  statusBreakdown: StatusBreakdownRow[];
}

export interface InsightsSummary {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatRate: number;
  avgSpendPerVisit: number;
  totalJobs: number;
}

export interface TopCustomerRow {
  customerId: string;
  customerName: string;
  phone: string;
  totalJobs: number;
  totalRevenue: number;
  lastVisit: string;
  avgSpend: number;
}

export interface InsightsReportDTO {
  summary: InsightsSummary;
  topCustomers: TopCustomerRow[];
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/types/reports.ts
git commit -m "feat: add shared report DTO types"
```

---

### Task 2: Zod Schemas

**Files:**
- Create: `shared/schemas/reports.schema.ts`

- [ ] **Step 1: Create the reports query schema**

```typescript
import { z } from "zod";

export const reportsQuerySchema = z
  .object({
    range: z.enum(["7d", "30d", "month", "year"]).optional(),
    from: z.string().datetime({ error: "validations.invalid_date" }).optional(),
    to: z.string().datetime({ error: "validations.invalid_date" }).optional(),
  })
  .refine(
    (data) => {
      if (data.from || data.to) return !!data.from && !!data.to;
      return !!data.range;
    },
    { error: "validations.range_or_dates_required" },
  )
  .refine(
    (data) => {
      if (data.from && data.to) {
        const diff =
          new Date(data.to).getTime() - new Date(data.from).getTime();
        return diff > 0 && diff <= 365 * 24 * 60 * 60 * 1000;
      }
      return true;
    },
    { error: "validations.custom_range_limit" },
  );
```

- [ ] **Step 2: Commit**

```bash
git add shared/schemas/reports.schema.ts
git commit -m "feat: add reports query Zod schema"
```

---

### Task 3: Reports Service (Backend Queries)

**Files:**
- Create: `server/services/reports.service.ts`

This task creates the service with all query functions. Each function accepts `(prisma, scope, range)` and returns typed DTOs.

- [ ] **Step 1: Create the reports service file**

```typescript
import {
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
import { monthRange, toMoney, todayRange } from "../utils/time-range.js";

function scopeWhere(scope: Scope) {
  return scope.role === "TECHNICIAN" ? { technicianId: scope.userId } : {};
}

export function resolveRange(
  preset: TimeRangePreset | undefined,
  from: string | undefined,
  to: string | undefined,
  shopTz: string,
  now: Date = new Date(),
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
  includeMargin: boolean,
): Promise<RevenueReportDTO> {
  const prev = previousRange(range);
  const baseWhere = {
    ...scopeWhere(scope),
    status: { in: ["DONE", "DELIVERED"] },
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
          status: { in: ["DONE", "DELIVERED"] },
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
          status: { in: ["DONE", "DELIVERED"] },
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
          ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 10000,
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
    const cost = toMoney(costRows[0]?.cost);
    avgProfitMargin =
      totalRevenue > 0
        ? Math.round(((totalRevenue - cost) / totalRevenue) * 10000) / 100
        : 0;
  }

  const breakdownRows = await prisma.job.findMany({
    where: baseWhere,
    select: {
      jobCode: true,
      estimatedCost: true,
      depositAmount: true,
      customer: { select: { name: true } },
      device: {
        select: { model: true, brand: { select: { name: true } } },
      },
      parts: { select: { totalCost: true } },
      repairs: { select: { price: true } },
      auditLog: {
        where: {
          action: "status_change",
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
      j.parts.reduce((s, p) => s + toMoney(p.totalCost), 0),
    );
    const repairsTotal = toMoney(
      j.repairs.reduce((s, r) => s + toMoney(r.price), 0),
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
        j.auditLog[0]?.createdAt?.toISOString() ?? j.updatedAt.toISOString(),
    };
    if (includeMargin && repairsTotal > 0) {
      row.margin =
        Math.round(((repairsTotal - partsCost) / repairsTotal) * 10000) / 100;
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
  includeShopWide: boolean,
): Promise<OperationsReportDTO> {
  const prev = previousRange(range);
  const baseWhere = {
    ...scopeWhere(scope),
    status: { in: ["DONE", "DELIVERED"] },
    updatedAt: { gte: range.start, lt: range.end },
  };

  const [jobsCompleted, prevCompleted, inProgressJobs, turnaroundRows] =
    await Promise.all([
      prisma.job.count({ where: baseWhere }),
      prisma.job.count({
        where: {
          ...scopeWhere(scope),
          status: { in: ["DONE", "DELIVERED"] },
          updatedAt: { gte: prev.start, lt: prev.end },
        },
      }),
      prisma.job.count({
        where: {
          ...scopeWhere(scope),
          status: { in: ["IN_REPAIR", "ON_HOLD"] },
        },
      }),
      prisma.job.findMany({
        where: baseWhere,
        select: { createdAt: true, auditLog: { where: { action: "status_change", toValue: { in: ["DONE", "DELIVERED"] } }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);

  const jobsCompletedChangePercent =
    prevCompleted > 0
      ? Math.round(((jobsCompleted - prevCompleted) / prevCompleted) * 10000) /
        100
      : undefined;

  let totalTurnaroundMs = 0;
  let turnaroundCount = 0;
  for (const row of turnaroundRows) {
    const completionTime = row.auditLog[0]?.createdAt?.getTime();
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
          status: { in: ["DONE", "DELIVERED"] },
          updatedAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.job.count({
        where: {
          status: { in: ["DONE", "DELIVERED"] },
          updatedAt: { gte: range.start, lt: range.end },
        },
      }),
    ]);
    warrantyReturnRate =
      totalCount > 0
        ? Math.round((warrantyCount / totalCount) * 10000) / 100
        : 0;
  }

  const topRepairsRaw = await prisma.jobRepair.groupBy({
    by: ["repairName", "category"],
    where: {
      job: {
        ...scopeWhere(scope),
        status: { in: ["DONE", "DELIVERED"] },
        updatedAt: { gte: range.start, lt: range.end },
      },
    },
    _count: { _all: true },
    _avg: { price: true },
    _sum: { price: true },
    orderBy: { _count: { _all: "desc" } },
    take: 20,
  });

  const topRepairs = topRepairsRaw.map((r) => ({
    repairName: r.repairName,
    category: r.category ?? "",
    count: r._count._all,
    avgPrice: toMoney(r._avg.price),
    revenue: toMoney(r._sum.price),
  }));

  const ALL_STATUSES: JobStatus[] = [
    "INTAKE",
    "WAITING_FOR_PARTS",
    "IN_REPAIR",
    "ON_HOLD",
    "DONE",
    "DELIVERED",
    "RETURNED",
    "CANCELLED",
  ];

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
      count: g._count._all,
      avgDays: 0,
    }));

  for (const sb of statusBreakdown) {
    const statusEntries = await prisma.auditLog.findMany({
      where: {
        action: "status_change",
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
        const days = Math.max(
          0,
          (entry.createdAt.getTime() - entry.job.createdAt.getTime()) /
            86_400_000,
        );
        return acc + days;
      }, 0);
      sb.avgDays = Math.round((totalDays / statusEntries.length) * 10) / 10;
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
  range: DateRange,
): Promise<InsightsReportDTO> {
  const baseWhere = {
    ...scopeWhere(scope),
    createdAt: { gte: range.start, lt: range.end },
  };

  const [
    customerJobGroups,
    newCustomerIds,
    totalJobs,
    topCustomersRaw,
  ] = await Promise.all([
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
            10000,
        ) / 100
      : 0;
  const avgSpendPerVisit =
    totalJobs > 0
      ? toMoney(
          customerJobGroups.reduce(
            (s, g) => s + toMoney(g._sum.estimatedCost),
            0,
          ) / totalJobs,
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
      customerName: c?.name ?? "—",
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
```

- [ ] **Step 2: Commit**

```bash
git add server/services/reports.service.ts
git commit -m "feat: add reports service with revenue, operations, insights queries"
```

---

### Task 4: Reports Routes (Backend API)

**Files:**
- Create: `server/routes/reports.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create the reports route file**

```typescript
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "@shared/errors/app-error.js";
import { dashboardScope } from "../middlewares/dashboard-scope.js";
import { requireRoles } from "../middlewares/require-roles.js";
import {
  insightsReport,
  operationsReport,
  resolveRange,
  revenueReport,
} from "../services/reports.service.js";
import { reportsQuerySchema } from "@shared/schemas/reports.schema.js";

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/revenue",
    {
      preHandler: [requireRoles("OWNER"), dashboardScope],
      schema: { tags: ["reports"], summary: "Revenue & financial report" },
    },
    async (req) => {
      const scope = req.dashboardScope!;
      const parsed = reportsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          issues: parsed.error.issues,
        });
      }
      const q = parsed.data;
      const range = resolveRange(q.range, q.from, q.to, scope.shopTz);

      const marginResult = await req.server.auth.api.userHasPermission({
        body: {
          role: req.user?.role as string,
          permissions: { reports: ["viewMargin"] },
        },
      });

      return revenueReport(
        app.prisma,
        scope,
        range,
        marginResult?.success === true,
      );
    },
  );

  app.get(
    "/operations",
    {
      preHandler: [requireRoles("OWNER", "TECHNICIAN"), dashboardScope],
      schema: { tags: ["reports"], summary: "Repair operations report" },
    },
    async (req) => {
      const scope = req.dashboardScope!;
      const parsed = reportsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          issues: parsed.error.issues,
        });
      }
      const q = parsed.data;
      const range = resolveRange(q.range, q.from, q.to, scope.shopTz);

      const shopResult = await req.server.auth.api.userHasPermission({
        body: {
          role: req.user?.role as string,
          permissions: { reports: ["viewShop"] },
        },
      });

      return operationsReport(
        app.prisma,
        scope,
        range,
        shopResult?.success === true,
      );
    },
  );

  app.get(
    "/insights",
    {
      preHandler: [requireRoles("OWNER"), dashboardScope],
      schema: { tags: ["reports"], summary: "Customer insights report" },
    },
    async (req) => {
      const scope = req.dashboardScope!;
      const parsed = reportsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          issues: parsed.error.issues,
        });
      }
      const q = parsed.data;
      const range = resolveRange(q.range, q.from, q.to, scope.shopTz);

      return insightsReport(app.prisma, scope, range);
    },
  );
};
```

- [ ] **Step 2: Add reports route import and registration to server/index.ts**

Add after the existing route imports:
```typescript
import { reportsRoutes } from "./routes/reports.js";
```

Add the `"reports"` swagger tag to the tags array:
```typescript
{ name: "reports", description: "Reports" },
```

Register the route after `app.register(dashboardRoutes, ...)`:
```typescript
app.register(reportsRoutes, { prefix: "/api/reports" });
```

- [ ] **Step 3: Verify server compiles**

Run: `pnpm run check`
Expected: No type errors related to reports files

- [ ] **Step 4: Commit**

```bash
git add server/routes/reports.ts server/index.ts
git commit -m "feat: add /api/reports endpoints for revenue, operations, insights"
```

---

### Task 5: Frontend Store + Routing + Navigation

**Files:**
- Create: `src/stores/reports.ts`
- Modify: `src/app.tsx` — add `/reports` route
- Modify: `src/components/modules/sidebar.tsx` — add Reports nav item
- Modify: `src/components/modules/bottom-nav.tsx` — add Reports to MORE_ITEMS

- [ ] **Step 1: Create the reports Zustand store**

```typescript
import type {
  InsightsReportDTO,
  OperationsReportDTO,
  RevenueReportDTO,
  TimeRangePreset,
} from "@shared/types/reports";
import { create } from "zustand";
import i18n from "@/i18n";
import api, { getErrorMessage } from "@/lib/api";

interface ReportsState {
  range: TimeRangePreset;
  customFrom: string | null;
  customTo: string | null;
  revenue: { data?: RevenueReportDTO; loading: boolean; error?: string };
  operations: { data?: OperationsReportDTO; loading: boolean; error?: string };
  insights: { data?: InsightsReportDTO; loading: boolean; error?: string };
  setRange: (range: TimeRangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  fetchRevenue: () => Promise<void>;
  fetchOperations: () => Promise<void>;
  fetchInsights: () => Promise<void>;
}

function queryParams(state: ReportsState): string {
  if (state.customFrom && state.customTo) {
    return `?from=${encodeURIComponent(state.customFrom)}&to=${encodeURIComponent(state.customTo)}`;
  }
  return `?range=${state.range}`;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  range: "30d",
  customFrom: null,
  customTo: null,
  revenue: { loading: false },
  operations: { loading: false },
  insights: { loading: false },

  setRange: (range) => set({ range, customFrom: null, customTo: null }),
  setCustomRange: (from, to) => set({ customFrom: from, customTo: to }),

  fetchRevenue: async () => {
    set({ revenue: { loading: true } });
    try {
      const q = queryParams(get());
      const res = await api.get(`/reports/revenue${q}`);
      set({ revenue: { data: res.data as RevenueReportDTO, loading: false } });
    } catch (err: unknown) {
      set({
        revenue: {
          loading: false,
          error: getErrorMessage(err, i18n.t("errors.fetch_reports")),
        },
      });
    }
  },

  fetchOperations: async () => {
    set({ operations: { loading: true } });
    try {
      const q = queryParams(get());
      const res = await api.get(`/reports/operations${q}`);
      set({
        operations: { data: res.data as OperationsReportDTO, loading: false },
      });
    } catch (err: unknown) {
      set({
        operations: {
          loading: false,
          error: getErrorMessage(err, i18n.t("errors.fetch_reports")),
        },
      });
    }
  },

  fetchInsights: async () => {
    set({ insights: { loading: true } });
    try {
      const q = queryParams(get());
      const res = await api.get(`/reports/insights${q}`);
      set({
        insights: { data: res.data as InsightsReportDTO, loading: false },
      });
    } catch (err: unknown) {
      set({
        insights: {
          loading: false,
          error: getErrorMessage(err, i18n.t("errors.fetch_reports")),
        },
      });
    }
  },
}));
```

- [ ] **Step 2: Add the Reports nav item to sidebar.tsx**

Insert into `NAV_ITEMS` array, after the `notifications` entry and before the `ai_agent_title` entry:

```typescript
  {
    icon: "analytics",
    labelKey: "reports",
    to: "/reports",
    perm: { reports: ["viewSelf"] },
  },
```

- [ ] **Step 3: Add Reports to bottom-nav.tsx MORE_ITEMS**

Insert into `MORE_ITEMS` array (the position is flexible, suggest after AI entry):

```typescript
  {
    icon: "analytics",
    labelKey: "reports",
    perm: { reports: ["viewSelf"] },
    to: "/reports",
  },
```

- [ ] **Step 4: Add /reports route to app.tsx**

Add the import:
```typescript
import ReportsPage from "@/pages/reports";
```

Add the route inside the `<ProtectedRoute>` block, after the customers routes:

```tsx
        <Route element={<RequirePermission perm={{ reports: ["viewSelf"] }} />}>
          <Route
            element={
              <DashboardLayout>
                <ReportsPage />
              </DashboardLayout>
            }
            path="/reports"
          />
        </Route>
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/reports.ts src/app.tsx src/components/modules/sidebar.tsx src/components/modules/bottom-nav.tsx
git commit -m "feat: add reports store, routing, and nav items"
```

---

### Task 6: Reports Page Shell with Tabs + Time Range

**Files:**
- Create: `src/pages/reports/index.tsx`

This is the main page component with:
- Tab switcher (Revenue | Operations | Insights)
- Time range selector (7d / 30d / month / year)
- Tab visibility governed by user permissions
- Fetch-on-tab-switch pattern

- [ ] **Step 1: Create the reports page shell**

```tsx
import type { TimeRangePreset } from "@shared/types/reports";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "@/hooks/use-can";
import { useReportsStore } from "@/stores/reports";
import RevenueTab from "./revenue-tab";
import OperationsTab from "./operations-tab";
import InsightsTab from "./insights-tab";

const RANGE_OPTIONS: { key: TimeRangePreset; label: string }[] = [
  { key: "7d", label: "reports.7d" },
  { key: "30d", label: "reports.30d" },
  { key: "month", label: "reports.month" },
  { key: "year", label: "reports.year" },
];

type TabKey = "revenue" | "operations" | "insights";

export default function ReportsPage() {
  const { t } = useTranslation();
  const range = useReportsStore((s) => s.range);
  const setRange = useReportsStore((s) => s.setRange);
  const fetchRevenue = useReportsStore((s) => s.fetchRevenue);
  const fetchOperations = useReportsStore((s) => s.fetchOperations);
  const fetchInsights = useReportsStore((s) => s.fetchInsights);

  const canViewShop = useCan({ reports: ["viewShop"] });
  const canViewSelf = useCan({ reports: ["viewSelf"] });

  const visibleTabs: TabKey[] = [];
  if (canViewShop) visibleTabs.push("revenue");
  if (canViewSelf) visibleTabs.push("operations");
  if (canViewShop) visibleTabs.push("insights");

  const [activeTab, setActiveTab] = useState<TabKey>(visibleTabs[0]);

  useEffect(() => {
    if (activeTab === "revenue") fetchRevenue();
    if (activeTab === "operations") fetchOperations();
    if (activeTab === "insights") fetchInsights();
  }, [activeTab, range, fetchRevenue, fetchOperations, fetchInsights]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0]);
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-black font-headline text-2xl text-on-surface">
          {t("reports.title")}
        </h1>
        <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
          {RANGE_OPTIONS.map(({ key, label }) => (
            <button
              className={`rounded-lg px-3 py-1.5 font-medium text-sm transition-colors ${
                range === key
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary"
              }`}
              key={key}
              onClick={() => setRange(key)}
              type="button"
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
          {visibleTabs.map((tab) => (
            <button
              className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary"
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {t(`reports.${tab}`)}
            </button>
          ))}
        </div>
      )}

      {activeTab === "revenue" && <RevenueTab />}
      {activeTab === "operations" && <OperationsTab />}
      {activeTab === "insights" && <InsightsTab />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/reports/index.tsx
git commit -m "feat: add reports page shell with tabs and time range selector"
```

---

### Task 7: Revenue Tab

**Files:**
- Create: `src/pages/reports/revenue-tab.tsx`

- [ ] **Step 1: Create the revenue tab component**

```tsx
import { useTranslation } from "react-i18next";
import { MetricCard } from "@/components/ui/metric-card";
import { useReportsStore } from "@/stores/reports";

export default function RevenueTab() {
  const { t } = useTranslation();
  const state = useReportsStore((s) => s.revenue);

  if (state.loading) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        {t("loading")}
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="py-12 text-center text-error">{state.error}</div>
    );
  }

  if (!state.data) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        {t("reports.noData")}
      </div>
    );
  }

  const { summary, breakdown } = state.data;
  const showMargin = summary.avgProfitMargin !== undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          detail={
            summary.revenueChangePercent !== undefined
              ? `${summary.revenueChangePercent > 0 ? "+" : ""}${summary.revenueChangePercent}%`
              : ""
          }
          icon="payments"
          label={t("reports.totalRevenue")}
          value={summary.totalRevenue.toLocaleString()}
        />
        <MetricCard
          detail=""
          icon="account_balance_wallet"
          label={t("reports.totalDeposits")}
          value={summary.totalDeposits.toLocaleString()}
        />
        {showMargin && (
          <MetricCard
            detail="%"
            icon="trending_up"
            label={t("reports.avgProfitMargin")}
            value={`${summary.avgProfitMargin}%`}
          />
        )}
        <MetricCard
          detail={t("reports.outstandingJobs", {
            count: summary.outstandingJobCount,
          })}
          icon="pending"
          label={t("reports.outstandingBalance")}
          value={summary.outstandingBalance.toLocaleString()}
        />
      </div>

      {breakdown.length > 0 ? (
        <div className="overflow-x-auto rounded-xl bg-surface-container-low">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wide">
                <th className="px-4 py-3">{t("reports.jobCode")}</th>
                <th className="px-4 py-3">{t("reports.customer")}</th>
                <th className="px-4 py-3">{t("reports.device")}</th>
                <th className="px-4 py-3 text-end">{t("reports.estCost")}</th>
                <th className="px-4 py-3 text-end">{t("reports.deposit")}</th>
                <th className="px-4 py-3 text-end">
                  {t("reports.partsCost")}
                </th>
                <th className="px-4 py-3 text-end">
                  {t("reports.repairsTotal")}
                </th>
                {showMargin && (
                  <th className="px-4 py-3 text-end">{t("reports.margin")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr
                  className="border-b border-outline-variant/50 last:border-0"
                  key={row.jobCode}
                >
                  <td className="px-4 py-3 font-mono font-medium text-on-surface">
                    {row.jobCode}
                  </td>
                  <td className="px-4 py-3 text-on-surface">
                    {row.customerName}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {row.deviceName}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {row.estimatedCost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {row.depositAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {row.partsCost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {row.repairsTotal.toLocaleString()}
                  </td>
                  {showMargin && (
                    <td className="px-4 py-3 text-end tabular-nums">
                      {row.margin !== undefined ? `${row.margin}%` : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-on-surface-variant">
          {t("reports.noData")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/reports/revenue-tab.tsx
git commit -m "feat: add revenue & financial report tab"
```

---

### Task 8: Operations Tab

**Files:**
- Create: `src/pages/reports/operations-tab.tsx`

- [ ] **Step 1: Create the operations tab component**

```tsx
import { useTranslation } from "react-i18next";
import { MetricCard } from "@/components/ui/metric-card";
import { useReportsStore } from "@/stores/reports";

export default function OperationsTab() {
  const { t } = useTranslation();
  const state = useReportsStore((s) => s.operations);

  if (state.loading) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        {t("loading")}
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="py-12 text-center text-error">{state.error}</div>
    );
  }

  if (!state.data) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        {t("reports.noData")}
      </div>
    );
  }

  const { summary, topRepairs, statusBreakdown } = state.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          detail={
            summary.jobsCompletedChangePercent !== undefined
              ? `${summary.jobsCompletedChangePercent > 0 ? "+" : ""}${summary.jobsCompletedChangePercent}%`
              : ""
          }
          icon="check_circle"
          label={t("reports.jobsCompleted")}
          value={String(summary.jobsCompleted)}
        />
        <MetricCard
          detail={t("reports.hours")}
          icon="schedule"
          label={t("reports.avgTurnaround")}
          value={String(summary.avgTurnaroundHours)}
        />
        <MetricCard
          detail=""
          icon="engineering"
          label={t("reports.jobsInProgress")}
          value={String(summary.jobsInProgress)}
        />
        {summary.warrantyReturnRate !== undefined && (
          <MetricCard
            detail="%"
            icon="autorenew"
            label={t("reports.warrantyReturnRate")}
            value={`${summary.warrantyReturnRate}%`}
          />
        )}
      </div>

      {topRepairs.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold text-on-surface text-sm uppercase tracking-wide">
            {t("reports.topRepairs")}
          </h2>
          <div className="overflow-x-auto rounded-xl bg-surface-container-low">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">{t("reports.repairName")}</th>
                  <th className="px-4 py-3">{t("reports.category")}</th>
                  <th className="px-4 py-3 text-end">{t("reports.count")}</th>
                  <th className="px-4 py-3 text-end">
                    {t("reports.avgPrice")}
                  </th>
                  <th className="px-4 py-3 text-end">
                    {t("reports.revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topRepairs.map((r) => (
                  <tr
                    className="border-b border-outline-variant/50 last:border-0"
                    key={`${r.repairName}-${r.category}`}
                  >
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {r.repairName}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {r.category}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {r.count}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {r.avgPrice.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {r.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statusBreakdown.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold text-on-surface text-sm uppercase tracking-wide">
            {t("reports.statusBreakdown")}
          </h2>
          <div className="overflow-x-auto rounded-xl bg-surface-container-low">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">{t("reports.status")}</th>
                  <th className="px-4 py-3 text-end">{t("reports.count")}</th>
                  <th className="px-4 py-3 text-end">
                    {t("reports.avgDays")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {statusBreakdown.map((s) => (
                  <tr
                    className="border-b border-outline-variant/50 last:border-0"
                    key={s.status}
                  >
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {t(`jobStatus.${s.status}`)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {s.count}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {s.avgDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/reports/operations-tab.tsx
git commit -m "feat: add repair operations report tab"
```

---

### Task 9: Customer Insights Tab

**Files:**
- Create: `src/pages/reports/insights-tab.tsx`

- [ ] **Step 1: Create the insights tab component**

```tsx
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { useReportsStore } from "@/stores/reports";

export default function InsightsTab() {
  const { t } = useTranslation();
  const state = useReportsStore((s) => s.insights);

  if (state.loading) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        {t("loading")}
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="py-12 text-center text-error">{state.error}</div>
    );
  }

  if (!state.data) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        {t("reports.noData")}
      </div>
    );
  }

  const { summary, topCustomers } = state.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          detail={
            <span className="flex gap-2">
              <Badge variant="success" size="sm">
                {t("reports.newCustomers", { count: summary.newCustomers })}
              </Badge>
              <Badge variant="secondary" size="sm">
                {t("reports.returningCustomers", {
                  count: summary.returningCustomers,
                })}
              </Badge>
            </span>
          }
          icon="people"
          label={t("reports.totalCustomers")}
          value={String(summary.totalCustomers)}
        />
        <MetricCard
          detail="%"
          icon="repeat"
          label={t("reports.repeatRate")}
          value={`${summary.repeatRate}%`}
        />
        <MetricCard
          detail=""
          icon="payments"
          label={t("reports.avgSpendPerVisit")}
          value={summary.avgSpendPerVisit.toLocaleString()}
        />
        <MetricCard
          detail=""
          icon="receipt_long"
          label={t("reports.totalJobs")}
          value={String(summary.totalJobs)}
        />
      </div>

      {topCustomers.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold text-on-surface text-sm uppercase tracking-wide">
            {t("reports.topCustomers")}
          </h2>
          <div className="overflow-x-auto rounded-xl bg-surface-container-low">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">{t("reports.customerName")}</th>
                  <th className="px-4 py-3">{t("reports.phone")}</th>
                  <th className="px-4 py-3 text-end">
                    {t("reports.totalJobs")}
                  </th>
                  <th className="px-4 py-3 text-end">
                    {t("reports.totalRevenue")}
                  </th>
                  <th className="px-4 py-3">{t("reports.lastVisit")}</th>
                  <th className="px-4 py-3 text-end">
                    {t("reports.avgSpend")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr
                    className="border-b border-outline-variant/50 last:border-0"
                    key={c.customerId}
                  >
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {c.customerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {c.totalJobs}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {c.totalRevenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {c.lastVisit
                        ? new Date(c.lastVisit).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {c.avgSpend.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/reports/insights-tab.tsx
git commit -m "feat: add customer insights report tab"
```

---

### Task 10: i18n Keys

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add reports translation keys to en.json**

Add these keys under the top-level (sibling to existing keys like `"dashboard"`, `"jobs"`, etc.):

```json
{
  "reports": {
    "title": "Reports",
    "revenue": "Revenue",
    "operations": "Operations",
    "insights": "Insights",
    "7d": "7 Days",
    "30d": "30 Days",
    "month": "This Month",
    "year": "This Year",
    "noData": "No data for this period",
    "totalRevenue": "Total Revenue",
    "totalDeposits": "Total Deposits",
    "avgProfitMargin": "Avg Profit Margin",
    "outstandingBalance": "Outstanding Balance",
    "outstandingJobs": "{{count}} jobs",
    "jobsCompleted": "Jobs Completed",
    "avgTurnaround": "Avg Turnaround",
    "hours": "hours",
    "jobsInProgress": "In Progress",
    "warrantyReturnRate": "Warranty Return Rate",
    "totalCustomers": "Total Customers",
    "newCustomers": "{{count}} new",
    "returningCustomers": "{{count}} returning",
    "repeatRate": "Repeat Rate",
    "avgSpendPerVisit": "Avg Spend/Visit",
    "totalJobs": "Total Jobs",
    "jobCode": "Job Code",
    "customer": "Customer",
    "device": "Device",
    "estCost": "Est. Cost",
    "deposit": "Deposit",
    "partsCost": "Parts Cost",
    "repairsTotal": "Repairs",
    "margin": "Margin",
    "topRepairs": "Top Repairs",
    "repairName": "Repair",
    "category": "Category",
    "count": "Count",
    "avgPrice": "Avg Price",
    "revenue": "Revenue",
    "statusBreakdown": "Status Breakdown",
    "status": "Status",
    "avgDays": "Avg Days",
    "topCustomers": "Top Customers",
    "customerName": "Customer",
    "phone": "Phone",
    "totalRevenue": "Revenue",
    "lastVisit": "Last Visit",
    "avgSpend": "Avg Spend"
  }
}
```

Also add error key:
```json
"errors": {
  ...existing...,
  "fetch_reports": "Failed to load reports"
}
```

And add the bare `"reports"` key at the top level for the sidebar label:
```json
"reports": "Reports"
```

Note: The nested `reports.*` namespace handles the page-level keys. The bare `"reports"` key at the root handles the sidebar/bottom nav label.

- [ ] **Step 2: Run sync-locales**

Run: `pnpm run sync-locales`
This auto-translates `ar.json` and `fr.json` from the English keys.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add reports i18n keys and sync locales"
```

---

### Task 11: Lint, Typecheck, and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run lint and typecheck**

Run: `pnpm run check`
Expected: No errors

- [ ] **Step 2: Fix any lint/type issues**

If `pnpm run check` reports issues, fix them. Common issues to watch for:
- Unused imports (the `role` variable in revenue-tab if not used — remove it)
- Any biome formatting issues

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve lint/type issues in reports feature"
```