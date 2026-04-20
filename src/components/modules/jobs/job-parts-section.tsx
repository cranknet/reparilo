import type { Job } from "@shared/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDzd } from "@/lib/format";
import { useJobsStore } from "@/stores/jobs";

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
  const addPart = useJobsStore((s) => s.addPart);
  const removePart = useJobsStore((s) => s.removePart);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [partName, setPartName] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  const isTerminal = ["DELIVERED", "RETURNED", "CANCELLED"].includes(
    job.status
  );

  const handleAddPart = useCallback(async () => {
    if (!(partName.trim() && unitPrice)) {
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      await addPart(job.id, {
        partName: partName.trim(),
        category,
        unitPrice: Number(unitPrice),
        quantity: Number(quantity) || 1,
      });
      setPartName("");
      setUnitPrice("");
      setQuantity("1");
      setShowForm(false);
      onChanged?.();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("jobs_status_change_error_unknown")
      );
    } finally {
      setLoading(false);
    }
  }, [addPart, job.id, partName, category, unitPrice, quantity, onChanged, t]);

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
            onClick={() => setShowForm(!showForm)}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {t("jobs_parts_add")}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 rounded-xl bg-surface-container-low p-4">
          <input
            className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-2.5 font-body text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
            onChange={(e) => setPartName(e.target.value)}
            placeholder={t("jobs_parts_part_name")}
            type="text"
            value={partName}
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              className="rounded-xl border-none bg-surface-container-lowest px-3 py-2.5 font-body text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
              onChange={(e) => setCategory(e.target.value)}
              value={category}
            >
              {[
                "SCREEN",
                "BATTERY",
                "CHARGING_PORT",
                "CAMERA",
                "SPEAKER",
                "MICROPHONE",
                "MOTHERBOARD",
                "HOUSING",
                "BUTTON",
                "OTHER",
              ].map((cat) => (
                <option key={cat} value={cat}>
                  {t(`part_category.${cat}`)}
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border-none bg-surface-container-lowest px-4 py-2.5 font-body text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder={t("jobs_parts_unit_price")}
              type="number"
              value={unitPrice}
            />
            <input
              className="rounded-xl border-none bg-surface-container-lowest px-4 py-2.5 font-body text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
              min="1"
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t("jobs_parts_quantity")}
              type="number"
              value={quantity}
            />
          </div>
          {formError && (
            <p className="font-body text-error text-xs">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              className="rounded-xl px-3 py-2 font-bold font-headline text-on-surface-variant text-xs transition-colors hover:bg-surface-container-high"
              onClick={() => setShowForm(false)}
              type="button"
            >
              {t("cancel")}
            </button>
            <button
              className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 font-bold font-headline text-on-primary text-xs transition-colors disabled:opacity-60"
              disabled={loading || !partName.trim() || !unitPrice}
              onClick={handleAddPart}
              type="button"
            >
              {loading && (
                <span className="material-symbols-outlined animate-spin text-sm">
                  progress_activity
                </span>
              )}
              {t("jobs_parts_add")}
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}
