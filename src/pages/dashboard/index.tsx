import type { JobStatusType } from "@shared/constants";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import AiCallout from "@/components/modules/dashboard/ai-callout";
import FinancialTrend from "@/components/modules/dashboard/financial-trend";
import JobPipeline from "@/components/modules/dashboard/job-pipeline";
import OverdueJobs from "@/components/modules/dashboard/overdue-jobs";
import MetricCard from "@/components/ui/metric-card";
import { useCan } from "@/hooks/use-can";
import { useAuthStore } from "@/stores/auth";
import { useDashboardStore } from "@/stores/dashboard";
import { useUiStore } from "@/stores/ui";

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
  const openIntakeModal = useUiStore((s) => s.openIntakeModal);
  const canCreateJob = useCan({ jobs: ["create"] });

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const pipelineCounts: Record<JobStatusType, number> =
    data?.pipeline ?? EMPTY_PIPELINE;
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none md:px-8"
            disabled={!canCreateJob}
            onClick={() => openIntakeModal()}
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
                  i <=
                  Math.round(
                    data?.avgProfitMargin ? data.avgProfitMargin * 5 : 0
                  )
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
