import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useReturnClaimsList } from "@/hooks/use-return-claims";

interface Props {
  jobId: string;
}

export default function JobReturnsHistorySection({ jobId }: Props) {
  const { t } = useTranslation();
  const { data } = useReturnClaimsList({ originalJobId: jobId, limit: 50 });

  if (!data || data.items.length === 0) {
    return (
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">
          {t("returns_job_history_title")}
        </h2>
        <p className="mt-1 text-on-surface-variant text-sm">
          {t("returns_job_history_empty")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">
        {t("returns_job_history_title")}
      </h2>
      <ul className="mt-2 divide-y divide-outline-variant">
        {data.items.map((c) => (
          <li
            className="flex items-center justify-between py-2 text-sm"
            key={c.id}
          >
            <Link className="underline" to={`/returns/${c.id}`}>
              {new Date(c.openedAt).toLocaleDateString()} —{" "}
              {c.claimedJobRepair?.repairName ??
                c.claimedJobPart?.partName ??
                t("returns_table_claimed_other")}
            </Link>
            <span>{t(`returns_status_${c.status.toLowerCase()}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
