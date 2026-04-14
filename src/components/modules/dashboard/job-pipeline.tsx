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
    color: "bg-error-container",
    descriptionKey: "pipeline_hold_desc",
  },
  {
    status: JobStatus.DONE,
    color: "bg-on-secondary-container",
    descriptionKey: "pipeline_done_desc",
  },
];

interface JobPipelineProps {
  benchCapacity: number;
  counts: Record<JobStatusType, number>;
}

// ... existing imports ...
// ... existing imports ...
export default function JobPipeline({
  counts,
  benchCapacity,
}: JobPipelineProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleStatusClick = (status: JobStatusType) => {
    navigate(`/jobs?status=${status}`);
  };

  return (
    <div className="h-full rounded-xl bg-surface-container-low p-6 ring-1 ring-surface-container-low/50 transition-all">
      <h3 className="mb-6 flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
        <span className="material-symbols-outlined">account_tree</span>
        {t("job_pipeline")}
      </h3>
      <div className="space-y-3">
        {PIPELINE_ITEMS.map(({ status, color, descriptionKey }) => (
          <button
            className={`flex w-full cursor-pointer items-center justify-between rounded-lg p-3 text-left transition-all hover:bg-white/50 ${
              status === JobStatus.IN_REPAIR
                ? "bg-surface-container-highest ring-1 ring-surface-container-low"
                : ""
            }`}
            key={status}
            onClick={() => handleStatusClick(status)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <div className={`h-8 w-2 rounded-full ${color}`} />
              <div className="text-left">
                <p className="font-bold text-on-surface text-sm">
                  {t(`status.${status}`)}
                </p>
                <p className="text-[10px] text-on-surface-variant">
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
          <p className="font-bold text-[10px] text-primary uppercase">
            {t("bench_capacity")}
          </p>
          <span className="font-bold text-[10px] text-primary">
            {benchCapacity}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/50">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${benchCapacity}%` }}
          />
        </div>
      </div>
    </div>
  );
}
