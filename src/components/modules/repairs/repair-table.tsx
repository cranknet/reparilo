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
  name: string;
}

const CATEGORY_COLORS: Record<RepairCategory, string> = {
  HARDWARE: "bg-secondary-container text-on-secondary-container",
  SOFTWARE: "bg-tertiary-fixed text-on-tertiary-fixed",
  DIAGNOSTIC: "bg-primary-fixed text-on-primary-fixed",
};

interface RepairTableProps {
  repairs: RepairItem[];
}

export default function RepairTable({ repairs }: RepairTableProps) {
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
                <td className="p-4 text-end">
                  <button
                    aria-label={t("edit_repair", { name: repair.name })}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      edit
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
