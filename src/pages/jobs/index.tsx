import type { JobStatusType } from "@shared/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BatchActionBar from "@/components/modules/jobs/batch-action-bar";
import UnifiedJobsFilter from "@/components/modules/jobs/filters";
import type {
  JobRow,
  StatusGroupKey,
} from "@/components/modules/jobs/jobs-shared";
import { jobToRow, STATUS_GROUPS } from "@/components/modules/jobs/jobs-shared";
import JobsTable from "@/components/modules/jobs/jobs-table";
import JobMobileCard from "@/components/modules/jobs/mobile-card";
import { exportJobsPdf } from "@/lib/export-pdf";
import { useJobsStore } from "@/stores/jobs";
import { useUiStore } from "@/stores/ui";

export default function JobsPage() {
  const { t } = useTranslation();
  const { jobs, metrics, isLoadingJobs, fetchJobs, fetchMetrics } =
    useJobsStore();
  const [statusFilter, setStatusFilter] = useState<JobStatusType | "ALL">(
    "ALL"
  );
  const [groupFilter, setGroupFilter] = useState<StatusGroupKey | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const openIntakeModal = useUiStore((s) => s.openIntakeModal);

  useEffect(() => {
    fetchJobs();
    fetchMetrics();
  }, [fetchJobs, fetchMetrics]);

  const jobRows: JobRow[] = useMemo(() => jobs.map(jobToRow), [jobs]);

  const filteredJobs = useMemo(() => {
    let result = jobRows;

    if (statusFilter !== "ALL") {
      result = result.filter((j) => j.status === statusFilter);
    } else if (groupFilter !== "ALL") {
      const group = STATUS_GROUPS.find((g) => g.key === groupFilter);
      if (group) {
        result = result.filter((j) => group.statuses.includes(j.status));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.id.toLowerCase().includes(q) ||
          j.customer.toLowerCase().includes(q) ||
          j.device.toLowerCase().includes(q)
      );
    }

    return result;
  }, [jobRows, statusFilter, groupFilter, searchQuery]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (filteredJobs.every((j) => prev.has(j.rawJob?.id ?? j.id))) {
        return new Set();
      }
      return new Set(filteredJobs.map((j) => j.rawJob?.id ?? j.id));
    });
  }, [filteredJobs]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedJobs = useMemo(
    () =>
      filteredJobs
        .filter((j) => selectedIds.has(j.rawJob?.id ?? j.id))
        .map((j) => ({ id: j.rawJob?.id ?? j.id, status: j.status })),
    [filteredJobs, selectedIds]
  );

  const handleGroupChange = (group: StatusGroupKey | "ALL") => {
    setGroupFilter(group);
    setStatusFilter("ALL");
  };

  const handleExport = useCallback(() => {
    exportJobsPdf({
      columns: [
        t("job_id"),
        t("customer"),
        t("device"),
        t("status_label"),
        t("technician"),
      ],
      rows: filteredJobs,
      title: t("open_repairs"),
      filename: "jobs.pdf",
    });
  }, [filteredJobs, t]);

  if (isLoadingJobs && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("open_repairs")}
          </h2>
          <p className="mt-1 font-body font-medium text-on-surface-variant text-sm md:text-base">
            {t("open_repairs_desc")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            aria-label={t("download_list")}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-low px-4 py-2.5 font-bold font-headline text-on-surface-variant text-sm transition-all hover:bg-surface-container-high sm:flex-none md:px-6"
            onClick={handleExport}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              file_export
            </span>
            <span className="whitespace-nowrap">{t("download_list")}</span>
          </button>
          <button
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold font-headline text-on-primary text-sm transition-all hover:bg-primary-container sm:flex-none md:px-8"
            onClick={() => openIntakeModal()}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              add_box
            </span>
            <span className="whitespace-nowrap">{t("new_checkin")}</span>
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <UnifiedJobsFilter
          activeGroup={groupFilter}
          activeStatus={statusFilter}
          metrics={metrics}
          onGroupChange={handleGroupChange}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          searchQuery={searchQuery}
        />

        <div className="hidden sm:block">
          <JobsTable
            jobs={filteredJobs}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            selectedIds={selectedIds}
          />
        </div>

        <div className="space-y-3 sm:hidden">
          {filteredJobs.map((job) => (
            <JobMobileCard
              customer={job.customer}
              customerTier={job.customerTier}
              device={job.device}
              deviceIcon={job.deviceIcon}
              id={job.id}
              key={job.id}
              rawJob={job.rawJob}
              status={job.status}
            />
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined mb-4 text-5xl text-on-surface-variant">
              search_off
            </span>
            <p className="font-bold font-headline text-on-surface-variant text-sm">
              {t("no_jobs_found")}
            </p>
            <p className="mt-1 font-body text-on-surface-variant text-xs">
              {t("no_jobs_found_desc")}
            </p>
          </div>
        )}
      </section>

      <BatchActionBar
        onClear={clearSelection}
        selectedIds={selectedIds}
        selectedJobs={selectedJobs}
      />
    </>
  );
}
