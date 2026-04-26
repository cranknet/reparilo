import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "@/hooks/use-debounce";
import { useCustomersStore } from "@/stores/customers";

interface CustomerSearchResult {
  _count: { jobs: number };
  email: string | null;
  id: string;
  name: string;
  phone: string;
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const { searchCustomers } = useCustomersStore();
  const [results, setResults] = useState<CustomerSearchResult[]>([]);

  useEffect(() => {
    if (debounced.trim().length >= 2) {
      searchCustomers(debounced).then(setResults);
    } else {
      setResults([]);
    }
  }, [debounced, searchCustomers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-extrabold font-headline text-2xl text-on-surface">
          {t("customers")}
        </h1>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
          search
        </span>
        <input
          className="w-full rounded-xl bg-surface-container-high py-3 ps-10 pe-4 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_customers_placeholder")}
          type="text"
          value={query}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((customer) => (
            <a
              className="flex items-center justify-between rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
              href={`/customers/${customer.id}`}
              key={customer.id}
            >
              <div>
                <p className="font-bold text-on-surface text-sm">
                  {customer.name}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {customer.phone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-xs">
                  {t("job_count", { count: customer._count.jobs })}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {debounced.trim().length >= 2 && results.length === 0 && (
        <div className="py-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined mb-2 text-4xl">
            person_off
          </span>
          <p>{t("no_customers_found")}</p>
        </div>
      )}
    </div>
  );
}
