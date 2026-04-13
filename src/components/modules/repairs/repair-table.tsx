import { useTranslation } from "react-i18next";

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

function formatDzd(value: number): string {
  return value.toLocaleString("fr-DZ");
}

interface RepairTableProps {
  repairs: RepairItem[];
  totalCount: number;
}

export default function RepairTable({ repairs, totalCount }: RepairTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-low">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-high/30">
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("repair_name")}
              </th>
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("category")}
              </th>
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("base_price")}
              </th>
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("duration")}
              </th>
              <th className="p-4" />
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
                      <p className="font-mono text-[10px] text-outline uppercase tracking-tight">
                        {repair.code}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 font-bold text-[10px] uppercase ${CATEGORY_COLORS[repair.category]}`}
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
                <td className="p-4 text-right">
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
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
      <div className="flex items-center justify-between border-outline-variant/5 border-t bg-surface-container-high/30 px-6 py-4">
        <span className="font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
          {t("showing_results", { count: repairs.length, total: totalCount })}
        </span>
        <div className="flex gap-2">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface disabled:opacity-50"
            disabled
            type="button"
          >
            <span className="material-symbols-outlined text-sm">
              chevron_left
            </span>
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"
            type="button"
          >
            <span className="font-bold text-xs">1</span>
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface"
            type="button"
          >
            <span className="font-bold text-xs">2</span>
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
