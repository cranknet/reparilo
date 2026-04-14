import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";

interface RepairJob {
  customerName: string;
  deviceModel: string;
  estimatedCompletion: string;
  id: string;
  status: JobStatusType;
  technician: string;
}

const STATUS_CHIP_STYLES: Record<string, string> = {
  INTAKE: "bg-secondary-container text-on-secondary-container",
  WAITING_FOR_PARTS: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  IN_REPAIR: "bg-primary/10 text-primary",
  ON_HOLD: "bg-error-container text-on-error-container",
  DONE: "bg-on-secondary-container/10 text-on-secondary-container",
  DELIVERED: "bg-on-secondary-container/10 text-on-secondary-container",
  RETURNED: "bg-outline-variant/20 text-on-surface-variant",
  CANCELLED: "bg-outline-variant/20 text-on-surface-variant",
};

const STATUS_BAR_STYLES: Record<string, string> = {
  INTAKE: "bg-secondary",
  WAITING_FOR_PARTS: "bg-tertiary",
  IN_REPAIR: "bg-primary",
  ON_HOLD: "bg-error",
  DONE: "bg-on-secondary-container",
  DELIVERED: "bg-on-secondary-container",
  RETURNED: "bg-outline-variant",
  CANCELLED: "bg-outline-variant",
};

interface ActiveRepairsQueueProps {
  jobs: RepairJob[];
}

export default function ActiveRepairsQueue({ jobs }: ActiveRepairsQueueProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold font-headline text-2xl tracking-tight">
          {t("front_desk.active_repairs")}
        </h2>
        <span className="rounded-full bg-surface-container px-3 py-1 font-label text-on-surface-variant text-sm">
          {t("front_desk.job_count", { count: jobs.length })}
        </span>
      </div>
      {jobs.length === 0 ? (
        <p className="font-medium text-on-surface-variant text-sm">
          {t("front_desk.no_active_repairs")}
        </p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              className="cursor-pointer overflow-hidden rounded-xl bg-surface-container-lowest shadow-premium transition-colors hover:bg-surface-container-low"
              key={job.id}
            >
              <div
                className={`h-1 w-full ${STATUS_BAR_STYLES[job.status] ?? "bg-primary"}`}
              />
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="mb-1 font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                      {t("job_id")}: {job.id}
                    </p>
                    <h3 className="font-extrabold font-headline text-primary text-xl">
                      {job.deviceModel}
                    </h3>
                    <p className="font-medium text-on-surface">
                      {job.customerName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-bold font-label text-xs uppercase ${STATUS_CHIP_STYLES[job.status] ?? "bg-primary/10 text-primary"}`}
                  >
                    {t(`status.${job.status}`)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-outline-variant/5 border-t pt-4">
                  <div>
                    <p className="font-bold text-[10px] text-on-surface-variant uppercase">
                      {t("front_desk.estimated_completion")}
                    </p>
                    <p className="font-bold text-sm">
                      {job.estimatedCompletion}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[10px] text-on-surface-variant uppercase">
                      {t("technician")}
                    </p>
                    <p className="font-bold text-sm">{job.technician}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        className="w-full text-center font-bold text-primary text-xs transition-all hover:underline"
        type="button"
      >
        {t("front_desk.view_all_repairs")}
      </button>
    </div>
  );
}
