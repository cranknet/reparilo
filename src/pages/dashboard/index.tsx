import type { JobStatusType } from "@shared/constants";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import AiCallout from "@/components/modules/dashboard/ai-callout";
import FinancialTrend from "@/components/modules/dashboard/financial-trend";
import JobPipeline from "@/components/modules/dashboard/job-pipeline";
import MetricCard from "@/components/modules/dashboard/metric-card";
import OverdueJobs from "@/components/modules/dashboard/overdue-jobs";

const MOCK_PIPELINE_COUNTS: Record<JobStatusType, number> = {
  INTAKE: 5,
  WAITING_FOR_PARTS: 8,
  IN_REPAIR: 7,
  ON_HOLD: 2,
  DONE: 2,
  DELIVERED: 0,
  RETURNED: 0,
  CANCELLED: 0,
};

const MOCK_FINANCIAL_DATA = [
  { revenue: 65, cost: 40 },
  { revenue: 70, cost: 45 },
  { revenue: 55, cost: 50 },
  { revenue: 80, cost: 35 },
  { revenue: 90, cost: 55 },
  { revenue: 40, cost: 30 },
  { revenue: 30, cost: 20 },
];

const MOCK_OVERDUE_JOBS = (t: TFunction) => [
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

const MOCK_WARRANTY_RETURNS = (t: TFunction) => [
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

export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("shop_intelligence")}
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
            <span className="whitespace-nowrap">{t("new_intake")}</span>
          </button>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        <MetricCard
          detail={t("dashboard_page.since_8am", { count: 3 })}
          icon="precision_manufacturing"
          label={t("active_jobs")}
          value="24"
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
          value="12"
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-4/5 bg-on-secondary-container" />
          </div>
        </MetricCard>

        <MetricCard
          detail=""
          icon="payments"
          iconColor="text-tertiary"
          label={t("revenue_mtd")}
          unit="DZD"
          value="452,000"
        >
          <div className="flex items-center gap-1 font-bold text-tertiary text-xs">
            <span className="material-symbols-outlined text-[14px]">
              trending_up
            </span>
            12% {t("increase_from_prev")}
          </div>
        </MetricCard>

        <MetricCard
          detail=""
          icon="bar_chart"
          label={t("avg_profit_margin")}
          unit="%"
          value="38.4"
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
          <JobPipeline benchCapacity={82} counts={MOCK_PIPELINE_COUNTS} />
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
