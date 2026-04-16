import type { PartCategoryType } from "@shared/constants";
import { PartCategory } from "@shared/constants";
import type { PartsCatalog } from "@shared/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AddPartModal from "@/components/modules/parts/add-part-modal";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { formatDzd } from "@/lib/format";
import { usePartsCatalogStore } from "@/stores/parts-catalog";

type SortField = "name" | "category" | "defaultPrice" | "supplier";

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

const CATEGORIES: (PartCategoryType | "ALL")[] = [
  "ALL",
  ...Object.values(PartCategory),
];

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
      <td className="px-6 py-5">
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-container-high" />
      </td>
      <td className="px-6 py-5">
        <div className="h-8 w-8 animate-pulse rounded-xl bg-surface-container-high" />
      </td>
    </tr>
  );
}

function DesktopPartRow({
  onToggle,
  part,
  t,
  togglingId,
}: {
  onToggle: (part: PartsCatalog) => void;
  part: PartsCatalog;
  t: (key: string) => string;
  togglingId: string | null;
}) {
  const isActive = part.isActive;
  const rowCls = isActive
    ? "transition-colors hover:bg-surface-container-lowest"
    : "bg-surface-container/50 opacity-60 transition-colors hover:bg-surface-container-lowest";
  const nameCls = isActive
    ? "font-bold text-on-surface text-sm"
    : "font-bold line-through text-on-surface text-sm";
  const statusBadgeCls = isActive
    ? "bg-primary-container text-on-primary-container"
    : "bg-surface-container-high text-on-surface-variant";
  const toggleBtnCls = isActive
    ? "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
    : "text-primary hover:bg-primary-container";

  return (
    <tr className={rowCls}>
      <td className="px-6 py-5">
        <div className="flex flex-col">
          <span className={nameCls}>{part.name}</span>
          <span className="font-mono text-[11px] text-outline tracking-tight">
            {part.id.slice(0, 8)}
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
          {part.supplier ?? "\u2014"}
        </span>
      </td>
      <td className="px-6 py-5">
        <span className="font-mono font-semibold text-sm">
          {formatDzd(Number(part.defaultPrice))} {t("currency_dzd")}
        </span>
      </td>
      <td className="px-6 py-5">
        <span
          className={`rounded-full px-3 py-1 font-bold text-xs ${statusBadgeCls}`}
        >
          {isActive ? t("active") : t("inactive")}
        </span>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-1">
          <button
            aria-label={isActive ? t("deactivate_part") : t("activate_part")}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${toggleBtnCls}`}
            disabled={togglingId === part.id}
            onClick={() => onToggle(part)}
            type="button"
          >
            <Icon name={isActive ? "toggle_on" : "toggle_off"} size="sm" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobilePartCard({
  onToggle,
  part,
  t,
  togglingId,
}: {
  onToggle: (part: PartsCatalog) => void;
  part: PartsCatalog;
  t: (key: string) => string;
  togglingId: string | null;
}) {
  const isActive = part.isActive;
  const cardCls = isActive ? "p-4" : "bg-surface-container/50 opacity-60 p-4";
  const nameCls = isActive
    ? "font-bold text-on-surface text-sm"
    : "font-bold line-through text-on-surface text-sm";
  const statusBadgeCls = isActive
    ? "bg-primary-container text-on-primary-container"
    : "bg-surface-container-high text-on-surface-variant";
  const toggleBtnCls = isActive
    ? "flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl font-bold text-on-surface-variant text-xs transition-all hover:bg-surface-container-high hover:text-primary"
    : "flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl font-bold text-primary text-xs transition-all hover:bg-primary-container";

  return (
    <div className={cardCls}>
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0">
          <h3 className={nameCls}>{part.name}</h3>
          <span className="font-mono text-[11px] text-outline">
            {part.id.slice(0, 8)}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-bold text-xs uppercase ${CATEGORY_COLORS[part.category] ?? "bg-surface-container-high text-on-surface-variant"}`}
        >
          {t(`part_category.${part.category}`)}
        </span>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 font-bold text-xs ${statusBadgeCls}`}
        >
          {isActive ? t("active") : t("inactive")}
        </span>
        <span className="font-bold font-mono text-primary text-sm">
          {formatDzd(Number(part.defaultPrice))} {t("currency_dzd")}
        </span>
      </div>
      <div className="-mx-1 flex items-center gap-2 rounded-xl bg-surface-container-lowest px-1 py-1">
        {part.supplier && (
          <span className="flex-1 px-3 py-2 text-on-surface-variant text-xs">
            {part.supplier}
          </span>
        )}
        <button
          aria-label={isActive ? t("deactivate_part") : t("activate_part")}
          className={toggleBtnCls}
          disabled={togglingId === part.id}
          onClick={() => onToggle(part)}
          type="button"
        >
          <Icon name={isActive ? "toggle_on" : "toggle_off"} size="sm" />
          <span>{isActive ? t("deactivate_part") : t("activate_part")}</span>
        </button>
      </div>
    </div>
  );
}

function CategoryFilterPills({
  activeFilter,
  onFilterChange,
  showAllCategories,
  onToggleAll,
  t,
}: {
  activeFilter: PartCategoryType | "ALL";
  onFilterChange: (cat: PartCategoryType | "ALL") => void;
  onToggleAll: (show: boolean) => void;
  showAllCategories: boolean;
  t: (key: string) => string;
}) {
  const visibleCats = CATEGORIES.filter(
    (cat) => showAllCategories || cat === "ALL" || CATEGORIES.indexOf(cat) <= 4
  );

  return (
    <div className="hide-scrollbar flex flex-wrap items-center gap-2">
      {visibleCats.map((cat) => {
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
            onClick={() => onFilterChange(cat)}
            type="button"
          >
            {cat === "ALL" ? t("all_categories") : t(`part_category.${cat}`)}
          </button>
        );
      })}
      {!showAllCategories && CATEGORIES.length > 5 && (
        <button
          className="min-h-[44px] shrink-0 rounded-full px-4 py-2.5 font-bold text-primary text-xs uppercase tracking-wide transition-all hover:bg-surface-container-high"
          onClick={() => onToggleAll(true)}
          type="button"
        >
          {t("show_more")}
        </button>
      )}
      {showAllCategories && (
        <button
          className="min-h-[44px] shrink-0 rounded-full px-4 py-2.5 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-all hover:bg-surface-container-high"
          onClick={() => onToggleAll(false)}
          type="button"
        >
          {t("show_less")}
        </button>
      )}
    </div>
  );
}

function PartsDesktopTable({
  isLoading,
  onSort,
  parts,
  sortBy,
  sortDir,
  t,
  togglingId,
  onToggle,
}: {
  isLoading: boolean;
  onSort: (field: SortField) => void;
  onToggle: (part: PartsCatalog) => void;
  parts: PartsCatalog[];
  sortBy: SortField;
  sortDir: "asc" | "desc";
  t: (key: string) => string;
  togglingId: string | null;
}) {
  return (
    <table className="w-full border-collapse text-start">
      <thead>
        <tr className="bg-surface-container-high/50">
          <th
            aria-sort={getAriaSort(sortBy, sortDir, "name")}
            className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
            onClick={() => onSort("name")}
          >
            {t("part_details")}
            {sortBy === "name" && (
              <Icon
                className="ms-1 align-middle text-primary"
                name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                size="xs"
              />
            )}
          </th>
          <th
            aria-sort={getAriaSort(sortBy, sortDir, "category")}
            className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
            onClick={() => onSort("category")}
          >
            {t("category")}
            {sortBy === "category" && (
              <Icon
                className="ms-1 align-middle text-primary"
                name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                size="xs"
              />
            )}
          </th>
          <th
            aria-sort={getAriaSort(sortBy, sortDir, "supplier")}
            className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
            onClick={() => onSort("supplier")}
          >
            {t("supplier")}
            {sortBy === "supplier" && (
              <Icon
                className="ms-1 align-middle text-primary"
                name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                size="xs"
              />
            )}
          </th>
          <th
            aria-sort={getAriaSort(sortBy, sortDir, "defaultPrice")}
            className="cursor-pointer px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide transition-colors hover:text-primary"
            onClick={() => onSort("defaultPrice")}
          >
            {t("unit_cost")}
            {sortBy === "defaultPrice" && (
              <Icon
                className="ms-1 align-middle text-primary"
                name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                size="xs"
              />
            )}
          </th>
          <th className="px-6 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide">
            {t("status_label")}
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
          : parts.map((part) => (
              <DesktopPartRow
                key={part.id}
                onToggle={onToggle}
                part={part}
                t={t}
                togglingId={togglingId}
              />
            ))}
      </tbody>
    </table>
  );
}

export default function PartsCatalogPage() {
  const { t } = useTranslation();
  const {
    parts,
    isLoading,
    error,
    totalCount,
    fetchParts,
    createPart,
    togglePartActive,
    clearError,
  } = usePartsCatalogStore();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeFilter, setActiveFilter] = useState<PartCategoryType | "ALL">(
    "ALL"
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [toast, setToast] = useState<{
    isError: boolean;
    message: string;
  } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ isError, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchParams = useMemo(
    () => ({
      search: search || undefined,
      category: activeFilter === "ALL" ? undefined : activeFilter,
    }),
    [search, activeFilter]
  );

  useEffect(() => {
    fetchParts(fetchParams);
  }, [fetchParams, fetchParts]);

  useEffect(() => {
    if (error) {
      showToast(error, true);
      clearError();
    }
  }, [error, showToast, clearError]);

  const sorted = useMemo(() => {
    return [...parts].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === "string" && typeof bv === "string") {
        return mul * av.localeCompare(bv);
      }
      return mul * (Number(av) - Number(bv));
    });
  }, [parts, sortBy, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  const { activeCount, catalogValue, uniqueSuppliers } = useMemo(() => {
    const active = parts.filter((p) => p.isActive);
    return {
      activeCount: active.length,
      catalogValue: active.reduce((acc, p) => acc + Number(p.defaultPrice), 0),
      uniqueSuppliers: new Set(
        active
          .filter(
            (p): p is PartsCatalog & { supplier: string } => p.supplier !== null
          )
          .map((p) => p.supplier)
      ).size,
    };
  }, [parts]);

  const handleAddPart = async (
    data: Omit<
      {
        category: PartCategoryType | "";
        isActive: boolean;
        name: string;
        supplier: string;
      },
      "defaultPrice"
    > & { defaultPrice: number }
  ) => {
    if (!data.category) {
      showToast(t("failed_to_create_part"), true);
      return;
    }
    try {
      await createPart({
        category: data.category,
        defaultPrice: data.defaultPrice,
        name: data.name,
        supplier: data.supplier || undefined,
      });
      setShowAddModal(false);
      showToast(t("part_added_successfully"));
      await fetchParts(fetchParams);
    } catch {
      showToast(t("failed_to_create_part"), true);
    }
  };

  const handleToggleActive = async (part: PartsCatalog) => {
    setTogglingId(part.id);
    try {
      await togglePartActive(part.id, !part.isActive);
      showToast(t("part_status_changed"));
    } catch {
      showToast(t("failed_to_update_status"), true);
    } finally {
      setTogglingId(null);
    }
  };

  const hasParts = sorted.length > 0 || isLoading;
  const showEmptyState = sorted.length === 0 && !isLoading;

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

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-on-surface-variant text-sm">
          <span className="font-bold text-on-surface">{totalCount}</span>{" "}
          {t("total_parts")}
          <span className="text-outline-variant">&middot;</span>
          <span className="font-bold text-on-surface">{activeCount}</span>{" "}
          {t("active")}
          <span className="text-outline-variant">&middot;</span>
          <span className="font-bold text-on-surface">
            {catalogValue > 0 ? formatDzd(catalogValue) : "0"}
          </span>{" "}
          {t("currency_dzd")}
          <span className="text-outline-variant">&middot;</span>
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
              {CATEGORIES.map((cat) => (
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
          <CategoryFilterPills
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onToggleAll={setShowAllCategories}
            showAllCategories={showAllCategories}
            t={t}
          />
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

      {showEmptyState && (
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

      {hasParts && (
        <div className="overflow-hidden rounded-2xl bg-surface-container-low">
          <div className="hidden overflow-x-auto md:block">
            <PartsDesktopTable
              isLoading={isLoading}
              onSort={toggleSort}
              onToggle={handleToggleActive}
              parts={sorted}
              sortBy={sortBy}
              sortDir={sortDir}
              t={t}
              togglingId={togglingId}
            />
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
              sorted.map((part) => (
                <MobilePartCard
                  key={part.id}
                  onToggle={handleToggleActive}
                  part={part}
                  t={t}
                  togglingId={togglingId}
                />
              ))
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPartModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddPart}
        />
      )}

      {toast && (
        <div
          aria-live="polite"
          className={`fixed end-6 bottom-6 z-50 flex animate-[fadeSlideUp_0.3s_ease-out] items-center gap-2 rounded-2xl px-5 py-3 font-bold text-sm shadow-2xl ${
            toast.isError
              ? "bg-error text-on-error"
              : "bg-on-surface text-on-primary"
          }`}
          role="status"
        >
          <Icon name={toast.isError ? "error" : "check_circle"} size="sm" />
          {toast.message}
        </div>
      )}
    </>
  );
}
