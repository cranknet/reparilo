import type { ModelSearchResult } from "@/hooks/use-model-search";

interface ModelSearchDropdownProps {
  disabled: boolean;
  isCreating: boolean;
  isSearching: boolean;
  onAdd: () => void;
  onSelect: (model: ModelSearchResult) => void;
  query: string;
  results: ModelSearchResult[];
  searchError: boolean;
  showAddOption: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  visible: boolean;
}

export default function ModelSearchDropdown({
  disabled,
  isCreating,
  isSearching,
  onAdd,
  onSelect,
  query,
  results,
  searchError,
  showAddOption,
  t,
  visible,
}: ModelSearchDropdownProps) {
  if (!visible || disabled) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant">
      {isSearching && !searchError && (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="material-symbols-outlined animate-spin text-on-surface-variant text-sm">
            progress_activity
          </span>
          <span className="font-label text-on-surface-variant text-xs">
            {t("intake.searching")}
          </span>
        </div>
      )}
      {searchError && (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="material-symbols-outlined text-error text-sm">
            error
          </span>
          <span className="font-label text-error text-xs">
            {t("intake.error_search_model")}
          </span>
        </div>
      )}
      {!isSearching && results.length > 0 && !searchError && (
        <ul className="max-h-48 overflow-y-auto py-1">
          {results.map((m) => (
            <li key={m.id}>
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-surface-container-high"
                onClick={() => onSelect(m)}
                type="button"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container">
                  <span className="material-symbols-outlined text-on-secondary-container text-sm">
                    phone_iphone
                  </span>
                </span>
                <span className="truncate font-bold font-headline text-on-surface text-sm">
                  {m.model}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showAddOption && !isSearching && !searchError && !isCreating && (
        <button
          className="flex w-full items-center gap-3 border-outline-variant border-t px-4 py-2.5 text-start transition-colors hover:bg-surface-container-high"
          onClick={onAdd}
          type="button"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary-container">
            <span className="material-symbols-outlined text-on-tertiary-container text-sm">
              add
            </span>
          </span>
          <span className="truncate font-bold font-headline text-primary text-sm">
            {t("intake.add_model", { name: query })}
          </span>
        </button>
      )}
      {isCreating && (
        <div className="flex items-center gap-2 border-outline-variant border-t px-4 py-3">
          <span className="material-symbols-outlined animate-spin text-on-surface-variant text-sm">
            progress_activity
          </span>
          <span className="font-label text-on-surface-variant text-xs">
            {t("intake.creating_model")}
          </span>
        </div>
      )}
      {!isSearching &&
        results.length === 0 &&
        !searchError &&
        !showAddOption &&
        query.length >= 1 && (
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">
              search_off
            </span>
            <span className="font-label text-on-surface-variant text-xs">
              {t("intake.no_model_found")}
            </span>
          </div>
        )}
    </div>
  );
}
