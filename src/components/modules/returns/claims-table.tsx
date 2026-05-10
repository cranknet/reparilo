import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ReturnClaimListItem } from "@/types/return-claim";

interface Props {
  items: ReturnClaimListItem[];
  limit: number;
  onPageChange: (page: number) => void;
  page: number;
  total: number;
}

function ageDays(openedAt: string, resolvedAt: string | null): number {
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  return Math.max(
    0,
    Math.floor((end.getTime() - new Date(openedAt).getTime()) / 86_400_000)
  );
}

export default function ClaimsTable({
  items,
  total,
  page,
  limit,
  onPageChange,
}: Props) {
  const { t, i18n } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface-container p-10 text-center">
        <p className="font-medium text-lg text-on-surface">
          {t("returns_list_empty_title")}
        </p>
        <p className="mt-1 text-on-surface-variant text-sm">
          {t("returns_list_empty_desc")}
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(i18n.language);

  const claimedLine = (it: ReturnClaimListItem) =>
    it.claimedJobRepair?.repairName ??
    it.claimedJobPart?.partName ??
    t("returns_table_claimed_other");

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-high text-left text-on-surface-variant">
          <tr>
            <th className="px-3 py-2">{t("returns_table_col_date")}</th>
            <th className="px-3 py-2">{t("returns_table_col_job")}</th>
            <th className="px-3 py-2">{t("returns_table_col_customer")}</th>
            <th className="px-3 py-2">{t("returns_table_col_claimed")}</th>
            <th className="px-3 py-2">{t("returns_table_col_fault")}</th>
            <th className="px-3 py-2">{t("returns_table_col_outcome")}</th>
            <th className="px-3 py-2">{t("returns_table_col_status")}</th>
            <th className="px-3 py-2">{t("returns_table_col_age")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant bg-surface">
          {items.map((it) => (
            <tr className="hover:bg-surface-container" key={it.id}>
              <td className="px-3 py-2">{fmtDate(it.openedAt)}</td>
              <td className="px-3 py-2">
                <Link className="underline" to={`/jobs/${it.originalJob.id}`}>
                  {it.originalJob.jobCode}
                </Link>
              </td>
              <td className="px-3 py-2">{it.originalJob.customer.name}</td>
              <td className="px-3 py-2">
                <Link className="underline" to={`/returns/${it.id}`}>
                  {claimedLine(it)}
                </Link>
              </td>
              <td className="px-3 py-2">
                {it.faultCategory
                  ? t(`returns_fault_${it.faultCategory.toLowerCase()}`)
                  : "—"}
              </td>
              <td className="px-3 py-2">
                {it.resolutionOutcome
                  ? t(`returns_outcome_${it.resolutionOutcome.toLowerCase()}`)
                  : "—"}
              </td>
              <td className="px-3 py-2">
                {t(`returns_status_${it.status.toLowerCase()}`)}
              </td>
              <td className="px-3 py-2">
                {t("returns_table_age_days", {
                  count: ageDays(it.openedAt, it.resolvedAt),
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav className="flex items-center justify-between border-outline-variant border-t bg-surface-container px-3 py-2 text-sm">
        <span>{`${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}`}</span>
        <div className="flex gap-2">
          <button
            className="rounded border border-outline-variant px-2 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            ‹
          </button>
          <button
            className="rounded border border-outline-variant px-2 py-1 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            ›
          </button>
        </div>
      </nav>
    </div>
  );
}
