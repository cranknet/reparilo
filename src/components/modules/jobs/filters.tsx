import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import type { StatusGroupKey } from "./jobs-shared";
import { STATUS_GROUPS } from "./jobs-shared";

interface JobsFiltersProps {
  activeGroup?: StatusGroupKey | "ALL";
  activeStatus?: JobStatusType | "ALL";
  onGroupChange: (group: StatusGroupKey | "ALL") => void;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: JobStatusType | "ALL") => void;
  searchQuery: string;
}

export default function JobsFilters({
  activeStatus = "ALL",
  activeGroup = "ALL",
  onStatusChange,
  onGroupChange,
  onSearchChange,
  searchQuery,
}: JobsFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            aria-label={t("search")}
            className="min-h-[44px] w-full rounded-lg bg-surface-container-low py-2 pr-3 pl-10 font-body text-on-surface text-sm transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("search_jobs")}
            type="search"
            value={searchQuery}
          />
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <button
          className={[
            "min-h-[44px] shrink-0 rounded-lg px-3 py-2 font-bold font-label text-[11px] uppercase tracking-wider transition-all",
            activeGroup === "ALL" && activeStatus === "ALL"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
          ].join(" ")}
          onClick={() => onGroupChange("ALL")}
          type="button"
        >
          {t("status_label")}
        </button>

        {STATUS_GROUPS.map((group) => (
          <button
            className={[
              "min-h-[44px] shrink-0 rounded-lg px-3 py-2 font-bold font-label text-[11px] uppercase tracking-wider transition-all",
              activeGroup === group.key && activeStatus === "ALL"
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
            ].join(" ")}
            key={group.key}
            onClick={() => onGroupChange(group.key)}
            type="button"
          >
            {t(group.labelKey)}
          </button>
        ))}

        {activeGroup !== "ALL" && (
          <>
            <span className="mx-1 h-6 w-px bg-outline-variant" />
            {(
              STATUS_GROUPS.find((g) => g.key === activeGroup)?.statuses ?? []
            ).map((s) => (
              <button
                className={[
                  "min-h-[44px] shrink-0 rounded-lg px-3 py-2 font-bold font-label text-[11px] uppercase tracking-wider transition-all",
                  activeStatus === s
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
                ].join(" ")}
                key={s}
                onClick={() => onStatusChange(s)}
                type="button"
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
