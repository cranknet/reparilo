import { useTranslation } from "react-i18next";

interface StatItem {
  labelKey: string;
  unit?: string;
  value: string;
}

interface QuickStatsChipsProps {
  stats: StatItem[];
}

export default function QuickStatsChips({ stats }: QuickStatsChipsProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="mb-4 font-bold font-headline text-lg">
        {t("front_desk.quick_stats")}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div
            className="rounded-lg bg-surface-container-low p-3 text-center"
            key={stat.labelKey}
          >
            <p className="font-bold text-on-surface-variant text-xs uppercase">
              {t(stat.labelKey)}
            </p>
            <p className="font-extrabold text-lg text-primary">
              {stat.value}
              {stat.unit && <span className="text-xs">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
