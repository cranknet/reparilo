import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import ClaimHeader from "@/components/modules/returns/claim-header";
import ClaimPhotosSection from "@/components/modules/returns/claim-photos-section";
import ResolutionSection from "@/components/modules/returns/resolution-section";
import TriageSection from "@/components/modules/returns/triage-section";
import { useReturnClaim } from "@/hooks/use-return-claims";

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: claim, isLoading } = useReturnClaim(id);

  if (isLoading || !claim) {
    return <div className="p-6">{t("loading")}</div>;
  }

  const claimedLine =
    claim.claimedJobRepair?.repairName ??
    claim.claimedJobPart?.partName ??
    t("returns_detail_no_line");

  const getClaimedLineLabel = () => {
    if (claim.claimedJobRepair) {
      return t("returns_detail_claimed_repair");
    }
    if (claim.claimedJobPart) {
      return t("returns_detail_claimed_part");
    }
    return t("returns_detail_no_line");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ClaimHeader claim={claim} />

      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">{getClaimedLineLabel()}</h2>
        <p className="mt-1 text-on-surface">{claimedLine}</p>
        <h3 className="mt-3 font-medium text-on-surface-variant text-sm">
          {t("returns_detail_customer_complaint")}
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-on-surface">
          {claim.returnReason}
        </p>
      </section>

      <TriageSection claim={claim} />
      <ResolutionSection claim={claim} />
      <ClaimPhotosSection claim={claim} />
    </div>
  );
}
