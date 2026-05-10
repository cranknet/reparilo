import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

export default function ClaimHeader({ claim }: Props) {
  const { t, i18n } = useTranslation();
  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleString(i18n.language) : "—";
  const isGoodwill =
    claim.warrantyInfo.deliveredAt !== null &&
    !claim.warrantyInfo.isInWarrantyAtOpen;

  return (
    <header className="space-y-3">
      <Link className="text-on-surface-variant text-sm underline" to="/returns">
        ← {t("returns_detail_back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
          {t("returns_detail_title", { id: claim.id })}
        </h2>
        <span
          className={
            claim.status === "OPEN"
              ? "rounded-full bg-primary-container px-3 py-1 font-medium text-on-primary-container text-xs"
              : "rounded-full bg-surface-variant px-3 py-1 font-medium text-xs"
          }
        >
          {t(`returns_status_${claim.status.toLowerCase()}`)}
        </span>
        {isGoodwill && (
          <span className="rounded-full bg-error-container px-3 py-1 font-medium text-on-error-container text-xs">
            {t("returns_warranty_goodwill")}
          </span>
        )}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
        <div>
          <span className="text-on-surface-variant">
            {t("returns_detail_original_job")}:{" "}
          </span>
          <Link className="underline" to={`/jobs/${claim.originalJob.id}`}>
            {claim.originalJob.jobCode}
          </Link>
        </div>
        <div>
          <span className="text-on-surface-variant">
            {t("returns_detail_customer")}:{" "}
          </span>
          <Link
            className="underline"
            to={`/customers/${claim.originalJob.customer.id}`}
          >
            {claim.originalJob.customer.name}
          </Link>
        </div>
        <div className="sm:col-span-2 md:col-span-1">
          {t("returns_detail_opened_by", {
            name: claim.openedBy.name,
            date: fmt(claim.openedAt),
          })}
        </div>
        {claim.resolvedAt && claim.resolvedBy && (
          <div className="sm:col-span-2 md:col-span-1">
            {t("returns_detail_resolved_by", {
              name: claim.resolvedBy.name,
              date: fmt(claim.resolvedAt),
            })}
          </div>
        )}
      </div>
    </header>
  );
}
