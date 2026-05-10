import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { useResolveClaim, useSpawnRework } from "@/hooks/use-return-claims";
import type { ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

export default function ResolutionSection({ claim }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const canRework = useCan({ returns: ["resolveRework"] });
  const canRefund = useCan({ returns: ["resolveRefund"] });
  const spawnRework = useSpawnRework(claim.id);
  const resolveClaim = useResolveClaim(claim.id);

  const [partialCharge, setPartialCharge] = useState<string>("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [path, setPath] = useState<"rework" | "refund">("rework");

  if (claim.status === "RESOLVED") {
    return (
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">
          {t("returns_resolution_title")}
        </h2>
        <p className="mt-2 text-on-surface">
          {t("returns_resolution_resolved_outcome", {
            outcome: t(
              `returns_outcome_${claim.resolutionOutcome?.toLowerCase()}`
            ),
          })}
        </p>
        {claim.resolvedAt && (
          <p className="text-on-surface-variant text-sm">
            {t("returns_resolution_resolved_at", {
              date: new Date(claim.resolvedAt).toLocaleString(i18n.language),
            })}
          </p>
        )}
      </section>
    );
  }

  const faultMissing = !claim.faultCategory;

  return (
    <section className="space-y-4 rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">
        {t("returns_resolution_title")}
      </h2>
      <p className="text-on-surface-variant text-sm">
        {t("returns_resolution_choose_path")}
      </p>

      <div className="flex gap-2">
        <button
          className={`rounded px-3 py-1.5 text-sm ${path === "rework" ? "bg-primary text-on-primary" : "border border-outline-variant"}`}
          onClick={() => setPath("rework")}
          type="button"
        >
          {t("returns_resolution_path_rework")}
        </button>
        <button
          className={`rounded px-3 py-1.5 text-sm ${path === "refund" ? "bg-primary text-on-primary" : "border border-outline-variant"}`}
          disabled={!canRefund}
          onClick={() => setPath("refund")}
          type="button"
        >
          {t("returns_resolution_path_refund")}
        </button>
      </div>

      {path === "rework" && (
        <div className="space-y-3">
          {!claim.reworkJob && (
            <button
              className="rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
              disabled={!canRework || faultMissing || spawnRework.isPending}
              onClick={async () => {
                const r = await spawnRework.mutateAsync();
                toast.success(t("returns_toast_rework_spawned"));
                navigate(`/jobs/${r.reworkJobId}`);
              }}
              type="button"
            >
              {t("returns_resolution_spawn_rework")}
            </button>
          )}

          {claim.reworkJob && claim.reworkJob.status !== "DELIVERED" && (
            <p className="text-on-surface-variant text-sm">
              {t("returns_resolution_rework_pending")}{" "}
              <Link className="underline" to={`/jobs/${claim.reworkJob.id}`}>
                {claim.reworkJob.jobCode}
              </Link>
            </p>
          )}

          {claim.reworkJob && claim.reworkJob.status === "DELIVERED" && (
            <div className="space-y-3">
              <p className="text-sm">
                {t("returns_resolution_rework_delivered")}
              </p>
              <button
                className="rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
                disabled={!canRework || faultMissing || resolveClaim.isPending}
                onClick={async () => {
                  await resolveClaim.mutateAsync({
                    resolutionOutcome: "REWORK_FREE",
                  });
                  toast.success(t("returns_toast_resolved"));
                }}
                type="button"
              >
                {t("returns_resolution_resolve_rework_free")}
              </button>

              <div className="flex items-center gap-2">
                <input
                  aria-label={t("returns_resolution_partial_charge_label")}
                  className="w-32 rounded border border-outline-variant bg-surface px-2 py-1.5 text-sm"
                  min={1}
                  onChange={(e) => setPartialCharge(e.target.value)}
                  type="number"
                  value={partialCharge}
                />
                <button
                  className="rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
                  disabled={
                    !canRework || faultMissing || resolveClaim.isPending
                  }
                  onClick={async () => {
                    const amount = Number(partialCharge);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      return;
                    }
                    await resolveClaim.mutateAsync({
                      resolutionOutcome: "REWORK_PARTIAL_CHARGE",
                      partialChargeAmount: amount,
                    });
                    toast.success(t("returns_toast_resolved"));
                  }}
                  type="button"
                >
                  {t("returns_resolution_resolve_rework_partial")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {path === "refund" && canRefund && (
        <div className="flex items-center gap-2">
          <input
            aria-label={t("returns_resolution_refund_amount_label")}
            className="w-32 rounded border border-outline-variant bg-surface px-2 py-1.5 text-sm"
            min={1}
            onChange={(e) => setRefundAmount(e.target.value)}
            type="number"
            value={refundAmount}
          />
          <button
            className="rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
            disabled={faultMissing || resolveClaim.isPending}
            onClick={async () => {
              const amount = Number(refundAmount);
              if (!Number.isFinite(amount) || amount <= 0) {
                return;
              }
              await resolveClaim.mutateAsync({
                resolutionOutcome: "REFUND_PARTIAL",
                refundAmount: amount,
              });
              toast.success(t("returns_toast_resolved"));
            }}
            type="button"
          >
            {t("returns_resolution_resolve_refund_partial")}
          </button>
          <button
            className="rounded bg-primary px-3 py-1.5 text-on-primary text-sm disabled:opacity-50"
            disabled={faultMissing || resolveClaim.isPending}
            onClick={async () => {
              const amount = Number(refundAmount);
              if (!Number.isFinite(amount) || amount <= 0) {
                return;
              }
              await resolveClaim.mutateAsync({
                resolutionOutcome: "REFUND_FULL",
                refundAmount: amount,
              });
              toast.success(t("returns_toast_resolved"));
            }}
            type="button"
          >
            {t("returns_resolution_resolve_refund_full")}
          </button>
        </div>
      )}
    </section>
  );
}
