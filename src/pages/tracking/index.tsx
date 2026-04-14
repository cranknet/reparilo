import { JobStatus } from "@shared/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

const STATUS_FLOW = [
  JobStatus.INTAKE,
  JobStatus.WAITING_FOR_PARTS,
  JobStatus.IN_REPAIR,
  JobStatus.DONE,
  JobStatus.DELIVERED,
] as const;

interface TrackingData {
  daysInShop: number;
  device: string;
  estimatedCompletion: string;
  issue: string;
  jobCode: string;
  shopAddress: string;
  shopName: string;
  shopPhone: string;
  status: string;
  technician: { initials: string; name: string; level: string };
  timeline: { status: string; note: string; date: string }[];
}

const MOCK_DATA: TrackingData = {
  jobCode: "JOB-12345",
  status: JobStatus.IN_REPAIR,
  device: "iPhone 15 Pro Max",
  issue: "Cracked screen replacement",
  estimatedCompletion: "Apr 16, 2026",
  daysInShop: 3,
  shopName: "Precision Auto Care",
  shopPhone: "+213 550 123 456",
  shopAddress: "Industrial Zone East, Lot 42, Algiers",
  technician: {
    initials: "SM",
    name: "S. Mansour",
    level: "L3 Certified Tech",
  },
  timeline: [
    {
      status: JobStatus.INTAKE,
      note: "Confirmed on April 12, 09:15 AM",
      date: "Apr 12",
    },
    {
      status: JobStatus.WAITING_FOR_PARTS,
      note: "OEM Screen Kit arrived April 13",
      date: "Apr 13",
    },
    {
      status: JobStatus.IN_REPAIR,
      note: "Technician currently calibrating digitizer",
      date: "Apr 14",
    },
    { status: JobStatus.DONE, note: "Pending Quality Control", date: "" },
    { status: JobStatus.DELIVERED, note: "Pending Pickup / Courier", date: "" },
  ],
};

function LookupForm({ onSearch }: { onSearch: (code: string) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="sticky top-0 z-50 w-full bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <span className="font-bold font-headline text-2xl text-primary-container tracking-tight">
            Reparilo
          </span>
          <button
            className="material-symbols-outlined rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200/50"
            type="button"
          >
            language
          </button>
        </div>
      </nav>

      <main className="flex flex-grow items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 shadow-sm md:p-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "radial-gradient(#0040a1 0.5px, transparent 0.5px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-highest">
                <span className="material-symbols-outlined text-3xl text-primary-container">
                  build_circle
                </span>
              </div>

              <h1 className="mb-3 font-extrabold font-headline text-3xl text-on-surface tracking-tight md:text-4xl">
                {t("tracking_title")}
              </h1>
              <p className="mb-10 max-w-sm font-body text-lg text-on-surface-variant">
                {t("tracking_subtitle")}
              </p>

              <form
                className="w-full space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) {
                    onSearch(code.trim());
                  }
                }}
              >
                <div className="group relative">
                  <input
                    className="h-16 w-full rounded-xl bg-surface-container-highest px-6 font-medium text-lg outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("tracking_input_placeholder")}
                    type="text"
                    value={code}
                  />
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                </div>
                <button
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container font-bold font-headline text-lg text-on-primary shadow-lg shadow-primary/10 transition-all duration-150 active:opacity-80"
                  type="submit"
                >
                  <span>{t("tracking_track_btn")}</span>
                  <span className="material-symbols-outlined text-xl">
                    arrow_forward
                  </span>
                </button>
              </form>

              <div className="mt-10 w-full border-outline-variant/15 border-t pt-8">
                <p className="flex flex-col items-center justify-center gap-1 font-label text-on-surface-variant text-sm sm:flex-row">
                  <span>{t("tracking_no_code")}</span>
                  <span className="font-semibold text-primary">
                    {t("tracking_contact_us")}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-xl bg-surface-container-high/50 p-6">
              <div className="rounded-lg bg-surface-container-lowest p-3">
                <span className="material-symbols-outlined text-primary">
                  verified
                </span>
              </div>
              <div className="text-left">
                <p className="font-label text-on-surface-variant text-xs uppercase tracking-widest">
                  {t("tracking_certified_parts")}
                </p>
                <p className="font-bold font-headline text-sm">
                  {t("tracking_original_engineering")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-surface-container-high/50 p-6">
              <div className="rounded-lg bg-surface-container-lowest p-3">
                <span className="material-symbols-outlined text-primary">
                  shutter_speed
                </span>
              </div>
              <div className="text-left">
                <p className="font-label text-on-surface-variant text-xs uppercase tracking-widest">
                  {t("tracking_fast_turnaround")}
                </p>
                <p className="font-bold font-headline text-sm">
                  {t("tracking_24h_express")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto w-full border-slate-200/30 border-t py-8">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <span className="font-body text-slate-500 text-xs uppercase tracking-wider">
            © 2026 Reparilo. All rights reserved.
          </span>
          <span className="cursor-default font-body text-slate-400 text-xs uppercase tracking-wider transition-all hover:text-slate-900">
            Powered by Reparilo Engineering
          </span>
        </div>
      </footer>
    </div>
  );
}

function StatusView({ data }: { data: TrackingData }) {
  const { t } = useTranslation();
  const currentIdx = STATUS_FLOW.indexOf(
    data.status as (typeof STATUS_FLOW)[number]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="sticky top-0 z-50 w-full bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <span className="font-bold font-headline text-2xl text-primary-container tracking-tight">
            Reparilo
          </span>
          <button
            className="material-symbols-outlined rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200/50"
            type="button"
          >
            language
          </button>
        </div>
      </nav>

      <main className="flex flex-grow items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm md:flex-row">
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between bg-surface-container-highest px-8 py-6">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary px-4 py-1.5 font-bold font-label text-[11px] text-white uppercase tracking-widest">
                    {t(`status.${data.status}`)}
                  </span>
                  <span className="font-medium text-on-surface-variant text-sm">
                    {t("tracking_tracker_active")}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-label text-on-surface-variant text-xs uppercase tracking-wider">
                    {t("tracking_time_in_shop")}
                  </p>
                  <h2 className="font-extrabold font-headline text-3xl text-primary-container leading-none">
                    {t("tracking_day_count", { count: data.daysInShop })}
                  </h2>
                </div>
              </div>

              <div className="space-y-10 p-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                      {t("tracking_device_model")}
                    </p>
                    <p className="font-bold font-headline text-on-surface text-xl">
                      {data.device}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                      {t("tracking_reported_issue")}
                    </p>
                    <p className="font-bold font-headline text-on-surface text-xl">
                      {data.issue}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                      {t("tracking_job_reference")}
                    </p>
                    <p className="inline-block rounded bg-surface-container-low px-2 py-1 font-mono font-semibold text-lg text-primary-container">
                      {data.jobCode}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                      {t("tracking_estimated_completion")}
                    </p>
                    <p className="font-bold font-headline text-lg text-on-surface">
                      {data.estimatedCompletion}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="mb-6 font-bold font-label text-on-surface-variant text-xs uppercase tracking-widest">
                    {t("tracking_repair_lifecycle")}
                  </h3>
                  <div className="relative flex flex-col gap-8">
                    <div className="absolute top-2 bottom-2 left-[11px] w-[2px] bg-surface-container-high" />

                    {data.timeline.map((step, idx) => {
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      const isPending = idx > currentIdx;

                      return (
                        <div
                          className="group relative flex items-center gap-6"
                          key={step.status}
                        >
                          {isCompleted && (
                            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                              <span
                                className="material-symbols-outlined text-sm text-white"
                                style={{
                                  fontVariationSettings: "'wght' 700",
                                }}
                              >
                                check
                              </span>
                            </div>
                          )}
                          {isCurrent && (
                            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-primary-container bg-surface-container-lowest ring-4 ring-primary-container/20">
                              <div className="h-2 w-2 rounded-full bg-primary-container" />
                            </div>
                          )}
                          {isPending && (
                            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-outline-variant bg-surface-container-lowest" />
                          )}
                          <div
                            className={`flex flex-col ${isPending ? "opacity-50" : ""}`}
                          >
                            <span
                              className={`font-bold text-sm uppercase tracking-wide ${isCurrent ? "text-primary-container" : "text-on-surface"}`}
                            >
                              {t(`status.${step.status}`)}
                            </span>
                            <span className="text-on-surface-variant text-xs">
                              {step.note}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-surface-container-high border-t bg-surface-container-low px-8 py-5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">
                    precision_manufacturing
                  </span>
                  <span className="font-bold text-on-surface text-xs uppercase tracking-tight">
                    {data.shopName}
                  </span>
                </div>
                <div className="flex items-center gap-6 font-medium text-[11px] text-on-surface-variant">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">
                      call
                    </span>
                    <span>{data.shopPhone}</span>
                  </div>
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <span className="material-symbols-outlined text-sm">
                      location_on
                    </span>
                    <span>{data.shopAddress}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-8 bg-surface-container-high p-8 md:w-80">
              <div className="space-y-4">
                <h4 className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-widest">
                  {t("tracking_facility_insight")}
                </h4>
                <div className="group relative aspect-video overflow-hidden rounded-xl bg-surface-container-highest">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    <span className="font-bold text-[10px] text-white uppercase tracking-widest">
                      {t("tracking_live_bench")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="mb-2 font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
                    {t("tracking_technician")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container font-bold font-headline text-white text-xs">
                      {data.technician.initials}
                    </div>
                    <div>
                      <p className="font-bold text-on-surface text-sm">
                        {data.technician.name}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {data.technician.level}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl bg-surface-container-lowest/50 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-primary">
                      verified_user
                    </span>
                    <span className="font-bold text-[10px] uppercase tracking-widest">
                      {t("tracking_repair_guarantee")}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    {t("tracking_guarantee_desc")}
                  </p>
                </div>
              </div>

              <button
                className="group mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-4 font-bold text-sm text-white tracking-wide shadow-lg shadow-primary/20 transition-all hover:opacity-90"
                type="button"
              >
                {t("tracking_contact_shop")}
                <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto w-full border-slate-200/30 border-t py-8">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <span className="font-body text-slate-500 text-xs uppercase tracking-wider">
            © 2026 Reparilo. All rights reserved.
          </span>
          <span className="font-body text-slate-400 text-xs uppercase tracking-wider transition-all hover:text-slate-900">
            Powered by Reparilo Engineering
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function TrackingPage() {
  const { jobCode } = useParams<{ jobCode?: string }>();
  const [trackedJob, setTrackedJob] = useState<TrackingData | null>(
    jobCode ? MOCK_DATA : null
  );

  if (trackedJob) {
    return <StatusView data={trackedJob} />;
  }

  return (
    <LookupForm
      onSearch={() => {
        setTrackedJob(MOCK_DATA);
      }}
    />
  );
}
