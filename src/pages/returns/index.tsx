import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ClaimsFilters from "@/components/modules/returns/claims-filters";
import ClaimsTable from "@/components/modules/returns/claims-table";
import { fetchReturnClaims } from "@/lib/api-return-claims";
import type {
  ListClaimsParams,
  ListClaimsResponse,
} from "@/types/return-claim";

export default function ReturnsListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ListClaimsParams>({
    status: "OPEN",
    page: 1,
    limit: 20,
  });
  const [data, setData] = useState<ListClaimsResponse | null>(null);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReturnClaims(filters);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-bold text-2xl text-on-surface">
          {t("returns_list_title")}
        </h1>
        <p className="mt-1 text-on-surface-variant">
          {t("returns_list_subtitle")}
        </p>
      </header>

      <ClaimsFilters onChange={setFilters} value={filters} />

      {isLoading ? (
        <div className="rounded-lg border border-outline-variant p-6 text-center text-on-surface-variant">
          {t("loading")}
        </div>
      ) : (
        <ClaimsTable
          items={data?.items ?? []}
          limit={filters.limit ?? 20}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          page={filters.page ?? 1}
          total={data?.total ?? 0}
        />
      )}
    </div>
  );
}
