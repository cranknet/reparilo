import { INACTIVE_STATUSES } from "@shared/constants";
import type { Job, JobPart } from "@shared/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Can } from "@/components/modules/can";
import { formatDzd } from "@/lib/format";
import { useJobsStore } from "@/stores/jobs";
import { useToastStore } from "@/stores/toast";
import AddPartDialog from "./add-part-dialog";

interface JobPartsSectionProps {
  job: Job;
  onChanged?: () => void;
}

function fmt(n: number): string {
  return `${formatDzd(n)} DZD`;
}

export default function JobPartsSection({
  job,
  onChanged,
}: JobPartsSectionProps) {
  const { t } = useTranslation();
  const removePart = useJobsStore((s) => s.removePart);
  const addPart = useJobsStore((s) => s.addPart);
  const undoToast = useToastStore((s) => s.undoToast);
  const regularToast = useToastStore((s) => s.toast);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const isTerminal = INACTIVE_STATUSES.includes(
    job.status as (typeof INACTIVE_STATUSES)[number]
  );

  const handleRemovePart = useCallback(
    async (partId: string, partData: JobPart) => {
      try {
        await removePart(job.id, partId);
        onChanged?.();
        undoToast("job_part_remove_success", "undo", () => {
          addPart(job.id, {
            partName: partData.partName,
            category: partData.category,
            quantity: partData.quantity,
            unitPrice: Number(partData.unitPrice),
          })
            .then(() => {
              onChanged?.();
              regularToast("job_part_undone");
            })
            .catch(() => {
              regularToast("job_part_undo_failed", "error");
            });
        });
      } catch {
        regularToast("job_part_remove_failed", "error");
      }
    },
    [removePart, addPart, job.id, onChanged, undoToast, regularToast]
  );

  const parts = job.partsUsed ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold font-headline text-base text-on-surface">
          {t("jobs_parts_title")}
        </h2>
        {!isTerminal && (
          <button
            className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 font-bold font-label text-primary text-xs uppercase tracking-wider transition-colors hover:bg-surface-container-high"
            onClick={() => setShowAddDialog(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {t("jobs_parts_add")}
          </button>
        )}
      </div>

      {parts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-surface-container-low/50 py-8">
          <span className="material-symbols-outlined mb-2 text-3xl text-on-surface-variant/60">
            inventory_2
          </span>
          <p className="font-bold font-headline text-on-surface-variant text-sm">
            {t("jobs_parts_empty_title")}
          </p>
          <p className="mt-1 font-body text-on-surface-variant/80 text-xs">
            {t("jobs_parts_empty_desc")}
          </p>
          {!isTerminal && (
            <button
              className="mt-3 flex min-h-[44px] items-center gap-1 rounded-lg bg-primary px-3 font-bold font-label text-on-primary text-xs uppercase tracking-wider transition-colors hover:bg-primary-container hover:text-on-primary-container"
              onClick={() => setShowAddDialog(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {t("jobs_parts_add")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {parts.map((part) => (
            <div
              className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2"
              key={part.id}
            >
              <div className="min-w-0 flex-1">
                <p className="font-body font-medium text-on-surface text-sm">
                  {part.partName}
                </p>
                <p className="font-label text-on-surface-variant text-xs">
                  {t(`part_category.${part.category}`)}
                  <Can perm={{ parts: ["viewCost"] }}>
                    {" "}
                    · {Number(part.unitPrice).toLocaleString()} ×{" "}
                    {part.quantity}
                  </Can>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Can perm={{ parts: ["viewCost"] }}>
                  <span className="font-bold font-headline text-on-surface text-xs">
                    {fmt(Number(part.totalCost))}
                  </span>
                </Can>
                {!isTerminal && (
                  <RemovePartButton
                    onRemove={() => handleRemovePart(part.id, part)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPartDialog
        jobId={job.id}
        onAdded={() => {
          setShowAddDialog(false);
          onChanged?.();
        }}
        onClose={() => setShowAddDialog(false)}
        open={showAddDialog}
      />
    </div>
  );
}

function RemovePartButton({ onRemove }: { onRemove: () => void }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1">
        <span className="font-label text-[10px] text-error">
          {t("confirm_remove")}
        </span>
        <button
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-error text-on-error transition-colors hover:bg-on-error hover:text-error"
          onClick={() => {
            onRemove();
            setConfirming(false);
          }}
          title={t("confirm")}
          type="button"
        >
          <span className="material-symbols-outlined text-sm">check</span>
        </button>
        <button
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high"
          onClick={() => setConfirming(false)}
          title={t("cancel")}
          type="button"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    );
  }

  return (
    <button
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
      onClick={() => setConfirming(true)}
      title={t("jobs_parts_remove")}
      type="button"
    >
      <span className="material-symbols-outlined text-sm">close</span>
    </button>
  );
}
