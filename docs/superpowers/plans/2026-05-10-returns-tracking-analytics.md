# Returns Tracking — Analytics & Reports (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the analytics that justify the whole feature — repoint the existing Warranty Return Rate KPI to use claim data, add a new "Returns" tab to the Reports page with summary cards and breakdowns by fault / repair / part / technician / time-to-return, and add an inline "this month's net warranty cost" hint to the dashboard revenue card.

**Architecture:** One new aggregation service function + endpoint (`GET /api/reports/returns`). One new tab on the existing `/reports` page following the established pattern (Zustand store slice, MetricCard summary row, breakdown sections). Existing operations-tab KPI gets a one-line backend formula swap. No new charting library — use plain HTML + Tailwind for the donut (stacked horizontal bar) and histogram, matching the table-and-card aesthetic already established by the Reports page.

**Tech Stack:** Same as Plans 1 & 2 — React 19, React Router 7, Zustand, axios, Vitest, Prisma 5, Fastify 5.

**Spec reference:** `docs/superpowers/specs/2026-05-10-returns-and-photo-evidence-design.md`
**Prerequisites:** Plans 1 (backend) and 2 (frontend) merged. `return_claims` table populated with at least a few resolved claims for visual QA.

**Conventions to honor (from project CLAUDE.md):**
- AppError SSOT for error codes; use existing reports query pattern (Zod schema, Fastify schema, dashboardScope middleware)
- All new locale keys go in `src/i18n/locales/en.json`; run `bun run sync-locales`
- Prefer extending `server/services/reports.service.ts` over creating a new service — keep reports logic colocated
- The existing `MetricCard` component at `src/components/ui/metric-card` is the design source-of-truth for cards
- Reports tab visibility follows the existing `viewSelf` / `viewShop` split

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `shared/schemas/reports.schema.ts` | (Re-use existing `reportsQuerySchema`) | No change |
| `shared/types/reports.ts` | Modify | Add `ReturnsReport` shape |
| `server/services/reports.service.ts` | Modify | Add `returnsReport()`; repoint Warranty Return Rate formula in `operationsReport()` |
| `server/services/__tests__/reports.service.test.ts` | Modify | Tests for `returnsReport` + repointed formula |
| `server/routes/reports.ts` | Modify | Register `GET /api/reports/returns` |
| `server/__tests__/reports-routes.test.ts` (or existing reports test) | Modify | Route smoke test |
| `src/i18n/locales/en.json` | Modify | New `reports_returns_*` keys |
| `src/stores/reports.ts` | Modify | Add `returns` slice + `fetchReturns` action |
| `src/pages/reports/index.tsx` | Modify | Add "returns" tab between operations and insights |
| `src/pages/reports/returns-tab.tsx` | Create | The new tab UI |
| `src/components/ui/stacked-bar.tsx` | Create | Reusable horizontal stacked bar (used for fault breakdown + per-repair fault distribution) |
| `src/components/ui/histogram.tsx` | Create | Reusable simple histogram for time-to-return |
| `src/pages/dashboard/index.tsx` | Modify | Inline "this month's net warranty cost" on the revenue card (owner only) |

---

## Task 1: Repoint Warranty Return Rate Formula

**Files:**
- Modify: `server/services/reports.service.ts`
- Modify: `server/services/__tests__/reports.service.test.ts` (or wherever operations is tested)

The existing operations report computes warranty return rate as `count(Job.isWarrantyReturn=true) / count(completed jobs) × 100`. We swap the numerator to count `return_claims` opened in the range.

- [ ] **Step 1: Locate the existing warranty rate computation**

Run: `grep -n "isWarrantyReturn\|warrantyReturnRate" server/services/reports.service.ts`

Note the function and the existing query.

- [ ] **Step 2: Write a failing test for the new formula**

In the operations test block (likely `server/services/__tests__/dashboard.service.test.ts` or `reports.service.test.ts` — check both), add or modify a test:

```ts
it("computes warrantyReturnRate from return_claims (not Job.isWarrantyReturn)", async () => {
  const findManyJobs = vi.fn().mockResolvedValue([{ id: "j1" }, { id: "j2" }, { id: "j3" }, { id: "j4" }]);
  const countClaims = vi.fn().mockResolvedValue(1); // 1 claim against 4 delivered jobs = 25%
  const prisma = makePrisma({
    job: { findMany: findManyJobs, count: vi.fn().mockResolvedValue(4), groupBy: vi.fn() },
    returnClaim: { count: countClaims },
  });

  const result = await operationsReport(prisma, ownerScope, { range: "30d" });

  expect(result.summary.warrantyReturnRate).toBe(25);
  expect(countClaims).toHaveBeenCalledWith({
    where: { openedAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
  });
});
```

> Adapt to the actual `makePrisma` shape used in the existing test. If `returnClaim` is not yet in the mock factory, add it: `returnClaim: { count: vi.fn() }`.

- [ ] **Step 3: Run, expect failure**

Run: `bun vitest run server/services/__tests__/reports.service.test.ts`
Expected: FAIL — formula still uses `isWarrantyReturn` count.

- [ ] **Step 4: Update the formula**

In `server/services/reports.service.ts`, find the warranty-rate calculation. Replace the numerator query:

```ts
// BEFORE (illustrative — match the actual source):
// const warrantyReturns = await prisma.job.count({
//   where: { isWarrantyReturn: true, ...rangeFilter },
// });

// AFTER:
const claimsOpened = await prisma.returnClaim.count({
  where: {
    openedAt: { gte: range.start, lte: range.end },
    ...(scope.technicianId
      ? {
          OR: [
            { originalJob: { technicianId: scope.technicianId } },
            { reworkJob: { technicianId: scope.technicianId } },
          ],
        }
      : {}),
  },
});

const warrantyReturnRate =
  jobsDelivered > 0 ? Math.round((claimsOpened / jobsDelivered) * 100) : 0;
```

Confirm the existing variable names (`jobsDelivered`, `range.start`, etc.) match what's in the file; rename to match local conventions if needed.

- [ ] **Step 5: Run, expect pass**

Run: `bun vitest run server/services/__tests__/reports.service.test.ts`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add server/services/reports.service.ts server/services/__tests__/
git commit -m "fix(reports): warranty return rate sourced from return_claims"
```

---

## Task 2: Add `returnsReport` Aggregation Service (TDD)

**Files:**
- Modify: `shared/types/reports.ts`
- Modify: `server/services/reports.service.ts`
- Modify: `server/services/__tests__/reports.service.test.ts`

- [ ] **Step 1: Add the response type**

In `shared/types/reports.ts`, add:

```ts
export type FaultCategoryKey = "WORKMANSHIP" | "DEFECTIVE_PART" | "MISDIAGNOSIS";

export type TimeToReturnBucket =
  | "0-7d"
  | "8-30d"
  | "31-60d"
  | "61-90d"
  | "90d+";

export interface ReturnsReportSummary {
  totalReturns: number;
  totalReturnsChangePercent?: number;
  warrantyReturnRate: number;
  warrantyReturnRateChangePercent?: number;
  netWarrantyCost: number;
  netWarrantyCostChangePercent?: number;
  avgTimeToReturnDays: number;
  avgTimeToReturnChangePercent?: number;
}

export interface FaultBreakdownItem {
  faultCategory: FaultCategoryKey;
  count: number;
}

export interface ReturnsByRepairItem {
  repairName: string;
  category: string;
  count: number;
  faultDistribution: Record<FaultCategoryKey, number>;
}

export interface ReturnsByPartItem {
  partName: string;
  supplier: string | null;
  count: number;
  primaryFault: FaultCategoryKey | null;
  defectivePartPercent: number;
}

export interface ReturnsByTechnicianItem {
  technicianId: string;
  technicianName: string;
  jobsDelivered: number;
  claimsAgainst: number;
  returnRatePercent: number;
  dominantFault: FaultCategoryKey | null;
}

export interface TimeToReturnHistogramItem {
  bucket: TimeToReturnBucket;
  count: number;
}

export interface ReturnsReport {
  summary: ReturnsReportSummary;
  faultBreakdown: FaultBreakdownItem[];
  byRepair: ReturnsByRepairItem[];
  byPart: ReturnsByPartItem[];
  byTechnician: ReturnsByTechnicianItem[] | null; // null when scope is viewSelf
  timeToReturn: TimeToReturnHistogramItem[];
}
```

- [ ] **Step 2: Write failing tests**

Append to the existing reports service test:

```ts
import { returnsReport } from "../reports.service.js";

describe("returnsReport", () => {
  const ownerScope = { technicianId: null, canViewShop: true };
  const techScope = { technicianId: "tech-1", canViewShop: false };

  it("returns zero summary on empty data", async () => {
    const prisma = makePrisma({
      job: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      returnClaim: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { refundAmount: null, partialChargeAmount: null } }),
      },
      jobPart: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await returnsReport(prisma, ownerScope, { range: "30d" });

    expect(result.summary.totalReturns).toBe(0);
    expect(result.summary.warrantyReturnRate).toBe(0);
    expect(result.summary.netWarrantyCost).toBe(0);
    expect(result.summary.avgTimeToReturnDays).toBe(0);
    expect(result.faultBreakdown).toEqual([]);
    expect(result.byRepair).toEqual([]);
    expect(result.byPart).toEqual([]);
    expect(result.timeToReturn).toHaveLength(5);
  });

  it("hides byTechnician when scope is viewSelf", async () => {
    const prisma = makePrisma({
      job: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      returnClaim: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { refundAmount: null, partialChargeAmount: null } }),
      },
      jobPart: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await returnsReport(prisma, techScope, { range: "30d" });

    expect(result.byTechnician).toBeNull();
  });

  it("computes net warranty cost = refunds + rework parts cost − partial charges", async () => {
    const prisma = makePrisma({
      job: { count: vi.fn().mockResolvedValue(10), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn() },
      returnClaim: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          { reworkJobId: "rj-1" },
          { reworkJobId: "rj-2" },
        ]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { refundAmount: 1000, partialChargeAmount: 200 },
        }),
      },
      jobPart: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 500 } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await returnsReport(prisma, ownerScope, { range: "30d" });

    // 1000 + 500 − 200 = 1300
    expect(result.summary.netWarrantyCost).toBe(1300);
  });

  it("buckets time-to-return correctly", async () => {
    const now = new Date();
    const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const prisma = makePrisma({
      job: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn() },
      returnClaim: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([
          { openedAt: now,           originalJob: { auditLogs: [{ newStatus: "DELIVERED", createdAt: days(3) }] } },
          { openedAt: now,           originalJob: { auditLogs: [{ newStatus: "DELIVERED", createdAt: days(20) }] } },
          { openedAt: now,           originalJob: { auditLogs: [{ newStatus: "DELIVERED", createdAt: days(45) }] } },
          { openedAt: now,           originalJob: { auditLogs: [{ newStatus: "DELIVERED", createdAt: days(80) }] } },
          { openedAt: now,           originalJob: { auditLogs: [{ newStatus: "DELIVERED", createdAt: days(120) }] } },
        ]),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { refundAmount: null, partialChargeAmount: null } }),
      },
      jobPart: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await returnsReport(prisma, ownerScope, { range: "year" });

    const bucket = (k: string) => result.timeToReturn.find((b) => b.bucket === k)?.count ?? 0;
    expect(bucket("0-7d")).toBe(1);
    expect(bucket("8-30d")).toBe(1);
    expect(bucket("31-60d")).toBe(1);
    expect(bucket("61-90d")).toBe(1);
    expect(bucket("90d+")).toBe(1);
  });
});
```

- [ ] **Step 3: Run, expect failures**

Run: `bun vitest run server/services/__tests__/reports.service.test.ts`
Expected: FAIL — `returnsReport` not exported.

- [ ] **Step 4: Implement `returnsReport`**

Append to `server/services/reports.service.ts`:

```ts
import type {
  FaultBreakdownItem,
  FaultCategoryKey,
  ReturnsByPartItem,
  ReturnsByRepairItem,
  ReturnsByTechnicianItem,
  ReturnsReport,
  TimeToReturnHistogramItem,
} from "@shared/types/reports.js";

const BUCKETS: Array<{ key: TimeToReturnHistogramItem["bucket"]; min: number; max: number }> = [
  { key: "0-7d", min: 0, max: 7 },
  { key: "8-30d", min: 8, max: 30 },
  { key: "31-60d", min: 31, max: 60 },
  { key: "61-90d", min: 61, max: 90 },
  { key: "90d+", min: 91, max: Number.POSITIVE_INFINITY },
];

interface DashboardScope {
  technicianId: string | null;
  canViewShop: boolean;
}

export async function returnsReport(
  prisma: DbClient,
  scope: DashboardScope,
  query: { range: string; from?: string; to?: string },
): Promise<ReturnsReport> {
  const range = resolveRange(query);
  const techWhere = scope.technicianId
    ? {
        OR: [
          { originalJob: { technicianId: scope.technicianId } },
          { reworkJob: { technicianId: scope.technicianId } },
        ],
      }
    : {};

  const claimWhere = {
    openedAt: { gte: range.start, lte: range.end },
    ...techWhere,
  };

  // ── Summary ───────────────────────────────────────────
  const [totalReturns, jobsDelivered, refundsSum, claimsList] = await Promise.all([
    prisma.returnClaim.count({ where: claimWhere }),
    prisma.job.count({
      where: {
        status: "DELIVERED",
        updatedAt: { gte: range.start, lte: range.end },
        ...(scope.technicianId ? { technicianId: scope.technicianId } : {}),
      },
    }),
    prisma.returnClaim.aggregate({
      where: claimWhere,
      _sum: { refundAmount: true, partialChargeAmount: true },
    }),
    prisma.returnClaim.findMany({
      where: claimWhere,
      select: {
        reworkJobId: true,
        openedAt: true,
        faultCategory: true,
        claimedJobRepair: { select: { repairName: true, category: true } },
        claimedJobPart: { select: { partName: true } },
        originalJob: {
          select: {
            id: true,
            technicianId: true,
            auditLogs: {
              where: { newStatus: "DELIVERED" },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  const reworkJobIds = claimsList.map((c) => c.reworkJobId).filter(Boolean) as string[];
  const partsCost = await prisma.jobPart.aggregate({
    where: { jobId: { in: reworkJobIds } },
    _sum: { totalCost: true },
  });

  const refunds = Number(refundsSum._sum.refundAmount ?? 0);
  const partials = Number(refundsSum._sum.partialChargeAmount ?? 0);
  const reworkPartsCost = Number(partsCost._sum.totalCost ?? 0);

  const netWarrantyCost = Math.round((refunds + reworkPartsCost - partials) * 100) / 100;

  const warrantyReturnRate =
    jobsDelivered > 0 ? Math.round((totalReturns / jobsDelivered) * 100) : 0;

  // Avg time to return (days)
  const ttrSamples = claimsList
    .map((c) => {
      const delivered = c.originalJob.auditLogs[0]?.createdAt;
      if (!delivered) return null;
      return (c.openedAt.getTime() - delivered.getTime()) / 86_400_000;
    })
    .filter((v): v is number => v !== null && v >= 0);
  const avgTimeToReturnDays =
    ttrSamples.length === 0
      ? 0
      : Math.round(ttrSamples.reduce((a, b) => a + b, 0) / ttrSamples.length);

  // ── Fault breakdown ───────────────────────────────────
  const faultGroups = await prisma.returnClaim.groupBy({
    by: ["faultCategory"],
    where: { ...claimWhere, faultCategory: { not: null } },
    _count: { _all: true },
  });
  const faultBreakdown: FaultBreakdownItem[] = faultGroups
    .filter((g): g is typeof g & { faultCategory: FaultCategoryKey } => Boolean(g.faultCategory))
    .map((g) => ({ faultCategory: g.faultCategory, count: g._count._all }));

  // ── By repair ─────────────────────────────────────────
  const byRepairMap = new Map<string, ReturnsByRepairItem>();
  for (const c of claimsList) {
    const repair = c.claimedJobRepair;
    if (!repair) continue;
    const key = `${repair.repairName}::${repair.category}`;
    let entry = byRepairMap.get(key);
    if (!entry) {
      entry = {
        repairName: repair.repairName,
        category: repair.category,
        count: 0,
        faultDistribution: { WORKMANSHIP: 0, DEFECTIVE_PART: 0, MISDIAGNOSIS: 0 },
      };
      byRepairMap.set(key, entry);
    }
    entry.count += 1;
    if (c.faultCategory) {
      entry.faultDistribution[c.faultCategory as FaultCategoryKey] += 1;
    }
  }
  const byRepair = Array.from(byRepairMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);

  // ── By part ───────────────────────────────────────────
  const byPartMap = new Map<string, { partName: string; counts: Record<FaultCategoryKey, number>; total: number }>();
  for (const c of claimsList) {
    const part = c.claimedJobPart;
    if (!part) continue;
    const key = part.partName;
    let entry = byPartMap.get(key);
    if (!entry) {
      entry = {
        partName: part.partName,
        counts: { WORKMANSHIP: 0, DEFECTIVE_PART: 0, MISDIAGNOSIS: 0 },
        total: 0,
      };
      byPartMap.set(key, entry);
    }
    entry.total += 1;
    if (c.faultCategory) {
      entry.counts[c.faultCategory as FaultCategoryKey] += 1;
    }
  }
  const byPart: ReturnsByPartItem[] = Array.from(byPartMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((e) => {
      const dominant = (Object.entries(e.counts) as [FaultCategoryKey, number][])
        .sort((a, b) => b[1] - a[1])[0];
      return {
        partName: e.partName,
        supplier: null, // populated by parts_catalog join in a follow-up if needed
        count: e.total,
        primaryFault: dominant && dominant[1] > 0 ? dominant[0] : null,
        defectivePartPercent:
          e.total > 0 ? Math.round((e.counts.DEFECTIVE_PART / e.total) * 100) : 0,
      };
    });

  // ── By technician (viewShop only) ─────────────────────
  let byTechnician: ReturnsByTechnicianItem[] | null = null;
  if (scope.canViewShop) {
    const technicianIds = new Set<string>();
    for (const c of claimsList) {
      if (c.originalJob.technicianId) technicianIds.add(c.originalJob.technicianId);
    }
    const technicians = await prisma.user.findMany({
      where: { id: { in: Array.from(technicianIds) } },
      select: { id: true, name: true },
    });

    byTechnician = await Promise.all(
      technicians.map(async (u) => {
        const [delivered, claimsAgainst] = await Promise.all([
          prisma.job.count({
            where: {
              technicianId: u.id,
              status: "DELIVERED",
              updatedAt: { gte: range.start, lte: range.end },
            },
          }),
          prisma.returnClaim.count({
            where: {
              ...claimWhere,
              originalJob: { technicianId: u.id },
            },
          }),
        ]);
        const tcs = claimsList.filter((c) => c.originalJob.technicianId === u.id);
        const counts = { WORKMANSHIP: 0, DEFECTIVE_PART: 0, MISDIAGNOSIS: 0 } as Record<FaultCategoryKey, number>;
        for (const c of tcs) {
          if (c.faultCategory) counts[c.faultCategory as FaultCategoryKey] += 1;
        }
        const dominant = (Object.entries(counts) as [FaultCategoryKey, number][])
          .sort((a, b) => b[1] - a[1])[0];
        return {
          technicianId: u.id,
          technicianName: u.name,
          jobsDelivered: delivered,
          claimsAgainst,
          returnRatePercent:
            delivered > 0 ? Math.round((claimsAgainst / delivered) * 100) : 0,
          dominantFault: dominant && dominant[1] > 0 ? dominant[0] : null,
        };
      }),
    );
    byTechnician.sort((a, b) => b.returnRatePercent - a.returnRatePercent);
  }

  // ── Time-to-return histogram ─────────────────────────
  const buckets = BUCKETS.map((b) => ({ bucket: b.key, count: 0 }));
  for (const days of ttrSamples) {
    const idx = BUCKETS.findIndex((b) => days >= b.min && days <= b.max);
    if (idx >= 0) buckets[idx].count += 1;
  }

  return {
    summary: {
      totalReturns,
      warrantyReturnRate,
      netWarrantyCost,
      avgTimeToReturnDays,
    },
    faultBreakdown,
    byRepair,
    byPart,
    byTechnician,
    timeToReturn: buckets,
  };
}
```

> **Notes:**
> - The `_count: { _all: true }` shape is current Prisma syntax; verify if your version uses a different return shape.
> - The `originalJob.auditLogs[].newStatus` field name must match the actual AuditLog schema. Run `grep -n "model AuditLog" prisma/schema.prisma` and adjust if the field is named differently (e.g., `status`, `toStatus`).
> - `byPart` does not currently look up `parts_catalog.supplier` — supplier data lives on `JobPart.supplier`, which is a snapshot field. If you want supplier in the output, extend the `claimedJobPart` select above and aggregate it. Adding this is a one-line follow-up; deferred from v1.

- [ ] **Step 5: Run, expect pass**

Run: `bun vitest run server/services/__tests__/reports.service.test.ts`
Expected: all returnsReport tests pass.

- [ ] **Step 6: Add `vs previous period` comparison**

The spec requires "vs previous period" deltas on the 4 summary cards. Add a helper that recomputes the summary for the immediately preceding period of equal length and emits the change percent.

In `server/services/reports.service.ts`, immediately before the final `return` statement of `returnsReport`, add:

```ts
// Period comparison
const periodDays = Math.max(1, (range.end.getTime() - range.start.getTime()) / 86_400_000);
const prevStart = new Date(range.start.getTime() - periodDays * 86_400_000);
const prevEnd = new Date(range.start.getTime() - 1);
const prevWhere = {
  openedAt: { gte: prevStart, lte: prevEnd },
  ...techWhere,
};
const [prevTotal, prevDelivered, prevAgg, prevClaimsList] = await Promise.all([
  prisma.returnClaim.count({ where: prevWhere }),
  prisma.job.count({
    where: {
      status: "DELIVERED",
      updatedAt: { gte: prevStart, lte: prevEnd },
      ...(scope.technicianId ? { technicianId: scope.technicianId } : {}),
    },
  }),
  prisma.returnClaim.aggregate({
    where: prevWhere,
    _sum: { refundAmount: true, partialChargeAmount: true },
  }),
  prisma.returnClaim.findMany({
    where: prevWhere,
    select: {
      reworkJobId: true,
      openedAt: true,
      originalJob: {
        select: {
          auditLogs: {
            where: { newStatus: "DELIVERED" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  }),
]);

const prevReworkJobIds = prevClaimsList.map((c) => c.reworkJobId).filter(Boolean) as string[];
const prevPartsCost = await prisma.jobPart.aggregate({
  where: { jobId: { in: prevReworkJobIds } },
  _sum: { totalCost: true },
});
const prevNetCost =
  Number(prevAgg._sum.refundAmount ?? 0) +
  Number(prevPartsCost._sum.totalCost ?? 0) -
  Number(prevAgg._sum.partialChargeAmount ?? 0);
const prevTtrSamples = prevClaimsList
  .map((c) => {
    const d = c.originalJob.auditLogs[0]?.createdAt;
    return d ? (c.openedAt.getTime() - d.getTime()) / 86_400_000 : null;
  })
  .filter((v): v is number => v !== null && v >= 0);
const prevAvgTtr =
  prevTtrSamples.length === 0
    ? 0
    : prevTtrSamples.reduce((a, b) => a + b, 0) / prevTtrSamples.length;
const prevRate = prevDelivered > 0 ? (prevTotal / prevDelivered) * 100 : 0;

const pct = (curr: number, prev: number) =>
  prev === 0 ? undefined : Math.round(((curr - prev) / prev) * 100);
```

Then update the summary block of the return value:

```ts
summary: {
  totalReturns,
  totalReturnsChangePercent: pct(totalReturns, prevTotal),
  warrantyReturnRate,
  warrantyReturnRateChangePercent: pct(warrantyReturnRate, prevRate),
  netWarrantyCost,
  netWarrantyCostChangePercent: pct(netWarrantyCost, prevNetCost),
  avgTimeToReturnDays,
  avgTimeToReturnChangePercent: pct(avgTimeToReturnDays, prevAvgTtr),
},
```

- [ ] **Step 7: Run all reports tests**

Run: `bun vitest run server/services/__tests__/reports.service.test.ts`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add server/services/reports.service.ts shared/types/reports.ts server/services/__tests__/
git commit -m "feat(reports): returns report aggregation with summary, breakdowns, period comparison"
```

---

## Task 3: Register `/api/reports/returns` Route

**Files:**
- Modify: `server/routes/reports.ts`

- [ ] **Step 1: Add the route**

In `server/routes/reports.ts`, alongside the existing routes:

```ts
import { returnsReport } from "../services/reports.service.js";

// inside the plugin async block:
app.get(
  "/returns",
  {
    preHandler: [
      requirePermission({ reports: ["viewSelf"] }),
      dashboardScope,
    ],
    schema: { tags: ["reports"], summary: "Returns analytics report" },
  },
  async (req) => {
    // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
    const scope = req.dashboardScope!;
    const parsed = reportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", {
        errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
      });
    }
    return await returnsReport(app.prisma, scope, parsed.data);
  },
);
```

> Match the exact preHandler / scope / parsing pattern of the existing `/operations` route — copy it as-is and rename.

- [ ] **Step 2: Smoke test in the browser**

Run: `bun run server` (or whatever the dev script is). Hit `/api/reports/returns?range=30d` with valid auth.
Expected: 200 with the `ReturnsReport` shape (counts may be 0 if no claims exist).

- [ ] **Step 3: Commit**

```bash
git add server/routes/reports.ts
git commit -m "feat(reports): register returns analytics endpoint"
```

---

## Task 4: Locale Keys

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add new keys**

```json
"reports_tabs_returns": "Returns",

"reports_returns_total_returns": "Total returns",
"reports_returns_warranty_rate": "Warranty return rate",
"reports_returns_net_cost": "Net warranty cost",
"reports_returns_net_cost_footnote": "Excludes technician labor",
"reports_returns_avg_ttr": "Avg time to return",
"reports_returns_avg_ttr_unit": "days",

"reports_returns_fault_breakdown_title": "Fault category breakdown",
"reports_returns_by_repair_title": "Returns by repair type (top 10)",
"reports_returns_by_repair_col_repair": "Repair",
"reports_returns_by_repair_col_count": "Returns",
"reports_returns_by_repair_col_dist": "Fault distribution",

"reports_returns_by_part_title": "Returns by part / supplier (top 10)",
"reports_returns_by_part_col_part": "Part",
"reports_returns_by_part_col_count": "Returns",
"reports_returns_by_part_col_primary_fault": "Primary fault",
"reports_returns_by_part_col_defective_pct": "% defective-part",

"reports_returns_by_technician_title": "Returns by technician",
"reports_returns_by_technician_col_name": "Technician",
"reports_returns_by_technician_col_delivered": "Jobs delivered",
"reports_returns_by_technician_col_claims": "Claims",
"reports_returns_by_technician_col_rate": "Return rate",
"reports_returns_by_technician_col_dominant": "Dominant fault",

"reports_returns_ttr_title": "Time to return",
"reports_returns_ttr_bucket_0_7": "0–7 days",
"reports_returns_ttr_bucket_8_30": "8–30 days",
"reports_returns_ttr_bucket_31_60": "31–60 days",
"reports_returns_ttr_bucket_61_90": "61–90 days",
"reports_returns_ttr_bucket_90_plus": "90+ days",

"reports_returns_empty": "No return claims in this period",

"dashboard_revenue_warranty_cost_inline": "This month's net warranty cost: {{amount}}"
```

- [ ] **Step 2: Sync**

Run: `bun run sync-locales`
Expected: ar/fr updated.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n(reports): returns analytics tab keys"
```

---

## Task 5: Reports Store Slice

**Files:**
- Modify: `src/stores/reports.ts`

- [ ] **Step 1: Find the existing pattern**

Run: `grep -n "operations\|fetchOperations\|insights" src/stores/reports.ts | head -10`

Note how `operations` is structured: typically `{ data, loading, error }` plus a `fetchOperations` action.

- [ ] **Step 2: Add a `returns` slice**

Mirror the `operations` shape. In `src/stores/reports.ts`:

```ts
import type { ReturnsReport } from "@shared/types/reports";
import api, { getErrorMessage } from "@/lib/api";

// Add to the state interface:
returns: {
  data: ReturnsReport | null;
  loading: boolean;
  error: string | null;
};

fetchReturns: () => Promise<void>;
```

In the store factory (initial state):

```ts
returns: { data: null, loading: false, error: null },
```

In the actions:

```ts
fetchReturns: async () => {
  const { range } = get();
  if (!range) return;
  set((s) => ({ returns: { ...s.returns, loading: true, error: null } }));
  try {
    const res = await api.get<ReturnsReport>("/reports/returns", { params: { range } });
    set({ returns: { data: res.data, loading: false, error: null } });
  } catch (err) {
    set((s) => ({
      returns: {
        ...s.returns,
        loading: false,
        error: getErrorMessage(err, "Failed to load returns report"),
      },
    }));
  }
},
```

Match the exact typing patterns of the existing actions.

- [ ] **Step 3: Commit**

```bash
git add src/stores/reports.ts
git commit -m "feat(reports): zustand slice for returns analytics"
```

---

## Task 6: Stacked Bar + Histogram UI Primitives

**Files:**
- Create: `src/components/ui/stacked-bar.tsx`
- Create: `src/components/ui/histogram.tsx`
- Create: `src/components/ui/__tests__/stacked-bar.test.tsx`

These are tiny, reusable, no-dependency components that match the project's table-and-card aesthetic.

- [ ] **Step 1: Implement StackedBar**

Create `src/components/ui/stacked-bar.tsx`:

```tsx
interface Segment {
  label: string;
  value: number;
  className: string; // Tailwind background, e.g. "bg-primary"
}

interface Props {
  segments: Segment[];
  ariaLabel?: string;
}

export function StackedBar({ segments, ariaLabel }: Props) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) {
    return (
      <div
        aria-label={ariaLabel}
        className="h-2 w-full rounded-full bg-surface-variant"
      />
    );
  }
  return (
    <div
      aria-label={ariaLabel}
      className="flex h-2 w-full overflow-hidden rounded-full bg-surface-variant"
    >
      {segments.map((s) => (
        <span
          key={s.label}
          className={`${s.className} h-full`}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement Histogram**

Create `src/components/ui/histogram.tsx`:

```tsx
interface Bar {
  label: string;
  value: number;
}

interface Props {
  bars: Bar[];
  emptyText?: string;
}

export function Histogram({ bars, emptyText }: Props) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  if (bars.every((b) => b.value === 0)) {
    return <p className="text-sm text-on-surface-variant">{emptyText ?? ""}</p>;
  }
  return (
    <div className="space-y-2">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 text-on-surface-variant">{b.label}</span>
          <div className="h-3 flex-1 rounded-full bg-surface-variant">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right tabular-nums">{b.value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Quick test for StackedBar**

Create `src/components/ui/__tests__/stacked-bar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StackedBar } from "../stacked-bar";

describe("StackedBar", () => {
  it("renders an empty bar when total is 0", () => {
    render(<StackedBar ariaLabel="zero" segments={[{ label: "a", value: 0, className: "bg-primary" }]} />);
    expect(screen.getByLabelText("zero")).toBeInTheDocument();
  });

  it("sets segment widths proportionally", () => {
    const { container } = render(
      <StackedBar
        ariaLabel="three"
        segments={[
          { label: "a", value: 1, className: "bg-primary" },
          { label: "b", value: 3, className: "bg-secondary" },
        ]}
      />,
    );
    const segs = container.querySelectorAll("span");
    expect((segs[0] as HTMLElement).style.width).toBe("25%");
    expect((segs[1] as HTMLElement).style.width).toBe("75%");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `bun vitest run src/components/ui/__tests__/stacked-bar.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/stacked-bar.tsx src/components/ui/histogram.tsx src/components/ui/__tests__/stacked-bar.test.tsx
git commit -m "feat(ui): stacked-bar and histogram primitives for analytics"
```

---

## Task 7: Returns Tab UI

**Files:**
- Create: `src/pages/reports/returns-tab.tsx`

- [ ] **Step 1: Implement the tab**

Create `src/pages/reports/returns-tab.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Histogram } from "@/components/ui/histogram";
import { MetricCard } from "@/components/ui/metric-card";
import { StackedBar } from "@/components/ui/stacked-bar";
import { useReportsStore } from "@/stores/reports";

const FAULT_COLORS: Record<string, string> = {
  WORKMANSHIP: "bg-error",
  DEFECTIVE_PART: "bg-secondary",
  MISDIAGNOSIS: "bg-tertiary",
};

export default function ReturnsTab() {
  const { t } = useTranslation();
  const state = useReportsStore((s) => s.returns);

  if (state.loading) {
    return <div className="py-12 text-center text-on-surface-variant">{t("loading")}</div>;
  }
  if (state.error) {
    return <div className="py-12 text-center text-error">{state.error}</div>;
  }
  if (!state.data) {
    return <div className="py-12 text-center text-on-surface-variant">{t("reports.noData")}</div>;
  }

  const { summary, faultBreakdown, byRepair, byPart, byTechnician, timeToReturn } = state.data;

  const fmtChange = (n: number | undefined) =>
    n === undefined ? "" : `${n > 0 ? "+" : ""}${n}%`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon="undo"
          label={t("reports_returns_total_returns")}
          value={String(summary.totalReturns)}
          detail={fmtChange(summary.totalReturnsChangePercent)}
        />
        <MetricCard
          icon="trending_up"
          label={t("reports_returns_warranty_rate")}
          value={`${summary.warrantyReturnRate}%`}
          detail={fmtChange(summary.warrantyReturnRateChangePercent)}
        />
        <MetricCard
          icon="payments"
          label={t("reports_returns_net_cost")}
          value={String(summary.netWarrantyCost)}
          detail={t("reports_returns_net_cost_footnote")}
        />
        <MetricCard
          icon="schedule"
          label={t("reports_returns_avg_ttr")}
          value={`${summary.avgTimeToReturnDays} ${t("reports_returns_avg_ttr_unit")}`}
          detail={fmtChange(summary.avgTimeToReturnChangePercent)}
        />
      </div>

      {/* Fault breakdown */}
      <section className="space-y-3 rounded-lg border border-outline-variant bg-surface-container p-4">
        <h3 className="font-medium">{t("reports_returns_fault_breakdown_title")}</h3>
        <StackedBar
          ariaLabel={t("reports_returns_fault_breakdown_title")}
          segments={faultBreakdown.map((f) => ({
            label: t(`returns_fault_${f.faultCategory.toLowerCase()}`),
            value: f.count,
            className: FAULT_COLORS[f.faultCategory] ?? "bg-primary",
          }))}
        />
        <ul className="flex flex-wrap gap-4 text-sm">
          {faultBreakdown.map((f) => (
            <li key={f.faultCategory} className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded ${FAULT_COLORS[f.faultCategory]}`} />
              <Link
                className="underline"
                to={`/returns?faultCategory=${f.faultCategory}`}
              >
                {t(`returns_fault_${f.faultCategory.toLowerCase()}`)}: {f.count}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* By repair */}
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h3 className="mb-3 font-medium">{t("reports_returns_by_repair_title")}</h3>
        {byRepair.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t("reports_returns_empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-on-surface-variant">
              <tr>
                <th className="py-2">{t("reports_returns_by_repair_col_repair")}</th>
                <th className="py-2 text-right">{t("reports_returns_by_repair_col_count")}</th>
                <th className="py-2 w-1/3">{t("reports_returns_by_repair_col_dist")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {byRepair.map((r) => (
                <tr key={`${r.repairName}-${r.category}`}>
                  <td className="py-2">{r.repairName}</td>
                  <td className="py-2 text-right tabular-nums">{r.count}</td>
                  <td className="py-2">
                    <StackedBar
                      ariaLabel={`${r.repairName} fault distribution`}
                      segments={(["WORKMANSHIP", "DEFECTIVE_PART", "MISDIAGNOSIS"] as const).map(
                        (k) => ({
                          label: k,
                          value: r.faultDistribution[k],
                          className: FAULT_COLORS[k],
                        }),
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* By part */}
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h3 className="mb-3 font-medium">{t("reports_returns_by_part_title")}</h3>
        {byPart.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t("reports_returns_empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-on-surface-variant">
              <tr>
                <th className="py-2">{t("reports_returns_by_part_col_part")}</th>
                <th className="py-2 text-right">{t("reports_returns_by_part_col_count")}</th>
                <th className="py-2">{t("reports_returns_by_part_col_primary_fault")}</th>
                <th className="py-2 text-right">{t("reports_returns_by_part_col_defective_pct")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {byPart.map((p) => (
                <tr key={p.partName}>
                  <td className="py-2">{p.partName}</td>
                  <td className="py-2 text-right tabular-nums">{p.count}</td>
                  <td className="py-2">
                    {p.primaryFault ? t(`returns_fault_${p.primaryFault.toLowerCase()}`) : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.defectivePartPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* By technician (viewShop only) */}
      {byTechnician !== null && (
        <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <h3 className="mb-3 font-medium">{t("reports_returns_by_technician_title")}</h3>
          {byTechnician.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t("reports_returns_empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-on-surface-variant">
                <tr>
                  <th className="py-2">{t("reports_returns_by_technician_col_name")}</th>
                  <th className="py-2 text-right">{t("reports_returns_by_technician_col_delivered")}</th>
                  <th className="py-2 text-right">{t("reports_returns_by_technician_col_claims")}</th>
                  <th className="py-2 text-right">{t("reports_returns_by_technician_col_rate")}</th>
                  <th className="py-2">{t("reports_returns_by_technician_col_dominant")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {byTechnician.map((tech) => (
                  <tr key={tech.technicianId}>
                    <td className="py-2">{tech.technicianName}</td>
                    <td className="py-2 text-right tabular-nums">{tech.jobsDelivered}</td>
                    <td className="py-2 text-right tabular-nums">{tech.claimsAgainst}</td>
                    <td className="py-2 text-right tabular-nums">{tech.returnRatePercent}%</td>
                    <td className="py-2">
                      {tech.dominantFault
                        ? t(`returns_fault_${tech.dominantFault.toLowerCase()}`)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Time to return */}
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h3 className="mb-3 font-medium">{t("reports_returns_ttr_title")}</h3>
        <Histogram
          emptyText={t("reports_returns_empty")}
          bars={timeToReturn.map((b) => ({
            label: t(`reports_returns_ttr_bucket_${b.bucket.replace("-", "_").replace("+", "_plus")}`),
            value: b.count,
          }))}
        />
      </section>
    </div>
  );
}
```

> **i18n key trick:** the bucket labels are derived as `reports_returns_ttr_bucket_${bucket.replace("-", "_").replace("+", "_plus")}` — so `0-7d` → `reports_returns_ttr_bucket_0_7d`. Adjust the i18n keys in Task 4 to match this transform exactly, or simplify by using a fixed lookup map. **Recommended:** map explicitly:
>
> ```ts
> const TTR_LABELS: Record<string, string> = {
>   "0-7d": "reports_returns_ttr_bucket_0_7",
>   "8-30d": "reports_returns_ttr_bucket_8_30",
>   "31-60d": "reports_returns_ttr_bucket_31_60",
>   "61-90d": "reports_returns_ttr_bucket_61_90",
>   "90d+":  "reports_returns_ttr_bucket_90_plus",
> };
> ```
> Use `t(TTR_LABELS[b.bucket])` instead of the string transform.

- [ ] **Step 2: Apply the explicit-map fix**

Replace the inline `t(...)` call inside the Histogram bars block with the explicit map shown above.

- [ ] **Step 3: Commit**

```bash
git add src/pages/reports/returns-tab.tsx
git commit -m "feat(reports): returns tab UI with summary cards, breakdowns, and histogram"
```

---

## Task 8: Wire the Returns Tab into the Reports Page

**Files:**
- Modify: `src/pages/reports/index.tsx`

- [ ] **Step 1: Add the tab to the visibleTabs union**

In `src/pages/reports/index.tsx`, find the `TabKey` type and `visibleTabs` array. Update:

```ts
type TabKey = "revenue" | "operations" | "returns" | "insights";

// inside visibleTabs computation, after operations and before insights:
if (canViewSelf) {
  tabs.push("returns");
}
```

- [ ] **Step 2: Wire the fetch + render**

Add to the imports:

```ts
import ReturnsTab from "./returns-tab";
```

Add to the fetch effect:

```ts
if (activeTab === "returns") {
  fetchReturns();
}
```

(Pull `fetchReturns` from the store: `const fetchReturns = useReportsStore((s) => s.fetchReturns);`.)

Add to the render switch / conditional render block:

```tsx
{activeTab === "returns" && <ReturnsTab />}
```

Add the tab button to whatever tab navigation exists in the page header — match the exact pattern used by `revenue / operations / insights`. The label key is `reports_tabs_returns`.

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`. Visit `/reports`, switch to the Returns tab. Expected: data renders for OWNER (full tab including by-technician), and renders without the by-technician section for TECHNICIAN.

- [ ] **Step 4: Commit**

```bash
git add src/pages/reports/index.tsx
git commit -m "feat(reports): register returns tab in reports page"
```

---

## Task 9: Dashboard Inline "This Month's Net Warranty Cost"

**Files:**
- Modify: `src/pages/dashboard/index.tsx`

The owner dashboard already has a revenue card (per recent dashboard work). Add a small subline showing the current calendar month's net warranty cost.

- [ ] **Step 1: Source the value**

Reuse the existing `fetchReturns` action with `range="month"`. In the dashboard component, alongside other dashboard data fetches, add a minimal call:

```tsx
const returnsData = useReportsStore((s) => s.returns.data);
const fetchReturns = useReportsStore((s) => s.fetchReturns);
const setRange = useReportsStore((s) => s.setRange);

useEffect(() => {
  // ensure month range, then fetch returns once for inline metric
  setRange("month");
  fetchReturns();
}, [setRange, fetchReturns]);
```

> **Caution:** the dashboard and Reports page share the same `range` state. Setting `range="month"` here will affect the Reports page too if both are open. If that's undesirable, add a separate `dashboardRange` slice or call a one-shot `api.get("/reports/returns", { params: { range: "month" } })` directly in the dashboard component without touching the shared store. **Recommended:** the direct API call avoids store coupling.

Replace the above with:

```tsx
import api from "@/lib/api";
import { useEffect, useState } from "react";
import type { ReturnsReport } from "@shared/types/reports";

const [warrantyCostMonth, setWarrantyCostMonth] = useState<number | null>(null);

useEffect(() => {
  let cancelled = false;
  api
    .get<ReturnsReport>("/reports/returns", { params: { range: "month" } })
    .then((res) => {
      if (!cancelled) setWarrantyCostMonth(res.data.summary.netWarrantyCost);
    })
    .catch(() => {
      if (!cancelled) setWarrantyCostMonth(null);
    });
  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 2: Render the inline metric on the revenue card**

Inside the existing revenue-card JSX, add (only when `warrantyCostMonth !== null` and the user is OWNER):

```tsx
{warrantyCostMonth !== null && (
  <p className="mt-2 text-xs text-on-surface-variant">
    {t("dashboard_revenue_warranty_cost_inline", {
      amount: warrantyCostMonth.toLocaleString(),
    })}
  </p>
)}
```

Gate visibility with `useCan({ reports: ["viewShop"] })` to keep it owner-only.

- [ ] **Step 3: Manual smoke test**

Run dev, log in as OWNER. Verify the inline subtext shows the month's warranty cost. Switch to TECHNICIAN — line should be hidden.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/index.tsx
git commit -m "feat(dashboard): inline net warranty cost on revenue card (owner)"
```

---

## Task 10: Verification and Wrap-Up

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `bun run test`
Expected: all pass.

- [ ] **Step 2: Lint and format**

Run: `bun run check`
Expected: clean. `bun run fix` if needed.

- [ ] **Step 3: i18n sync**

Run: `bun run sync-locales`
Expected: ar/fr in sync.

- [ ] **Step 4: Manual QA in Chrome DevTools (per project rule)**

Seed a few claims spanning fault categories and outcomes (use the curl flow from Plan 1 Task 16). Then:

1. As OWNER on `/reports`:
   - Returns tab renders with summary cards + breakdowns
   - Fault donut (stacked bar) reflects counts
   - "By technician" table appears
   - Drill-down: click a fault chip → lands on `/returns?faultCategory=WORKMANSHIP` with that filter pre-applied
   - Period comparison shows on cards (vs previous period)
2. As TECHNICIAN:
   - Tab visible, scoped to claims involving the user
   - "By technician" table is hidden
   - Net warranty cost card hidden (no `viewShop`)
3. Dashboard:
   - Revenue card shows inline "This month's net warranty cost: $X" for OWNER, hidden for TECHNICIAN
4. Operations tab Warranty Return Rate:
   - Now sourced from `return_claims`. Verify the number changes when a refund-only claim is created (the previous formula would have ignored it).
5. AR locale: layout/RTL intact across the new tab.
6. Console: clean.

- [ ] **Step 5: Tag the analytics work as complete**

```bash
git log --oneline -15  # verify the commit trail for this plan
```

The full Returns Tracking feature (Plans 1–3) is now complete: backend, frontend, and analytics.

---

## Self-Review

**Spec coverage check (against `2026-05-10-returns-and-photo-evidence-design.md`, Analytics & Reports sections):**

| Spec section | Tasks |
|---|---|
| Repointed "Warranty Return Rate" KPI on Operations tab | 1 |
| New Returns tab — Total returns card + change% | 2, 7, 8 |
| New Returns tab — Warranty return rate card | 2, 7 |
| New Returns tab — Net warranty cost card with footnote | 2, 7 (formula in 2; footnote i18n in 4) |
| New Returns tab — Avg time to return card | 2, 7 |
| Fault category breakdown (donut → stacked bar) | 6, 7 |
| Returns by repair type (top 10, with stacked fault distribution) | 2, 7 |
| Returns by part / supplier (top 10) | 2, 7 (supplier deferred — see notes) |
| Returns by technician (viewShop only) | 2, 7 |
| Time-to-return histogram with 5 buckets | 2, 6, 7 |
| Permission scoping `viewShop` vs `viewSelf` | 2 (service), 3 (route preHandler), 7 (UI hides byTechnician) |
| Goodwill / out-of-warranty flag in list filter | (Plan 2 — already covered) |
| Period comparison "vs previous period" | 2 (step 6) |
| Drill-down from chart segments to filtered list | 7 |
| Dashboard "Open returns" card | (Plan 2 — already covered) |
| Dashboard inline "this month's net warranty cost" | 9 |

**Out-of-scope (deliberately deferred):**
- Supplier dimension on the by-part table — currently `JobPart.supplier` is a snapshot string. To group by supplier accurately we'd need to either (a) include it in the existing groupBy, or (b) join through `parts_catalog`. Either is a small follow-up; v1 leaves `supplier: null` and groups by `partName` only.
- Real chart library (Recharts, Chart.js) — the spec described a "donut chart" and "horizontal bar chart"; we deliver functional equivalents using HTML+Tailwind to avoid adding a dependency for a single feature. Easy upgrade later.
- Dashboard widgets beyond the inline metric (the spec mentions "open returns" — already in Plan 2).

**Placeholder scan:** none. Every code block runs as-is once the implementer adapts the AuditLog field name and verifies the `makePrisma` test factory shape.

**Type consistency check:**
- `ReturnsReport` type defined once (`shared/types/reports.ts`, Task 2) and consumed in both backend (Task 2) and frontend (Tasks 5, 7).
- `FaultCategoryKey` matches Prisma enum string values (`WORKMANSHIP`, `DEFECTIVE_PART`, `MISDIAGNOSIS`).
- `TimeToReturnBucket` strings match between aggregator (Task 2) and renderer (Task 7) via the explicit map.
- `summary.*ChangePercent` field naming consistent across cards.

**Risk callouts:**
- **AuditLog field name** (`newStatus`) — verify against `prisma/schema.prisma` `model AuditLog`. The most common alternative is `toStatus`. If different, update both `returnsReport` and the `prevClaimsList` query.
- **`makePrisma` test factory** — check `server/services/__tests__/dashboard.service.test.ts` to confirm the helper name (it might be `mockPrisma` or a slightly different shape). Adapt the test snippets accordingly.
- **Existing `dashboardScope` middleware** — assumes `viewShop` is on the scope object. Verify the actual shape; the field may be named `canViewShop` (as I used) or `viewShop` or similar.
- **Tailwind tokens** — `bg-error`, `bg-secondary`, `bg-tertiary` for fault color coding. If those don't exist in the project's theme, swap to the closest equivalents (e.g., `bg-rose-500`, `bg-amber-500`, `bg-blue-500`).
- **Reports store coupling** (Task 9) — the recommended path uses a direct API call to avoid coupling. If the dashboard already loads other reports state, prefer the consistent path even if it shares range.
