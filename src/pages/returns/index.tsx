import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReturnClaimsList } from "@/hooks/use-return-claims";
import type { ListClaimsParams } from "@/types/return-claim";
import ClaimsFilters from "@/components/modules/returns/claims-filters";
import ClaimsTable from "@/components/modules/returns/claims-table";

export default function ReturnsListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ListClaimsParams>({
    status: "OPEN",
    page: 1,
    limit: 20,
  });
  const { data, isLoading } = useReturnClaimsList(filters);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">
          {t("returns_list_title")}
        </h1>
        <p className="mt-1 text-on-surface-variant">
          {t("returns_list_subtitle")}
        </p>
      </header>

      <ClaimsFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="rounded-lg border border-outline-variant p-6 text-center text-on-surface-variant">
          {t("loading")}
        </div>
      ) : (
        <ClaimsTable
          items={data?.items ?? []}
          total={data?.total ?? 0}
          page={filters.page ?? 1}
          limit={filters.limit ?? 20}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      )}
    </div>
  );
}
