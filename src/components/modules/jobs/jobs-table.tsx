import { DEVICE_ICONS } from "@shared/constants";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { JobRow } from "./jobs-shared";

export type { JobRow } from "./jobs-shared";

import StatusBadge from "./status-badge";
import StatusChangeMenu from "./status-change-menu";

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
            <tr className="bg-surface-container-low">
              <th className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                {t("job_id")}
              </th>
              <th className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                {t("device")}
              </th>
              <th className="hidden p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-wide lg:table-cell">
                {t("customers")}
              </th>
              <th className="p-4 text-center font-body font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                {t("status_label")}
              </th>
              <th className="p-4 font-body font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                {t("technician")}
              </th>
              <th className="p-4 text-right font-body font-bold text-on-surface-variant text-xs uppercase tracking-wide">
                <span className="sr-only">{t("actions")}</span>
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
                  <Link
                    className="font-bold font-headline text-primary text-xs tracking-tight hover:underline lg:text-sm"
                    to={`/jobs/${job.rawJob?.id ?? job.id}`}
                  >
                    {job.id}
                  </Link>
                </td>
                <td className="p-4">
                  <Link
                    className="block"
                    to={`/jobs/${job.rawJob?.id ?? job.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
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
                          <p className="font-body text-on-surface-variant text-xs">
                            {job.deviceSpec}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
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
                    {job.rawJob ? (
                      <StatusChangeMenu job={job.rawJob} />
                    ) : (
                      <StatusBadge status={job.status} />
                    )}
                  </div>
                </td>
                <td className="p-4">
                  {job.technician ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-highest">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">
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
                    aria-label={t("job_actions")}
                    className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                    title={t("job_actions")}
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
