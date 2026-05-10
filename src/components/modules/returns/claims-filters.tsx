import { useTranslation } from "react-i18next";
import type { ListClaimsParams } from "@/types/return-claim";

interface Props {
  value: ListClaimsParams;
  onChange: (next: ListClaimsParams) => void;
}

export default function ClaimsFilters({ value, onChange }: Props) {
  const { t } = useTranslation();

  const set = <K extends keyof ListClaimsParams>(
    key: K,
    v: ListClaimsParams[K],
  ) => onChange({ ...value, [key]: v, page: 1 });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant bg-surface-container p-4">
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">
          {t("returns_filter_status")}
        </span>
        <select
          aria-label={t("returns_filter_status")}
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.status ?? ""}
          onChange={(e) =>
            set(
              "status",
              (e.target.value || undefined) as ListClaimsParams["status"],
            )
          }
        >
          <option value="">—</option>
          <option value="OPEN">{t("returns_status_open")}</option>
          <option value="RESOLVED">{t("returns_status_resolved")}</option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">
          {t("returns_filter_fault")}
        </span>
        <select
          aria-label={t("returns_filter_fault")}
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.faultCategory ?? ""}
          onChange={(e) =>
            set(
              "faultCategory",
              (e.target.value || undefined) as ListClaimsParams["faultCategory"],
            )
          }
        >
          <option value="">—</option>
          <option value="WORKMANSHIP">
            {t("returns_fault_workmanship")}
          </option>
          <option value="DEFECTIVE_PART">
            {t("returns_fault_defective_part")}
          </option>
          <option value="MISDIAGNOSIS">
            {t("returns_fault_misdiagnosis")}
          </option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">
          {t("returns_filter_outcome")}
        </span>
        <select
          aria-label={t("returns_filter_outcome")}
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.resolutionOutcome ?? ""}
          onChange={(e) =>
            set(
              "resolutionOutcome",
              (e.target.value || undefined) as ListClaimsParams["resolutionOutcome"],
            )
          }
        >
          <option value="">—</option>
          <option value="REWORK_FREE">{t("returns_outcome_rework_free")}</option>
          <option value="REWORK_PARTIAL_CHARGE">
            {t("returns_outcome_rework_partial_charge")}
          </option>
          <option value="REFUND_PARTIAL">
            {t("returns_outcome_refund_partial")}
          </option>
          <option value="REFUND_FULL">{t("returns_outcome_refund_full")}</option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">
          {t("returns_filter_from")}
        </span>
        <input
          aria-label={t("returns_filter_from")}
          type="date"
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.from ? value.from.slice(0, 10) : ""}
          onChange={(e) =>
            set(
              "from",
              e.target.value ? new Date(e.target.value).toISOString() : undefined,
            )
          }
        />
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">
          {t("returns_filter_to")}
        </span>
        <input
          aria-label={t("returns_filter_to")}
          type="date"
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.to ? value.to.slice(0, 10) : ""}
          onChange={(e) =>
            set(
              "to",
              e.target.value ? new Date(e.target.value).toISOString() : undefined,
            )
          }
        />
      </label>

      <button
        type="button"
        className="rounded border border-outline-variant bg-surface px-3 py-1.5 text-sm hover:bg-surface-container-high"
        onClick={() => onChange({ page: 1, limit: 20 })}
      >
        {t("returns_filter_clear")}
      </button>
    </div>
  );
}
