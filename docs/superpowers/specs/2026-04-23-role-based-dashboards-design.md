# Role-Based Dashboards — Backend Design

**Date:** 2026-04-23
**Status:** Draft, awaiting user review
**Scope:** MVP — Dashboard aggregation API and authorization for Owner, Technician, and Front-Desk dashboards

## Context

Reparilo ships three role-specific dashboards (`src/pages/dashboard/{index,technician,front-desk}.tsx`). They are currently shells: pipeline counts are wired to `/jobs/metrics`, and a few widgets read `jobs` from the store. Everything else — revenue, overdue jobs, per-technician queues, activity feed, financial trend, today schedule, priority alerts — is mocked.

This document specifies the backend for those dashboards: three endpoints, a service layer of composable metric functions, role-scoped authorization, and WebSocket-driven live refresh.

Explicitly **out of scope** (each gets its own future project):

- Parts inventory / stock alerts (UI currently mocks `PartsAlert`)
- Walk-in / waiting-room queue (UI currently mocks `WaitingCustomers`)
- Customer satisfaction / CSAT (UI currently mocks `QuickStatsChips`)
- Materialized views or aggregate caching (add when measured latency demands it)
- Owner impersonating a specific technician's dashboard

The dashboards' corresponding widgets will show empty states or remain mocked until those projects ship.

## Decisions

The following decisions are locked. The rest of the document builds on them.

| # | Decision |
|---|---|
| 1 | Scope per role: Technician is strict (`technicianId = self`); Front-Desk has full read; Owner has full read including financials. |
| 2 | Revenue is recognized on `DELIVERED`. Profit margin uses the same recognition rule. |
| 3 | Live updates via WebSocket push using the existing `wsBroadcast` plugin. No client polling. |
| 4 | Timezone for "today"/"this month" derived from `ShopSettings.timezone` (new field, IANA name). Fallback: `process.env.TZ ?? "UTC"`. |
| 5 | Overdue = active status AND `estimatedDate < today (shopTz)`. Reuses existing `overdue-scheduler` definition. |
| 6 | Financial trend: last 7 days, one point per day, Owner only. |
| 7 | Activity feed: last 20 `AuditLog` entries. Technician scope: entries by self OR on jobs assigned to self. |
| 8 | One endpoint per role: `GET /api/dashboard/{owner,technician,front-desk}`. Each returns a single typed DTO. |
| 9 | Owner may call any of the three endpoints (self-preview). Other roles may call only their own. |

## Architecture

### New files

```
server/
├── routes/
│   └── dashboard.ts              # 3 handlers, thin; compose service fns
├── services/
│   └── dashboard.service.ts      # composable metric functions
├── middlewares/
│   └── dashboard-scope.ts        # builds Scope object from session + ShopSettings
├── lib/
│   └── dashboard-events.ts       # emitDashboardChanged() — WS fan-out helper
shared/
└── types/
    └── dashboard.ts              # OwnerDashboardDTO, TechnicianDashboardDTO, FrontDeskDashboardDTO
prisma/
└── migrations/
    └── <ts>_add_shop_timezone/   # ShopSettings.timezone (String, nullable)
```

### Request flow

```
Client → GET /api/dashboard/:role
  → authGuard (existing Better Auth session check) → 401 if no session
  → requireRole(...allowedRoles) → 403 if role mismatch
  → dashboardScopeMiddleware → attaches req.dashboardScope
  → handler composes dashboard.service fns via Promise.all
  → returns typed DTO (JSON)
```

### `Scope` — single source of truth for authorization

```ts
type Scope = {
  role: "OWNER" | "TECHNICIAN" | "FRONT_DESK";
  userId: string;     // session user id — never client-provided
  shopTz: string;     // resolved from ShopSettings.timezone, with fallback
};
```

Every metric function takes `Scope` and applies filters internally. No route handler ever hand-rolls a `where: { technicianId: ... }` clause — that belongs in the service.

### Live updates

A small helper consolidates WS fan-out:

```ts
// server/lib/dashboard-events.ts
type DashboardTarget = "OWNER" | "FRONT_DESK" | { technicianId: string };

function emitDashboardChanged(app, targets: DashboardTarget[]): void;
```

Emission points (all currently single code paths):

- `job.service.ts` create → `["OWNER", "FRONT_DESK", { technicianId }]` (when assigned)
- `job.service.ts` update / status change → include both old and new technician when it changes
- `job.service.ts` delete → compute targets from the pre-delete row
- `overdue-scheduler.ts` → already broadcasts; add a dashboard event alongside

Payload is `{ type: "dashboard:invalidate" }`. Clients listen and trigger their existing fetch functions. No per-metric diff payload — dashboards re-fetch their full DTO. Justification: cheap (< 200 ms round trip for single-shop scale), avoids client-side state reconciliation bugs, keeps the contract tiny.

## Endpoints & DTOs

All three endpoints:

- Require a valid session (401 otherwise).
- Enforce role gate (403 otherwise).
- Return the fully populated DTO (no optional top-level keys).
- Use server-enforced list caps; no unbounded queries.

### `GET /api/dashboard/owner` — `OwnerDashboardDTO`

```ts
type OwnerDashboardDTO = {
  pipeline: Record<JobStatus, number>;           // all 8 statuses
  activeJobs: number;                            // INTAKE+IN_REPAIR+ON_HOLD+WAITING_FOR_PARTS
  completedToday: number;                        // transitioned to DELIVERED today (shopTz)
  revenueThisMonth: number;                      // Σ (JobRepair.price + JobPart.totalCost) for DELIVERED, current month
  avgProfitMargin: number;                       // (revenue − partsCost) / revenue, DELIVERED current month; 0 if no revenue
  financialTrend: Array<{
    date: string;                                // YYYY-MM-DD in shopTz
    revenue: number;
    cost: number;
  }>;                                            // exactly 7 entries, oldest first
  overdueJobs: Array<{
    id: string;
    jobCode: string;
    device: string;                              // "Brand Model"
    customerName: string;
    repairSummary: string;                       // first JobRepair name, or "—"
    hoursLate: number;
  }>;                                            // max 10, oldest first
  warrantyReturns: Array<{
    id: string;
    jobCode: string;
    description: string;                         // reportedProblem truncated to 80 chars
    createdAt: string;                           // ISO-8601
  }>;                                            // max 5, newest first
};
```

### `GET /api/dashboard/technician` — `TechnicianDashboardDTO`

All counts and lists are scoped to `technicianId = session.userId`.

```ts
type TechnicianDashboardDTO = {
  pipeline: Record<JobStatus, number>;
  myActiveJobs: number;
  completedToday: number;
  waitingForParts: number;
  avgRepairTimeHours: number;                    // mean (updatedAt − createdAt) for DELIVERED, last 30d; 0 if none
  todaySchedule: Array<{
    id: string;
    jobCode: string;
    customerName: string;
    device: string;
    repairSummary: string;
    status: JobStatus;
    estimatedDate: string | null;                // YYYY-MM-DD
  }>;                                            // my jobs with estimatedDate = today, else top 5 active
  recentActivity: Array<{
    id: string;
    action: AuditAction;
    jobCode: string | null;
    fromValue: string | null;
    toValue: string | null;
    createdAt: string;
  }>;                                            // last 20 entries, newest first
  priorityActions: {
    jobsNeedingStatusUpdate: number;             // my IN_REPAIR with updatedAt > 24h ago
    overdueCount: number;
    partsWaitingCount: number;
  };
};
```

### `GET /api/dashboard/front-desk` — `FrontDeskDashboardDTO`

```ts
type FrontDeskDashboardDTO = {
  activeRepairs: Array<{
    id: string;
    jobCode: string;
    deviceModel: string;
    customerName: string;
    status: JobStatus;
    estimatedDate: string | null;
    updatedAt: string;
    technicianName: string | null;
  }>;                                            // active + completed-today, max 20, newest first
  todayOverview: {
    totalToday: number;                          // jobs created today (shopTz)
    completedToday: number;                      // delivered today
    recentIntakes: Array<{
      id: string;
      jobCode: string;
      deviceModel: string;
      createdAt: string;
    }>;                                          // newest 3 INTAKE jobs created today
  };
  priorityAlerts: Array<{
    id: string;
    kind: "OVERDUE" | "WARRANTY_RETURN" | "READY_FOR_PICKUP";
    jobCode: string;
    message: string;                             // short human-readable summary
  }>;                                            // max 5
  pickupReady: Array<{
    id: string;
    jobCode: string;
    customerName: string;
    customerPhone: string;
    deviceModel: string;
    readyAt: string;                             // updatedAt when transitioned to DONE
  }>;                                            // max 10
};
```

### DTO conventions

- Money fields: `number`, rounded to 2 decimals at the DTO boundary via `toMoney()`. `null` → 0.
- Date fields: ISO-8601 strings. `YYYY-MM-DD` for date-only fields.
- No optional keys at the top level; arrays are `[]` when empty.

## Service Layer

`server/services/dashboard.service.ts` exposes pure, composable functions. Each accepts `(prisma, scope, …args)` and returns one slice of a DTO. This matches the existing service style (`job.service.ts`, `receipt.service.ts`).

### Function inventory

| Function | Signature | Notes |
|---|---|---|
| `pipelineCounts` | `(prisma, scope) → Record<JobStatus, number>` | Uses `prisma.job.groupBy`. |
| `activeJobsCount` | `(prisma, scope) → number` | Derived from `pipelineCounts`. |
| `completedTodayCount` | `(prisma, scope, todayRange) → number` | `DELIVERED` with `updatedAt` in today's shopTz range. |
| `revenueThisMonth` | `(prisma, scope, monthRange) → number` | One raw SQL: SUM of `JobRepair.price` + SUM of `JobPart.totalCost` joined on delivered jobs in range. |
| `avgProfitMargin` | `(prisma, scope, monthRange) → number` | Same query as `revenueThisMonth` with cost column; compute ratio in JS. |
| `financialTrend` | `(prisma, scope, days) → FinancialTrendPoint[]` | One raw SQL with `generate_series` + `date_trunc('day', ... AT TIME ZONE shopTz)`. |
| `overdueJobs` | `(prisma, scope, limit)` | Active status AND `estimatedDate < today(shopTz)`. Joins customer, device, repairs. |
| `warrantyReturnsOpen` | `(prisma, limit)` | `isWarrantyReturn = true` AND status not in {DELIVERED, CANCELLED}. |
| `todayScheduleForTech` | `(prisma, userId, today)` | Jobs assigned to self with `estimatedDate = today`. If none, fall back to top 5 active assigned jobs ordered by `createdAt` asc. |
| `recentActivityForTech` | `(prisma, userId, limit)` | `userId = self` OR `jobId IN (jobs where technicianId = self)`. |
| `avgRepairTimeHours` | `(prisma, userId, days)` | Mean `(updatedAt − createdAt)` for DELIVERED jobs in window. |
| `priorityActionsForTech` | `(prisma, userId, today)` | Three counts, one query each (trivially cheap). |
| `activeRepairsQueue` | `(prisma, limit)` | Active jobs + jobs delivered today. Ordered by `updatedAt` desc. Joins customer, device, technician. |
| `todayOverview` | `(prisma, shopTz, today)` | Counts + newest-3 intake list. |
| `priorityAlerts` | `(prisma, limit)` | Union of overdue jobs, open warranty returns, and DONE-ready-for-pickup. Sorted by `updatedAt` desc, top `limit` taken across all kinds. |
| `pickupReady` | `(prisma, limit)` | `status = DONE`. Ordered by `updatedAt` desc (proxy for "time marked ready" — MVP approximation; a dedicated `readyAt` column is a future refinement). |

### Query strategy

- **Prefer `groupBy` / `aggregate`** over "fetch all, reduce in JS."
- **`financialTrend`** runs a single raw SQL — `generate_series`-based — so 7-day trend is one round trip.
- **`revenueThisMonth`** runs a single raw SQL joining `jobs`, `job_parts`, `job_repairs` with `status = 'DELIVERED'` and `updatedAt` in the month range. Simpler than two queries assembled in JS.
- **`recentActivityForTech`** two-clause OR on `AuditLog` with a `LIMIT 20` and an index on `(userId, createdAt)` — existing index `AuditLog.userId` + `createdAt` covers this.
- Money arithmetic stays in Prisma `Decimal` until the DTO boundary.

### Handler composition

```ts
// server/routes/dashboard.ts
app.get("/api/dashboard/owner", { preHandler: [requireRole("OWNER")] }, async (req) => {
  const scope = req.dashboardScope;
  const today = todayRange(scope.shopTz);
  const thisMonth = monthRange(scope.shopTz);
  const [pipeline, completedToday, revenueThisMonth, avgProfitMargin,
         financialTrend, overdueList, warrantyReturns] = await Promise.all([
    pipelineCounts(prisma, scope),
    completedTodayCount(prisma, scope, today),
    revenueThisMonth_(prisma, scope, thisMonth),
    avgProfitMargin_(prisma, scope, thisMonth),
    financialTrend_(prisma, scope, 7),
    overdueJobs_(prisma, scope, 10),
    warrantyReturnsOpen(prisma, 5),
  ]);
  const activeJobs =
    pipeline.INTAKE + pipeline.IN_REPAIR + pipeline.ON_HOLD + pipeline.WAITING_FOR_PARTS;
  return { pipeline, activeJobs, completedToday, revenueThisMonth,
           avgProfitMargin, financialTrend,
           overdueJobs: overdueList, warrantyReturns };
});
```

Technician and front-desk handlers follow the same pattern.

## Middleware & Utilities

### `dashboardScopeMiddleware`

```ts
// server/middlewares/dashboard-scope.ts
async function dashboardScopeMiddleware(req) {
  const { id, role } = req.session.user;
  const shopTz = await getShopTimezone();   // cached with 60s TTL
  req.dashboardScope = { role, userId: id, shopTz };
}

async function getShopTimezone(): Promise<string> {
  // memoized read of ShopSettings.timezone, 60s TTL
  // fallback: process.env.TZ ?? "UTC"
}
```

### `requireRole(...roles)`

Existing pattern in the codebase (`server/config/route-security.ts`) — wrap or reuse. For the owner endpoint, role set is `["OWNER"]`; for the others, it is `["OWNER", <role>]` so owner can self-preview.

### `toMoney(d)` helper

```ts
function toMoney(d: Decimal | null | undefined): number {
  if (!d) return 0;
  return Math.round(Number(d) * 100) / 100;
}
```

### Timezone helpers

`todayRange(tz)` and `monthRange(tz)` return `{ start, end }` `Date` pairs computed once per request and passed into every service function — no service function re-derives "today".

## Schema Changes

One additive migration:

```prisma
model ShopSettings {
  // ...existing fields
  timezone String?   // IANA name, e.g. "Africa/Algiers"; null → server fallback
}
```

No other schema changes. Existing indexes cover all query patterns:

- `jobs(status, createdAt)` — pipeline + today counts
- `jobs(status, estimatedDate)` — overdue
- `jobs(technicianId)` — technician scoping
- `audit_logs(userId)` + `audit_logs(createdAt)` — activity feed
- `jobs(warrantyForJobId)` — warranty returns

## Authorization

- `authGuard` (existing) verifies session. 401 on miss.
- Session-banned or inactive users are rejected by existing guards — no extra logic.
- `requireRole(...roles)` is the only authorization check at the route layer. It matches `session.role` against the allowed set.
- **Scope is server-computed.** The client cannot pass a `userId`, `technicianId`, or `role` parameter to influence filtering. Technician scope is derived strictly from `session.userId`.
- Owner calling `/dashboard/technician` returns the owner's own assigned-jobs view (almost always empty). Owner-as-technician impersonation for a specific tech is out of scope for MVP.

## Error Handling & Edge Cases

- Service functions do not catch; errors bubble. Route handler has one top-level `try/catch` that logs and returns `500 { error: "dashboard_failed" }`.
- Missing `ShopSettings` row → fallback TZ, logged once, not per request.
- Empty datasets → zero/empty. `avgProfitMargin` with zero revenue returns `0`, not `NaN`. `avgRepairTimeHours` with no deliveries returns `0`.
- Free warranty-return jobs (zero-cost parts/repairs) naturally contribute 0 to revenue — no special filter.
- WS broadcasts only iterate connections with `readyState === 1`; stale clients are handled by the existing plugin.

## Testing

### Unit — `server/services/__tests__/dashboard.service.test.ts`

One `describe` block per service function. Uses the project's existing Prisma test setup.

- Scope filtering: technician sees only their jobs; owner and front-desk see all.
- Revenue excludes non-DELIVERED.
- Timezone boundaries: "today" at 23:59 local (in range) vs. 00:01 UTC when shopTz is Africa/Algiers.
- Zero-data safety across every function.
- Financial trend returns exactly 7 entries with zero-filled gaps.
- Warranty filter excludes delivered/cancelled warranty jobs.

### Integration — `server/__tests__/dashboard-routes.test.ts`

Follows the existing `rbac-matrix.test.ts` pattern.

- Matrix: each role × each endpoint → expected status (200 / 403).
- No session → 401 on all three.
- Owner hitting `/dashboard/technician` returns their own scope (empty unless they have assigned jobs).
- Response shape validated via Zod parse at the assertion layer.

### WebSocket — `server/__tests__/dashboard-events.test.ts`

- Create job (unassigned) → OWNER + FRONT_DESK predicates each receive one `dashboard:invalidate`.
- Create job assigned to T1 → OWNER + FRONT_DESK + T1 each receive one.
- Reassign T1 → T2 → OWNER + FRONT_DESK + T1 + T2 each receive one.
- Delete assigned job → OWNER + FRONT_DESK + T1 each receive one.

## Observability

- Each handler logs total duration and a per-metric breakdown at `debug` behind a flag (`DASHBOARD_TRACE=1`). Useful as job volume grows.
- Standard Fastify request logging covers everything else.

## Client Changes (out of scope, noted for plan)

The client-side wiring lives in a follow-up — mentioned here for completeness:

- New Zustand stores (or extend existing): `useOwnerDashboardStore`, `useTechnicianDashboardStore`, `useFrontDeskDashboardStore`. Each exposes `{ data, isLoading, error, fetch() }`.
- Each dashboard page calls its store's `fetch()` on mount.
- A single WS listener (already present for other events) triggers the matching store's `fetch()` on `dashboard:invalidate`.
- Remove `MOCK_*` constants for widgets the DTOs cover. Keep stubs for `PartsAlert` / `WaitingCustomers` / CSAT until their projects ship.

## Rollout

1. Migration + schema change first (additive, reversible).
2. Service functions + unit tests.
3. Routes + middleware + integration tests.
4. WS invalidation + tests.
5. Client wiring (follows in plan).
6. Remove mocks in the corresponding widgets.

No feature flag — additive endpoints; old `/jobs/metrics` stays until the client is fully migrated, then is removed.
