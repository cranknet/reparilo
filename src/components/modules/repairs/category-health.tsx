import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { RepairItem } from "./repair-table";

const FALLBACK_CATEGORIES = [
  { color: "bg-primary", key: "HARDWARE", pct: 65 },
  { color: "bg-tertiary", key: "SOFTWARE", pct: 20 },
  { color: "bg-secondary", key: "DIAGNOSTIC", pct: 15 },
];

const CATEGORY_COLORS: Record<string, string> = {
  HARDWARE: "bg-primary",
  SOFTWARE: "bg-tertiary",
  DIAGNOSTIC: "bg-secondary",
};

interface CategoryHealthProps {
  repairs?: RepairItem[];
}

export default function CategoryHealth({ repairs }: CategoryHealthProps) {
  const { t } = useTranslation();

  const categories = useMemo(() => {
    if (!repairs) {
      return FALLBACK_CATEGORIES;
    }
    const total = repairs.length;
    if (total === 0) {
      return FALLBACK_CATEGORIES;
    }
    const counts: Record<string, number> = {};
    for (const r of repairs) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([key, count]) => ({
        color: CATEGORY_COLORS[key] ?? "bg-primary",
        key,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [repairs]);

  return (
    <div className="rounded-2xl bg-surface-container-high p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-extrabold font-headline text-lg text-on-surface">
          {t("service_breakdown")}
        </h3>
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-on-surface-variant"
        >
          stacked_bar_chart
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {categories.map((cat) => (
          <div key={cat.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-bold text-on-surface text-sm">
                {t(`repair_category.${cat.key}`)}
              </span>
              <span className="font-bold text-on-surface-variant text-xs">
                {cat.pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className={`h-full rounded-full ${cat.color} transition-all duration-700`}
                style={{ width: `${cat.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-3 font-bold font-headline text-on-surface-variant text-xs uppercase tracking-wider transition-all hover:bg-surface-container-lowest"
        type="button"
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[18px]"
        >
          download
        </span>
        {t("download_service_report")}
      </button>
    </div>
  );
}
