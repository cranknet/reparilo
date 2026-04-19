import type { RepairCatalog } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRepairCatalogStore } from "@/stores/repair-catalog";

const CATEGORY_FILTERS = [
  { key: "", labelKey: "intake.repair_category_all" },
  { key: "HARDWARE", labelKey: "repair_category.HARDWARE" },
  { key: "SOFTWARE", labelKey: "repair_category.SOFTWARE" },
  { key: "DIAGNOSTIC", labelKey: "repair_category.DIAGNOSTIC" },
  { key: "OTHER", labelKey: "repair_category.OTHER" },
];

interface RepairServicePickerProps {
  compact?: boolean;
  onSelect: (repair: RepairCatalog) => void;
  selectedIds: string[];
}

export default function RepairServicePicker({
  onSelect,
  selectedIds,
  compact = false,
}: RepairServicePickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { repairs, fetchRepairs, isLoading } = useRepairCatalogStore();

  useEffect(() => {
    fetchRepairs({ isActive: true, limit: 100 });
  }, [fetchRepairs]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useCallback(() => {
    let results = repairs;
    if (categoryFilter) {
      results = results.filter((r) => r.category === categoryFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter((r) => r.name.toLowerCase().includes(q));
    }
    return results;
  }, [repairs, categoryFilter, query]);

  const handleSelect = useCallback(
    (repair: RepairCatalog) => {
      onSelect(repair);
      setQuery("");
      setOpen(false);
    },
    [onSelect]
  );

  const results = filtered();

  return (
    <div className={compact ? "space-y-2" : "space-y-3"} ref={containerRef}>
      <div className="relative">
        <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-outline text-sm">
          search
        </span>
        <input
          className="h-11 w-full rounded-xl bg-surface-container-highest ps-9 pe-4 font-body text-on-surface text-sm outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("intake.search_repairs")}
          type="text"
          value={query}
        />

        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant">
            {isLoading && (
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="material-symbols-outlined animate-spin text-on-surface-variant text-sm">
                  progress_activity
                </span>
                <span className="font-label text-on-surface-variant text-xs">
                  {t("intake.searching")}
                </span>
              </div>
            )}
            {!isLoading && results.length > 0 && (
              <ul className="max-h-48 overflow-y-auto py-1">
                {results.map((r) => {
                  const alreadySelected = selectedIds.includes(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                          alreadySelected
                            ? "cursor-not-allowed opacity-40"
                            : "hover:bg-surface-container-high"
                        }`}
                        disabled={alreadySelected}
                        onClick={() => handleSelect(r)}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold font-headline text-on-surface text-sm">
                            {r.name}
                          </p>
                          <p className="font-label text-on-surface-variant text-xs">
                            {t(`repair_category.${r.category}`)} ·{" "}
                            {Number(r.defaultPrice).toLocaleString()} DZD
                          </p>
                        </div>
                        {alreadySelected && (
                          <span className="material-symbols-outlined text-primary text-sm">
                            check
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!isLoading && results.length === 0 && query.trim().length >= 1 && (
              <div className="px-4 py-3">
                <span className="font-label text-on-surface-variant text-xs">
                  {t("intake.no_repairs_found")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            className={`rounded-full px-3 py-1 font-bold font-label text-xs transition-all ${
              categoryFilter === cat.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high"
            }`}
            key={cat.key}
            onClick={() => setCategoryFilter(cat.key)}
            type="button"
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
