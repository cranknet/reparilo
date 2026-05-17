import type { FaultCategory } from "@generated/enums";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { triageClaim } from "@/lib/api-return-claims";
import type { ReturnClaimDetail } from "@/types/return-claim";

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
  const [selected, setSelected] = useState<FaultCategory | null>(
    claim.faultCategory
  );
  const [isSaving, setSaving] = useState(false);

  if (claim.status === "RESOLVED") {
    return null;
  }

  const onSave = async () => {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      await triageClaim(claim.id, { faultCategory: selected });
      toast.success(t("returns_triage_saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl bg-surface-container-low p-5">
      <h2 className="font-bold text-on-surface">{t("returns_triage_title")}</h2>
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

      <Button
        className="mt-3"
        disabled={
          !(canTriage && selected) ||
          isSaving ||
          selected === claim.faultCategory
        }
        loading={isSaving}
        onClick={onSave}
        size="sm"
        type="button"
        variant="primary"
      >
        {t("returns_triage_save")}
      </Button>
    </section>
  );
}
