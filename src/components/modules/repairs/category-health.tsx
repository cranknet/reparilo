import { useTranslation } from "react-i18next";

const CATEGORIES = [
  { color: "bg-primary", key: "HARDWARE", pct: 65 },
  { color: "bg-tertiary", key: "SOFTWARE", pct: 20 },
  { color: "bg-secondary", key: "DIAGNOSTIC", pct: 15 },
];

export default function CategoryHealth() {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl bg-surface-container-high p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-extrabold font-headline text-lg text-on-surface">
          {t("category_health")}
        </h3>
        <span className="material-symbols-outlined text-on-surface-variant">
          donut_large
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-bold text-on-surface text-sm">
                {t(`repair_category.${cat.key}`)}
              </span>
              <span className="font-bold text-on-surface-variant text-xs">
                {cat.pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className={`h-full rounded-full ${cat.color} transition-all duration-700`}
                style={{ width: `${cat.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-3 font-bold font-headline text-on-surface-variant text-xs uppercase tracking-wider transition-all hover:bg-surface-container-lowest"
        type="button"
      >
        <span className="material-symbols-outlined text-[18px]">download</span>
        {t("download_catalog_report")}
      </button>
    </div>
  );
}
