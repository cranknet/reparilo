import type { Customer, Job } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { Can } from "@/components/modules/can";
import EditCustomerDialog from "@/components/modules/customers/edit-customer-dialog";
import CostSummary from "@/components/modules/jobs/cost-summary";
import JobPartsSection from "@/components/modules/jobs/job-parts-section";
import JobPhotosSection from "@/components/modules/jobs/job-photos-section";
import JobRepairsSection from "@/components/modules/jobs/job-repairs-section";
import StatusHistoryTimeline from "@/components/modules/jobs/status-history-timeline";
import StatusPopover from "@/components/modules/jobs/status-popover";
import TechnicianSelect from "@/components/modules/jobs/technician-select";
import { formatDzd } from "@/lib/format";
import { useJobsStore } from "@/stores/jobs";

function fmt(n: number): string {
  return `${formatDzd(n)} DZD`;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackCopied, setTrackCopied] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);

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

  const handleCopyTrackLink = useCallback(() => {
    if (!job?.jobCode) {
      return;
    }
    const url = `${window.location.origin}/tracking/${job.jobCode}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setTrackCopied(true);
        setTimeout(() => setTrackCopied(false), 2000);
      },
      (err) => {
        console.error("Failed to copy tracking link:", err);
      }
    );
  }, [job?.jobCode]);

  const handleCustomerSaved = useCallback(
    (updated: Customer) => {
      if (job?.customer) {
        setJob({ ...job, customer: updated });
      }
    },
    [job]
  );

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
  const jobMargin = (job as Record<string, unknown>).margin as
    | number
    | undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        className="inline-flex items-center gap-1 font-bold text-primary text-sm hover:underline"
        to="/jobs"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        {t("jobs_detail_back")}
      </Link>

      <div className="mt-6 rounded-2xl bg-surface-container-high p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-extrabold font-headline text-lg text-on-surface tracking-tight sm:truncate sm:text-2xl">
              {[job.device?.brand, job.device?.model]
                .filter(Boolean)
                .join(" ") || t("intake.device_section")}
            </h1>
            {job.reportedProblem && (
              <p className="mt-1 line-clamp-2 font-body text-on-surface-variant text-sm">
                {job.reportedProblem}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-label text-on-surface-variant text-xs uppercase sm:hidden">
              {t("status_label")}
            </span>
            <StatusPopover job={job} onChanged={() => fetchJob()} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label text-on-surface-variant text-xs uppercase">
                {t("customers")}
              </span>
              <Can perm={{ customers: ["edit"] }}>
                <button
                  className="inline-flex items-center gap-0.5 text-primary text-xs hover:underline"
                  onClick={() => setShowEditCustomer(true)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">
                    edit
                  </span>
                </button>
              </Can>
            </div>
            <p className="font-body font-medium text-on-surface text-sm">
              {job.customer?.name}
            </p>
            <p className="font-label text-on-surface-variant text-xs">
              {job.customer?.phone}
            </p>
            {job.customer?.email && (
              <p className="font-label text-on-surface-variant text-xs">
                {job.customer.email}
              </p>
            )}
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
                size="sm"
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

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-bold font-label text-on-primary text-xs transition-colors hover:bg-primary-container hover:text-on-primary-container"
            to={`/tracking/${job.jobCode}`}
          >
            <span className="material-symbols-outlined text-sm">
              open_in_new
            </span>
            {t("jobs_detail_track")}
          </Link>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-on-surface"
            onClick={handleCopyTrackLink}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">
              {trackCopied ? "check" : "share"}
            </span>
            {trackCopied
              ? t("jobs_detail_track_link_copied")
              : t("jobs_detail_share")}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-on-surface"
            onClick={() =>
              window.open(`/api/receipts/${job.id}/receipt`, "_blank")
            }
            type="button"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            {t("jobs_detail_print")}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-on-surface"
            onClick={() =>
              window.open(`/api/receipts/${job.id}/label`, "_blank")
            }
            type="button"
          >
            <span className="material-symbols-outlined text-sm">label</span>
            {t("jobs_detail_print_label")}
          </button>
        </div>
      </div>

      {job.photos && job.photos.length > 0 && (
        <div className="mt-10">
          <JobPhotosSection job={job} onChanged={() => fetchJob()} />
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-4 font-bold font-headline text-base text-on-surface">
          {t("jobs_detail_history")}
        </h2>
        <StatusHistoryTimeline jobId={job.id} />
      </div>

      <div className="mt-8">
        <JobPartsSection job={job} onChanged={() => fetchJob()} />
      </div>

      <div className="mt-4">
        <JobRepairsSection job={job} onChanged={() => fetchJob()} />
      </div>

      <div className="mt-8">
        <CostSummary
          deposit={deposit}
          finalCost={finalCost}
          margin={jobMargin}
          partsTotal={partsTotal}
          repairsTotal={repairsTotal}
        />
      </div>

      {job.customer && (
        <EditCustomerDialog
          customer={job.customer}
          onClose={() => setShowEditCustomer(false)}
          onSaved={handleCustomerSaved}
          open={showEditCustomer}
        />
      )}
    </div>
  );
}
