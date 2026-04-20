import type { JobStatusType } from "@shared/constants";
import { JOB_STATUS_FLOW } from "@shared/constants";
import type { Job } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";
import StatusBadge from "./status-badge";

const REQUIRES_REASON: JobStatusType[] = ["ON_HOLD", "CANCELLED"];

interface StatusPopoverProps {
  job: Job;
  onChanged?: () => void;
}

export default function StatusPopover({ job, onChanged }: StatusPopoverProps) {
  const { t } = useTranslation();
  const transitionStatus = useJobsStore((s) => s.transitionStatus);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<JobStatusType | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableStatuses = JOB_STATUS_FLOW[job.status] ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setPending(null);
        setReason("");
        setError(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPending(null);
        setReason("");
        setError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSelect = useCallback(
    (status: JobStatusType) => {
      if (REQUIRES_REASON.includes(status)) {
        setPending(status);
        setReason("");
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      transitionStatus(job.id, status)
        .then(() => {
          setOpen(false);
          onChanged?.();
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : t("jobs_status_change_error_unknown")
          );
        })
        .finally(() => setLoading(false));
    },
    [job.id, transitionStatus, onChanged, t]
  );

  const handleConfirmReason = useCallback(async () => {
    if (!pending) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await transitionStatus(job.id, pending, reason.trim() || undefined);
      setOpen(false);
      setPending(null);
      setReason("");
      onChanged?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t("jobs_status_change_error_unknown")
      );
    } finally {
      setLoading(false);
    }
  }, [pending, reason, job.id, transitionStatus, onChanged, t]);

  const handleCancelReason = useCallback(() => {
    setPending(null);
    setReason("");
    setError(null);
  }, []);

  if (availableStatuses.length === 0) {
    return <StatusBadge status={job.status} />;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="flex items-center gap-1.5 rounded-full transition-colors hover:brightness-95"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <StatusBadge status={job.status} />
        <span className="material-symbols-outlined text-on-surface-variant text-sm">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div
          className="absolute end-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant"
          role="listbox"
        >
          {!pending && (
            <ul className="py-1">
              {availableStatuses.map((status) => (
                <li key={status}>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-start transition-colors hover:bg-surface-container-high"
                    disabled={loading}
                    onClick={() => handleSelect(status)}
                    role="option"
                    type="button"
                  >
                    <StatusBadge status={status} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pending && (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                <span className="material-symbols-outlined text-on-surface-variant text-sm">
                  arrow_forward
                </span>
                <StatusBadge status={pending} />
              </div>
              <textarea
                className="w-full resize-none rounded-xl bg-surface-container-highest px-4 py-3 font-body text-on-surface text-sm placeholder:text-outline focus:ring-2 focus:ring-primary/20"
                disabled={loading}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("jobs_status_change_reason_placeholder")}
                rows={2}
                value={reason}
              />
              {error && <p className="font-body text-error text-xs">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-xl px-4 py-2 font-bold font-headline text-on-surface-variant text-xs transition-colors hover:bg-surface-container-high"
                  disabled={loading}
                  onClick={handleCancelReason}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 font-bold font-headline text-on-primary text-xs transition-colors hover:bg-primary-container disabled:opacity-60"
                  disabled={loading}
                  onClick={handleConfirmReason}
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
          )}
        </div>
      )}
    </div>
  );
}
