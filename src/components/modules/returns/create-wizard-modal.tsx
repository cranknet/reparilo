import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useCreateReturnClaim } from "@/hooks/use-return-claims";
import WarrantyBadge from "./warranty-badge";

interface JobLine {
  daysSinceDelivered: number | null;
  id: string;
  kind: "repair" | "part";
  name: string;
  warrantyDays: number;
}

interface Props {
  onClose: () => void;
  /** Called when user picks "Not a warranty case" \u2014 parent should open new-job intake. */
  onCreateNewPaidJob: () => void;
  open: boolean;
  originalJob: {
    id: string;
    jobCode: string;
    customer: { id: string; name: string };
    repairs: JobLine[];
    parts: JobLine[];
  };
}

type Selection =
  | { kind: "repair"; id: string }
  | { kind: "part"; id: string }
  | { kind: "other" };

export default function CreateWizardModal({
  open,
  onClose,
  originalJob,
  onCreateNewPaidJob,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createClaim = useCreateReturnClaim();
  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<Selection>({ kind: "other" });
  const [reason, setReason] = useState("");

  if (!open) {
    return null;
  }

  const canNext = step === 1 && reason.trim().length > 0;

  const submitAccept = async () => {
    let payload: {
      originalJobId: string;
      claimedJobRepairId?: string;
      claimedJobPartId?: string;
      returnReason: string;
    };
    if (selection.kind === "repair") {
      payload = {
        originalJobId: originalJob.id,
        claimedJobRepairId: selection.id,
        returnReason: reason,
      };
    } else if (selection.kind === "part") {
      payload = {
        originalJobId: originalJob.id,
        claimedJobPartId: selection.id,
        returnReason: reason,
      };
    } else {
      payload = { originalJobId: originalJob.id, returnReason: reason };
    }
    const created = await createClaim.mutateAsync(payload);
    toast.success(t("returns_toast_created"));
    onClose();
    navigate(`/returns/${created.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-xl">
        {step === 1 && (
          <>
            <h2 className="font-bold text-lg">
              {t("returns_wizard_step1_title")}
            </h2>
            <p className="mt-1 text-on-surface-variant text-sm">
              {t("returns_wizard_select_line_help")}
            </p>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {originalJob.repairs.map((r) => (
                <label
                  className="flex items-center justify-between rounded border border-outline-variant p-2 text-sm"
                  key={r.id}
                >
                  <span className="flex items-center gap-2">
                    <input
                      checked={
                        selection.kind === "repair" && selection.id === r.id
                      }
                      name="line"
                      onChange={() =>
                        setSelection({ kind: "repair", id: r.id })
                      }
                      type="radio"
                    />
                    {r.name}
                  </span>
                  <WarrantyBadge
                    daysSinceDelivered={r.daysSinceDelivered}
                    warrantyDays={r.warrantyDays}
                  />
                </label>
              ))}
              {originalJob.parts.map((p) => (
                <label
                  className="flex items-center justify-between rounded border border-outline-variant p-2 text-sm"
                  key={p.id}
                >
                  <span className="flex items-center gap-2">
                    <input
                      checked={
                        selection.kind === "part" && selection.id === p.id
                      }
                      name="line"
                      onChange={() => setSelection({ kind: "part", id: p.id })}
                      type="radio"
                    />
                    {p.name}
                  </span>
                  <WarrantyBadge
                    daysSinceDelivered={p.daysSinceDelivered}
                    warrantyDays={p.warrantyDays}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 rounded border border-outline-variant p-2 text-sm">
                <input
                  checked={selection.kind === "other"}
                  name="line"
                  onChange={() => setSelection({ kind: "other" })}
                  type="radio"
                />
                {t("returns_wizard_different_problem")}
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-on-surface-variant">
                {t("returns_wizard_reason_label")}
              </span>
              <textarea
                className="min-h-[80px] w-full rounded border border-outline-variant bg-surface px-2 py-1.5"
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("returns_wizard_reason_placeholder")}
                value={reason}
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border border-outline-variant px-3 py-1.5 text-sm"
                onClick={onClose}
                type="button"
              >
                {t("returns_wizard_cancel")}
              </button>
              <button
                className="rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
                disabled={!canNext}
                onClick={() => setStep(2)}
                type="button"
              >
                {t("returns_wizard_next")}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-bold text-lg">
              {t("returns_wizard_step2_title")}
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              <button
                className="rounded bg-primary px-3 py-2 text-on-primary text-sm"
                disabled={createClaim.isPending}
                onClick={submitAccept}
                type="button"
              >
                {t("returns_wizard_accept")}
              </button>
              <button
                className="rounded border border-outline-variant px-3 py-2 text-sm"
                onClick={() => {
                  onClose();
                  onCreateNewPaidJob();
                }}
                type="button"
              >
                {t("returns_wizard_reject")}
              </button>
              <button
                className="text-on-surface-variant text-sm underline"
                onClick={() => setStep(1)}
                type="button"
              >
                {t("returns_wizard_back")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
