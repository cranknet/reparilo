import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Icon } from "@/components/ui/icon";
import type { ReturnClaimListItem } from "@/types/return-claim";

interface Props {
  isLoading?: boolean;
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

function SkeletonRow() {
  return (
    <tr>
      <td className="px-5 py-4">
        <div className="h-3 w-16 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-20 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="hidden px-5 py-4 sm:table-cell">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="hidden px-5 py-4 md:table-cell">
        <div className="h-3 w-28 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="hidden px-5 py-4 lg:table-cell">
        <div className="h-3 w-20 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="hidden px-5 py-4 lg:table-cell">
        <div className="h-3 w-16 animate-pulse rounded bg-surface-container-high" />
      </td>
      <td className="px-5 py-4">
        <div className="h-5 w-14 animate-pulse rounded-full bg-surface-container-high" />
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-8 animate-pulse rounded bg-surface-container-high" />
      </td>
    </tr>
  );
}

function MobileClaimCard({
  item,
  t,
}: {
  item: ReturnClaimListItem;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const claimedLine =
    item.claimedJobRepair?.repairName ??
    item.claimedJobPart?.partName ??
    t("returns_table_claimed_other");

  return (
    <Link
      className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container-low"
      to={`/returns/${item.id}`}
    >
      <div className="min-w-0">
        <p className="font-bold text-on-surface text-sm">
          {item.originalJob.jobCode}
        </p>
        <p className="text-on-surface-variant text-xs">
          {new Date(item.openedAt).toLocaleDateString()} — {claimedLine}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={
            item.status === "OPEN"
              ? "rounded-full bg-primary-container px-2.5 py-1 font-bold text-on-primary-container text-xs"
              : "rounded-full bg-surface-container-high px-2.5 py-1 font-bold text-on-surface-variant text-xs"
          }
        >
          {t(`returns_status_${item.status.toLowerCase()}`)}
        </span>
        <Icon
          className="text-on-surface-variant"
          name="chevron_right"
          size="sm"
        />
      </div>
    </Link>
  );
}

export default function ClaimsTable({
  items,
  total,
  page,
  limit,
  onPageChange,
  isLoading,
}: Props) {
  const { t, i18n } = useTranslation();

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(i18n.language);

  const claimedLine = (it: ReturnClaimListItem) =>
    it.claimedJobRepair?.repairName ??
    it.claimedJobPart?.partName ??
    t("returns_table_claimed_other");

  const thCls =
    "px-5 py-4 font-bold text-on-surface-variant text-xs uppercase tracking-wide text-start";

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-low">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[540px] border-collapse text-start">
          <thead>
            <tr className="bg-surface-container-high/50">
              <th className={thCls}>{t("returns_table_col_date")}</th>
              <th className={thCls}>{t("returns_table_col_job")}</th>
              <th className={`${thCls} hidden sm:table-cell`}>
                {t("returns_table_col_customer")}
              </th>
              <th className={`${thCls} hidden md:table-cell`}>
                {t("returns_table_col_claimed")}
              </th>
              <th className={`${thCls} hidden lg:table-cell`}>
                {t("returns_table_col_fault")}
              </th>
              <th className={`${thCls} hidden lg:table-cell`}>
                {t("returns_table_col_outcome")}
              </th>
              <th className={thCls}>{t("returns_table_col_status")}</th>
              <th className={thCls}>{t("returns_table_col_age")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={`skeleton-${String(i)}`} />
                ))
              : items.map((it) => (
                  <tr
                    className="transition-colors hover:bg-surface-container-lowest"
                    key={it.id}
                  >
                    <td className="px-5 py-4 text-on-surface-variant text-sm">
                      {fmtDate(it.openedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className="font-bold text-on-surface text-sm hover:underline"
                        to={`/jobs/${it.originalJob.id}`}
                      >
                        {it.originalJob.jobCode}
                      </Link>
                    </td>
                    <td className="hidden px-5 py-4 sm:table-cell">
                      <span className="text-on-surface-variant text-sm">
                        {it.originalJob.customer.name}
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <Link
                        className="text-on-surface text-sm hover:underline"
                        to={`/returns/${it.id}`}
                      >
                        {claimedLine(it)}
                      </Link>
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      <span className="text-on-surface-variant text-sm">
                        {it.faultCategory
                          ? t(`returns_fault_${it.faultCategory.toLowerCase()}`)
                          : "\u2014"}
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      <span className="text-on-surface-variant text-sm">
                        {it.resolutionOutcome
                          ? t(
                              `returns_outcome_${it.resolutionOutcome.toLowerCase()}`
                            )
                          : "\u2014"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          it.status === "OPEN"
                            ? "rounded-full bg-primary-container px-2.5 py-1 font-bold text-on-primary-container text-xs"
                            : "rounded-full bg-surface-container-high px-2.5 py-1 font-bold text-on-surface-variant text-xs"
                        }
                      >
                        {t(`returns_status_${it.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-on-surface-variant text-sm">
                        {t("returns_table_age_days", {
                          count: ageDays(it.openedAt, it.resolvedAt),
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-3 md:hidden">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                className="flex flex-col gap-3 rounded-xl p-4"
                key={`mobile-skeleton-${String(i)}`}
              >
                <div className="h-3 w-3/5 animate-pulse rounded bg-surface-container-high" />
                <div className="h-2 w-2/5 animate-pulse rounded bg-surface-container-highest" />
              </div>
            ))
          : items.map((it) => <MobileClaimCard item={it} key={it.id} t={t} />)}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between border-outline-variant border-t px-5 py-3 text-sm">
          <span className="text-on-surface-variant">
            {`${(page - 1) * limit + 1}\u2013${Math.min(page * limit, total)} / ${total}`}
          </span>
          <div className="flex gap-2">
            <button
              className="flex min-h-9 items-center justify-center rounded-lg bg-surface-container-highest px-3 font-bold text-on-surface-variant text-sm transition-colors hover:bg-surface-container disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              type="button"
            >
              {t("previous")}
            </button>
            <button
              className="flex min-h-9 items-center justify-center rounded-lg bg-surface-container-highest px-3 font-bold text-on-surface-variant text-sm transition-colors hover:bg-surface-container disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              type="button"
            >
              {t("next")}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
