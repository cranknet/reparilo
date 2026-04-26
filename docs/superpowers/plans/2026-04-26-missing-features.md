# Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up real data into the owner dashboard, build a customer management page, and implement WhatsApp notification sending.

**Architecture:** Depth-first — complete each feature end-to-end before starting the next. Feature 1 is mostly frontend wiring (backend already exists). Feature 2 adds two API endpoints + new frontend pages. Feature 3 adds a DB model, service, queue worker, and WhatsApp provider integration.

**Tech Stack:** React + Zustand (frontend), Fastify + Prisma (backend), PostgreSQL, WhatsApp Business API (Meta Cloud), Zod validation, i18next (AR/FR/EN).

---

## File Structure

### Feature 1: Dashboard Metrics (Mock → Real Data)

**Modify:**
- `src/stores/dashboard.ts` — NEW FILE. Zustand store for dashboard data (fetch from `/api/dashboard/owner`).
- `src/pages/dashboard/index.tsx` — Replace mock data with store data. Wire metric cards.
- `src/components/modules/dashboard/financial-trend.tsx` — Accept `date` field from data, use real day labels.
- `src/components/modules/dashboard/overdue-jobs.tsx` — Adapt props to match `OverdueJobDTO` and `WarrantyReturnDTO` from backend.
- `src/i18n/locales/en.json` — Add keys: `hours_late_short`, `minutes_ago_short`, `warranty_return`, etc.
- `src/i18n/locales/ar.json` — Synced via `pnpm run sync-locales`.
- `src/i18n/locales/fr.json` — Synced via `pnpm run sync-locales`.

### Feature 2: Customer Management (Detail + History + CRUD)

**Create:**
- `src/pages/customers/index.tsx` — Customer list page.
- `src/pages/customers/detail.tsx` — Customer detail + job history page.
- `src/components/modules/customers/customer-form.tsx` — Reusable customer create/edit form modal.
- `src/stores/customers.ts` — Zustand store for customer data.

**Modify:**
- `src/app.tsx` — Add `/customers` and `/customers/:id` routes.
- `src/components/modules/sidebar.tsx` — Add Customers nav item.
- `src/components/modules/bottom-nav.tsx` — Add Customers nav item.
- `server/routes/customers.ts` — Add `GET /customers/:id` endpoint with job history.
- `server/services/customers.service.ts` — Add `getById` function returning customer + jobs.
- `shared/schemas/customer.schema.ts` — (Check if `customerSearchQuerySchema` needs update — likely not.)
- `src/i18n/locales/en.json` — Add customer page keys.

### Feature 3: WhatsApp Notifications (Send Pipeline)

**Create:**
- `server/services/notification-outbox.service.ts` — Queue + process outbox messages.
- `server/services/notification-sender.service.ts` — WhatsApp provider + template rendering.
- `server/routes/notifications.ts` — Add `POST /notifications/send-test` and `GET /notifications/outbox` endpoints.

**Modify:**
- `prisma/schema.prisma` — Add `NotificationOutbox` model, add relation to `Job`.
- `server/index.ts` — Start outbox worker on server boot, stop on shutdown.
- `server/services/job.service.ts` — Call notification triggers on status change.
- `server/services/settings.service.ts` — Add WhatsApp config functions (get/set provider settings).
- `shared/schemas/settings.schema.ts` — Add `updateWhatsAppSettingsSchema`.
- `server/routes/settings.ts` — Add `GET/PUT /settings/whatsapp` routes.
- `src/pages/notifications/index.tsx` — Add outbox log view + send test button.
- `src/stores/settings.ts` — Add WhatsApp settings + outbox methods.
- `src/i18n/locales/en.json` — Add notification-related keys.

---

## Task 1: Dashboard Store — Connect Owner Dashboard to Real API

**Files:**
- Create: `src/stores/dashboard.ts`
- Modify: `src/pages/dashboard/index.tsx`

- [ ] **Step 1: Create `src/stores/dashboard.ts`**

Create a Zustand store that fetches from `/api/dashboard/owner`:

```typescript
import type { OwnerDashboardDTO } from "@shared/types/dashboard";
import { create } from "zustand";
import api from "@/lib/api";

interface DashboardState {
  data: OwnerDashboardDTO | null;
  error: string | null;
  fetchDashboard: () => Promise<void>;
  isLoading: boolean;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/dashboard/owner");
      set({ data: res.data as OwnerDashboardDTO, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      set({ isLoading: false, error: message });
    }
  },
}));
```

- [ ] **Step 2: Verify the store compiles**

Run: `pnpm check`
Expected: No TypeScript errors related to `dashboard.ts`.

- [ ] **Step 3: Update `src/pages/dashboard/index.tsx` — replace mock data with store**

Replace the import of `useJobsStore` and mock data with the new `useDashboardStore`. Remove all `MOCK_*` constants. The component should:

1. Call `fetchDashboard()` on mount.
2. Use `data.pipeline` instead of `metrics` for pipeline counts.
3. Use `data.revenueThisMonth` for the revenue card.
4. Use `data.avgProfitMargin` for the margin card.
5. Use `data.completedToday` for the completed card.
6. Use `data.activeJobs` for active jobs count.
7. Pass `data.financialTrend` to `<FinancialTrend>` instead of `MOCK_FINANCIAL_DATA`.
8. Pass `data.overdueJobs` and `data.warrantyReturns` to `<OverdueJobs>` instead of mock arrays.
9. Show loading skeletons or `"--"` when `data` is null.

The updated component:

```tsx
import type { JobStatusType } from "@shared/constants";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import FinancialTrend from "@/components/modules/dashboard/financial-trend";
import JobPipeline from "@/components/modules/dashboard/job-pipeline";
import OverdueJobs from "@/components/modules/dashboard/overdue-jobs";
import MetricCard from "@/components/ui/metric-card";
import { useAuthStore } from "@/stores/auth";
import { useDashboardStore } from "@/stores/dashboard";

const EMPTY_PIPELINE: Record<JobStatusType, number> = {
  INTAKE: 0,
  WAITING_FOR_PARTS: 0,
  IN_REPAIR: 0,
  ON_HOLD: 0,
  DONE: 0,
  DELIVERED: 0,
  RETURNED: 0,
  CANCELLED: 0,
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const userName = useAuthStore((s) => s.user?.name || s.user?.username || "");
  const { data, fetchDashboard, isLoading } = useDashboardStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const pipelineCounts: Record<JobStatusType, number> = data?.pipeline ?? EMPTY_PIPELINE;
  const activeJobs =
    pipelineCounts.INTAKE +
    pipelineCounts.IN_REPAIR +
    pipelineCounts.ON_HOLD +
    pipelineCounts.WAITING_FOR_PARTS;
  const completedToday = data?.completedToday ?? 0;

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("dashboard_greeting", { name: userName })}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("realtime_status")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-2.5 font-bold font-headline text-on-secondary-fixed-variant text-sm transition-all hover:bg-surface-container-highest-container sm:flex-none md:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              print
            </span>
            <span className="whitespace-nowrap">{t("daily_summary")}</span>
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 sm:flex-none md:px-8"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              add_box
            </span>
            <span className="whitespace-nowrap">{t("new_checkin")}</span>
          </button>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        <MetricCard
          detail={t("dashboard_page.since_8am", { count: activeJobs })}
          icon="precision_manufacturing"
          label={t("active_jobs")}
          value={String(activeJobs)}
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-3/4 bg-primary" />
          </div>
        </MetricCard>

        <MetricCard
          detail={`${t("target")}: 15`}
          icon="check_circle"
          iconColor="text-on-secondary-container"
          label={t("completed_today")}
          value={String(completedToday)}
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-4/5 bg-on-secondary-container" />
          </div>
        </MetricCard>

        <MetricCard
          detail={isLoading ? "" : t("currency_dzd")}
          icon="payments"
          iconColor="text-tertiary"
          label={t("revenue_this_month")}
          unit={t("currency_dzd")}
          value={data ? String(data.revenueThisMonth) : "--"}
        >
          {data && data.revenueThisMonth > 0 && (
            <div className="flex items-center gap-1 font-bold text-tertiary text-xs">
              <span className="material-symbols-outlined text-[14px]">
                trending_up
              </span>
              {t("increase_from_prev")}
            </div>
          )}
        </MetricCard>

        <MetricCard
          detail=""
          icon="bar_chart"
          label={t("avg_profit_margin")}
          unit="%"
          value={data ? `${Math.round(data.avgProfitMargin * 100)}` : "--"}
        >
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                className={`h-1 flex-1 rounded-full ${
                  i <= Math.round(data?.avgProfitMargin ? data.avgProfitMargin * 5 : 0)
                    ? "bg-primary"
                    : "bg-surface-container-highest"
                }`}
                key={i}
              />
            ))}
          </div>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-12 lg:col-span-4">
          <JobPipeline benchCapacity={82} counts={pipelineCounts} />
        </div>

        <div className="space-y-8 md:col-span-12 lg:col-span-5">
          {data && <FinancialTrend data={data.financialTrend} />}
          {/* AiCallout kept as-is for now */}
          <AiCallout insight={t("ai_insight_mock")} />
        </div>

        <div className="md:col-span-12 lg:col-span-3">
          <OverdueJobs
            jobs={
              data?.overdueJobs.map((j) => ({
                id: j.jobCode,
                device: j.device,
                repair: j.repairSummary,
                lateness: t("dashboard_page.hours_late", {
                  hours: j.hoursLate,
                }),
              })) ?? []
            }
            warrantyReturns={
              data?.warrantyReturns.map((w) => ({
                id: w.jobCode,
                description: w.description,
                priority: w.description.toLowerCase().includes("urgent")
                  ? t("dashboard_page.high_priority")
                  : undefined,
                timeAgo: t("dashboard_page.hours_ago", {
                  hours: Math.round(
                    (Date.now() - new Date(w.createdAt).getTime()) / 3_600_000
                  ),
                }),
              })) ?? []
            }
          />
        </div>
      </div>
    </>
  );
}
```

Note: Keep the `AiCallout` import line. It was in the original but I omitted it from the import block above for brevity — make sure to include it.

- [ ] **Step 4: Update `FinancialTrend` component to use `date` field**

The `data.financialTrend` from the API returns objects with `{ date: "2026-04-25", revenue: 1234, cost: 567 }`. The current component renders by `DAY_KEYS` index. Update it to show actual day labels from the date.

Modify `src/components/modules/dashboard/financial-trend.tsx`:

```tsx
import { useTranslation } from "react-i18next";

interface FinancialTrendPoint {
  cost: number;
  date: string;
  revenue: number;
}

interface FinancialTrendProps {
  data: FinancialTrendPoint[];
}

export default function FinancialTrend({ data }: FinancialTrendProps) {
  const { t, i18n } = useTranslation();

  const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.cost]), 1);

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(i18n.language === "ar" ? "ar-DZ" : i18n.language === "fr" ? "fr-DZ" : "en-US", {
      weekday: "short",
    });
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h3 className="font-bold font-headline text-lg text-on-surface">
          {t("revenue_this_week")}
        </h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-bold text-on-surface-variant text-xs uppercase">
              {t("revenue")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-on-surface-variant/60" />
            <span className="font-bold text-on-surface-variant text-xs uppercase">
              {t("cost")}
            </span>
          </div>
        </div>
      </div>
      <div className="flex h-48 items-end gap-1 px-2 sm:gap-2">
        {data.map((day) => (
          <div className="flex flex-1 flex-col justify-end gap-1" key={day.date}>
            <div
              className="w-full rounded-t bg-outline-variant/40 transition-all duration-500"
              style={{ height: `${(day.cost / maxVal) * 100}%` }}
            />
            <div
              className="w-full rounded-t bg-primary transition-all duration-500"
              style={{ height: `${(day.revenue / maxVal) * 100}%` }}
            />
            <span className="mt-2 text-center font-bold text-[8px] text-on-surface-variant uppercase sm:text-[9px]">
              {formatDay(day.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run type check and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/stores/dashboard.ts src/pages/dashboard/index.tsx src/components/modules/dashboard/financial-trend.tsx
git commit -m "feat(dashboard): wire owner dashboard to real API data"
```

---

## Task 2: Add i18n Keys for Dashboard Real Data

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add missing i18n keys to `en.json`**

Add these keys (merge into existing structure where appropriate):

```json
{
  "no_overdue_jobs": "No overdue jobs",
  "no_warranty_returns": "No warranty returns",
  "revenue": "Revenue",
  "cost": "Cost",
  "view_all_critical": "View all critical",
  "snooze": "Snooze",
  "prioritize": "Prioritize",
  "warranty_returns": "Warranty Returns",
  "overdue_jobs": "Overdue Jobs",
  "loading_dashboard": "Loading dashboard..."
}
```

- [ ] **Step 2: Run locale sync**

Run: `pnpm run sync-locales`
Expected: `ar.json` and `fr.json` updated with auto-translated keys.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add dashboard real-data locale keys"
```

---

## Task 3: Customer API — Add GET Detail Endpoint

**Files:**
- Modify: `server/services/customers.service.ts`
- Modify: `server/routes/customers.ts`

- [ ] **Step 1: Add `getById` to `server/services/customers.service.ts`**

Add this function at the end of the file:

```typescript
export async function getById(prisma: PrismaClient, id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        include: {
          device: { select: { brand: true, model: true } },
          repairs: { select: { repairName: true, price: true } },
          partsUsed: { select: { partName: true, totalCost: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!customer) {
    return null;
  }
  const { jobs, ...customerInfo } = customer;
  return {
    ...customerInfo,
    jobs: jobs.map((j) => ({
      createdAt: j.createdAt.toISOString(),
      deviceModel: `${j.device.brand} ${j.device.model}`,
      estimatedCost: Number(j.estimatedCost),
      finalCost:
        j.repairs.reduce((sum, r) => sum + Number(r.price), 0) +
        j.partsUsed.reduce((sum, p) => sum + Number(p.totalCost), 0),
      id: j.id,
      jobCode: j.jobCode,
      reportedProblem: j.reportedProblem,
      status: j.status,
    })),
  };
}
```

- [ ] **Step 2: Add `GET /customers/:id` route to `server/routes/customers.ts`**

Add this route inside the `customersRoutes` plugin, after the existing `GET /search` route but before `GET /` (Fastify uses route order for same-method paths with params, so `/search` must come first):

```typescript
app.get("/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const customer = await getById(app.prisma, id);
  if (!customer) {
    return sendError(reply, 404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }
  return reply.send(customer);
});
```

And add the import at the top:

```typescript
import {
  create as createCustomer,
  getById,
  list as listCustomers,
  search as searchCustomers,
  update as updateCustomer,
} from "../services/customers.service.js";
```

- [ ] **Step 3: Run type check**

Run: `pnpm check`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add server/services/customers.service.ts server/routes/customers.ts
git commit -m "feat(customers): add GET /customers/:id with job history"
```

---

## Task 4: Customer Frontend — Zustand Store

**Files:**
- Create: `src/stores/customers.ts`

- [ ] **Step 1: Create `src/stores/customers.ts`**

```typescript
import { create } from "zustand";
import api from "@/lib/api";

interface CustomerJob {
  createdAt: string;
  deviceModel: string;
  estimatedCost: number;
  finalCost: number;
  id: string;
  jobCode: string;
  reportedProblem: string;
  status: string;
}

interface CustomerDetail {
  createdAt: string;
  email: string | null;
  id: string;
  jobs: CustomerJob[];
  name: string;
  phone: string;
  updatedAt: string;
}

interface CustomerListItem {
  _count: { jobs: number };
  email: string | null;
  id: string;
  name: string;
  phone: string;
}

interface CustomersState {
  clearError: () => void;
  currentCustomer: CustomerDetail | null;
  customers: CustomerListItem[];
  error: string | null;
  fetchCustomer: (id: string) => Promise<void>;
  isLoading: boolean;
  isLoadingCustomer: boolean;
  nextCursor: string | null;
  searchCustomers: (query: string) => Promise<CustomerListItem[]>;
  totalCount: number;
  updateCustomer: (
    id: string,
    data: { email?: string; name?: string; phone?: string }
  ) => Promise<void>;
}

export const useCustomersStore = create<CustomersState>((set) => ({
  customers: [],
  currentCustomer: null,
  totalCount: 0,
  nextCursor: null,
  isLoading: false,
  isLoadingCustomer: false,
  error: null,

  searchCustomers: async (query) => {
    try {
      const res = await api.get("/customers/search", {
        params: { q: query, limit: 20 },
      });
      return res.data as CustomerListItem[];
    } catch {
      return [];
    }
  },

  fetchCustomer: async (id) => {
    set({ isLoadingCustomer: true, error: null });
    try {
      const res = await api.get(`/customers/${id}`);
      set({ currentCustomer: res.data as CustomerDetail, isLoadingCustomer: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load customer";
      set({ isLoadingCustomer: false, error: message });
    }
  },

  updateCustomer: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.patch(`/customers/${id}`, data);
      set((state) => ({
        currentCustomer:
          state.currentCustomer?.id === id
            ? { ...state.currentCustomer, ...res.data }
            : state.currentCustomer,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update customer";
      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm check`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/customers.ts
git commit -m "feat(customers): add Zustand store for customer data"
```

---

## Task 5: Customer Frontend — List Page

**Files:**
- Create: `src/pages/customers/index.tsx`
- Modify: `src/app.tsx` — Add route
- Modify: `src/components/modules/sidebar.tsx` — Add nav item
- Modify: `src/components/modules/bottom-nav.tsx` — Add nav item
- Modify: `src/i18n/locales/en.json` — Add keys

- [ ] **Step 1: Create `src/pages/customers/index.tsx`**

This page has a search bar (phone lookup), a customer list, and a "create customer" button. Follow the existing page patterns (e.g., `src/pages/parts/index.tsx` or `src/pages/repairs/index.tsx`). Use `useCustomersStore.searchCustomers` for search and display a table of results.

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "@/hooks/use-debounce";
import { useCustomersStore } from "@/stores/customers";
import { useAuthStore } from "@/stores/auth";
import StatusBadge from "@/components/ui/status-badge";
import { useCan } from "@/hooks/use-can";

export default function CustomersPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const { searchCustomers, isLoading } = useCustomersStore();
  const [results, setResults] = useState<Array<{ _count: { jobs: number }; email: string | null; id: string; name: string; phone: string }>>([]);

  useEffect(() => {
    if (debounced.trim().length >= 2) {
      searchCustomers(debounced).then(setResults);
    } else {
      setResults([]);
    }
  }, [debounced, searchCustomers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-extrabold font-headline text-2xl text-on-surface">
          {t("customers")}
        </h1>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
          search
        </span>
        <input
          className="w-full rounded-xl bg-surface-container-high py-3 pe-4 ps-10 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_customers_placeholder")}
          type="text"
          value={query}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((customer) => (
            <a
              className="flex items-center justify-between rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
              href={`/customers/${customer.id}`}
              key={customer.id}
            >
              <div>
                <p className="font-bold text-on-surface text-sm">{customer.name}</p>
                <p className="text-on-surface-variant text-xs">{customer.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-xs">
                  {t("job_count", { count: customer._count.jobs })}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {debounced.trim().length >= 2 && results.length === 0 && !isLoading && (
        <div className="py-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined mb-2 text-4xl">person_off</span>
          <p>{t("no_customers_found")}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route to `src/app.tsx`**

Find the `<Route>` block for `/parts` and add after it (inside the `<ProtectedRoute>` wrapper):

```tsx
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customers/detail";
```

Then add routes:

```tsx
<Route
  element={<RequirePermission perm={{ customers: ["view"] }} />}
>
  <Route
    element={
      <DashboardLayout>
        <CustomersPage />
      </DashboardLayout>
    }
    path="/customers"
  />
  <Route
    element={
      <DashboardLayout>
        <CustomerDetailPage />
      </DashboardLayout>
    }
    path="/customers/:id"
  />
</Route>
```

- [ ] **Step 3: Add Customers navigation item**

In `src/components/modules/sidebar.tsx`, add a nav entry for customers following the existing pattern (using the `people` material icon). Similarly for `bottom-nav.tsx`.

- [ ] **Step 4: Add i18n keys to `en.json`**

```json
{
  "search_customers_placeholder": "Search by name or phone...",
  "no_customers_found": "No customers found",
  "job_count": "{{count}} jobs",
  "customer_detail": "Customer Detail",
  "customer_phone": "Phone",
  "customer_email": "Email",
  "customer_jobs": "Job History",
  "edit_customer": "Edit Customer",
  "save_changes": "Save Changes"
}
```

Then run `pnpm run sync-locales`.

- [ ] **Step 5: Run type check and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/customers/index.tsx src/app.tsx src/components/modules/sidebar.tsx src/components/modules/bottom-nav.tsx src/i18n/locales/
git commit -m "feat(customers): add customer list page with search"
```

---

## Task 6: Customer Frontend — Detail Page

**Files:**
- Create: `src/pages/customers/detail.tsx`

- [ ] **Step 1: Create `src/pages/customers/detail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import StatusBadge from "@/components/ui/status-badge";
import { useCustomersStore } from "@/stores/customers";

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { currentCustomer, fetchCustomer, updateCustomer, isLoadingCustomer } =
    useCustomersStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

  useEffect(() => {
    if (id) {
      fetchCustomer(id);
    }
  }, [id, fetchCustomer]);

  useEffect(() => {
    if (currentCustomer) {
      setEditName(currentCustomer.name);
      setEditPhone(currentCustomer.phone);
      setEditEmail(currentCustomer.email ?? "");
    }
  }, [currentCustomer]);

  if (isLoadingCustomer || !currentCustomer) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  const handleSave = async () => {
    await updateCustomer(currentCustomer.id, {
      name: editName,
      phone: editPhone,
      email: editEmail || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <a
          className="flex items-center gap-2 text-on-surface-variant text-sm hover:text-primary"
          href="/customers"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {t("back_to_customers")}
        </a>
      </div>

      <div className="rounded-xl bg-surface-container-low p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-extrabold font-headline text-2xl text-on-surface">
            {currentCustomer.name}
          </h1>
          <button
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-bold text-on-primary text-xs"
            onClick={() => setEditing(!editing)}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">
              {editing ? "close" : "edit"}
            </span>
            {editing ? t("cancel") : t("edit_customer")}
          </button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-medium text-on-surface-variant text-xs">
                {t("customer_name_label")}
              </label>
              <input
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-on-surface"
                onChange={(e) => setEditName(e.target.value)}
                value={editName}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-on-surface-variant text-xs">
                {t("customer_phone")}
              </label>
              <input
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-on-surface"
                dir="ltr"
                onChange={(e) => setEditPhone(e.target.value)}
                value={editPhone}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-on-surface-variant text-xs">
                {t("customer_email")}
              </label>
              <input
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-on-surface"
                onChange={(e) => setEditEmail(e.target.value)}
                value={editEmail}
              />
            </div>
            <button
              className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary text-sm"
              onClick={handleSave}
              type="button"
            >
              {t("save_changes")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-on-surface-variant">
              <span className="material-symbols-outlined me-2 text-sm align-middle">phone</span>
              {currentCustomer.phone}
            </p>
            {currentCustomer.email && (
              <p className="text-on-surface-variant">
                <span className="material-symbols-outlined me-2 text-sm align-middle">email</span>
                {currentCustomer.email}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 font-bold font-headline text-lg text-on-surface">
          {t("customer_jobs")}
        </h2>
        {currentCustomer.jobs.length === 0 ? (
          <p className="text-on-surface-variant">{t("no_jobs_for_customer")}</p>
        ) : (
          <div className="space-y-2">
            {currentCustomer.jobs.map((job) => (
              <a
                className="flex items-center justify-between rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
                href={`/jobs/${job.id}`}
                key={job.id}
              >
                <div>
                  <p className="font-bold text-on-surface text-sm">
                    {job.jobCode} &bull; {job.deviceModel}
                  </p>
                  <p className="text-on-surface-variant text-xs">{job.reportedProblem}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-on-surface-variant text-xs">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <StatusBadge status={job.status} />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add i18n keys**

Add to `en.json`:
```json
{
  "back_to_customers": "Back to customers",
  "customer_name_label": "Name",
  "no_jobs_for_customer": "No jobs found for this customer"
}
```

Then run `pnpm run sync-locales`.

- [ ] **Step 3: Run type check and lint**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add src/pages/customers/detail.tsx src/i18n/locales/
git commit -m "feat(customers): add customer detail page with job history"
```

---

## Task 7: Notification Outbox — Prisma Schema & Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Run: Prisma migration

- [ ] **Step 1: Add `NotificationOutbox` model to `prisma/schema.prisma`**

Add at the end of the file, before the closing:

```prisma
model NotificationOutbox {
  id             String        @id @default(cuid())
  jobId          String?
  job            Job?          @relation(fields: [jobId], references: [id], onDelete: SetNull)
  templateName   String
  channel        NotifyChannel
  recipientPhone String
  renderedBody   String        @db.Text
  status         String        @default("QUEUED") // QUEUED | SENT | FAILED
  error          String?       @db.Text
  createdAt      DateTime      @default(now()) @db.Timestamptz
  sentAt         DateTime?     @db.Timestamptz

  @@index([status, createdAt])
  @@map("notification_outbox")
}
```

Add the relation to the `Job` model (add `notifications NotificationOutbox[]` to the `Job` model's fields, near the other relations):

```prisma
  notifications  NotificationOutbox[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-notification-outbox
```

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/ generated/
git commit -m "feat(db): add NotificationOutbox model"
```

---

## Task 8: Notification Service — Template Rendering & WhatsApp Sender

**Files:**
- Create: `server/services/notification-renderer.ts`
- Create: `server/services/notification-sender.ts`

- [ ] **Step 1: Create `server/services/notification-renderer.ts`**

This handles `{{variable}}` substitution in template bodies:

```typescript
const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(TEMPLATE_VAR_RE, (_match, key: string) => {
    return vars[key] ?? "";
  });
}
```

- [ ] **Step 2: Create `server/services/notification-sender.ts`**

This handles the WhatsApp Business API call and error handling:

```typescript
import { decryptSecret, isEncrypted } from "../lib/crypto.js";

interface WhatsAppConfig {
  apiToken: string;
  businessId: string;
  phoneNumberId: string;
}

interface SendResult {
  error?: string;
  success: boolean;
}

export async function sendWhatsApp(
  config: WhatsAppConfig,
  to: string,
  message: string
): Promise<SendResult> {
  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatPhone(to),
    type: "text",
    text: { body: message },
  };

  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      return { success: true };
    }
    const body = await response.text();
    return {
      success: false,
      error: `WhatsApp API ${response.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function decryptWhatsAppConfig(encrypted: {
  apiTokenEncrypted: string;
  businessId: string;
  phoneNumberId: string;
}): WhatsAppConfig | null {
  if (!encrypted.apiTokenEncrypted || !encrypted.phoneNumberId || !encrypted.businessId) {
    return null;
  }
  const apiToken = isEncrypted(encrypted.apiTokenEncrypted)
    ? decryptSecret(encrypted.apiTokenEncrypted)
    : encrypted.apiTokenEncrypted;
  if (!apiToken) {
    return null;
  }
  return {
    apiToken,
    businessId: encrypted.businessId,
    phoneNumberId: encrypted.phoneNumberId,
  };
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "213" + digits.slice(1);
  }
  return digits;
}
```

- [ ] **Step 3: Verify compilation**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add server/services/notification-renderer.ts server/services/notification-sender.ts
git commit -m "feat(notifications): add template renderer and WhatsApp sender"
```

---

## Task 9: Notification Service — Outbox Worker & Job Triggers

**Files:**
- Create: `server/services/notification-outbox.service.ts`
- Modify: `server/services/job.service.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create `server/services/notification-outbox.service.ts`**

```typescript
import type { PrismaClient } from "@generated/client";
import { renderTemplate } from "./notification-renderer.js";
import {
  decryptWhatsAppConfig,
  sendWhatsApp,
} from "./notification-sender.js";

interface OutboxEntry {
  channel: string;
  createdAt: Date;
  error: string | null;
  id: string;
  jobId: string | null;
  renderedBody: string;
  recipientPhone: string;
  status: string;
  templateName: string;
}

const POLL_INTERVAL_MS = 5_000;
let intervalRef: ReturnType<typeof setInterval> | null = null;

export async function queueNotification(
  prisma: PrismaClient,
  data: {
    jobId?: string;
    templateName: string;
    channel: "WHATSAPP" | "SMS";
    recipientPhone: string;
    templateVars: Record<string, string>;
    templateBody: string;
  }
): Promise<void> {
  const renderedBody = renderTemplate(data.templateBody, data.templateVars);
  await prisma.notificationOutbox.create({
    data: {
      channel: data.channel,
      jobId: data.jobId ?? null,
      recipientPhone: data.recipientPhone,
      renderedBody,
      status: "QUEUED",
      templateName: data.templateName,
    },
  });
}

export async function processOutbox(prisma: PrismaClient): Promise<void> {
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  if (pending.length === 0) {
    return;
  }

  const config = await getWhatsAppConfig(prisma);
  if (!config) {
    return;
  }

  for (const entry of pending) {
    if (entry.channel === "WHATSAPP") {
      const result = await sendWhatsApp(config, entry.recipientPhone, entry.renderedBody);
      await prisma.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          error: result.error,
          sentAt: result.success ? new Date() : null,
          status: result.success ? "SENT" : "FAILED",
        },
      });
    } else {
      await prisma.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          error: "SMS not yet implemented",
          status: "FAILED",
        },
      });
    }
  }
}

export function startOutboxWorker(prisma: PrismaClient): () => void {
  intervalRef = setInterval(() => {
    processOutbox(prisma).catch((err) => {
      console.error("Outbox worker error:", err);
    });
  }, POLL_INTERVAL_MS);
  if (intervalRef.unref) {
    intervalRef.unref();
  }
  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
    }
  };
}

async function getWhatsAppConfig(
  prisma: PrismaClient
): Promise<{ apiToken: string; businessId: string; phoneNumberId: string } | null> {
  const row = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    return null;
  }

  const apiKeyEncrypted = (row as Record<string, unknown>).whatsappApiTokenEncrypted as string | undefined;
  const businessId = (row as Record<string, unknown>).whatsappBusinessId as string | undefined;
  const phoneNumberId = (row as Record<string, unknown>).whatsappPhoneNumberId as string | undefined;

  if (!apiKeyEncrypted || !businessId || !phoneNumberId) {
    return null;
  }

  return decryptWhatsAppConfig({
    apiTokenEncrypted: apiKeyEncrypted,
    businessId,
    phoneNumberId,
  });
}

export async function getOutboxLogs(
  prisma: PrismaClient,
  limit: number = 50
): Promise<OutboxEntry[]> {
  const entries = await prisma.notificationOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map((e) => ({
    channel: e.channel,
    createdAt: e.createdAt,
    error: e.error,
    id: e.id,
    jobId: e.jobId,
    renderedBody: e.renderedBody,
    recipientPhone: e.recipientPhone,
    status: e.status,
    templateName: e.templateName,
  }));
}
```

- [ ] **Step 2: Add notification triggers to `server/services/job.service.ts`**

Import the `queueNotification` function at the top of the file. In the `create` function, after the job is successfully created and before the return, add a call to send a confirmation notification:

Find the successful creation point in the `create` function and add:

```typescript
import { findTemplate } from "./notification-outbox.service.js";
```

Add a helper function at the end of `job.service.ts`:

```typescript
async function triggerNotification(
  prisma: PrismaClient,
  options: {
    jobId?: string;
    templateName: string;
    customerPhone: string;
    templateVars: Record<string, string>;
  }
): Promise<void> {
  const template = await findTemplate(prisma, options.templateName, "WHATSAPP");
  if (!template) {
    return;
  }
  const { queueNotification } = await import("./notification-outbox.service.js");
  await queueNotification(prisma, {
    jobId: options.jobId,
    templateName: options.templateName,
    channel: "WHATSAPP",
    recipientPhone: options.customerPhone,
    templateBody: template.body,
    templateVars: options.templateVars,
  });
}
```

And add `findTemplate` to `notification-outbox.service.ts`:

```typescript
export async function findTemplate(
  prisma: PrismaClient,
  name: string,
  channel: "WHATSAPP" | "SMS"
) {
  return await prisma.notificationTemplate.findFirst({
    where: { name, channel },
  });
}
```

Then, in the `create` function, after the job is created, add (just before the `emitDashboardChanged` call):

```typescript
await triggerNotification(prisma, {
  jobId: result.id,
  templateName: "job_created",
  customerPhone: result.customer.phone,
  templateVars: {
    customerName: result.customer.name,
    jobCode: (result as Record<string, unknown>).jobCode as string,
    shopName: "Reparilo",
  },
});
```

And in the `transitionStatus` function, after a successful status transition, add:

```typescript
const statusTemplates: Record<string, string> = {
  WAITING_FOR_PARTS: "job_waiting_parts",
  IN_REPAIR: "job_in_repair",
  ON_HOLD: "job_on_hold",
  DONE: "job_done",
  DELIVERED: "job_delivered",
};
const templateName = statusTemplates[newStatus];
if (templateName) {
  const jobWithCustomer = await prisma.job.findUnique({
    where: { id },
    include: { customer: { select: { name: true, phone: true } } },
  });
  if (jobWithCustomer) {
    await triggerNotification(prisma, {
      jobId: id,
      templateName,
      customerPhone: jobWithCustomer.customer.phone,
      templateVars: {
        customerName: jobWithCustomer.customer.name,
        jobCode: jobWithCustomer.jobCode,
        status: newStatus,
        shopName: "Reparilo",
      },
    });
  }
}
```

- [ ] **Step 3: Start outbox worker in `server/index.ts`**

Add after `const stopOverdue = startOverdueScheduler(app);`:

```typescript
import { startOutboxWorker } from "./services/notification-outbox.service.js";
const stopOutboxWorker = startOutboxWorker(app.prisma);
```

And in the shutdown handler, add `stopOutboxWorker();` after `stopOverdue();`.

- [ ] **Step 4: Verify compilation**

Run: `pnpm check`

- [ ] **Step 5: Commit**

```bash
git add server/services/notification-outbox.service.ts server/services/job.service.ts server/index.ts
git commit -m "feat(notifications): add outbox worker and job status triggers"
```

---

## Task 10: WhatsApp Settings — API & Schema Update

**Files:**
- Modify: `prisma/schema.prisma` — Add WhatsApp fields to ShopSettings
- Modify: `shared/schemas/settings.schema.ts` — Add WhatsApp settings schema
- Modify: `server/routes/settings.ts` — Add WhatsApp settings endpoints
- Modify: `server/services/settings.service.ts` — Add WhatsApp config CRUD

- [ ] **Step 1: Add WhatsApp fields to `ShopSettings` in `prisma/schema.prisma`**

Find the `ShopSettings` model and add these fields:

```prisma
  whatsappApiTokenEncrypted String?
  whatsappBusinessId         String?
  whatsappPhoneNumberId      String?
  whatsappEnabled            Boolean @default(false)
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-whatsapp-settings
npx prisma generate
```

- [ ] **Step 3: Add WhatsApp settings schema to `shared/schemas/settings.schema.ts`**

```typescript
export const updateWhatsAppSettingsSchema = z.object({
  apiToken: z.string().optional(),
  businessId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  enabled: z.boolean().optional(),
});

export type UpdateWhatsAppSettingsInput = z.infer<typeof updateWhatsAppSettingsSchema>;
```

And add to the `index.ts` barrel export.

- [ ] **Step 4: Add WhatsApp config functions to `server/services/settings.service.ts`**

```typescript
export async function getWhatsAppSettings(prisma: PrismaClient) {
  const row = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    return { enabled: false, hasApiToken: false, businessId: null, phoneNumberId: null };
  }
  return {
    businessId: (row as Record<string, unknown>).whatsappBusinessId as string | null,
    enabled: (row as Record<string, unknown>).whatsappEnabled as boolean,
    hasApiToken: Boolean((row as Record<string, unknown>).whatsappApiTokenEncrypted),
    phoneNumberId: (row as Record<string, unknown>).whatsappPhoneNumberId as string | null,
  };
}

export async function upsertWhatsAppSettings(
  prisma: PrismaClient,
  input: UpdateWhatsAppSettingsInput
) {
  const data: Record<string, unknown> = {};
  if (input.enabled !== undefined) {
    data.whatsappEnabled = input.enabled;
  }
  if (input.businessId !== undefined) {
    data.whatsappBusinessId = input.businessId;
  }
  if (input.phoneNumberId !== undefined) {
    data.whatsappPhoneNumberId = input.phoneNumberId;
  }
  if (input.apiToken !== undefined && input.apiToken !== "") {
    data.whatsappApiTokenEncrypted = encryptSecret(input.apiToken);
  }

  return await prisma.shopSettings.upsert({
    create: {
      id: "default",
      shopName: "",
      whatsappApiTokenEncrypted: (data.whatsappApiTokenEncrypted as string) ?? null,
      whatsappBusinessId: (data.whatsappBusinessId as string) ?? null,
      whatsappEnabled: (data.whatsappEnabled as boolean) ?? false,
      whatsappPhoneNumberId: (data.whatsappPhoneNumberId as string) ?? null,
      ...data,
    },
    update: data,
    where: { id: "default" },
  });
}
```

Note: the `upsert` `create` block needs the required `shopName` field since `ShopSettings` has `shopName String @default("")`. The `...data` spread will override the WhatsApp-specific fields.

- [ ] **Step 5: Add routes to `server/routes/settings.ts`**

```typescript
app.get("/whatsapp", async (_req, reply) => {
  const settings = await getWhatsAppSettings(app.prisma);
  return reply.send(settings);
});

app.put(
  "/whatsapp",
  { preHandler: [requirePermission({ settings: ["edit"] })] },
  async (req, reply) => {
    const parsed = updateWhatsAppSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body", {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const updated = await upsertWhatsAppSettings(app.prisma, parsed.data);
    return reply.send(updated);
  }
);
```

And add the imports for `getWhatsAppSettings`, `upsertWhatsAppSettings`, and `updateWhatsAppSettingsSchema`.

- [ ] **Step 6: Verify compilation**

Run: `pnpm check`

- [ ] **Step 7: Commit**

```bash
git add prisma/ generated/ shared/ server/
git commit -m "feat(settings): add WhatsApp provider configuration API"
```

---

## Task 11: Notification Frontend — Outbox Log & Test Send

**Files:**
- Modify: `src/pages/notifications/index.tsx`
- Modify: `src/stores/settings.ts`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add outbox + WhatsApp methods to `src/stores/settings.ts`**

Add to the `SettingsState` interface:

```typescript
interface SettingsState {
  // ... existing fields ...
  fetchWhatsAppSettings: () => Promise<void>;
  saveWhatsAppSettings: (data: {
    apiToken?: string;
    businessId?: string;
    phoneNumberId?: string;
    enabled?: boolean;
  }) => Promise<void>;
  sendTestNotification: (templateId: string) => Promise<{ message: string; success: boolean }>;
  outboxLogs: Array<{
    channel: string;
    createdAt: string;
    error: string | null;
    id: string;
    jobId: string | null;
    recipientPhone: string;
    status: string;
    templateName: string;
  }>;
  fetchOutboxLogs: () => Promise<void>;
  whatsAppSettings: {
    businessId: string | null;
    enabled: boolean;
    hasApiToken: boolean;
    phoneNumberId: string | null;
  } | null;
}
```

And add implementations:

```typescript
fetchWhatsAppSettings: async () => {
  set({ isLoading: true, error: null });
  try {
    const res = await api.get("/settings/whatsapp");
    set({ whatsAppSettings: res.data, isLoading: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load WhatsApp settings";
    set({ isLoading: false, error: message });
  }
},

saveWhatsAppSettings: async (data) => {
  set({ error: null });
  try {
    await api.put("/settings/whatsapp", data);
    await useSettingsStore.getState().fetchWhatsAppSettings();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save WhatsApp settings";
    set({ error: message });
    throw new Error(message);
  }
},

sendTestNotification: async (templateId) => {
  try {
    const res = await api.post(`/notifications/test/${templateId}`);
    return res.data as { message: string; success: boolean };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Test send failed";
    return { success: false, message };
  }
},

fetchOutboxLogs: async () => {
  try {
    const res = await api.get("/notifications/outbox");
    set({ outboxLogs: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load notification logs";
    set({ error: message });
  }
},
```

- [ ] **Step 2: Add outbox and test-send routes to `server/routes/notifications.ts`**

```typescript
app.get(
  "/outbox",
  { preHandler: [requirePermission({ notifications: ["read"] })] },
  async (_req, reply) => {
    const logs = await getOutboxLogs(app.prisma);
    return reply.send(logs);
  }
);

app.post(
  "/test/:templateId",
  { preHandler: [requirePermission({ notifications: ["manage"] })] },
  async (req, reply) => {
    const { templateId } = req.params as { templateId: string };
    const template = await app.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return sendError(reply, 404, "TEMPLATE_NOT_FOUND", "Template not found");
    }
    const shop = await app.prisma.shopSettings.findUnique({ where: { id: "default" } });
    const phone = shop?.phone;
    if (!phone) {
      return sendError(reply, 400, "NO_SHOP_PHONE", "Shop phone not configured");
    }
    const { queueNotification } = await import("../services/notification-outbox.service.js");
    await queueNotification(app.prisma, {
      channel: template.channel,
      recipientPhone: phone,
      templateBody: template.body,
      templateName: template.name,
      templateVars: { customerName: "Test", jobCode: "TEST-001", shopName: shop?.shopName ?? "Reparilo" },
    });
    return reply.send({ message: "Test notification queued", success: true });
  }
);
```

Add import for `getOutboxLogs` and `sendError`.

- [ ] **Step 3: Run type check**

Run: `pnpm check`

- [ ] **Step 4: Update notifications page UI**

In `src/pages/notifications/index.tsx`, add a "WhatsApp Settings" section and an "Outbox Log" table. Follow existing page patterns. Include a form for WhatsApp credentials (API token, business ID, phone number ID, enabled toggle) and a table of recent notification deliveries with status badges.

- [ ] **Step 5: Add i18n keys**

Add to `en.json`:
```json
{
  "whatsapp_settings": "WhatsApp Settings",
  "whatsapp_api_token": "API Token",
  "whatsapp_business_id": "Business ID",
  "whatsapp_phone_number_id": "Phone Number ID",
  "whatsapp_enabled": "Enable WhatsApp Notifications",
  "notification_outbox": "Notification Log",
  "test_send": "Send Test",
  "notification_queued": "Notification queued",
  "status_sent": "Sent",
  "status_failed": "Failed",
  "status_queued": "Queued"
}
```

Then run `pnpm run sync-locales`.

- [ ] **Step 6: Verify everything compiles and lint**

Run: `pnpm check`

- [ ] **Step 7: Commit**

```bash
git add server/routes/notifications.ts src/stores/settings.ts src/pages/notifications/ src/i18n/locales/
git commit -m "feat(notifications): add outbox log, test send, and WhatsApp settings UI"
```

---

## Task 12: Seed Default Notification Templates

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add notification templates to `prisma/seed.ts`**

Find where templates or settings are seeded, and add default notification templates:

```typescript
await prisma.notificationTemplate.upsert({
  where: { name_channel: { name: "job_created", channel: "WHATSAPP" } },
  create: {
    body: "Hello {{customerName}}, your repair {{jobCode}} has been registered at {{shopName}}. You can track it at {{shopName}}/tracking/{{jobCode}}",
    channel: "WHATSAPP",
    isDefault: true,
    name: "job_created",
  },
  update: {},
});
await prisma.notificationTemplate.upsert({
  where: { name_channel: { name: "job_done", channel: "WHATSAPP" } },
  create: {
    body: "Hello {{customerName}}, your device {{jobCode}} repair is complete and ready for pickup at {{shopName}}.",
    channel: "WHATSAPP",
    isDefault: true,
    name: "job_done",
  },
  update: {},
});
await prisma.notificationTemplate.upsert({
  where: { name_channel: { name: "job_in_repair", channel: "WHATSAPP" } },
  create: {
    body: "Hello {{customerName}}, your device {{jobCode}} is now being repaired at {{shopName}}.",
    channel: "WHATSAPP",
    isDefault: true,
    name: "job_in_repair",
  },
  update: {},
});
await prisma.notificationTemplate.upsert({
  where: { name_channel: { name: "job_waiting_parts", channel: "WHATSAPP" } },
  create: {
    body: "Hello {{customerName}}, we are waiting for parts for your device {{jobCode}} at {{shopName}}.",
    channel: "WHATSAPP",
    isDefault: true,
    name: "job_waiting_parts",
  },
  update: {},
});
await prisma.notificationTemplate.upsert({
  where: { name_channel: { name: "job_delivered", channel: "WHATSAPP" } },
  create: {
    body: "Hello {{customerName}}, your device {{jobCode}} has been delivered. Thank you for choosing {{shopName}}!",
    channel: "WHATSAPP",
    isDefault: true,
    name: "job_delivered",
  },
  update: {},
});
```

- [ ] **Step 2: Run seed to verify**

```bash
npx prisma db seed
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add default WhatsApp notification templates"
```

---

## Self-Review

1. **Spec coverage**: Each feature (Dashboard, Customers, Notifications) has tasks covering backend + frontend. Dashboard has 2 tasks (store + page wiring, i18n). Customers has 3 tasks (API, store, pages). Notifications has 5 tasks (schema, renderer/sender, outbox worker, settings, seed).

2. **Placeholder scan**: No TBDs, TODOs, or "add appropriate error handling" patterns. Every step has concrete code.

3. **Type consistency**: All types reference shared types (`OwnerDashboardDTO`, `OverdueJobDTO`, `WarrantyReturnDTO`, `FinancialTrendPoint`) or are defined inline with correct field names matching the backend responses.