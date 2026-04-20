import type { JobStatusType } from "@shared/constants";
import { JOB_STATUS_FLOW } from "@shared/constants";
import type { Job } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";
import StatusBadge from "./status-badge";

interface StatusChangeMenuProps {
  job: Job;
  onChanged?: () => void;
}

export default function StatusChangeMenu({
  job,
  onChanged,
}: StatusChangeMenuProps) {
  const { t } = useTranslation();
  const transitionStatus = useJobsStore((s) => s.transitionStatus);
  const [selectedStatus, setSelectedStatus] = useState<JobStatusType | null>(
    null
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableStatuses = JOB_STATUS_FLOW[job.status] ?? [];

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleSelect = useCallback((status: JobStatusType) => {
    setSelectedStatus(status);
    setReason("");
    setError(null);
    setDropdownOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedStatus(null);
    setReason("");
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedStatus) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await transitionStatus(job.id, selectedStatus, reason || undefined);
      setSelectedStatus(null);
      setReason("");
      onChanged?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("jobs_status_change_error_unknown");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, job.id, reason, transitionStatus, onChanged, t]);

  if (availableStatuses.length === 0) {
    return <StatusBadge status={job.status} />;
  }

  if (selectedStatus) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-body text-on-surface-variant text-sm">
            {t("status_label")}:
          </span>
          <StatusBadge status={job.status} />
          <span className="material-symbols-outlined text-on-surface-variant text-sm">
            arrow_forward
          </span>
          <StatusBadge status={selectedStatus} />
        </div>
        <textarea
          className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 font-body text-on-surface text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
          disabled={loading}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("jobs_status_change_reason_placeholder")}
          rows={2}
          value={reason}
        />
        {error && <p className="font-body text-error text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            className="rounded-xl px-4 py-2 font-bold font-headline text-on-surface-variant text-xs transition-colors hover:bg-surface-container-high"
            disabled={loading}
            onClick={handleCancel}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 font-bold font-headline text-on-primary text-xs transition-colors hover:bg-primary-container disabled:opacity-60"
            disabled={loading}
            onClick={handleConfirm}
            type="button"
          >
            {loading && (
              <span className="material-symbols-outlined animate-spin text-sm">
                progress_activity
              </span>
            )}
            {t("jobs_status_change_confirm")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 font-bold font-headline text-on-surface text-sm transition-colors hover:bg-surface-container-highest"
        onClick={() => setDropdownOpen((prev) => !prev)}
        type="button"
      >
        <StatusBadge status={job.status} />
        <span className="material-symbols-outlined text-on-surface-variant text-sm">
          {dropdownOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {dropdownOpen && (
        <div
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant"
          role="listbox"
        >
          <ul className="py-1">
            {availableStatuses.map((status) => (
              <li key={status}>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-start transition-colors hover:bg-surface-container-high"
                  onClick={() => handleSelect(status)}
                  role="option"
                  type="button"
                >
                  <StatusBadge status={status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
