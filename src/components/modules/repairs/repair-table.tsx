import { useTranslation } from "react-i18next";
import { formatDzd } from "@/lib/format";

export type RepairCategory = "HARDWARE" | "SOFTWARE" | "DIAGNOSTIC";

export interface RepairItem {
  basePrice: number;
  category: RepairCategory;
  code: string;
  duration: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  id: string;
  isActive: boolean;
  name: string;
}

const CATEGORY_COLORS: Record<RepairCategory, string> = {
  HARDWARE: "bg-secondary-container text-on-secondary-container",
  SOFTWARE: "bg-tertiary-fixed text-on-tertiary-fixed",
  DIAGNOSTIC: "bg-primary-fixed text-on-primary-fixed",
};

interface RepairTableProps {
  deletingId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: (item: RepairItem) => void;
  onEdit: (item: RepairItem) => void;
  onShowDelete: (id: string) => void;
  onToggleActive: (item: RepairItem) => void;
  repairs: RepairItem[];
  togglingId: string | null;
}

export default function RepairTable({
  deletingId,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onShowDelete,
  onToggleActive,
  repairs,
  togglingId,
}: RepairTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-low">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-start">
          <thead>
            <tr className="bg-surface-container-high/30">
              <th
                className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-widest"
                scope="col"
              >
                {t("repair_name")}
              </th>
              <th
                className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-widest"
                scope="col"
              >
                {t("category")}
              </th>
              <th
                className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-widest"
                scope="col"
              >
                {t("base_price")}
              </th>
              <th
                className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-widest"
                scope="col"
              >
                {t("duration")}
              </th>
              <th className="p-4" scope="col" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {repairs.map((repair) => (
              <tr
                className="transition-colors hover:bg-surface-container-lowest"
                key={repair.id}
              >
                <td className="p-4">
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
                      <p className="font-bold font-headline text-sm">
                        {repair.name}
                      </p>
                      <p className="font-mono text-on-surface-variant text-xs uppercase tracking-tight">
                        {repair.code}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 font-bold text-xs uppercase ${CATEGORY_COLORS[repair.category]}`}
                  >
                    {t(`repair_category.${repair.category}`)}
                  </span>
                </td>
                <td className="p-4">
                  <span className="font-mono font-semibold text-sm">
                    {formatDzd(repair.basePrice)} DZD
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-on-surface-variant text-sm">
                    {repair.duration}
                  </span>
                </td>
                <td className="p-4">
                  {!repair.isActive && (
                    <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-bold text-on-surface-variant text-xs">
                      {t("inactive")}
                    </span>
                  )}
                  {repair.isActive && (
                    <span className="rounded-full bg-primary-container px-2.5 py-1 font-bold text-on-primary-container text-xs">
                      {t("active")}
                    </span>
                  )}
                </td>
                <td className="p-4 text-end">
                  {deletingId === repair.id ? (
                    <div
                      className="flex flex-col gap-2 p-2 text-start"
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
                          className="min-h-[36px] flex-1 rounded-lg bg-surface-container-high px-3 py-1.5 font-bold text-on-surface-variant text-xs transition-colors hover:bg-surface-container-highest"
                          onClick={onCancelDelete}
                          type="button"
                        >
                          {t("cancel")}
                        </button>
                        <button
                          className="min-h-[36px] flex-1 rounded-lg bg-error-container px-3 py-1.5 font-bold text-on-error-container text-xs transition-colors hover:opacity-90"
                          onClick={() => onConfirmDelete(repair)}
                          type="button"
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        aria-label={t("edit_repair", { name: repair.name })}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                        onClick={() => onEdit(repair)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          edit
                        </span>
                      </button>
                      <button
                        aria-label={
                          repair.isActive
                            ? t("deactivate_repair")
                            : t("activate_repair")
                        }
                        className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${repair.isActive ? "text-on-surface-variant hover:bg-surface-container-high hover:text-primary" : "text-primary hover:bg-primary-container"}`}
                        disabled={togglingId === repair.id}
                        onClick={() => onToggleActive(repair)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {repair.isActive ? "toggle_on" : "toggle_off"}
                        </span>
                      </button>
                      <button
                        aria-label={t("delete_repair")}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                        onClick={() => onShowDelete(repair.id)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          delete
                        </span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
