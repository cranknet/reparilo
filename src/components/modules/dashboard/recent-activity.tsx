import { useTranslation } from "react-i18next";

interface ActivityItem {
  icon: string;
  iconColor: string;
  id: string;
  textKey: string;
  timeAgo: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

export default function RecentActivity({ items }: RecentActivityProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl bg-surface-container-low p-6">
      <h3 className="mb-4 font-bold font-headline text-lg text-on-surface">
        {t("tech_dashboard.recent_activity")}
      </h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div className="flex items-start gap-4" key={item.id}>
            <div
              className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.iconColor}`}
            >
              <span className="material-symbols-outlined text-sm">
                {item.icon}
              </span>
            </div>
            <div>
              <p className="text-on-surface text-sm">
                {t(item.textKey, { id: item.id })}
              </p>
              <p className="text-on-surface-variant/60 text-xs">
                {item.timeAgo}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
