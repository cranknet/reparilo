import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import StatusBadge from "./status-badge";

const DEVICE_ICONS: Record<string, string> = {
  phone: "smartphone",
  tablet: "tablet_mac",
  laptop: "laptop_mac",
  watch: "watch",
  other: "precision_manufacturing",
};

export interface JobRow {
  customer: string;
  customerTier?: string;
  device: string;
  deviceIcon?: string;
  deviceSpec?: string;
  id: string;
  status: JobStatusType;
  technician?: string;
}

interface JobsTableProps {
  jobs: JobRow[];
}

export default function JobsTable({ jobs }: JobsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-lowest">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-high/30">
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("job_id")}
              </th>
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("device")}
              </th>
              <th className="hidden p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest lg:table-cell">
                {t("customers")}
              </th>
              <th className="p-4 text-center font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("status_label")}
              </th>
              <th className="p-4 font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("technician")}
              </th>
              <th className="p-4 text-right font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                {" "}
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr
                className="transition-colors hover:bg-surface-container-low"
                key={job.id}
              >
                <td className="p-4">
                  <span className="font-bold font-headline text-primary text-xs tracking-tight lg:text-sm">
                    {job.id}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high lg:h-10 lg:w-10">
                      <span className="material-symbols-outlined text-lg text-secondary lg:text-xl">
                        {DEVICE_ICONS[job.deviceIcon ?? "other"] ??
                          "precision_manufacturing"}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold font-headline text-xs lg:text-sm">
                        {job.device}
                      </p>
                      {job.deviceSpec && (
                        <p className="font-body text-[10px] text-on-surface-variant">
                          {job.deviceSpec}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden p-4 lg:table-cell">
                  <p className="font-body font-semibold text-sm">
                    {job.customer}
                  </p>
                  {job.customerTier && (
                    <p className="text-on-surface-variant text-xs">
                      {job.customerTier}
                    </p>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex justify-center">
                    <StatusBadge status={job.status} />
                  </div>
                </td>
                <td className="p-4">
                  {job.technician ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-highest">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                          person
                        </span>
                      </div>
                      <span className="font-body font-medium text-xs lg:text-sm">
                        {job.technician}
                      </span>
                    </div>
                  ) : (
                    <span className="font-body font-medium text-on-surface-variant text-xs italic">
                      {t("unassigned")}
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    className="p-2 text-on-surface-variant transition-colors hover:text-primary"
                    type="button"
                  >
                    <span className="material-symbols-outlined">more_vert</span>
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
