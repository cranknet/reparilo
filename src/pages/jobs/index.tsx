import type { JobStatusType } from "@shared/constants";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import JobsFilters from "@/components/modules/jobs/filters";
import IntakeModal from "@/components/modules/jobs/intake-modal";
import type { StatusGroupKey } from "@/components/modules/jobs/jobs-shared";
import { STATUS_GROUPS } from "@/components/modules/jobs/jobs-shared";
import type { JobRow } from "@/components/modules/jobs/jobs-table";
import JobsTable from "@/components/modules/jobs/jobs-table";
import JobMobileCard from "@/components/modules/jobs/mobile-card";
import StatusCounter from "@/components/modules/jobs/status-counter";

const MOCK_METRICS: { label: string; status?: JobStatusType; value: number }[] =
  [
    { label: "on_bench", status: "IN_REPAIR", value: 8 },
    { label: "queue_priority", status: "INTAKE", value: 12 },
    { label: "awaiting_parts", status: "WAITING_FOR_PARTS", value: 4 },
    { label: "quality_check", status: "DONE", value: 3 },
  ];

const MOCK_JOBS: JobRow[] = [
  {
    customer: "Karim Benali",
    customerTier: "Standard",
    device: "iPhone 14 Pro Max",
    deviceIcon: "phone",
    deviceSpec: "A16 | Space Black",
    id: "REP-2026-0042",
    status: "IN_REPAIR" as JobStatusType,
    technician: "Yacine M.",
  },
  {
    customer: "Leila Kermiche",
    customerTier: "VIP",
    device: 'iPad Air M2 11"',
    deviceIcon: "tablet",
    deviceSpec: "Wi-Fi | Blue",
    id: "REP-2026-0045",
    status: "WAITING_FOR_PARTS" as JobStatusType,
    technician: "Sarah B.",
  },
  {
    customer: "Omar Hadj",
    device: "Samsung Galaxy S24 Ultra",
    deviceIcon: "phone",
    deviceSpec: "Snapdragon | Titanium Gray",
    id: "REP-2026-0051",
    status: "INTAKE" as JobStatusType,
  },
  {
    customer: "Fatima Zeroual",
    customerTier: "VIP",
    device: "MacBook Air M3",
    deviceIcon: "laptop",
    deviceSpec: '13" | Midnight',
    id: "REP-2026-0058",
    status: "ON_HOLD" as JobStatusType,
    technician: "Yacine M.",
  },
  {
    customer: "Nabil Rouabeh",
    device: "Apple Watch Series 9",
    deviceIcon: "watch",
    deviceSpec: "45mm | Starlight",
    id: "REP-2026-0061",
    status: "DONE" as JobStatusType,
    technician: "Sarah B.",
  },
];

export default function JobsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<JobStatusType | "ALL">(
    "ALL"
  );
  const [groupFilter, setGroupFilter] = useState<StatusGroupKey | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);

  const filteredJobs = useMemo(() => {
    let jobs = MOCK_JOBS;

    if (statusFilter !== "ALL") {
      jobs = jobs.filter((j) => j.status === statusFilter);
    } else if (groupFilter !== "ALL") {
      const group = STATUS_GROUPS.find((g) => g.key === groupFilter);
      if (group) {
        jobs = jobs.filter((j) => group.statuses.includes(j.status));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.id.toLowerCase().includes(q) ||
          j.customer.toLowerCase().includes(q) ||
          j.device.toLowerCase().includes(q)
      );
    }

    return jobs;
  }, [statusFilter, groupFilter, searchQuery]);

  const handleCounterClick = (status: JobStatusType | undefined) => {
    if (!status) {
      return;
    }
    if (statusFilter === status) {
      setStatusFilter("ALL");
      setGroupFilter("ALL");
    } else {
      const parentGroup = STATUS_GROUPS.find((g) =>
        g.statuses.includes(status)
      );
      setStatusFilter(status);
      setGroupFilter(parentGroup?.key ?? "ALL");
    }
  };

  const handleGroupChange = (group: StatusGroupKey | "ALL") => {
    setGroupFilter(group);
    setStatusFilter("ALL");
  };

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
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
            aria-label={t("export")}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-low px-4 py-2.5 font-bold font-headline text-on-surface-variant text-sm transition-all hover:bg-surface-container-high sm:flex-none md:px-6"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              file_export
            </span>
            <span className="whitespace-nowrap">{t("export")}</span>
          </button>
          <button
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold font-headline text-on-primary text-sm transition-all hover:bg-primary-container sm:flex-none md:px-8"
            onClick={() => setIntakeOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              add_box
            </span>
            <span className="whitespace-nowrap">{t("new_intake")}</span>
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
        {MOCK_METRICS.map((m, i) => (
          <StatusCounter
            isActive={statusFilter === m.status}
            key={m.label}
            label={t(m.label)}
            onClick={m.status ? () => handleCounterClick(m.status) : undefined}
            primary={i === 0}
            status={m.status}
            value={m.value}
          />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <JobsFilters
          activeGroup={groupFilter}
          activeStatus={statusFilter}
          onGroupChange={handleGroupChange}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          searchQuery={searchQuery}
        />

        <div className="hidden sm:block">
          <JobsTable jobs={filteredJobs} />
        </div>

        <div className="space-y-3 sm:hidden">
          {filteredJobs.map((job) => (
            <JobMobileCard
              customer={job.customer}
              customerTier={job.customerTier}
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
              build
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

      <IntakeModal
        onClose={() => setIntakeOpen(false)}
        onSubmit={(data) => {
          console.log("Intake submitted:", data);
        }}
        open={intakeOpen}
      />
    </>
  );
}
