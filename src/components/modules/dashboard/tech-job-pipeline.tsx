import type { JobStatusType } from "@shared/constants";
import { JobStatus } from "@shared/constants";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

const PIPELINE_ITEMS: {
  status: JobStatusType;
  color: string;
  descriptionKey: string;
}[] = [
  {
    status: JobStatus.INTAKE,
    color: "bg-secondary-container",
    descriptionKey: "pipeline_intake_desc",
  },
  {
    status: JobStatus.WAITING_FOR_PARTS,
    color: "bg-tertiary-fixed",
    descriptionKey: "pipeline_waiting_desc",
  },
  {
    status: JobStatus.IN_REPAIR,
    color: "bg-primary",
    descriptionKey: "pipeline_repair_desc",
  },
  {
    status: JobStatus.ON_HOLD,
    color: "bg-outline-variant",
    descriptionKey: "pipeline_hold_desc",
  },
  {
    status: JobStatus.DONE,
    color: "bg-on-secondary-container",
    descriptionKey: "pipeline_done_desc",
  },
];

interface TechJobPipelineProps {
  benchCapacity: number;
  benchTotal: number;
  benchUsed: number;
  counts: Record<JobStatusType, number>;
}

export default function TechJobPipeline({
  counts,
  benchCapacity,
  benchUsed,
  benchTotal,
}: TechJobPipelineProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleStatusClick = (status: JobStatusType) => {
    navigate(`/jobs?status=${status}`);
  };

  return (
    <div className="h-full rounded-xl bg-surface-container-low p-6 ring-1 ring-surface-container-low/50 transition-all">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-bold font-headline text-lg text-on-surface">
          {t("tech_dashboard.my_repair_board")}
        </h3>
        <span className="font-bold text-primary text-xs uppercase">
          {t("realtime")}
        </span>
      </div>
      <div className="space-y-3">
        {PIPELINE_ITEMS.map(({ status, color, descriptionKey }) => (
          <button
            className={`flex w-full cursor-pointer items-center justify-between rounded-lg p-3 text-left transition-all hover:bg-surface-container-high ${
              status === JobStatus.IN_REPAIR
                ? "bg-surface-container-highest ring-1 ring-surface-container-low"
                : ""
            }`}
            key={status}
            onClick={() => handleStatusClick(status)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
              <div className="text-left">
                <p className="font-bold text-on-surface text-sm">
                  {t(`status.${status}`)}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {t(descriptionKey)}
                </p>
              </div>
            </div>
            <span className="font-extrabold font-headline text-on-surface text-xl">
              {String(counts[status]).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-8 rounded-xl bg-primary-fixed p-4 ring-1 ring-primary/20 transition-all">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold text-primary text-xs uppercase">
            {t("tech_dashboard.my_bench_usage")}
          </p>
          <span className="font-bold text-primary text-xs">
            {benchUsed}/{benchTotal} {t("tech_dashboard.slots")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-lowest/50">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, benchCapacity))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
