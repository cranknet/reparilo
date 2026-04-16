import type { RepairCatalog } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RepairFormData } from "@/components/modules/repairs/add-repair-modal";
import AddRepairModal from "@/components/modules/repairs/add-repair-modal";
import AiPricingCallout from "@/components/modules/repairs/ai-pricing-callout";
import CategoryHealth from "@/components/modules/repairs/category-health";
import type { SortOption } from "@/components/modules/repairs/repair-filters";
import RepairFilters from "@/components/modules/repairs/repair-filters";
import RepairMobileCard from "@/components/modules/repairs/repair-mobile-card";
import type {
  RepairCategory,
  RepairItem,
} from "@/components/modules/repairs/repair-table";
import RepairTable from "@/components/modules/repairs/repair-table";
import { Button } from "@/components/ui/button";
import { formatDzd } from "@/lib/format";
import { useRepairCatalogStore } from "@/stores/repair-catalog";

const CATEGORY_ICONS: Record<
  string,
  { icon: string; iconBg: string; iconColor: string }
> = {
  HARDWARE: {
    icon: "build",
    iconBg: "bg-primary-fixed",
    iconColor: "text-primary",
  },
  SOFTWARE: {
    icon: "terminal",
    iconBg: "bg-secondary-fixed",
    iconColor: "text-secondary",
  },
  DIAGNOSTIC: {
    icon: "troubleshoot",
    iconBg: "bg-tertiary-fixed",
    iconColor: "text-tertiary",
  },
  OTHER: {
    icon: "miscellaneous_services",
    iconBg: "bg-surface-container-high",
    iconColor: "text-on-surface-variant",
  },
};

const CATEGORY_PREFIXES: Record<string, string> = {
  HARDWARE: "HW",
  SOFTWARE: "SW",
  DIAGNOSTIC: "DG",
  OTHER: "OT",
};

function toRepairItem(r: RepairCatalog): RepairItem {
  const cat = r.category as string;
  const display = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.OTHER;
  const prefix = CATEGORY_PREFIXES[cat] ?? "OT";
  return {
    id: r.id,
    code: `REP-${prefix}-${r.id.slice(-3).toUpperCase()}`,
    name: r.name,
    category: cat as RepairCategory,
    basePrice:
      typeof r.defaultPrice === "number"
        ? r.defaultPrice
        : Number(r.defaultPrice),
    duration: "—",
    icon: display.icon,
    iconBg: display.iconBg,
    iconColor: display.iconColor,
  };
}

function RepairListEmpty({ onClearFilters }: { onClearFilters: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container-low px-6 py-16 text-center">
      <span className="material-symbols-outlined mb-4 text-[48px] text-on-surface-variant">
        search_off
      </span>
      <p className="font-bold font-headline text-lg text-on-surface">
        {t("no_repairs_found")}
      </p>
      <p className="mt-1 max-w-sm text-on-surface-variant text-sm">
        {t("no_repairs_found_desc")}
      </p>
      <button
        className="mt-6 rounded-xl bg-surface-container-high px-5 py-2.5 font-bold font-headline text-on-surface-variant text-sm transition-all hover:bg-surface-container-highest"
        onClick={onClearFilters}
        type="button"
      >
        {t("clear_filters")}
      </button>
    </div>
  );
}

function RepairListContent({ sorted }: { sorted: RepairItem[] }) {
  return (
    <>
      <div className="hidden md:block">
        <RepairTable repairs={sorted} />
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {sorted.map((repair) => (
          <RepairMobileCard key={repair.id} repair={repair} />
        ))}
      </div>
    </>
  );
}

function RepairListLoading() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          className="h-20 animate-pulse rounded-xl bg-surface-container-high"
          key={`skeleton-${String(i)}`}
        />
      ))}
    </div>
  );
}

export default function RepairsPage() {
  const { t } = useTranslation();
  const { repairs, isLoading, error, fetchRepairs, createRepair, clearError } =
    useRepairCatalogStore();
  const [activeCategory, setActiveCategory] = useState<RepairCategory | "ALL">(
    "ALL"
  );
  const [activeSort, setActiveSort] = useState<SortOption>("recently_added");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  const repairItems = useMemo(() => repairs.map(toRepairItem), [repairs]);

  const handleAddRepair = async (data: RepairFormData) => {
    await createRepair({
      name: data.name,
      category: data.category,
      defaultPrice: Number(data.basePrice),
    });
  };

  const { avgPrice, topCategory } = useMemo(() => {
    if (repairItems.length === 0) {
      return { avgPrice: 0, topCategory: "HARDWARE" as RepairCategory };
    }
    const avg = Math.round(
      repairItems.reduce((sum, r) => sum + r.basePrice, 0) / repairItems.length
    );
    const counts = repairItems.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const top = Object.entries(counts).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0] as RepairCategory;
    return { avgPrice: avg, topCategory: top };
  }, [repairItems]);

  const filtered = repairItems.filter((r) => {
    const matchesCategory =
      activeCategory === "ALL" || r.category === activeCategory;
    const matchesSearch =
      searchQuery === "" ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (activeSort) {
      case "price_low_high":
        return a.basePrice - b.basePrice;
      case "price_high_low":
        return b.basePrice - a.basePrice;
      case "az":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("repair_services")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("repair_services_subtitle")}
          </p>
          <p className="mt-1 text-on-surface-variant text-sm">
            {t("services_count", { count: repairItems.length })} ·{" "}
            {t("top_category_short", {
              category: t(`repair_category.${topCategory}`),
            })}{" "}
            · {t("avg_price_short", { price: formatDzd(avgPrice) })}
          </p>
        </div>
        <Button
          icon="add"
          onClick={() => setShowAddModal(true)}
          size="md"
          type="button"
          variant="gradient"
        >
          {t("add_service")}
        </Button>
      </div>

      {error && (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl bg-error-container px-4 py-3"
          role="alert"
        >
          <span className="material-symbols-outlined text-on-error-container">
            error
          </span>
          <p className="flex-1 font-bold text-on-error-container text-sm">
            {error}
          </p>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-error-container transition-colors hover:bg-on-error-container/10"
            onClick={clearError}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="mb-6">
        <RepairFilters
          activeCategory={activeCategory}
          activeSort={activeSort}
          onCategoryChange={setActiveCategory}
          onSearchChange={setSearchQuery}
          onSortChange={setActiveSort}
          searchQuery={searchQuery}
        />
      </div>

      <div className="mb-8">
        {isLoading && <RepairListLoading />}
        {!isLoading && sorted.length === 0 && (
          <RepairListEmpty onClearFilters={() => setActiveCategory("ALL")} />
        )}
        {!isLoading && sorted.length > 0 && (
          <RepairListContent sorted={sorted} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AiPricingCallout />
        </div>
        <CategoryHealth repairs={repairItems} />
      </div>

      <AddRepairModal
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddRepair}
        open={showAddModal}
      />
    </>
  );
}
