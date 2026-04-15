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
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
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
  onSearchChange,
  onSortChange,
  searchQuery,
}: RepairFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="relative shrink-0">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            className="rounded-xl bg-surface-container-high px-4 py-2.5 pl-10 font-body text-on-surface text-sm outline-none placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary/20"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("search_repairs")}
            type="text"
            value={searchQuery}
          />
        </div>
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
          aria-label={t("sort_by")}
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
