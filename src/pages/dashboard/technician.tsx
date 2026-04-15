import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import PartsAlert from "@/components/modules/dashboard/parts-alert";
import PriorityActions from "@/components/modules/dashboard/priority-actions";
import RecentActivity from "@/components/modules/dashboard/recent-activity";
import TechJobPipeline from "@/components/modules/dashboard/tech-job-pipeline";
import TodaySchedule from "@/components/modules/dashboard/today-schedule";
import MetricCard from "@/components/ui/metric-card";

const MOCK_PIPELINE_COUNTS: Record<JobStatusType, number> = {
  INTAKE: 1,
  WAITING_FOR_PARTS: 3,
  IN_REPAIR: 2,
  ON_HOLD: 0,
  DONE: 4,
  DELIVERED: 0,
  RETURNED: 0,
  CANCELLED: 0,
};

const MOCK_SCHEDULE = (t: (key: string) => string) => [
  {
    customerName: "Ahmed B.",
    device: "iPhone 14 Pro",
    id: "#REP-0124",
    repairType: t("dashboard_page.repair_screen_replace"),
    status: "IN_REPAIR",
    time: "09:00",
  },
  {
    customerName: "Sarah K.",
    device: "Samsung S21",
    id: "#REP-0128",
    repairType: t("dashboard_page.repair_battery_swap"),
    status: "WAITING_FOR_PARTS",
    time: "11:30",
  },
  {
    customerName: "Michael R.",
    device: "iPad Air Gen 4",
    id: "#REP-0131",
    repairType: t("tech_dashboard.repair_port_cleaning"),
    status: "INTAKE",
    time: "14:00",
  },
];

const MOCK_ACTIVITY = [
  {
    icon: "task_alt",
    iconColor: "bg-secondary/10 text-secondary",
    id: "#REP-0120",
    textKey: "tech_dashboard.activity_marked_done",
    timeAgo: "15 min ago",
  },
  {
    icon: "local_shipping",
    iconColor: "bg-tertiary/10 text-tertiary",
    id: "#REP-0128",
    textKey: "tech_dashboard.activity_part_requested",
    timeAgo: "1 hour ago",
  },
];

const MOCK_PRIORITY_ACTIONS = [
  {
    count: 3,
    labelKey: "tech_dashboard.jobs_need_status",
    variant: "default" as const,
  },
  {
    count: 1,
    labelKey: "tech_dashboard.job_overdue_deadline",
    variant: "warning" as const,
  },
  {
    count: 2,
    labelKey: "tech_dashboard.parts_requests_pending",
    variant: "default" as const,
  },
];

const MOCK_PARTS_ALERTS = [
  { name: "iPhone 15 Battery", quantity: 2, stockLevel: 15, threshold: 3 },
  { name: "Samsung S23 Screen", quantity: 0, stockLevel: 10, threshold: 2 },
  { name: "USB-C Port (A1)", quantity: 5, stockLevel: 12, threshold: 3 },
];

export default function TechnicianDashboardPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("tech_dashboard.title")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("tech_dashboard.subtitle")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-2.5 font-bold font-headline text-on-secondary-fixed-variant text-sm transition-all hover:bg-surface-container-high sm:flex-none md:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              monitoring
            </span>
            <span className="whitespace-nowrap">
              {t("tech_dashboard.my_performance")}
            </span>
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 font-bold font-headline text-on-primary text-sm shadow-lg shadow-primary/20 transition-all hover:opacity-90 sm:flex-none md:px-8"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              swap_horiz
            </span>
            <span className="whitespace-nowrap">
              {t("tech_dashboard.update_job_status")}
            </span>
          </button>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        <MetricCard
          detail={t("dashboard_page.since_8am", { count: 2 })}
          icon="precision_manufacturing"
          label={t("tech_dashboard.my_active_jobs")}
          value="6"
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-2/3 bg-primary" />
          </div>
          <span className="mt-2 block font-bold text-primary text-xs">
            66% {t("tech_dashboard.load")}
          </span>
        </MetricCard>

        <MetricCard
          detail={`${t("target")}: 7`}
          icon="check_circle"
          iconColor="text-on-secondary-container"
          label={t("completed_today")}
          value="4"
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-3/5 bg-on-secondary-container" />
          </div>
        </MetricCard>

        <MetricCard
          detail=""
          icon="inventory_2"
          iconColor="text-tertiary"
          label={t("tech_dashboard.waiting_for_parts")}
          value="3"
        >
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div className="h-2 w-2 rounded-full bg-tertiary" key={i} />
            ))}
          </div>
          <p className="mt-3 font-bold text-tertiary text-xs">
            {t("tech_dashboard.one_arriving_today")}
          </p>
        </MetricCard>

        <MetricCard
          detail={`${t("target")}: 2h`}
          icon="timer"
          iconColor="text-primary-container"
          label={t("tech_dashboard.avg_repair_time")}
          unit="h"
          value="2.4"
        >
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                className={`h-1 flex-1 rounded-full ${i <= 4 ? "bg-tertiary" : "bg-surface-container-highest"}`}
                key={i}
              />
            ))}
          </div>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-12 lg:col-span-4">
          <TechJobPipeline
            benchCapacity={50}
            benchTotal={4}
            benchUsed={2}
            counts={MOCK_PIPELINE_COUNTS}
          />
        </div>

        <div className="space-y-8 md:col-span-12 lg:col-span-5">
          <TodaySchedule items={MOCK_SCHEDULE(t)} />
          <RecentActivity items={MOCK_ACTIVITY} />
        </div>

        <div className="space-y-6 md:col-span-12 lg:col-span-3">
          <PriorityActions actions={MOCK_PRIORITY_ACTIONS} />
          <PartsAlert items={MOCK_PARTS_ALERTS} />
        </div>
      </div>
    </>
  );
}
