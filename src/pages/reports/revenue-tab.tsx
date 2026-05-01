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
    return <div className="py-12 text-center text-error">{state.error}</div>;
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
            summary.revenueChangePercent === undefined
              ? ""
              : `${summary.revenueChangePercent > 0 ? "+" : ""}${summary.revenueChangePercent}%`
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
              <tr className="border-outline-variant border-b text-on-surface-variant text-xs uppercase tracking-wide">
                <th className="px-4 py-3">{t("reports.jobCode")}</th>
                <th className="px-4 py-3">{t("reports.customer")}</th>
                <th className="px-4 py-3">{t("reports.device")}</th>
                <th className="px-4 py-3 text-end">{t("reports.estCost")}</th>
                <th className="px-4 py-3 text-end">{t("reports.deposit")}</th>
                <th className="px-4 py-3 text-end">{t("reports.partsCost")}</th>
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
                  className="border-outline-variant/50 border-b last:border-0"
                  key={row.jobCode}
                >
                  <td className="px-4 py-3 font-medium font-mono text-on-surface">
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
                      {row.margin === undefined ? "\u2014" : `${row.margin}%`}
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
