import type { Job, RepairCatalog } from "@shared/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import RepairServicePicker from "@/components/modules/jobs/repair-service-picker";
import { formatDzd } from "@/lib/format";
import { useJobsStore } from "@/stores/jobs";

interface JobRepairsSectionProps {
  job: Job;
  onChanged?: () => void;
}

export default function JobRepairsSection({
  job,
  onChanged,
}: JobRepairsSectionProps) {
  const { t } = useTranslation();
  const addRepair = useJobsStore((s) => s.addRepair);
  const removeRepair = useJobsStore((s) => s.removeRepair);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairCatalog | null>(
    null
  );
  const [price, setPrice] = useState("");

  const isTerminal = ["DELIVERED", "RETURNED", "CANCELLED"].includes(
    job.status
  );

  const handleSelectRepair = useCallback((repair: RepairCatalog) => {
    setSelectedRepair(repair);
    setPrice(String(Number(repair.defaultPrice)));
  }, []);

  const handleAddRepair = async () => {
    if (!(selectedRepair && price)) {
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      await addRepair(job.id, {
        repairId: selectedRepair.id,
        repairName: selectedRepair.name,
        category: selectedRepair.category,
        price: Number(price) || 0,
      });
      setSelectedRepair(null);
      setPrice("");
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
  };

  const handleRemoveRepair = useCallback(
    async (repairId: string) => {
      try {
        await removeRepair(job.id, repairId);
        onChanged?.();
      } catch {
        // error handled in store
      }
    },
    [removeRepair, job.id, onChanged]
  );

  const repairs = job.repairs ?? [];
  const selectedIds = repairs
    .map((r) => r.repairId)
    .filter((id): id is string => id != null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold font-headline text-base text-on-surface">
          {t("jobs_repairs_title")}
        </h2>
        {!isTerminal && (
          <button
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold font-label text-primary text-xs uppercase tracking-wider transition-colors hover:bg-surface-container-high"
            onClick={() => setShowForm(!showForm)}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {t("jobs_repairs_add")}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 space-y-3 rounded-xl bg-surface-container-low p-4">
          <RepairServicePicker
            compact
            onSelect={handleSelectRepair}
            selectedIds={selectedIds}
          />
          {selectedRepair && (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold font-headline text-on-surface text-sm">
                  {selectedRepair.name}
                </p>
                <p className="font-label text-on-surface-variant text-xs">
                  {t(`repair_category.${selectedRepair.category}`)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  className="w-24 rounded-xl border-none bg-surface-container-lowest px-3 py-2 font-body text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  min="0"
                  onChange={(e) => setPrice(e.target.value)}
                  step="0.01"
                  type="number"
                  value={price}
                />
                <span className="font-label text-on-surface-variant text-xs">
                  {t("currency_dzd")}
                </span>
              </div>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                onClick={() => {
                  setSelectedRepair(null);
                  setPrice("");
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          {formError && (
            <p className="font-body text-error text-xs">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              className="rounded-xl px-3 py-2 font-bold font-headline text-on-surface-variant text-xs transition-colors hover:bg-surface-container-high"
              onClick={() => {
                setShowForm(false);
                setSelectedRepair(null);
                setPrice("");
              }}
              type="button"
            >
              {t("cancel")}
            </button>
            <button
              className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 font-bold font-headline text-on-primary text-xs transition-colors disabled:opacity-60"
              disabled={loading || !selectedRepair || !price}
              onClick={handleAddRepair}
              type="button"
            >
              {loading && (
                <span className="material-symbols-outlined animate-spin text-sm">
                  progress_activity
                </span>
              )}
              {t("jobs_repairs_add")}
            </button>
          </div>
        </div>
      )}

      {repairs.length === 0 ? (
        <p className="font-body text-on-surface-variant text-sm">
          {t("jobs_repairs_empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {repairs.map((repair) => (
            <div
              className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2"
              key={repair.id}
            >
              <div className="min-w-0 flex-1">
                <p className="font-body font-medium text-on-surface text-sm">
                  {repair.repairName}
                </p>
                <p className="font-label text-on-surface-variant text-xs">
                  {t(`repair_category.${repair.category}`)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold font-headline text-on-surface text-xs">
                  {formatDzd(Number(repair.price))} {t("currency_dzd")}
                </span>
                {!isTerminal && (
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                    onClick={() => handleRemoveRepair(repair.id)}
                    title={t("jobs_repairs_remove")}
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
