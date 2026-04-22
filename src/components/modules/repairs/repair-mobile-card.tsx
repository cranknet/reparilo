import { useTranslation } from "react-i18next";
import { formatDzd } from "@/lib/format";
import type { RepairCategory, RepairItem } from "./repair-table";

const CATEGORY_COLORS: Record<RepairCategory, string> = {
  HARDWARE: "bg-secondary-container text-on-secondary-container",
  SOFTWARE: "bg-tertiary-fixed text-on-tertiary-fixed",
  DIAGNOSTIC: "bg-primary-fixed text-on-primary-fixed",
};

interface RepairMobileCardProps {
  deletingId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: (item: RepairItem) => void;
  onEdit: (item: RepairItem) => void;
  onShowDelete: (id: string) => void;
  onToggleActive: (item: RepairItem) => void;
  repair: RepairItem;
  togglingId: string | null;
}

export default function RepairMobileCard({
  deletingId,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onShowDelete,
  onToggleActive,
  repair,
  togglingId,
}: RepairMobileCardProps) {
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
            <span className="font-mono text-on-surface-variant text-xs uppercase tracking-tight">
              {repair.code}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!repair.isActive && (
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-bold text-on-surface-variant text-xs">
              {t("inactive")}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 font-bold text-xs uppercase ${CATEGORY_COLORS[repair.category]}`}
          >
            {t(`repair_category.${repair.category}`)}
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between border-outline-variant/10 border-t pt-3">
        <div className="flex flex-col">
          <span className="font-bold text-on-surface-variant text-xs uppercase tracking-wide">
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
        </div>
      </div>
      {deletingId === repair.id ? (
        <div
          className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-container-low p-3"
          role="alert"
        >
          <p className="font-bold text-on-surface text-sm">
            {t("delete_repair_confirm_title")}
          </p>
          <p className="text-on-surface-variant text-xs">
            {t("delete_repair_confirm_desc")}
          </p>
          <div className="flex gap-2">
            <button
              className="min-h-[44px] flex-1 rounded-lg bg-surface-container-high px-3 py-2 font-bold text-on-surface-variant text-xs transition-colors hover:bg-surface-container-highest"
              onClick={onCancelDelete}
              type="button"
            >
              {t("cancel")}
            </button>
            <button
              className="min-h-[44px] flex-1 rounded-lg bg-error-container px-3 py-2 font-bold text-on-error-container text-xs transition-colors hover:opacity-90"
              onClick={() => onConfirmDelete(repair)}
              type="button"
            >
              {t("delete")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            aria-label={t("edit_repair", { name: repair.name })}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl font-bold text-on-surface-variant text-xs transition-all hover:bg-surface-container-high hover:text-primary"
            onClick={() => onEdit(repair)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            <span>{t("edit")}</span>
          </button>
          <button
            aria-label={
              repair.isActive ? t("deactivate_repair") : t("activate_repair")
            }
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl font-bold text-xs transition-all ${
              repair.isActive
                ? "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                : "text-primary hover:bg-primary-container"
            }`}
            disabled={togglingId === repair.id}
            onClick={() => onToggleActive(repair)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              {repair.isActive ? "toggle_on" : "toggle_off"}
            </span>
            <span>
              {repair.isActive ? t("deactivate_repair") : t("activate_repair")}
            </span>
          </button>
          <button
            aria-label={t("delete_repair")}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl font-bold text-on-surface-variant text-xs transition-all hover:bg-error-container hover:text-on-error-container"
            onClick={() => onShowDelete(repair.id)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              delete
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
