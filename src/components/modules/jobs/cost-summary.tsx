import { useTranslation } from "react-i18next";
import { Can } from "@/components/modules/can";
import { formatDzd } from "@/lib/format";

function fmt(n: number): string {
  return `${formatDzd(n)} DZD`;
}

interface CostSummaryProps {
  deposit: number;
  finalCost: number;
  margin?: number;
  partsTotal: number;
  repairsTotal: number;
}

export default function CostSummary({
  deposit,
  finalCost,
  partsTotal,
  repairsTotal,
  margin,
}: CostSummaryProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-surface-container p-6">
      <h2 className="mb-4 font-bold font-headline text-base text-on-surface">
        {t("jobs_detail_cost_summary")}
      </h2>
      <div className="space-y-2">
        <Can perm={{ parts: ["viewCost"] }}>
          <div className="flex justify-between">
            <span className="font-body text-on-surface-variant text-sm">
              {t("jobs_detail_parts_subtotal")}
            </span>
            <span className="font-body font-medium text-on-surface text-sm">
              {fmt(partsTotal)}
            </span>
          </div>
        </Can>
        <div className="flex justify-between">
          <span className="font-body text-on-surface-variant text-sm">
            {t("jobs_detail_repairs_subtotal")}
          </span>
          <span className="font-body font-medium text-on-surface text-sm">
            {fmt(repairsTotal)}
          </span>
        </div>
        {deposit > 0 && (
          <div className="flex justify-between">
            <span className="font-body text-on-surface-variant text-sm">
              {t("jobs_detail_deposit")}
            </span>
            <span className="font-body font-medium text-on-surface text-sm">
              -{fmt(deposit)}
            </span>
          </div>
        )}
        <div className="border-outline-variant border-t pt-2">
          <div className="flex justify-between">
            <span className="font-bold font-headline text-on-surface text-sm">
              {t("jobs_detail_final_cost")}
            </span>
            <span className="font-extrabold font-headline text-lg text-primary">
              {fmt(finalCost)}
            </span>
          </div>
        </div>
        {margin !== undefined && (
          <div className="border-outline-variant border-t pt-2">
            <div className="flex justify-between">
              <span className="font-bold font-headline text-on-surface text-sm">
                {t("jobs_detail_margin")}
              </span>
              <span
                className={`font-extrabold font-headline text-lg ${margin >= 0 ? "text-primary" : "text-error"}`}
              >
                {margin >= 0 ? "+" : ""}
                {fmt(margin)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
