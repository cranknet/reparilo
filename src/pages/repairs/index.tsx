import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

const MOCK_REPAIRS: RepairItem[] = [
  {
    id: "1",
    code: "REP-SCR-004",
    name: "Screen Replacement Gen 4",
    category: "HARDWARE",
    basePrice: 18_500,
    duration: "2 - 3 Hours",
    icon: "stay_current_portrait",
    iconBg: "bg-primary-fixed",
    iconColor: "text-primary",
  },
  {
    id: "2",
    code: "REP-BAT-001",
    name: "Battery Replacement Standard",
    category: "HARDWARE",
    basePrice: 6200,
    duration: "45 Mins",
    icon: "battery_charging_full",
    iconBg: "bg-tertiary-fixed",
    iconColor: "text-tertiary",
  },
  {
    id: "3",
    code: "REP-SFT-012",
    name: "Software Flash & OS Recovery",
    category: "SOFTWARE",
    basePrice: 4500,
    duration: "1.5 Hours",
    icon: "terminal",
    iconBg: "bg-secondary-fixed",
    iconColor: "text-secondary",
  },
  {
    id: "4",
    code: "REP-CHG-008",
    name: "Charging Port Repair",
    category: "HARDWARE",
    basePrice: 5800,
    duration: "1 Hour",
    icon: "electric_bolt",
    iconBg: "bg-primary-fixed",
    iconColor: "text-primary",
  },
  {
    id: "5",
    code: "REP-DIAG-003",
    name: "Full Device Diagnostic",
    category: "DIAGNOSTIC",
    basePrice: 2000,
    duration: "30 Mins",
    icon: "troubleshoot",
    iconBg: "bg-secondary-fixed",
    iconColor: "text-secondary",
  },
  {
    id: "6",
    code: "REP-CAM-006",
    name: "Camera Module Replacement",
    category: "HARDWARE",
    basePrice: 15_000,
    duration: "2 Hours",
    icon: "photo_camera",
    iconBg: "bg-primary-fixed",
    iconColor: "text-primary",
  },
  {
    id: "7",
    code: "REP-DAT-015",
    name: "Data Recovery Service",
    category: "SOFTWARE",
    basePrice: 8000,
    duration: "3 - 5 Hours",
    icon: "cloud_sync",
    iconBg: "bg-secondary-fixed",
    iconColor: "text-secondary",
  },
  {
    id: "8",
    code: "REP-WAT-002",
    name: "Water Damage Assessment",
    category: "DIAGNOSTIC",
    basePrice: 3500,
    duration: "45 Mins",
    icon: "water_drop",
    iconBg: "bg-tertiary-fixed",
    iconColor: "text-tertiary",
  },
];

export default function RepairsPage() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<RepairCategory | "ALL">(
    "ALL"
  );
  const [activeSort, setActiveSort] = useState<SortOption>("recently_added");
  const [searchQuery, setSearchQuery] = useState("");

  const { avgPrice, topCategory } = useMemo(() => {
    const avg = Math.round(
      MOCK_REPAIRS.reduce((sum, r) => sum + r.basePrice, 0) /
        MOCK_REPAIRS.length
    );
    const counts = MOCK_REPAIRS.reduce(
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
  }, []);

  const filtered = MOCK_REPAIRS.filter((r) => {
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
            {t("service_catalog")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("repair_catalog")}
          </p>
          <p className="mt-1 text-on-surface-variant text-sm">
            {t("services_count", { count: MOCK_REPAIRS.length })} ·{" "}
            {t("top_category_short", {
              category: t(`repair_category.${topCategory}`),
            })}{" "}
            · {t("avg_price_short", { price: formatDzd(avgPrice) })}
          </p>
        </div>
        <Button icon="add" size="md" type="button" variant="gradient">
          {t("add_new_repair")}
        </Button>
      </div>

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
        {sorted.length === 0 ? (
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
              onClick={() => setActiveCategory("ALL")}
              type="button"
            >
              {t("clear_filters")}
            </button>
          </div>
        ) : (
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
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AiPricingCallout />
        </div>
        <CategoryHealth repairs={MOCK_REPAIRS} />
      </div>
    </>
  );
}
