import {
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  type JobStatusType,
} from "@shared/constants";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActiveRepairsQueue from "@/components/modules/dashboard/active-repairs-queue";
import PriorityAlertsPanel from "@/components/modules/dashboard/priority-alerts-panel";
import QuickIntakeForm from "@/components/modules/dashboard/quick-intake-form";
import QuickStatsChips from "@/components/modules/dashboard/quick-stats-chips";
import TodayOverview from "@/components/modules/dashboard/today-overview";
import WaitingCustomers from "@/components/modules/dashboard/waiting-customers";
import { useJobsStore } from "@/stores/jobs";

/** Format a date as a relative time string (e.g. "5m ago", "2h ago") */
function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return `${diffH}h ago`;
  }
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

/** Format a date for display as an estimated completion or completed-at string */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const MOCK_ALERTS = [
  {
    id: "alert-overdue",
    icon: "warning",
    title: "2 Repairs Overdue",
    description: "Action required immediately",
    variant: "error" as const,
  },
  {
    id: "alert-parts",
    icon: "inventory_2",
    title: "Parts Arrived",
    description: "Screen for #8812 arrived",
    variant: "secondary" as const,
  },
  {
    id: "alert-warranty",
    icon: "history",
    title: "Warranty Return",
    description: "Customer: Jordan Bates",
    variant: "tertiary" as const,
  },
];

const MOCK_WAITING = [
  { id: "w-1", initials: "BT", name: "Ben Thompson", waitMinutes: 12 },
  { id: "w-2", initials: "MK", name: "Maria Khan", waitMinutes: 5 },
];

export default function FrontDeskPage() {
  const { t } = useTranslation();
  const { jobs, isLoadingJobs, fetchJobs } = useJobsStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Map real jobs to the shape expected by ActiveRepairsQueue
  const activeRepairs = useMemo(() => {
    const isCompleted = (s: JobStatusType) =>
      COMPLETED_STATUSES.includes(s) || s === "CANCELLED";
    return jobs
      .filter(
        (j) => ACTIVE_STATUSES.includes(j.status) || isCompleted(j.status)
      )
      .map((j) => ({
        id: j.jobCode,
        deviceModel: `${j.device.brand} ${j.device.model}`,
        customerName: j.customer.name,
        status: j.status,
        estimatedCompletion: j.estimatedDate
          ? formatDate(j.estimatedDate)
          : undefined,
        completedAt:
          COMPLETED_STATUSES.includes(j.status) && j.updatedAt
            ? timeAgo(j.updatedAt)
            : undefined,
        technician: j.technician?.name ?? "Unassigned",
      }));
  }, [jobs]);

  // Recent intakes: latest 3 jobs with INTAKE status
  const recentIntakes = useMemo(() => {
    return jobs
      .filter((j) => j.status === "INTAKE")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 3)
      .map((j) => ({
        id: j.jobCode,
        device: `${j.device.brand} ${j.device.model}`,
        status: j.status,
        timeAgo: timeAgo(j.createdAt),
      }));
  }, [jobs]);

  // Today's overview counts derived from jobs created today
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const { completedToday, totalToday } = useMemo(() => {
    const todayJobs = jobs.filter(
      (j) => new Date(j.createdAt).getTime() >= todayStart
    );
    const completed = todayJobs.filter((j) =>
      COMPLETED_STATUSES.includes(j.status)
    ).length;
    return { completedToday: completed, totalToday: todayJobs.length };
  }, [jobs, todayStart]);

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
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("front_desk.title")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("front_desk.subtitle")}
          </p>
        </div>
      </div>

      <section className="mb-8 space-y-2">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-2.5 font-semibold text-on-surface-variant transition-colors hover:bg-secondary-fixed-dim hover:text-on-secondary-fixed sm:flex-row sm:justify-center sm:gap-2 sm:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            <span className="text-[10px] leading-tight sm:text-xs sm:leading-normal">
              {t("front_desk.walk_in_lookup")}
            </span>
          </button>
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-2.5 font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:flex-row sm:justify-center sm:gap-2 sm:px-4"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            <span className="text-[10px] leading-tight sm:text-xs sm:leading-normal">
              {t("front_desk.print_receipt")}
            </span>
          </button>
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-2.5 font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:flex-row sm:justify-center sm:gap-2 sm:px-4"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">summarize</span>
            <span className="text-[10px] leading-tight sm:text-xs sm:leading-normal">
              {t("daily_summary")}
            </span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-5">
          <ActiveRepairsQueue jobs={activeRepairs} />
        </div>

        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-4">
          <TodayOverview
            completedToday={completedToday}
            recentIntakes={recentIntakes}
            totalToday={totalToday}
          />
          <QuickIntakeForm />
        </div>

        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-3">
          <PriorityAlertsPanel alerts={MOCK_ALERTS} />
          <WaitingCustomers customers={MOCK_WAITING} />
          <QuickStatsChips
            stats={[
              { labelKey: "front_desk.mttr", value: "2.4", unit: "h" },
              { labelKey: "front_desk.csat", value: "4.9" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
