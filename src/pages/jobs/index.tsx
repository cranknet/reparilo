import type { JobStatusType } from "@shared/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import JobsFilters from "@/components/modules/jobs/filters";
import type { JobRow } from "@/components/modules/jobs/jobs-table";
import JobsTable from "@/components/modules/jobs/jobs-table";
import JobMetricCard from "@/components/modules/jobs/metric-card";
import JobMobileCard from "@/components/modules/jobs/mobile-card";

const MOCK_METRICS = [
  {
    detail: "+2 high",
    icon: "priority_high",
    label: "queue_priority",
    value: "12",
  },
  {
    detail: "In progress",
    icon: "engineering",
    label: "on_bench",
    value: "08",
  },
  {
    detail: "Pending deliv.",
    icon: "shopping_cart",
    iconColor: "text-tertiary",
    label: "awaiting_parts",
    value: "04",
  },
  {
    detail: "Ready today",
    icon: "verified",
    iconColor: "text-secondary",
    label: "quality_check",
    value: "03",
  },
];

const MOCK_JOBS: JobRow[] = [
  {
    id: "REP-2026-0042",
    device: "iPhone 14 Pro Max",
    deviceIcon: "phone",
    deviceSpec: "A16 | Space Black",
    customer: "Karim Benali",
    customerTier: "Standard",
    status: "IN_REPAIR" as JobStatusType,
    technician: "Yacine M.",
  },
  {
    id: "REP-2026-0045",
    device: 'iPad Air M2 11"',
    deviceIcon: "tablet",
    deviceSpec: "Wi-Fi | Blue",
    customer: "Leila Kermiche",
    customerTier: "VIP",
    status: "WAITING_FOR_PARTS" as JobStatusType,
    technician: "Sarah B.",
  },
  {
    id: "REP-2026-0051",
    device: "Samsung Galaxy S24 Ultra",
    deviceIcon: "phone",
    deviceSpec: "Snapdragon | Titanium Gray",
    customer: "Omar Hadj",
    status: "INTAKE" as JobStatusType,
  },
  {
    id: "REP-2026-0058",
    device: "MacBook Air M3",
    deviceIcon: "laptop",
    deviceSpec: '13" | Midnight',
    customer: "Fatima Zeroual",
    customerTier: "VIP",
    status: "ON_HOLD" as JobStatusType,
    technician: "Yacine M.",
  },
  {
    id: "REP-2026-0061",
    device: "Apple Watch Series 9",
    deviceIcon: "watch",
    deviceSpec: "45mm | Starlight",
    customer: "Nabil Rouabeh",
    status: "DONE" as JobStatusType,
    technician: "Sarah B.",
  },
];

export default function JobsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<JobStatusType | "ALL">(
    "ALL"
  );

  const filteredJobs =
    statusFilter === "ALL"
      ? MOCK_JOBS
      : MOCK_JOBS.filter((j) => j.status === statusFilter);

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("jobs_queue")}
          </h2>
          <p className="mt-1 font-body font-medium text-on-surface-variant text-sm md:text-base">
            {t("jobs_queue_desc")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-2.5 font-bold font-headline text-on-secondary-fixed-variant text-sm transition-all hover:bg-slate-300 sm:flex-none md:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              print
            </span>
            <span className="whitespace-nowrap">{t("export")}</span>
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-4 py-2.5 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 sm:flex-none md:px-8"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              add_box
            </span>
            <span className="whitespace-nowrap">{t("new_intake")}</span>
          </button>
        </div>
      </div>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {MOCK_METRICS.map((m) => (
          <JobMetricCard
            detail={m.detail}
            icon={m.icon}
            iconColor={m.iconColor}
            key={m.label}
            label={t(m.label)}
            value={m.value}
          />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="font-extrabold font-headline text-on-surface text-xl tracking-tight md:text-2xl">
              {t("jobs_queue")}
            </h3>
            <p className="font-body font-medium text-on-surface-variant text-xs md:text-sm">
              {t("jobs_queue_desc")}
            </p>
          </div>
          <JobsFilters
            activeStatus={statusFilter}
            onStatusChange={setStatusFilter}
          />
        </div>

        <div className="hidden sm:block">
          <JobsTable jobs={filteredJobs} />
        </div>

        <div className="space-y-4 sm:hidden">
          {filteredJobs.map((job) => (
            <JobMobileCard
              customer={job.customer}
              device={job.device}
              deviceIcon={job.deviceIcon}
              id={job.id}
              key={job.id}
              status={job.status}
              technician={job.technician}
            />
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined mb-4 text-5xl text-on-surface-variant">
              inbox
            </span>
            <p className="font-bold font-headline text-on-surface-variant text-sm">
              {t("no_jobs_found")}
            </p>
            <p className="mt-1 font-body text-on-surface-variant text-xs">
              {t("no_jobs_found_desc")}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
