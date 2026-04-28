import type { JobStatusType } from "@shared/constants";
import { JobStatus } from "@shared/constants";

export interface PipelineItem {
  color: string;
  descriptionKey: string;
  status: JobStatusType;
}

export const PIPELINE_ITEMS: PipelineItem[] = [
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

export const PIPELINE_ITEMS_ACCENT: PipelineItem[] = PIPELINE_ITEMS.map(
  (item) =>
    item.status === JobStatus.ON_HOLD
      ? { ...item, color: "bg-error-container" }
      : item
);
