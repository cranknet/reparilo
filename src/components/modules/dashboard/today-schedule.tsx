import { useTranslation } from "react-i18next";

interface ScheduleItem {
  customerName: string;
  device: string;
  id: string;
  repairType: string;
  status: string;
  time: string;
}

interface TodayScheduleProps {
  items: ScheduleItem[];
}

const STATUS_COLORS: Record<string, string> = {
  IN_REPAIR: "bg-primary",
  WAITING_FOR_PARTS: "bg-tertiary",
  INTAKE: "bg-secondary",
  TESTING: "bg-outline-variant",
  DONE: "bg-on-secondary-container",
};

export default function TodaySchedule({ items }: TodayScheduleProps) {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-6">
      <h3 className="mb-6 font-bold font-headline text-lg text-on-surface">
        {t("tech_dashboard.today_schedule")}
      </h3>
      <div className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-outline-variant/50">
        {items.map((item) => (
          <div className="relative pl-10" key={item.id}>
            <div
              className={`absolute top-1 left-0 h-6 w-6 rounded-full ${STATUS_COLORS[item.status] ?? "bg-outline-variant"} border-4 border-surface-container-low`}
            />
            <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container">
              <div>
                <p className="font-black text-primary text-xs">{item.time}</p>
                <h5 className="mt-1 font-bold text-sm">
                  {item.device}{" "}
                  <span className="font-normal text-on-surface-variant text-xs">
                    — {item.customerName}
                  </span>
                </h5>
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  {t("job_id")}: {item.id} &bull; {item.repairType}
                </p>
              </div>
              <button
                className="rounded-full bg-secondary/10 px-3 py-1 font-black text-[10px] text-secondary uppercase tracking-tighter transition-colors hover:bg-secondary hover:text-white"
                type="button"
              >
                {t("tech_dashboard.update")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
