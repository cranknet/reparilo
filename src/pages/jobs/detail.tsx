import type { Job } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import JobPartsSection from "@/components/modules/jobs/job-parts-section";
import StatusBadge from "@/components/modules/jobs/status-badge";
import StatusChangeMenu from "@/components/modules/jobs/status-change-menu";
import StatusHistoryTimeline from "@/components/modules/jobs/status-history-timeline";
import TechnicianSelect from "@/components/modules/jobs/technician-select";
import { useJobsStore } from "@/stores/jobs";

function fmt(n: number): string {
  return `${n.toLocaleString()} DZD`;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await useJobsStore.getState().fetchJobById(id);
      setJob(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleCopyCode = useCallback(() => {
    if (!job?.jobCode) {
      return;
    }
    navigator.clipboard.writeText(job.jobCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [job?.jobCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-2xl text-on-surface-variant">
          progress_activity
        </span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="py-20 text-center">
        <span className="material-symbols-outlined text-3xl text-error">
          error
        </span>
        <p className="mt-2 font-body text-error text-sm">
          {error ?? "Job not found"}
        </p>
        <Link
          className="mt-4 inline-block font-bold text-primary text-sm hover:underline"
          to="/jobs"
        >
          {t("jobs_detail_back")}
        </Link>
      </div>
    );
  }

  const partsTotal = (job.partsUsed ?? []).reduce(
    (s, p) =>
      s + (typeof p.totalCost === "number" ? p.totalCost : Number(p.totalCost)),
    0
  );
  const repairsTotal = (job.repairs ?? []).reduce(
    (s, r) => s + (typeof r.price === "number" ? r.price : Number(r.price)),
    0
  );
  const deposit =
    typeof job.depositAmount === "number"
      ? job.depositAmount
      : Number(job.depositAmount ?? 0);
  const finalCost = partsTotal + repairsTotal - deposit;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link
        className="inline-flex items-center gap-1 font-bold text-primary text-sm hover:underline"
        to="/jobs"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        {t("jobs_detail_back")}
      </Link>

      <div className="rounded-xl bg-surface-container-lowest p-6 ring-1 ring-outline-variant">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              className="flex items-center gap-2 hover:opacity-80"
              onClick={handleCopyCode}
              type="button"
            >
              <h1 className="font-extrabold font-headline text-2xl text-primary tracking-tight">
                {job.jobCode}
              </h1>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
            <p className="mt-1 font-body text-on-surface text-sm">
              {job.device?.brand} {job.device?.model}
              {(job.device?.brand || job.device?.model) && " · "}
              {job.reportedProblem}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <span className="font-label text-on-surface-variant text-xs uppercase">
              {t("customers")}
            </span>
            <p className="font-body font-medium text-on-surface text-sm">
              {job.customer?.name}
            </p>
            <p className="font-label text-on-surface-variant text-xs">
              {job.customer?.phone}
            </p>
          </div>
          <div>
            <span className="font-label text-on-surface-variant text-xs uppercase">
              {t("technician")}
            </span>
            <div className="mt-1">
              <TechnicianSelect
                currentTechnicianId={job.technician?.id}
                currentTechnicianName={job.technician?.name}
                jobId={job.id}
                onChanged={() => fetchJob()}
              />
            </div>
          </div>
          <div>
            <span className="font-label text-on-surface-variant text-xs uppercase">
              {t("intake.estimated_cost")}
            </span>
            <p className="font-bold font-headline text-on-surface text-sm">
              {fmt(
                typeof job.estimatedCost === "number"
                  ? job.estimatedCost
                  : Number(job.estimatedCost ?? 0)
              )}
            </p>
          </div>
          {job.estimatedDate && (
            <div>
              <span className="font-label text-on-surface-variant text-xs uppercase">
                {t("intake.delivery_date")}
              </span>
              <p className="font-body font-medium text-on-surface text-sm">
                {new Date(job.estimatedDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-6 ring-1 ring-outline-variant">
        <h2 className="mb-4 font-bold font-headline text-base text-on-surface">
          {t("jobs_detail_change_to")}
        </h2>
        <StatusChangeMenu job={job} onChanged={() => fetchJob()} />
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-6 ring-1 ring-outline-variant">
        <JobPartsSection job={job} onChanged={() => fetchJob()} />
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-6 ring-1 ring-outline-variant">
        <h2 className="mb-4 font-bold font-headline text-base text-on-surface">
          {t("jobs_detail_cost_summary")}
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-body text-on-surface-variant text-sm">
              {t("jobs_detail_parts_subtotal")}
            </span>
            <span className="font-body font-medium text-on-surface text-sm">
              {fmt(partsTotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-body text-on-surface-variant text-sm">
              {t("jobs_detail_repairs_subtotal")}
            </span>
            <span className="font-body font-medium text-on-surface text-sm">
              {fmt(repairsTotal)}
            </span>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between">
              <span className="font-body text-on-surface-variant text-sm">
                {t("jobs_detail_deposit")}
              </span>
              <span className="font-body font-medium text-on-surface text-sm">
                -{fmt(deposit)}
              </span>
            </div>
          )}
          <div className="border-outline-variant border-t pt-2">
            <div className="flex justify-between">
              <span className="font-bold font-headline text-on-surface text-sm">
                {t("jobs_detail_final_cost")}
              </span>
              <span className="font-extrabold font-headline text-lg text-primary">
                {fmt(finalCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-6 ring-1 ring-outline-variant">
        <h2 className="mb-4 font-bold font-headline text-base text-on-surface">
          {t("jobs_detail_history")}
        </h2>
        <StatusHistoryTimeline jobId={job.id} />
      </div>
    </div>
  );
}
