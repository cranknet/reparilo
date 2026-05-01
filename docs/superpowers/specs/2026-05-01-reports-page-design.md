# Reports Page — Design Spec

**Date:** 2026-05-01
**Status:** Draft
**Scope:** Single `/reports` page with 3 tabs, 3 API endpoints, role-scoped access

## Problem

Reparilo tracks jobs, parts, repairs, and customers — but there is no way to view aggregated business metrics. The RBAC system already defines `reports.viewSelf`, `reports.viewShop`, and `reports.viewMargin` permissions, but no UI or API endpoints use them. Shop owners and technicians need insight into revenue, repair performance, and customer behavior.

## Solution

A **Reports** page at `/reports` with three tabs:
1. **Revenue & Financial** — revenue, deposits, margins, per-job breakdown
2. **Repair Operations** — completion counts, turnaround time, top repairs, status distribution
3. **Customer Insights** — repeat rate, top customers, avg spend, new vs. returning

Each tab loads independently from its own API endpoint. A shared time-range selector controls the period for all tabs.

## Route Structure

### Frontend

- `/reports` — single page, 3 tabs
- Wrapped in `<RequirePermission perm={{ reports: ["viewSelf"] }}>` — visible to OWNER + TECHNICIAN
- Sidebar nav item: `icon: "analytics"`, `labelKey: "reports"`, `perm: { reports: ["viewSelf"] }`

### Backend

Three endpoints under `/api/reports/`:

| Method | Path | Minimum Permission | Description |
|--------|------|--------------------|-------------|
| GET | `/api/reports/revenue` | `reports.viewShop` | Revenue & financial summary + breakdown |
| GET | `/api/reports/operations` | `reports.viewSelf` | Repair operations metrics + breakdown |
| GET | `/api/reports/insights` | `reports.viewShop` | Customer insights + top customers |

**Query parameters (all endpoints):**

| Param | Type | Required | Values |
|-------|------|----------|--------|
| `range` | string | yes* | `7d`, `30d`, `month`, `year` |

*Required unless `from`+`to` custom range is provided.
| `from` | ISO date | no* | Custom range start |
| `to` | ISO date | no* | Custom range end |

*If `from` or `to` is provided, both are required and `range` is ignored. Max custom range: 1 year.

### Access Control

| Permission | OWNER | TECHNICIAN | FRONT_DESK |
|------------|-------|------------|------------|
| `reports.viewSelf` | Yes | Yes | No |
| `reports.viewShop` | Yes | No | No |
| `reports.viewMargin` | Yes | No | No |

- **Revenue & Insights tabs**: require `reports.viewShop` — OWNER only. If technician navigates to `/reports`, these tabs are hidden or disabled.
- **Operations tab**: minimum `reports.viewSelf`. Without `viewShop`, data is scoped to the requesting user's own jobs (technician sees only their stats).
- **Margin data**: fields with profit/margin values are only included in API responses if the user has `reports.viewMargin`. Otherwise, those fields are omitted from the response (not zeroed, not null — simply absent).

## Revenue & Financial Tab

### Summary Cards (4 across)

| Card | Value | Detail | Permission |
|------|-------|--------|------------|
| Total Revenue | sum of `estimatedCost` for DONE/DELIVERED jobs in range | vs. previous period % change | `viewShop` |
| Total Deposits | sum of `depositAmount` for jobs created in range | — | `viewShop` |
| Avg Profit Margin | `(revenue - parts cost) / revenue * 100` | Hidden entirely if no `viewMargin` | `viewShop` + `viewMargin` |
| Outstanding Balance | `estimatedCost - depositAmount` for DONE/DELIVERED jobs with balance > 0 | count of jobs with outstanding balance | `viewShop` |

### Breakdown Table

Jobs with status DONE or DELIVERED within the time range, sorted by completion date descending.

| Column | Source |
|--------|--------|
| Job Code | `Job.jobCode` |
| Customer | `Customer.name` |
| Device | `Brand.name` + `Device.model` |
| Est. Cost | `Job.estimatedCost` |
| Deposit | `Job.depositAmount` |
| Parts Cost | sum of `JobPart.totalCost` |
| Repairs Total | sum of `JobRepair.price` |
| Margin | `(repairs total - parts cost) / repairs total * 100` — only if `viewMargin` |

### Revenue Calculation

"Total Revenue" = sum of `estimatedCost` for jobs that transitioned to DONE or DELIVERED status within the time range. This uses the `AuditLog` table to find when jobs entered DONE/DELIVERED status (where `action = "status_change"` and `toValue IN ("DONE", "DELIVERED")`), not the job creation date. The `completedAt` field in breakdown rows is derived from this AuditLog timestamp.

### Period Comparison

The "vs. previous period" detail on the Total Revenue card computes the same metric for the immediately preceding period of equal length. Example: if `range=30d`, compare last 30 days vs. the 30 days before that. Display as "+12.5%" or "-5.3%".

## Repair Operations Tab

### Summary Cards (4 across)

| Card | Value | Detail | Permission |
|------|-------|--------|------------|
| Jobs Completed | count of DONE+DELIVERED in range | vs. previous period | `viewSelf` |
| Avg Turnaround | avg hours from `createdAt` to the timestamp of the DONE status transition | — | `viewSelf` |
| Jobs In Progress | count of IN_REPAIR+ON_HOLD currently (not range-bound) | — | `viewSelf` |
| Warranty Return Rate | warranty returns / completed jobs * 100 | Hidden if no `viewShop` | `viewShop` |

### Top Repairs Table

Grouped by `JobRepair.repairName` + `JobRepair.category`.

| Column | Source |
|--------|--------|
| Repair Name | `JobRepair.repairName` |
| Category | `JobRepair.category` |
| Count | number of times performed in range |
| Avg Price | avg `JobRepair.price` |
| Revenue | sum of `JobRepair.price` |

Sorted by count descending. Limited to top 20 rows.

### Status Breakdown Table

| Column | Source |
|--------|--------|
| Status | Job status enum value |
| Count | jobs in that status within range |
| Avg Days | avg time jobs in that status (computed from AuditLog transitions) |

All statuses shown, sorted by count descending.

### Technician Scope

When the user has `viewSelf` but not `viewShop`, all queries add `technicianId = userId` filter. Tables show only that technician's jobs. The "Warranty Return Rate" card is hidden.

## Customer Insights Tab

### Summary Cards (4 across)

| Card | Value | Detail | Permission |
|------|-------|--------|------------|
| Total Customers | distinct customers with jobs in range | new vs. returning split | `viewShop` |
| Repeat Customer Rate | customers with 2+ jobs / total customers * 100 | — | `viewShop` |
| Avg Spend Per Visit | avg `estimatedCost` per job | — | `viewShop` |
| Total Jobs | all jobs in range (all statuses) | — | `viewSelf` |

### Top Customers Table

| Column | Source |
|--------|--------|
| Customer Name | `Customer.name` |
| Phone | `Customer.phone` |
| Total Jobs | count of jobs in range |
| Total Revenue | sum of `Job.estimatedCost` |
| Last Visit | most recent job `createdAt` |
| Avg Spend | revenue / job count |

Sorted by total revenue descending. Limited to top 20 rows.

### New vs. Returning

Two badge/pill displays:
- **New**: customers whose first-ever job was created within the selected range
- **Returning**: customers who had jobs before the range start date

## Data Model

### No Schema Changes

All report data is derived from existing tables via aggregation queries:
- `Job` — primary source for all metrics
- `JobPart` — parts cost calculations
- `JobRepair` — repair revenue and top repairs
- `Customer` — customer grouping
- `AuditLog` — status transition timestamps for turnaround time and period-bound revenue
- `Brand` + `Device` — device names in breakdowns

### Shared DTOs

New file: `shared/types/reports.ts`

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

### Zod Schemas

New file: `shared/schemas/reports.schema.ts`

```typescript
export const reportsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "month", "year"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.from || data.to) return !!data.from && !!data.to;
    return !!data.range;
  },
  { message: "Either 'range' or both 'from' and 'to' are required" }
).refine(
  (data) => {
    if (data.from && data.to) {
      const diff = new Date(data.to).getTime() - new Date(data.from).getTime();
      return diff > 0 && diff <= 365 * 24 * 60 * 60 * 1000;
    }
    return true;
  },
  { message: "Custom range must be between 1 day and 1 year" }
);
```

## Error Handling

- **Empty data**: Return empty arrays and zero-value summaries. Frontend shows "No data for this period" message.
- **Missing permission**: Return 403 with AppError code `FORBIDDEN`. Frontend hides the tab entirely.
- **Invalid time range**: Return 400 with Zod validation error.
- **No schema changes**: No migration needed.

## Frontend Architecture

### Zustand Store

New file: `src/stores/reports.ts`

Three fetch methods mirroring the three endpoints. State shape:

```typescript
interface ReportsState {
  range: TimeRangePreset;
  from?: string;
  to?: string;
  revenue: { data?: RevenueReportDTO; loading: boolean; error?: string };
  operations: { data?: OperationsReportDTO; loading: boolean; error?: string };
  insights: { data?: InsightsReportDTO; loading: boolean; error?: string };
  setRange: (range: TimeRangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  fetchRevenue: () => Promise<void>;
  fetchOperations: () => Promise<void>;
  fetchInsights: () => Promise<void>;
}
```

### Page Structure

```
src/pages/reports/
├── index.tsx                    # Page shell with tab switcher + time range selector
├── revenue-tab.tsx              # Revenue & Financial tab content
├── operations-tab.tsx           # Repair Operations tab content
└── insights-tab.tsx             # Customer Insights tab content
```

### Tab Visibility

Tabs are hidden/shown based on permissions:
- Owner: all 3 tabs visible
- Technician: Operations tab only

### Currency Formatting

Use shop's configured currency from `ShopSettings.currency` (already available via the settings store). Format all monetary values with the appropriate currency symbol and decimal places.

### i18n

New keys in `en.json` under `reports.*` namespace:
- `reports.title`, `reports.revenue`, `reports.operations`, `reports.insights`
- `reports.totalRevenue`, `reports.totalDeposits`, `reports.avgProfitMargin`, `reports.outstandingBalance`
- `reports.jobsCompleted`, `reports.avgTurnaround`, `reports.jobsInProgress`, `reports.warrantyReturnRate`
- `reports.totalCustomers`, `reports.repeatRate`, `reports.avgSpendPerVisit`, `reports.totalJobs`
- `reports.noData`, `reports.newCustomers`, `reports.returningCustomers`
- `reports.7d`, `reports.30d`, `reports.month`, `reports.year`, `reports.customRange`
- All table header keys

Run `pnpm run sync-locales` after adding keys to `en.json`.

## Backend Architecture

### Service

New file: `server/services/reports.service.ts`

Follows the `dashboard.service.ts` pattern: accepts `(prisma, scope, rangeParams)` and uses `scopeWhere(scope)` for row-level filtering.

### Route Registration

In `server/index.ts`:
```typescript
app.register(reportsRoutes, { prefix: "/api/reports" });
```

### Query Approach

Use Prisma aggregation (`groupBy`, `_count`, `_sum`) and raw SQL where needed for AuditLog-based timestamp queries. The `scopeWhere` pattern from the dashboard service provides automatic technician filtering.

## Out of Scope

- Inventory/stock reports (no inventory module yet)
- Chart/graph visualizations (cards + tables only)
- Export to CSV/PDF
- Scheduled/automated reports
- Comparison between arbitrary date ranges
- Per-technician breakdown in revenue tab