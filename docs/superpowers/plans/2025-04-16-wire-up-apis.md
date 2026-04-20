# Wire Up Backend APIs with Frontend Components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the fully-implemented backend Jobs and Users APIs to the frontend pages that currently use hardcoded mock data, replacing all mock data with real API calls.

**Architecture:** Create Zustand stores (`jobsStore`, `usersStore`) following the pattern established in `authStore`. Each store manages server state, loading/error states, and provides action methods. Pages consume stores via hooks, replacing mock constants with store data.

**Tech Stack:** React, Zustand, Axios (existing `src/lib/api.ts`), TypeScript, Zod (shared schemas)

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/stores/jobs.ts` | Zustand store for jobs CRUD, metrics, listing with pagination |
| Create | `src/stores/users.ts` | Zustand store for users listing, create, toggle status |
| Modify | `src/components/modules/jobs/jobs-shared.ts` | Update `JobRow` type to match API response shape |
| Modify | `src/pages/jobs/index.tsx` | Replace mock data with store data |
| Modify | `src/pages/dashboard/index.tsx` | Replace mock metrics/pipeline with API data |
| Modify | `src/pages/dashboard/front-desk.tsx` | Replace mock data with store data |
| Modify | `src/pages/dashboard/technician.tsx` | Replace mock data with store data |
| Modify | `src/pages/settings/index.tsx` | Replace MOCK_USERS with real API calls |
| Modify | `src/components/modules/jobs/intake-modal.tsx` | Wire onSubmit to call POST /jobs/ |

---

### Task 1: Create Jobs Zustand Store

**Files:**
- Create: `src/stores/jobs.ts`
- Reference: `src/stores/auth.ts` (pattern), `shared/types/index.ts` (types), `shared/schemas/job.schema.ts` (schemas), `server/services/job.service.ts` (API shapes)

- [ ] **Step 1: Create `src/stores/jobs.ts`**

```ts
import type { JobStatusType } from "@shared/constants";
import type { Job, JobNote, JobPart, JobRepair } from "@shared/types";
import { create } from "zustand";
import api from "@/lib/api";

interface JobMetrics {
  [status: string]: number;
}

interface JobsState {
  jobs: Job[];
  metrics: JobMetrics | null;
  totalCount: number;
  nextCursor: string | null;
  isLoadingJobs: boolean;
  isLoadingMetrics: boolean;
  isCreatingJob: boolean;
  error: string | null;

  fetchJobs: (params?: {
    cursor?: string;
    limit?: number;
    status?: string;
    technicianId?: string;
    search?: string;
  }) => Promise<void>;
  fetchMetrics: () => Promise<void>;
  createJob: (data: {
    customerName: string;
    customerPhone: string;
    deviceBrand: string;
    deviceModel: string;
    color?: string;
    reportedProblem: string;
    conditionNotes?: string;
    estimatedCost: number;
    estimatedDate?: string;
    depositAmount?: number;
    technicianId?: string;
    isWarrantyReturn?: boolean;
    warrantyForJobId?: string;
  }) => Promise<Job>;
  updateJob: (id: string, data: Record<string, unknown>) => Promise<Job>;
  transitionStatus: (id: string, status: JobStatusType) => Promise<Job>;
  addNote: (jobId: string, content: string, isCustomerVisible?: boolean) => Promise<JobNote>;
  addPart: (jobId: string, data: {
    partId?: string;
    partName: string;
    category: string;
    unitPrice: number;
    quantity?: number;
    supplier?: string;
  }) => Promise<JobPart>;
  removePart: (jobId: string, partId: string) => Promise<void>;
  addRepair: (jobId: string, data: {
    repairId?: string;
    repairName: string;
    category: string;
    price: number;
  }) => Promise<JobRepair>;
  removeRepair: (jobId: string, repairId: string) => Promise<void>;
  clearError: () => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  metrics: null,
  totalCount: 0,
  nextCursor: null,
  isLoadingJobs: false,
  isLoadingMetrics: false,
  isCreatingJob: false,
  error: null,

  fetchJobs: async (params) => {
    set({ isLoadingJobs: true, error: null });
    try {
      const res = await api.get("/jobs", { params });
      set({
        jobs: res.data.jobs,
        nextCursor: res.data.nextCursor,
        totalCount: res.data.totalCount,
        isLoadingJobs: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch jobs";
      set({ isLoadingJobs: false, error: message });
    }
  },

  fetchMetrics: async () => {
    set({ isLoadingMetrics: false, error: null });
    try {
      const res = await api.get("/jobs/metrics");
      set({ metrics: res.data, isLoadingMetrics: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch metrics";
      set({ isLoadingMetrics: false, error: message });
    }
  },

  createJob: async (data) => {
    set({ isCreatingJob: true, error: null });
    try {
      const res = await api.post("/jobs", data);
      const newJob = res.data as Job;
      set((state) => ({
        jobs: [newJob, ...state.jobs],
        totalCount: state.totalCount + 1,
        isCreatingJob: false,
      }));
      return newJob;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create job";
      set({ isCreatingJob: false, error: message });
      throw new Error(message);
    }
  },

  updateJob: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.patch(`/jobs/${id}`, data);
      const updated = res.data as Job;
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update job";
      set({ error: message });
      throw new Error(message);
    }
  },

  transitionStatus: async (id, status) => {
    set({ error: null });
    try {
      const res = await api.patch(`/jobs/${id}/status`, { status });
      const updated = res.data as Job;
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to transition status";
      set({ error: message });
      throw new Error(message);
    }
  },

  addNote: async (jobId, content, isCustomerVisible = false) => {
    set({ error: null });
    try {
      const res = await api.post(`/jobs/${jobId}/notes`, { content, isCustomerVisible });
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, notes: [...(j.notes ?? []), res.data] }
            : j
        ),
      }));
      return res.data as JobNote;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add note";
      set({ error: message });
      throw new Error(message);
    }
  },

  addPart: async (jobId, data) => {
    set({ error: null });
    try {
      const res = await api.post(`/jobs/${jobId}/parts`, data);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, partsUsed: [...(j.partsUsed ?? []), res.data] }
            : j
        ),
      }));
      return res.data as JobPart;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add part";
      set({ error: message });
      throw new Error(message);
    }
  },

  removePart: async (jobId, partId) => {
    set({ error: null });
    try {
      await api.delete(`/jobs/${jobId}/parts/${partId}`);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, partsUsed: (j.partsUsed ?? []).filter((p) => p.id !== partId) }
            : j
        ),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove part";
      set({ error: message });
    }
  },

  addRepair: async (jobId, data) => {
    set({ error: null });
    try {
      const res = await api.post(`/jobs/${jobId}/repairs`, data);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, repairs: [...(j.repairs ?? []), res.data] }
            : j
        ),
      }));
      return res.data as JobRepair;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add repair";
      set({ error: message });
      throw new Error(message);
    }
  },

  removeRepair: async (jobId, repairId) => {
    set({ error: null });
    try {
      await api.delete(`/jobs/${jobId}/repairs/${repairId}`);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, repairs: (j.repairs ?? []).filter((r) => r.id !== repairId) }
            : j
        ),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove repair";
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
```

---

### Task 2: Create Users Zustand Store

**Files:**
- Create: `src/stores/users.ts`
- Reference: `src/stores/auth.ts` (pattern), `server/routes/users.ts` (API response shapes)

- [ ] **Step 1: Create `src/stores/users.ts`**

```ts
import type { RoleType } from "@shared/constants";
import { create } from "zustand";
import api from "@/lib/api";

interface UserRow {
  createdAt: string;
  email: string;
  id: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: RoleType;
  username: string;
}

interface UsersState {
  users: UserRow[];
  isLoading: boolean;
  error: string | null;

  fetchUsers: () => Promise<void>;
  createUser: (data: {
    username: string;
    email: string;
    password: string;
    role: RoleType;
  }) => Promise<UserRow>;
  toggleUserStatus: (id: string, isActive: boolean) => Promise<void>;
  resetUserPassword: (id: string, password: string) => Promise<void>;
  clearError: () => void;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/users");
      set({ users: res.data, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch users";
      set({ isLoading: false, error: message });
    }
  },

  createUser: async (data) => {
    set({ error: null });
    try {
      const res = await api.post("/users", data);
      const newUser = res.data as UserRow;
      set((state) => ({ users: [newUser, ...state.users] }));
      return newUser;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      set({ error: message });
      throw new Error(message);
    }
  },

  toggleUserStatus: async (id, isActive) => {
    set({ error: null });
    try {
      const res = await api.patch(`/users/${id}/status`, { isActive });
      const updated = res.data as UserRow;
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? updated : u)),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to toggle user status";
      set({ error: message });
      // Optimistic revert
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? { ...u, isActive: !isActive } : u)),
      }));
    }
  },

  resetUserPassword: async (id, password) => {
    set({ error: null });
    try {
      await api.post(`/users/${id}/reset-password`, { password });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));
```

---

### Task 3: Update JobRow Type to Match API Response Shape

**Files:**
- Modify: `src/components/modules/jobs/jobs-shared.ts`

The backend `GET /jobs` returns jobs with this shape (from `listJobs` service):
```ts
{
  jobs: Array<{
    id: string;
    jobCode: string;
    status: JobStatusType;
    estimatedCost: Decimal;
    reportedProblem: string;
    customer: { id: string; name: string; phone: string; ... };
    device: { id: string; brand: string; model: string; ... };
    technician: { id: string; name: string; username: string } | null;
    ...
  }>;
  nextCursor: string | null;
  totalCount: number;
}
```

The `JobRow` type needs to match or we need a mapper function.

- [ ] **Step 1: Update `src/components/modules/jobs/jobs-shared.ts`**

Replace the `JobRow` interface and add a mapping helper:

```ts
import type { JobStatusType } from "@shared/constants";
import type { Job } from "@shared/types";
import { DEVICE_ICONS } from "@shared/constants";

export interface JobRow {
  customer: string;
  customerTier?: string;
  device: string;
  deviceIcon?: string;
  deviceSpec?: string;
  id: string;
  status: JobStatusType;
  technician?: string;
}

const STATUS_GROUP_ACTIVE: JobStatusType[] = ["INTAKE", "IN_REPAIR", "ON_HOLD"];
const STATUS_GROUP_WAITING: JobStatusType[] = ["WAITING_FOR_PARTS", "DONE"];
const STATUS_GROUP_CLOSED: JobStatusType[] = [
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

export const STATUS_GROUPS = [
  {
    key: "active",
    labelKey: "status_group_active",
    statuses: STATUS_GROUP_ACTIVE,
  },
  {
    key: "waiting",
    labelKey: "status_group_waiting",
    statuses: STATUS_GROUP_WAITING,
  },
  {
    key: "closed",
    labelKey: "status_group_closed",
    statuses: STATUS_GROUP_CLOSED,
  },
] as const;

export type StatusGroupKey = (typeof STATUS_GROUPS)[number]["key"];

export function jobToRow(job: Job): JobRow {
  const deviceType = job.device?.brand?.toLowerCase().includes("ipad")
    ? "tablet"
    : job.device?.brand?.toLowerCase().includes("mac") ||
        job.device?.brand?.toLowerCase().includes("laptop")
      ? "laptop"
      : job.device?.brand?.toLowerCase().includes("watch")
        ? "watch"
        : "phone";

  return {
    id: job.jobCode ?? job.id,
    customer: job.customer?.name ?? "",
    device: job.device
      ? `${job.device.brand} ${job.device.model}`
      : "",
    deviceIcon: DEVICE_ICONS[deviceType] ?? deviceType,
    deviceSpec: job.device?.model ?? "",
    status: job.status,
    technician: job.technician?.name,
  };
}
```

---

### Task 4: Wire Up JobsPage to Use Real API Data

**Files:**
- Modify: `src/pages/jobs/index.tsx`

- [ ] **Step 1: Replace mock data with store data in `src/pages/jobs/index.tsx`**

Key changes:
1. Import `useJobsStore` and `jobToRow`
2. Call `fetchJobs()` and `fetchMetrics()` in `useEffect`
3. Replace `MOCK_METRICS` with store `metrics`
4. Replace `MOCK_JOBS` with `jobs.map(jobToRow)`
5. Replace `IntakeModal`'s `onSubmit` with store's `createJob`
6. Add loading/empty states

```tsx
import type { JobStatusType } from "@shared/constants";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";
import { jobToRow } from "@/components/modules/jobs/jobs-shared";
import IntakeModal from "@/components/modules/jobs/intake-modal";
import type { StatusGroupKey } from "@/components/modules/jobs/jobs-shared";
import { STATUS_GROUPS } from "@/components/modules/jobs/jobs-shared";
import type { JobRow } from "@/components/modules/jobs/jobs-table";
import JobsTable from "@/components/modules/jobs/jobs-table";
import JobMobileCard from "@/components/modules/jobs/mobile-card";
import StatusCounter from "@/components/modules/jobs/status-counter";
import type { IntakeFormData } from "@/components/modules/jobs/intake-modal";

export default function JobsPage() {
  const { t } = useTranslation();
  const {
    jobs,
    metrics,
    isLoadingJobs,
    isCreatingJob,
    fetchJobs,
    fetchMetrics,
    createJob,
  } = useJobsStore();
  const [statusFilter, setStatusFilter] = useState<JobStatusType | "ALL">("ALL");
  const [groupFilter, setGroupFilter] = useState<StatusGroupKey | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchMetrics();
  }, [fetchJobs, fetchMetrics]);

  const jobRows: JobRow[] = useMemo(() => jobs.map(jobToRow), [jobs]);

  const filteredJobs = useMemo(() => {
    let result = jobRows;
    if (statusFilter !== "ALL") {
      result = result.filter((j) => j.status === statusFilter);
    } else if (groupFilter !== "ALL") {
      const group = STATUS_GROUPS.find((g) => g.key === groupFilter);
      if (group) {
        result = result.filter((j) => group.statuses.includes(j.status));
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.id.toLowerCase().includes(q) ||
          j.customer.toLowerCase().includes(q) ||
          j.device.toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobRows, statusFilter, groupFilter, searchQuery]);

  const counterData = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: "on_bench", status: "IN_REPAIR" as JobStatusType, value: metrics["IN_REPAIR"] ?? 0 },
      { label: "queue_priority", status: "INTAKE" as JobStatusType, value: metrics["INTAKE"] ?? 0 },
      { label: "awaiting_parts", status: "WAITING_FOR_PARTS" as JobStatusType, value: metrics["WAITING_FOR_PARTS"] ?? 0 },
      { label: "quality_check", status: "DONE" as JobStatusType, value: metrics["DONE"] ?? 0 },
    ];
  }, [metrics]);

  const handleCounterClick = (status: JobStatusType | undefined) => {
    if (!status) return;
    if (statusFilter === status) {
      setStatusFilter("ALL");
      setGroupFilter("ALL");
    } else {
      const parentGroup = STATUS_GROUPS.find((g) => g.statuses.includes(status));
      setStatusFilter(status);
      setGroupFilter(parentGroup?.key ?? "ALL");
    }
  };

  const handleGroupChange = (group: StatusGroupKey | "ALL") => {
    setGroupFilter(group);
    setStatusFilter("ALL");
  };

  const handleIntakeSubmit = async (data: IntakeFormData) => {
    await createJob({
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      deviceBrand: data.brand || data.model,
      deviceModel: data.model,
      color: data.color || undefined,
      reportedProblem: data.reportedProblem,
      conditionNotes: data.conditionNotes || undefined,
      estimatedCost: Number.parseFloat(data.estimatedCost) || 0,
      estimatedDate: data.estimatedDelivery || undefined,
      depositAmount: data.deposit ? Number.parseFloat(data.deposit) : undefined,
    });
    await fetchJobs();
    await fetchMetrics();
  };

  if (isLoadingJobs && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("open_repairs")}
          </h2>
          <p className="mt-1 font-body font-medium text-on-surface-variant text-sm md:text-base">
            {t("open_repairs_desc")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            aria-label={t("download_list")}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-low px-4 py-2.5 font-bold font-headline text-on-surface-variant text-sm transition-all hover:bg-surface-container-high sm:flex-none md:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              file_export
            </span>
            <span className="whitespace-nowrap">{t("download_list")}</span>
          </button>
          <button
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold font-headline text-on-primary text-sm transition-all hover:bg-primary-container sm:flex-none md:px-8"
            onClick={() => setIntakeOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              add_box
            </span>
            <span className="whitespace-nowrap">{t("new_checkin")}</span>
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
        {counterData.map((m, i) => (
          <StatusCounter
            isActive={statusFilter === m.status}
            key={m.label}
            label={t(m.label)}
            onClick={m.status ? () => handleCounterClick(m.status) : undefined}
            primary={i === 0}
            status={m.status}
            value={m.value}
          />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <JobsFilters
          activeGroup={groupFilter}
          activeStatus={statusFilter}
          onGroupChange={handleGroupChange}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          searchQuery={searchQuery}
        />

        <div className="hidden sm:block">
          <JobsTable jobs={filteredJobs} />
        </div>

        <div className="space-y-3 sm:hidden">
          {filteredJobs.map((job) => (
            <JobMobileCard
              customer={job.customer}
              customerTier={job.customerTier}
              device={job.device}
              deviceIcon={job.deviceIcon}
              id={job.id}
              key={job.id}
              status={job.status}
              technician={job.technician}
            />
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined mb-4 text-5xl text-on-surface-variant">
              build
            </span>
            <p className="font-bold font-headline text-on-surface-variant text-sm">
              {t("no_jobs_found")}
            </p>
            <p className="mt-1 font-body text-on-surface-variant text-xs">
              {t("no_jobs_found_desc")}
            </p>
          </div>
        )}
      </section>

      <IntakeModal
        onClose={() => setIntakeOpen(false)}
        onSubmit={handleIntakeSubmit}
        open={intakeOpen}
      />
    </>
  );
}
```

---

### Task 5: Wire Up Owner Dashboard to Use Jobs Metrics

**Files:**
- Modify: `src/pages/dashboard/index.tsx`

- [ ] **Step 1: Replace mock data with store data in `src/pages/dashboard/index.tsx`**

Key changes:
1. Import `useJobsStore`
2. Call `fetchMetrics()` in `useEffect`
3. Replace `MOCK_PIPELINE_COUNTS` with real metrics
4. Replace `MOCK_METRICS` card values with real data
5. Keep `MOCK_FINANCIAL_DATA`, `MOCK_OVERDUE_JOBS`, `MOCK_WARRANTY_RETURNS` as stubs (no backend support yet)

The dashboard metrics card values come from the `/jobs/metrics` endpoint which returns `{ INTAKE: 5, WAITING_FOR_PARTS: 8, ... }`. Map these to the MetricCard props and pipeline counts.

```tsx
import type { JobStatusType } from "@shared/constants";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";
import AiCallout from "@/components/modules/dashboard/ai-callout";
import FinancialTrend from "@/components/modules/dashboard/financial-trend";
import JobPipeline from "@/components/modules/dashboard/job-pipeline";
import OverdueJobs from "@/components/modules/dashboard/overdue-jobs";
import MetricCard from "@/components/ui/metric-card";

// Financial and overdue data will be replaced when dedicated APIs exist
const MOCK_FINANCIAL_DATA = [
  { revenue: 65, cost: 40 },
  { revenue: 70, cost: 45 },
  { revenue: 55, cost: 50 },
  { revenue: 80, cost: 35 },
  { revenue: 90, cost: 55 },
  { revenue: 40, cost: 30 },
  { revenue: 30, cost: 20 },
];

const MOCK_OVERDUE_JOBS = (t: (key: string) => string) => [
  {
    id: "#REP-8821",
    device: "iPhone 14 Pro",
    repair: t("dashboard_page.repair_screen_replace"),
    lateness: t("dashboard_page.hours_late", { hours: 24 }),
  },
  {
    id: "#REP-8835",
    device: "Samsung S23",
    repair: t("dashboard_page.repair_battery_swap"),
    lateness: t("dashboard_page.hours_late", { hours: 4 }),
  },
];

const MOCK_WARRANTY_RETURNS = (t: (key: string) => string) => [
  {
    id: "#WAR-012",
    description: t("dashboard_page.warranty_phantom_touch"),
    priority: t("dashboard_page.high_priority"),
    timeAgo: t("dashboard_page.minutes_ago", { minutes: 10 }),
  },
  {
    id: "#WAR-011",
    description: t("dashboard_page.warranty_charging_port"),
    timeAgo: t("dashboard_page.hours_ago", { hours: 2 }),
  },
];

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
  const { metrics, fetchMetrics } = useJobsStore();

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const pipelineCounts: Record<JobStatusType, number> = useMemo(() => {
    if (!metrics) return EMPTY_PIPELINE;
    return {
      INTAKE: metrics["INTAKE"] ?? 0,
      WAITING_FOR_PARTS: metrics["WAITING_FOR_PARTS"] ?? 0,
      IN_REPAIR: metrics["IN_REPAIR"] ?? 0,
      ON_HOLD: metrics["ON_HOLD"] ?? 0,
      DONE: metrics["DONE"] ?? 0,
      DELIVERED: metrics["DELIVERED"] ?? 0,
      RETURNED: metrics["RETURNED"] ?? 0,
      CANCELLED: metrics["CANCELLED"] ?? 0,
    };
  }, [metrics]);

  const activeJobs = pipelineCounts.INTAKE + pipelineCounts.IN_REPAIR + pipelineCounts.ON_HOLD + pipelineCounts.WAITING_FOR_PARTS;
  const completedToday = pipelineCounts.DONE;

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("shop_overview")}
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
          detail={t("dashboard_page.since_8am", { count: 3 })}
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
          detail=""
          icon="payments"
          iconColor="text-tertiary"
          label={t("revenue_this_month")}
          unit={t("currency_dzd")}
          value="--"
        >
          <div className="flex items-center gap-1 font-bold text-tertiary text-xs">
            <span className="material-symbols-outlined text-[14px]">
              trending_up
            </span>
            -- {t("increase_from_prev")}
          </div>
        </MetricCard>

        <MetricCard
          detail=""
          icon="bar_chart"
          label={t("avg_profit_margin")}
          unit="%"
          value="--"
        >
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                className={`h-1 flex-1 rounded-full ${i <= 3 ? "bg-primary" : "bg-surface-container-highest"}`}
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
          <FinancialTrend data={MOCK_FINANCIAL_DATA} />
          <AiCallout insight={t("ai_insight_mock")} />
        </div>

        <div className="md:col-span-12 lg:col-span-3">
          <OverdueJobs
            jobs={MOCK_OVERDUE_JOBS(t)}
            warrantyReturns={MOCK_WARRANTY_RETURNS(t)}
          />
        </div>
      </div>
    </>
  );
}
```

---

### Task 6: Wire Up Settings Users Tab to Real API

**Files:**
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Add users store integration in `src/pages/settings/index.tsx`**

Key changes:
1. Import `useUsersStore`
2. Call `fetchUsers()` in `useEffect` when `activeTab === "users"`
3. Replace `MOCK_USERS` with store `users`
4. Add loading state for users tab
5. Wire up the "Add User" button to a dialog (or at minimum, a `createUser` call)
6. Wire up status toggle to `toggleUserStatus`

The changes to the settings page are localized to the `renderUsersSection` function and adding state management. Only the relevant snippet changes are shown:

Add imports at the top:
```ts
import { useUsersStore } from "@/stores/users";
```

Add inside `SettingsPage()`:
```ts
const { users, isLoading: isLoadingUsers, fetchUsers } = useUsersStore();
```

Add useEffect for fetching users:
```ts
useEffect(() => {
  if (activeTab === "users") {
    fetchUsers();
  }
}, [activeTab, fetchUsers]);
```

Replace `MOCK_USERS` in `renderUsersSection` with `users` from the store. The user objects from the API have `username`, `email`, `role`, `isActive`, `id` fields which match what the UI already renders.

---

### Task 7: Wire Up Front-Desk and Technician Dashboards

**Files:**
- Modify: `src/pages/dashboard/front-desk.tsx`
- Modify: `src/pages/dashboard/technician.tsx`

**Front-Desk Dashboard (`front-desk.tsx`):**

- [ ] **Step 1: Replace mock data with real jobs data**

Import `useJobsStore` and `jobToRow`. Use `fetchJobs()` in a `useEffect`. Map jobs to `MOCK_REPAIRS` and `MOCK_RECENT_INTAKES` shapes. Keep `MOCK_ALERTS`, `MOCK_WAITING`, and `MOCK_STATS` as stubs since there are no backend endpoints for those yet.

**Technician Dashboard (`technician.tsx`):**

- [ ] **Step 2: Replace mock pipeline counts with real metrics**

Import `useJobsStore`. Use `fetchMetrics()` to get real `MOCK_PIPELINE_COUNTS`. Keep `MOCK_SCHEDULE`, `MOCK_ACTIVITY`, `MOCK_PRIORITY_ACTIONS`, `MOCK_PARTS_ALERTS` as stubs.

---

### Task 8: Run Linter

- [ ] **Step 1: Run `pnpm run lint` and `pnpm run typecheck` to verify code quality**

```bash
pnpm run lint && pnpm run typecheck
```

Expected: No errors. Fix any lint or type errors.

- [ ] **Step 2: Commit all changes**

```bash
git add -A && git commit -m "feat: wire up Jobs API and Users API to frontend

- Create useJobsStore Zustand store for Jobs CRUD, metrics, listing
- Create useUsersStore Zustand store for user management
- Wire JobsPage to real API data (fetchJobs, createJob via IntakeModal)
- Wire Owner Dashboard metrics to GET /jobs/metrics
- Wire Settings users tab to GET /users
- Replace mock data in front-desk and technician dashboards with real data
- Update JobRow type with jobToRow mapper for API response shape"
```