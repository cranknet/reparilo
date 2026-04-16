# Parts Catalog Frontend-Backend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock data in the parts catalog page with real API calls, removing stock tracking UI and wiring up to the existing Zustand store and backend.

**Architecture:** The Zustand store (`usePartsCatalogStore`) and backend (`/api/parts`) already exist. We refactor the page to use the store instead of local mock data, remove stock-related UI, add server-side search/filter via store params, and wire the AddPartModal to call `createPart()`.

**Tech Stack:** React, Zustand, react-i18next, Axios (via `src/lib/api.ts`), Prisma-derived shared types

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/pages/parts/index.tsx` | **Major refactor** | Main parts catalog page — replace mock data with store, remove stock UI, add isActive toggle |
| `src/components/modules/parts/add-part-modal.tsx` | **No changes needed** | Modal already has correct form fields; wiring happens in the page's `onSubmit` handler |
| `src/stores/parts-catalog.ts` | **No changes needed** | Store is already fully wired to the API |
| `src/i18n/locales/en.json` | **Minor additions** | Add locale keys for new UI elements (inactive badge, error states, etc.) |
| `shared/constants/part-categories.ts` | **No changes needed** | Already has `PartCategory` enum values |
| `shared/types/index.ts` | **No changes needed** | Already exports `PartsCatalog` type |

---

### Task 1: Add missing locale keys to en.json

**Files:**
- Modify: `src/i18n/locales/en.json`

The store error and isActive status need locale keys that don't exist yet. We also need to replace stock-related keys with catalog-appropriate ones.

- [ ] **Step 1: Add new locale keys to en.json**

Add these keys (remove/repurpose stock ones where needed):

```json
  "inactive": "Inactive",
  "deactivate_part": "Deactivate",
  "activate_part": "Activate",
  "part_status_changed": "Part status updated",
  "failed_to_create_part": "Failed to create part",
  "failed_to_fetch_parts": "Failed to load parts",
  "failed_to_update_status": "Failed to update part status",
  "active_parts": "Active",
  "inactive_parts": "Inactive",
  "total_catalog_value": "Catalog Value"
```

Note: Keys like `stock_level`, `low_stock`, `reorder`, `units` can stay in en.json for now (removing them could break other references) but will no longer be used on this page.

- [ ] **Step 2: Sync locales**

Run: `pnpm run sync-locales`

This auto-translates the new keys to ar.json and fr.json.

- [ ] **Step 3: Commit locale changes**

```bash
git add src/i18n/locales/
git commit -m "feat(parts): add locale keys for catalog wiring"
```

---

### Task 2: Refactor PartsCatalogPage to use store data

**Files:**
- Modify: `src/pages/parts/index.tsx`

This is the core task. Rewrite the page component to use `usePartsCatalogStore` instead of mock data, remove all stock-related UI, and add isActive toggle functionality.

- [ ] **Step 1: Write the refactored page**

Replace the entire content of `src/pages/parts/index.tsx` with the following. Key changes:
- Remove: `MockPart` type, `MOCK_PARTS`, `StockBar` component, `SkeletonRow`, low-stock alert banner, stock columns/rows
- Add: `usePartsCatalogStore` for data fetching and mutations
- Add: `useEffect` for initial fetch and filter-triggered refetches
- Add: `isActive` toggle in manage column
- Add: Error display from store
- Change: Metrics show total parts, active/inactive count, catalog value (sum of defaultPrice for active parts)
- Keep: Category filter pills, search, sort, empty state, mobile layout

```tsx
import type { PartsCatalog } from "@shared/types";
import type { PartCategoryType } from "@shared/constants";
import { PartCategory } from "@shared/constants";
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
  const [toast, setToast] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    fetchParts({
      search: search || undefined,
      category: activeFilter === "ALL" ? undefined : activeFilter,
    });
  }, [search, activeFilter, fetchParts]);

  useEffect(() => {
    if (error) {
      showToast(error);
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

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  const activeCount = parts.filter((p) => p.isActive).length;
  const inactiveCount = parts.filter((p) => !p.isActive).length;
  const catalogValue = parts.reduce(
    (acc, p) => acc + Number(p.defaultPrice),
    0
  );
  const uniqueSuppliers = [
    ...new Set(parts.filter((p) => p.supplier).map((p) => p.supplier!)),
  ].length;

  const handleAddPart = async (
    data: Omit<
      { category: PartCategoryType; defaultPrice: number; name: string; supplier: string },
      never
    > & { defaultPrice: number }
  ) => {
    try {
      await createPart(data);
      setShowAddModal(false);
      showToast(t("part_added_successfully"));
      await fetchParts({
        search: search || undefined,
        category: activeFilter === "ALL" ? undefined : activeFilter,
      });
    } catch {
      showToast(t("failed_to_create_part"));
    }
  };

  const handleToggleActive = async (part: PartsCatalog) => {
    setTogglingId(part.id);
    try {
      await togglePartActive(part.id, !part.isActive);
      showToast(t("part_status_changed"));
    } catch {
      showToast(t("failed_to_update_status"));
    } finally {
      setTogglingId(null);
    }
  };

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
          <span className="text-outline-variant">·</span>
          <span className="font-bold text-on-surface">{activeCount}</span>{" "}
          {t("active")}
          <span className="text-outline-variant">·</span>
          <span className="font-bold text-on-surface">{catalogValue > 0 ? formatDzd(catalogValue) : "0"}</span>{" "}
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
          <div className="hide-scrollbar flex flex-wrap items-center gap-2">
            {CATEGORIES.filter((cat) =>
              showAllCategories
                ? true
                : cat === "ALL" || CATEGORIES.indexOf(cat) <= 4
            ).map((cat) => {
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
            {!showAllCategories && CATEGORIES.length > 5 && (
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
                    {t("status")}
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
                  : sorted.map((part) => (
                      <tr
                        className={`transition-colors hover:bg-surface-container-lowest ${
                          !part.isActive ? "bg-surface-container/50 opacity-60" : ""
                        }`}
                        key={part.id}
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className={`font-bold text-sm ${!part.isActive ? "line-through" : ""} text-on-surface`}>
                              {part.name}
                            </span>
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
                            {part.supplier || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-mono font-semibold text-sm">
                            {formatDzd(Number(part.defaultPrice))} {t("currency_dzd")}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 font-bold text-xs ${
                              part.isActive
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-container-high text-on-surface-variant"
                            }`}
                          >
                            {part.isActive ? t("active") : t("inactive")}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1">
                            <button
                              aria-label={part.isActive ? t("deactivate_part") : t("activate_part")}
                              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                                part.isActive
                                  ? "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                                  : "text-primary hover:bg-primary-container"
                              }`}
                              disabled={togglingId === part.id}
                              onClick={() => handleToggleActive(part)}
                              type="button"
                            >
                              <Icon
                                name={part.isActive ? "toggle_on" : "toggle_off"}
                                size="sm"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
              sorted.map((part) => (
                <div
                  className={`p-4 ${!part.isActive ? "bg-surface-container/50 opacity-60" : ""}`}
                  key={part.id}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className={`font-bold text-sm text-on-surface ${!part.isActive ? "line-through" : ""}`}>
                        {part.name}
                      </h3>
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
                      className={`rounded-full px-3 py-1 font-bold text-xs ${
                        part.isActive
                          ? "bg-primary-container text-on-primary-container"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {part.isActive ? t("active") : t("inactive")}
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
                      aria-label={part.isActive ? t("deactivate_part") : t("activate_part")}
                      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl font-bold text-xs transition-all ${
                        part.isActive
                          ? "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                          : "text-primary hover:bg-primary-container"
                      }`}
                      disabled={togglingId === part.id}
                      onClick={() => handleToggleActive(part)}
                      type="button"
                    >
                      <Icon
                        name={part.isActive ? "toggle_on" : "toggle_off"}
                        size="sm"
                      />
                      <span>
                        {part.isActive ? t("deactivate_part") : t("activate_part")}
                      </span>
                    </button>
                  </div>
                </div>
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
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm run build 2>&1 | tail -20`

Expected: No type errors. There may be lint warnings but no blocking errors.

- [ ] **Step 3: Commit the refactored page**

```bash
git add src/pages/parts/index.tsx
git commit -m "feat(parts): wire catalog page to backend store

Replace mock data with usePartsCatalogStore, remove stock tracking UI,
add isActive toggle, server-side search/filter, and error handling."
```

---

### Task 3: Verify and test in browser

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

Run: `pnpm run dev`

- [ ] **Step 2: Open the app in Chrome DevTools and navigate to the parts page**

Login with admin credentials, navigate to the parts inventory page.

- [ ] **Step 3: Verify the page loads real data from the backend**

Check that:
- Parts list loads from the API (not mock data)
- Search triggers API calls with `?search=` param
- Category filter triggers API calls with `?category=` param
- "Add New Part" opens modal and creates a part successfully
- Toggle active/inactive works
- Skeleton loading state shows while data is loading
- Error state shows toast notification if API fails

- [ ] **Step 4: Check console for errors**

Use Chrome DevTools console to verify no JavaScript errors are thrown.

- [ ] **Step 5: Run lint and fix any issues**

Run: `pnpm run lint 2>&1 | tail -20`

Fix any lint errors found.