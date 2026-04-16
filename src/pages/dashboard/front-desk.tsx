import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import ActiveRepairsQueue from "@/components/modules/dashboard/active-repairs-queue";
import PriorityAlertsPanel from "@/components/modules/dashboard/priority-alerts-panel";
import QuickIntakeForm from "@/components/modules/dashboard/quick-intake-form";
import QuickStatsChips from "@/components/modules/dashboard/quick-stats-chips";
import TodayOverview from "@/components/modules/dashboard/today-overview";
import WaitingCustomers from "@/components/modules/dashboard/waiting-customers";

const MOCK_REPAIRS: {
  customerName: string;
  completedAt?: string;
  estimatedCompletion?: string;
  id: string;
  deviceModel: string;
  status: JobStatusType;
  technician: string;
}[] = [
  {
    id: "#8821",
    deviceModel: "iPhone 15 Pro Max",
    customerName: "Liam Sterling",
    status: "IN_REPAIR",
    estimatedCompletion: "Today, 4:30 PM",
    technician: "Marco Ross",
  },
  {
    id: "#8819",
    deviceModel: "MacBook Air M2",
    customerName: "Elena Vance",
    status: "WAITING_FOR_PARTS",
    estimatedCompletion: "Oct 26, 11:00 AM",
    technician: "Unassigned",
  },
  {
    id: "#8815",
    deviceModel: "Samsung S24 Ultra",
    customerName: "David Chen",
    status: "DONE",
    completedAt: "2 Hours Ago",
    technician: "Sarah Jenkins",
  },
  {
    id: "#8810",
    deviceModel: "iPad Pro 12.9",
    customerName: "Nora Fields",
    status: "INTAKE",
    estimatedCompletion: "Oct 27, 2:00 PM",
    technician: "Unassigned",
  },
];

const MOCK_RECENT_INTAKES: {
  id: string;
  device: string;
  status: JobStatusType;
  timeAgo: string;
}[] = [
  { id: "#8822", device: "Pixel 8 Pro", status: "INTAKE", timeAgo: "5m ago" },
  {
    id: "#8821",
    device: "iPhone 15 Pro Max",
    status: "IN_REPAIR",
    timeAgo: "22m ago",
  },
  {
    id: "#8819",
    device: "MacBook Air M2",
    status: "WAITING_FOR_PARTS",
    timeAgo: "1h ago",
  },
];

const MOCK_ALERTS = [
  {
    id: "alert-overdue",
    icon: "warning",
    title: "2 Repairs Overdue",
    description: "Action required immediately",
    variant: "error" as const,
  },
  {
    id: "alert-parts",
    icon: "inventory_2",
    title: "Parts Arrived",
    description: "Screen for #8812 arrived",
    variant: "secondary" as const,
  },
  {
    id: "alert-warranty",
    icon: "history",
    title: "Warranty Return",
    description: "Customer: Jordan Bates",
    variant: "tertiary" as const,
  },
];

const MOCK_WAITING = [
  { id: "w-1", initials: "BT", name: "Ben Thompson", waitMinutes: 12 },
  { id: "w-2", initials: "MK", name: "Maria Khan", waitMinutes: 5 },
];

export default function FrontDeskPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("front_desk.title")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("front_desk.subtitle")}
          </p>
        </div>
      </div>

      <section className="mb-8 space-y-2">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3 font-bold text-white shadow-premium transition-opacity hover:opacity-90 sm:w-auto"
          type="button"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add_circle
          </span>
          {t("new_checkin")}
        </button>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-2.5 font-semibold text-on-surface-variant transition-colors hover:bg-secondary-fixed-dim hover:text-on-secondary-fixed sm:flex-row sm:justify-center sm:gap-2 sm:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            <span className="text-[10px] leading-tight sm:text-xs sm:leading-normal">
              {t("front_desk.walk_in_lookup")}
            </span>
          </button>
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-2.5 font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:flex-row sm:justify-center sm:gap-2 sm:px-4"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            <span className="text-[10px] leading-tight sm:text-xs sm:leading-normal">
              {t("front_desk.print_receipt")}
            </span>
          </button>
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-high px-2 py-2.5 font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary sm:flex-row sm:justify-center sm:gap-2 sm:px-4"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">summarize</span>
            <span className="text-[10px] leading-tight sm:text-xs sm:leading-normal">
              {t("daily_summary")}
            </span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-5">
          <ActiveRepairsQueue jobs={MOCK_REPAIRS} />
        </div>

        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-4">
          <TodayOverview
            completedToday={15}
            recentIntakes={MOCK_RECENT_INTAKES}
            totalToday={23}
          />
          <QuickIntakeForm />
        </div>

        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-3">
          <PriorityAlertsPanel alerts={MOCK_ALERTS} />
          <WaitingCustomers customers={MOCK_WAITING} />
          <QuickStatsChips
            stats={[
              { labelKey: "front_desk.mttr", value: "2.4", unit: "h" },
              { labelKey: "front_desk.csat", value: "4.9" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
