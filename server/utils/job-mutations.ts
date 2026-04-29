import { INACTIVE_STATUSES } from "@shared/constants/job-statuses";

export function assertJobMutable(job: {
  status: string;
}): { error: "JOB_IN_TERMINAL_STATUS" } | null {
  if ((INACTIVE_STATUSES as string[]).includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }
  return null;
}
