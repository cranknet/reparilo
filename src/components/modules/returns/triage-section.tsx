import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { useTriageClaim } from "@/hooks/use-return-claims";
import type { FaultCategory, ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

const OPTIONS: FaultCategory[] = [
  "WORKMANSHIP",
  "DEFECTIVE_PART",
  "MISDIAGNOSIS",
];

export default function TriageSection({ claim }: Props) {
  const { t } = useTranslation();
  const canTriage = useCan({ returns: ["triage"] });
  const triage = useTriageClaim(claim.id);
  const [selected, setSelected] = useState<FaultCategory | null>(
    claim.faultCategory
  );

  if (claim.status === "RESOLVED") {
    return null;
  }

  const onSave = async () => {
    if (!selected) {
      return;
    }
    await triage.mutateAsync({ faultCategory: selected });
    toast.success(t("returns_triage_saved"));
  };

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">
        {t("returns_triage_title")}
      </h2>
      <p className="mt-1 text-on-surface-variant text-sm">
        {t("returns_triage_help")}
      </p>

      <fieldset className="mt-3 space-y-2" disabled={!canTriage}>
        {OPTIONS.map((opt) => (
          <label className="flex items-center gap-2 text-sm" key={opt}>
            <input
              checked={selected === opt}
              name="faultCategory"
              onChange={() => setSelected(opt)}
              type="radio"
              value={opt}
            />
            {t(`returns_fault_${opt.toLowerCase()}`)}
          </label>
        ))}
      </fieldset>

      <button
        className="mt-3 rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
        disabled={
          !(canTriage && selected) ||
          triage.isPending ||
          selected === claim.faultCategory
        }
        onClick={onSave}
        type="button"
      >
        {t("returns_triage_save")}
      </button>
    </section>
  );
}
