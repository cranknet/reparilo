import type { PartCategoryType } from "@shared/constants";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import AddPartModal from "@/components/modules/parts/add-part-modal";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { formatDzd } from "@/lib/format";

type SortField = "name" | "category" | "defaultPrice" | "supplier";

interface MockPart {
  category: PartCategoryType;
  defaultPrice: number;
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  stockMax: number;
  supplier: string;
}

const MOCK_PARTS: MockPart[] = [
  {
    category: "SCREEN",
    defaultPrice: 42_500,
    id: "1",
    name: "Super Retina XDR Display",
    sku: "LCD-IP14-001",
    stockLevel: 42,
    stockMax: 50,
    supplier: "Global Tech Parts",
  },
  {
    category: "BATTERY",
    defaultPrice: 8200,
    id: "2",
    name: "Li-Ion Battery (4323mAh)",
    sku: "BATT-IP14PM-92",
    stockLevel: 3,
    stockMax: 50,
    supplier: "Energetic Logistics",
  },
  {
    category: "OTHER",
    defaultPrice: 1450,
    id: "3",
    name: "Mainboard Flex Cable",
    sku: "FLEX-MB-S22-04",
    stockLevel: 112,
    stockMax: 120,
    supplier: "Component Hub",
  },
  {
    category: "CHARGING_PORT",
    defaultPrice: 6800,
    id: "4",
    name: "USB-C Charging Assembly",
    sku: "CHRG-S23U-07",
    stockLevel: 18,
    stockMax: 40,
    supplier: "Global Tech Parts",
  },
  {
    category: "CAMERA",
    defaultPrice: 22_400,
    id: "5",
    name: "Wide-Angle Camera Module",
    sku: "CAM-IP14P-WA",
    stockLevel: 7,
    stockMax: 30,
    supplier: "OptiSource DZA",
  },
  {
    category: "SPEAKER",
    defaultPrice: 3200,
    id: "6",
    name: "Earpiece Speaker Unit",
    sku: "SPK-EP-IP13-01",
    stockLevel: 56,
    stockMax: 60,
    supplier: "Component Hub",
  },
  {
    category: "MOTHERBOARD",
    defaultPrice: 85_000,
    id: "7",
    name: "Logic Board (A15 Bionic)",
    sku: "MB-IP14-A15",
    stockLevel: 2,
    stockMax: 10,
    supplier: "ShenZhen Direct",
  },
  {
    category: "HOUSING",
    defaultPrice: 18_000,
    id: "8",
    name: "Midframe Assembly",
    sku: "HSG-IP14-MID",
    stockLevel: 24,
    stockMax: 25,
    supplier: "Global Tech Parts",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  BATTERY: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  BUTTON: "bg-secondary-container text-on-secondary-container",
  CAMERA: "bg-primary-fixed text-on-primary-fixed",
  CHARGING_PORT: "bg-secondary-fixed text-on-secondary-fixed-variant",
  HOUSING: "bg-surface-container-high text-on-surface-variant",
  MICROPHONE: "bg-secondary-container text-on-secondary-container",
  MOTHERBOARD: "bg-error-container text-on-error-container",
  OTHER: "bg-surface-container-high text-on-surface-variant",
  SCREEN: "bg-primary-fixed text-on-primary-fixed",
  SPEAKER: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

function getAriaSort(
  currentSortBy: SortField,
  currentSortDir: "asc" | "desc",
  field: SortField
): "ascending" | "descending" | "none" {
  if (currentSortBy !== field) {
    return "none";
  }
  return currentSortDir === "asc" ? "ascending" : "descending";
}

function StockBar({ level, max }: { level: number; max: number }) {
  const pct = Math.round((level / max) * 100);
  let color = "bg-primary";
  if (pct < 10) {
    color = "bg-error";
  } else if (pct < 30) {
    color = "bg-tertiary";
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-bold text-xs">
        <span className={pct < 10 ? "text-error" : "text-on-surface"}>
          {level}
          {pct < 10 && (
            <Icon
              className="ms-1 align-middle text-error"
              name="error"
              size="xs"
            />
          )}
        </span>
        <span className={pct < 10 ? "text-error" : "text-primary"}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div
          aria-label="stock level"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={pct}
          className={`h-full rounded-full ${color} transition-all duration-500`}
          role="progressbar"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td className="px-6 py-5">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-3/5 animate-pulse rounded bg-surface-container-high" />
          <div className="h-2 w-2/5 animate-pulse rounded bg-surface-container-highest" />
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-container-high" />
      </td>
      <td className="px-6 py-5">
        <div className="h-3 w-2/5 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="px-6 py-5">
        <div className="h-3 w-1/4 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="min-w-[160px] px-6 py-5">
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full animate-pulse rounded bg-surface-container-high" />
          <div className="h-1.5 w-3/4 animate-pulse rounded-full bg-surface-container-highest" />
        </div>
      </td>
    </tr>
  );
}

export default function PartsCatalogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeFilter, setActiveFilter] = useState<PartCategoryType | "ALL">(
    "ALL"
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [isLoading] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const lowStockItems = MOCK_PARTS.filter(
    (p) => p.stockLevel / p.stockMax < 0.1
  );
  const lowStockCount = lowStockItems.length;
  const totalValue = MOCK_PARTS.reduce(
    (acc, p) => acc + p.defaultPrice * p.stockLevel,
    0
  );
  const uniqueSuppliers = [...new Set(MOCK_PARTS.map((p) => p.supplier))]
    .length;

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const filtered = MOCK_PARTS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeFilter === "ALL" || p.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === "string" && typeof bv === "string") {
      return mul * av.localeCompare(bv);
    }
    return mul * (Number(av) - Number(bv));
  });

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  const categories: (PartCategoryType | "ALL")[] = [
    "ALL",
    "SCREEN",
    "BATTERY",
    "CHARGING_PORT",
    "CAMERA",
    "SPEAKER",
    "MICROPHONE",
    "MOTHERBOARD",
    "HOUSING",
    "BUTTON",
    "OTHER",
  ];

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("parts_inventory")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("parts_inventory_desc")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            className="hidden min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-bold text-on-surface-variant text-sm transition-all hover:bg-surface-container-highest sm:flex"
            onClick={() => setShowCategoryFilters((prev) => !prev)}
            type="button"
          >
            <Icon name="filter_list" size="sm" />
            <span className="whitespace-nowrap">{t("filters")}</span>
          </button>
          <button
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary text-sm shadow-md shadow-primary/10 transition-all hover:bg-primary/90 active:scale-[0.98] sm:flex-none md:px-8"
            onClick={() => setShowAddModal(true)}
            type="button"
          >
            <Icon name="add" size="sm" />
            <span className="whitespace-nowrap">{t("add_new_part")}</span>
          </button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="mb-6 rounded-2xl bg-error-container/20 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-error-container">
                <Icon className="text-error" name="warning" size="lg" />
              </div>
              <div>
                <p className="font-extrabold font-headline text-lg text-on-surface">
                  {t("low_stock_alerts")} ({lowStockCount})
                </p>
                <p className="text-on-surface-variant text-sm">
                  {t("reorder_recommended")}
                </p>
              </div>
            </div>
            <button
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-error px-5 py-3 font-bold text-on-error text-sm transition-all hover:opacity-90"
              onClick={() => {
                setActiveFilter("ALL");
                setShowCategoryFilters(true);
              }}
              type="button"
            >
              <Icon name="shopping_cart" size="sm" />
              <span>{t("review_low_stock")}</span>
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {lowStockItems.map((part) => (
              <div
                className="flex items-center justify-between rounded-xl bg-error-container/40 px-4 py-3"
                key={part.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 font-bold text-xs uppercase ${CATEGORY_COLORS[part.category] ?? "bg-surface-container-high text-on-surface-variant"}`}
                  >
                    {t(`part_category.${part.category}`)}
                  </span>
                  <span className="truncate font-bold text-on-surface text-sm">
                    {part.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="font-bold text-error text-sm">
                    {part.stockLevel}/{part.stockMax}
                  </span>
                  <button
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-error px-3 py-2 font-bold text-on-error text-xs transition-all hover:opacity-90"
                    type="button"
                  >
                    <Icon name="replay" size="xs" />
                    {t("reorder")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-on-surface-variant text-sm">
          <span className="font-bold text-on-surface">{MOCK_PARTS.length}</span>{" "}
          {t("total_skus")}
          <span className="text-outline-variant">·</span>
          <span className="font-bold text-on-surface">
            {formatDzd(totalValue)}
          </span>{" "}
          {t("currency_dzd")}
          <span className="text-outline-variant">·</span>
          <span className="font-bold text-on-surface">{uniqueSuppliers}</span>{" "}
          {t("active_suppliers")}
        </div>
      </div>

      <div className="mb-5">
        <Input
          iconStart="search"
          id="parts-search"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_parts_placeholder")}
          value={search}
        />
        <div className="mt-2 sm:hidden">
          <div className="relative">
            <select
              aria-label={t("all_categories")}
              className="h-11 w-full appearance-none rounded-xl border-none bg-surface-container-highest px-4 pe-10 text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
              onChange={(e) => {
                setActiveFilter(
                  e.target.value === "ALL"
                    ? "ALL"
                    : (e.target.value as PartCategoryType)
                );
              }}
              value={activeFilter}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "ALL"
                    ? t("all_categories")
                    : t(`part_category.${cat}`)}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {showCategoryFilters && (
        <div className="mb-5 hidden rounded-2xl bg-surface-container-low p-4 sm:block">
          <div className="hide-scrollbar flex flex-wrap items-center gap-2">
            {categories
              .filter((cat) =>
                showAllCategories
                  ? true
                  : cat === "ALL" || categories.indexOf(cat) <= 4
              )
              .map((cat) => {
                const isActive = activeFilter === cat;
                return (
                  <button
                    aria-pressed={isActive}
                    className={`min-h-[44px] shrink-0 rounded-full px-4 py-2.5 font-bold text-xs uppercase tracking-wide transition-all ${
                      isActive
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    type="button"
                  >
                    {cat === "ALL"
                      ? t("all_categories")
                      : t(`part_category.${cat}`)}
                  </button>
                );
              })}
            {!showAllCategories && categories.length > 5 && (
              <button
                className="min-h-[44px] shrink-0 rounded-full px-4 py-2.5 font-bold text-primary text-xs uppercase tracking-wide transition-all hover:bg-surface-container-high"
                onClick={() => setShowAllCategories(true)}
                type="button"
              >
                {t("show_more")}
              </button>
            )}
            {showAllCategories && (
              <button
                className="min-h-[44px] shrink-0 rounded-full px-4 py-2.5 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-all hover:bg-surface-container-high"
                onClick={() => setShowAllCategories(false)}
                type="button"
              >
                {t("show_less")}
              </button>
            )}
          </div>
        </div>
      )}

      {!showCategoryFilters && activeFilter !== "ALL" && (
        <div className="mb-5 hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-primary px-3 py-1 font-bold text-on-primary text-xs uppercase">
            {t(`part_category.${activeFilter}`)}
          </span>
          <button
            className="flex min-h-[44px] items-center gap-1 rounded-full px-2 py-1 text-on-surface-variant text-xs transition-all hover:text-on-surface"
            onClick={() => setActiveFilter("ALL")}
            type="button"
          >
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      {sorted.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-low">
            <Icon
              className="text-on-surface-variant"
              name="search_off"
              size="xl"
            />
          </div>
          <p className="font-bold font-headline text-lg text-on-surface">
            {t("no_parts_found")}
          </p>
          <p className="mt-1 text-on-surface-variant text-sm">
            {t("try_different_search")}
          </p>
        </div>
      )}

      {(sorted.length > 0 || isLoading) && (
        <div className="overflow-hidden rounded-2xl bg-surface-container-low">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th
                    aria-sort={getAriaSort(sortBy, sortDir, "name")}
                    className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
                    onClick={() => toggleSort("name")}
                  >
                    {t("part_details")}
                    {sortBy === "name" && (
                      <Icon
                        className="ms-1 align-middle text-primary"
                        name={
                          sortDir === "asc" ? "arrow_upward" : "arrow_downward"
                        }
                        size="xs"
                      />
                    )}
                  </th>
                  <th
                    aria-sort={getAriaSort(sortBy, sortDir, "category")}
                    className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
                    onClick={() => toggleSort("category")}
                  >
                    {t("category")}
                    {sortBy === "category" && (
                      <Icon
                        className="ms-1 align-middle text-primary"
                        name={
                          sortDir === "asc" ? "arrow_upward" : "arrow_downward"
                        }
                        size="xs"
                      />
                    )}
                  </th>
                  <th
                    aria-sort={getAriaSort(sortBy, sortDir, "supplier")}
                    className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
                    onClick={() => toggleSort("supplier")}
                  >
                    {t("supplier")}
                    {sortBy === "supplier" && (
                      <Icon
                        className="ms-1 align-middle text-primary"
                        name={
                          sortDir === "asc" ? "arrow_upward" : "arrow_downward"
                        }
                        size="xs"
                      />
                    )}
                  </th>
                  <th
                    aria-sort={getAriaSort(sortBy, sortDir, "defaultPrice")}
                    className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
                    onClick={() => toggleSort("defaultPrice")}
                  >
                    {t("unit_cost")}
                    {sortBy === "defaultPrice" && (
                      <Icon
                        className="ms-1 align-middle text-primary"
                        name={
                          sortDir === "asc" ? "arrow_upward" : "arrow_downward"
                        }
                        size="xs"
                      />
                    )}
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                    {t("stock_level")}
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                    {t("manage")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={`skeleton-${String(i)}`} />
                    ))
                  : sorted.map((part) => {
                      const stockPct = Math.round(
                        (part.stockLevel / part.stockMax) * 100
                      );
                      const isLow = stockPct < 10;
                      return (
                        <tr
                          className={`transition-colors hover:bg-surface-container-lowest ${isLow ? "bg-error-container/20" : ""}`}
                          key={part.id}
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-on-surface text-sm">
                                {part.name}
                              </span>
                              <span className="font-mono text-[11px] text-outline tracking-tight">
                                {part.sku}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 font-bold text-xs uppercase ${CATEGORY_COLORS[part.category] ?? "bg-surface-container-high text-on-surface-variant"}`}
                            >
                              {t(`part_category.${part.category}`)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-on-surface-variant text-sm">
                              {part.supplier}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-mono font-semibold text-sm">
                              {formatDzd(part.defaultPrice)} {t("currency_dzd")}
                            </span>
                          </td>
                          <td className="min-w-[160px] px-6 py-5">
                            <StockBar
                              level={part.stockLevel}
                              max={part.stockMax}
                            />
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1">
                              <button
                                aria-label={t("edit_part")}
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-outline transition-colors hover:bg-surface-container-high hover:text-primary"
                                type="button"
                              >
                                <Icon name="edit" size="sm" />
                              </button>
                              {isLow && (
                                <button
                                  aria-label={t("reorder")}
                                  className="flex h-11 items-center gap-1.5 rounded-xl bg-error px-3 font-bold text-on-error text-xs transition-all hover:opacity-90"
                                  type="button"
                                >
                                  <Icon name="replay" size="xs" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {isLoading ? (
              <div className="p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    className="flex flex-col gap-3 py-4"
                    key={`mobile-skeleton-${String(i)}`}
                  >
                    <div className="h-3 w-3/5 animate-pulse rounded bg-surface-container-high" />
                    <div className="h-2 w-2/5 animate-pulse rounded bg-surface-container-highest" />
                    <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-container-highest" />
                  </div>
                ))}
              </div>
            ) : (
              sorted.map((part) => {
                const stockPct = Math.round(
                  (part.stockLevel / part.stockMax) * 100
                );
                const isLow = stockPct < 10;
                return (
                  <div
                    className={`p-4 ${isLow ? "bg-error-container/20" : ""}`}
                    key={part.id}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface text-sm">
                          {part.name}
                        </h3>
                        <span className="font-mono text-[11px] text-outline">
                          {part.sku}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 font-bold text-xs uppercase ${CATEGORY_COLORS[part.category] ?? "bg-surface-container-high text-on-surface-variant"}`}
                      >
                        {t(`part_category.${part.category}`)}
                      </span>
                    </div>
                    <div className="mb-3">
                      <StockBar level={part.stockLevel} max={part.stockMax} />
                    </div>
                    <div className="flex items-end justify-between">
                      <span
                        className={`font-bold text-xs uppercase tracking-wide ${isLow ? "text-error" : "text-on-surface-variant"}`}
                      >
                        {isLow ? t("low_stock") : t("stock_level")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-primary text-sm">
                          {formatDzd(part.defaultPrice)} {t("currency_dzd")}
                        </span>
                      </div>
                    </div>
                    <div className="-mx-1 mt-3 flex items-center gap-2 rounded-xl bg-surface-container-lowest px-1 py-1">
                      <button
                        aria-label={t("edit_part")}
                        className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                        type="button"
                      >
                        <Icon name="edit" size="sm" />
                        <span className="text-xs">{t("edit")}</span>
                      </button>
                      {isLow && (
                        <button
                          aria-label={t("reorder")}
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-error font-bold text-on-error text-xs transition-all hover:opacity-90"
                          type="button"
                        >
                          <Icon name="replay" size="xs" />
                          <span>{t("reorder")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPartModal
          onClose={() => setShowAddModal(false)}
          onSubmit={(_data) => {
            setShowAddModal(false);
            showToast(t("part_added_successfully"));
          }}
        />
      )}

      {toast && (
        <div
          aria-live="polite"
          className="fixed end-6 bottom-6 z-50 flex animate-[fadeSlideUp_0.3s_ease-out] items-center gap-2 rounded-2xl bg-on-surface px-5 py-3 font-bold text-on-primary text-sm shadow-2xl"
          role="status"
        >
          <Icon name="check_circle" size="sm" />
          {toast}
        </div>
      )}
    </>
  );
}
