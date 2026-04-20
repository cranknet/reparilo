import type { Job } from "@shared/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDzd } from "@/lib/format";
import { useJobsStore } from "@/stores/jobs";
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
  const [showAddDialog, setShowAddDialog] = useState(false);

  const isTerminal = ["DELIVERED", "RETURNED", "CANCELLED"].includes(
    job.status
  );

  const handleRemovePart = useCallback(
    async (partId: string) => {
      try {
        await removePart(job.id, partId);
        onChanged?.();
      } catch {
        // error handled in store
      }
    },
    [removePart, job.id, onChanged]
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
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold font-label text-primary text-xs uppercase tracking-wider transition-colors hover:bg-surface-container-high"
            onClick={() => setShowAddDialog(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {t("jobs_parts_add")}
          </button>
        )}
      </div>

      {parts.length === 0 ? (
        <p className="font-body text-on-surface-variant text-sm">
          {t("jobs_parts_empty")}
        </p>
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
                  {t(`part_category.${part.category}`)} ·{" "}
                  {Number(part.unitPrice).toLocaleString()} × {part.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold font-headline text-on-surface text-xs">
                  {fmt(Number(part.totalCost))}
                </span>
                {!isTerminal && (
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                    onClick={() => handleRemovePart(part.id)}
                    title={t("jobs_parts_remove")}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">
                      close
                    </span>
                  </button>
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
