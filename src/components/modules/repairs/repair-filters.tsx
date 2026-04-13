import { useTranslation } from "react-i18next";
import type { RepairCategory } from "./repair-table";

export type SortOption =
  | "recently_added"
  | "price_low_high"
  | "price_high_low"
  | "az";

interface RepairFiltersProps {
  activeCategory: RepairCategory | "ALL";
  activeSort: SortOption;
  onCategoryChange: (category: RepairCategory | "ALL") => void;
  onSortChange: (sort: SortOption) => void;
}

const CATEGORIES: (RepairCategory | "ALL")[] = [
  "ALL",
  "HARDWARE",
  "SOFTWARE",
  "DIAGNOSTIC",
];

const SORT_OPTIONS: { key: SortOption; labelKey: string }[] = [
  { key: "recently_added", labelKey: "recently_added" },
  { key: "price_low_high", labelKey: "price_low_high" },
  { key: "price_high_low", labelKey: "price_high_low" },
  { key: "az", labelKey: "sort_az" },
];

export default function RepairFilters({
  activeCategory,
  activeSort,
  onCategoryChange,
  onSortChange,
}: RepairFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {CATEGORIES.map((cat) => (
          <button
            className={`shrink-0 rounded-full px-4 py-2 font-bold font-headline text-xs uppercase tracking-wide transition-all ${
              activeCategory === cat
                ? "bg-primary text-white"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
            key={cat}
            onClick={() => onCategoryChange(cat)}
            type="button"
          >
            {cat === "ALL" ? t("all_repairs") : t(`repair_category.${cat}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-on-surface-variant">
          sort
        </span>
        <select
          className="rounded-xl bg-surface-container-highest px-3 py-2 font-bold font-headline text-on-surface text-xs uppercase tracking-wide outline-none transition-colors focus:bg-surface-container"
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          value={activeSort}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
