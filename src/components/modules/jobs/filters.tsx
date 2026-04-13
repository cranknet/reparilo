import type { JobStatusType } from "@shared/constants";
import { JobStatus } from "@shared/constants";
import { useTranslation } from "react-i18next";

interface JobsFiltersProps {
  activeStatus?: JobStatusType | "ALL";
  onStatusChange: (status: JobStatusType | "ALL") => void;
}

export default function JobsFilters({
  activeStatus = "ALL",
  onStatusChange,
}: JobsFiltersProps) {
  const { t } = useTranslation();

  const statuses: (JobStatusType | "ALL")[] = [
    "ALL",
    ...Object.values(JobStatus),
  ];

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <button
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-container-high px-3 py-1.5 font-bold text-[10px] text-on-surface-variant md:px-4 md:py-2 md:text-xs"
        type="button"
      >
        <span className="material-symbols-outlined text-sm md:text-base">
          filter_list
        </span>
        {t("filter")}
      </button>
      {statuses.map((s) => (
        <button
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-bold text-[10px] md:px-4 md:py-2 md:text-xs ${
            activeStatus === s
              ? "bg-primary text-white"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
          key={s}
          onClick={() => onStatusChange(s)}
          type="button"
        >
          {s === "ALL" ? t("status_label") : t(`status.${s}`)}
        </button>
      ))}
    </div>
  );
}
