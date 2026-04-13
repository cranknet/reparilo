import { useTranslation } from "react-i18next";
import type { RepairCategory, RepairItem } from "./repair-table";

const CATEGORY_COLORS: Record<RepairCategory, string> = {
  HARDWARE: "bg-secondary-container text-on-secondary-container",
  SOFTWARE: "bg-tertiary-fixed text-on-tertiary-fixed",
  DIAGNOSTIC: "bg-primary-fixed text-on-primary-fixed",
};

function formatDzd(value: number): string {
  return value.toLocaleString("fr-DZ");
}

interface RepairMobileCardProps {
  repair: RepairItem;
}

export default function RepairMobileCard({ repair }: RepairMobileCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${repair.iconBg}`}
          >
            <span
              className={`material-symbols-outlined text-lg ${repair.iconColor}`}
            >
              {repair.icon}
            </span>
          </div>
          <div>
            <h3 className="font-bold font-headline text-sm">{repair.name}</h3>
            <span className="font-mono text-[10px] text-outline">
              {repair.code}
            </span>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-bold text-[10px] uppercase ${CATEGORY_COLORS[repair.category]}`}
        >
          {t(`repair_category.${repair.category}`)}
        </span>
      </div>
      <div className="flex items-end justify-between border-surface-container-high border-t pt-3">
        <div className="flex flex-col">
          <span className="font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
            {t("duration")}
          </span>
          <span className="font-bold text-on-surface text-sm">
            {repair.duration}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold font-mono text-primary text-sm">
            {formatDzd(repair.basePrice)} DZD
          </span>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
