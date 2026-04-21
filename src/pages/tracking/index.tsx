import { JobStatus, LANGUAGES } from "@shared/constants";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import api from "@/lib/api";

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const nextLang = () => {
    const normalizedLang = i18n.language.split("-")[0];
    const currentIdx = LANGUAGES.indexOf(
      normalizedLang as (typeof LANGUAGES)[number]
    );
    const resolvedIdx = currentIdx === -1 ? 0 : currentIdx;
    const next = LANGUAGES[(resolvedIdx + 1) % LANGUAGES.length];
    i18n.changeLanguage(next);
  };

  return (
    <button
      aria-label={t("language_switch")}
      className="material-symbols-outlined rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
      onClick={nextLang}
      type="button"
    >
      language
    </button>
  );
}

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
  timeline: { status: string; note: string; date: string }[];
}

function LookupForm({
  onSearch,
}: {
  onSearch: (code: string, phone4: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [phone4, setPhone4] = useState("");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="sticky top-0 z-50 w-full bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <span className="font-bold font-headline text-2xl text-primary-container tracking-tight">
            Reparilo
          </span>
          <LanguageSwitcher />
        </div>
      </nav>

      <main className="flex flex-grow items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 shadow-sm md:p-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "radial-gradient(var(--color-primary) 0.5px, transparent 0.5px)",
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
                  if (code.trim() && phone4.trim()) {
                    onSearch(code.trim(), phone4.trim());
                  }
                }}
              >
                <div className="group relative">
                  <input
                    aria-label={t("tracking_input_placeholder")}
                    className="h-16 w-full rounded-xl bg-surface-container-highest px-6 font-medium text-lg outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("tracking_input_placeholder")}
                    type="text"
                    value={code}
                  />
                  <div className="absolute end-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                </div>
                <div className="group relative">
                  <input
                    aria-label={t("tracking_phone4_placeholder")}
                    className="h-16 w-full rounded-xl bg-surface-container-highest px-6 font-medium text-lg outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(e) =>
                      setPhone4(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder={t("tracking_phone4_placeholder")}
                    type="text"
                    value={phone4}
                  />
                  <div className="absolute end-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                </div>
                <button
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container font-bold font-headline text-lg text-on-primary shadow-lg shadow-primary/10 transition-all duration-150 active:opacity-80 disabled:opacity-50"
                  disabled={!(code.trim() && phone4.trim())}
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
              <div className="text-start">
                <p className="font-label text-on-surface-variant text-xs uppercase tracking-widest">
                  {t("tracking_certified_parts")}
                </p>
                <p className="font-bold font-headline text-sm">
                  {t("tracking_genuine_parts")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-surface-container-high/50 p-6">
              <div className="rounded-lg bg-surface-container-lowest p-3">
                <span className="material-symbols-outlined text-primary">
                  shutter_speed
                </span>
              </div>
              <div className="text-start">
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

      <footer className="mt-auto w-full border-outline-variant/30 border-t py-8">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <span className="font-body text-on-surface-variant text-xs uppercase tracking-wider">
            © 2026 Reparilo. All rights reserved.
          </span>
          <span className="cursor-default font-body text-on-surface-variant text-xs uppercase tracking-wider transition-all hover:text-on-surface">
            Powered by Reparilo Engineering
          </span>
        </div>
      </footer>
    </div>
  );
}

function StatusView({
  data,
  onBack,
}: {
  data: TrackingData;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const resolvedIdx = (() => {
    const idx = STATUS_FLOW.indexOf(
      data.status as (typeof STATUS_FLOW)[number]
    );
    if (idx === -1) {
      console.warn(`[Tracking] Unknown status: ${data.status}`);
      return 0;
    }
    return idx;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="sticky top-0 z-50 w-full bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <button
            className="flex items-center gap-1.5 font-bold font-headline text-2xl text-primary-container tracking-tight"
            onClick={onBack}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">
              arrow_back
            </span>
            Reparilo
          </button>
          <LanguageSwitcher />
        </div>
      </nav>

      <main className="flex flex-grow items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm md:flex-row">
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between bg-surface-container-highest px-8 py-6">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary px-4 py-1.5 font-bold font-label text-on-primary text-xs uppercase tracking-wide">
                    {t(`status.${data.status}`)}
                  </span>
                  <span className="font-medium text-on-surface-variant text-sm">
                    {t("tracking_tracker_active")}
                  </span>
                </div>
                <div className="text-end">
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
                    <p className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-[0.15em]">
                      {t("tracking_device_model")}
                    </p>
                    <p className="font-bold font-headline text-on-surface text-xl">
                      {data.device}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-[0.15em]">
                      {t("tracking_reported_issue")}
                    </p>
                    <p className="font-bold font-headline text-on-surface text-xl">
                      {data.issue}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-[0.15em]">
                      {t("tracking_job_reference")}
                    </p>
                    <p className="inline-block rounded bg-surface-container-low px-2 py-1 font-mono font-semibold text-lg text-primary-container">
                      {data.jobCode}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-[0.15em]">
                      {t("tracking_estimated_completion")}
                    </p>
                    <p className="font-bold font-headline text-lg text-on-surface">
                      {data.estimatedCompletion}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="mb-6 font-bold font-label text-on-surface-variant text-xs uppercase tracking-widest">
                    {t("tracking_repair_progress")}
                  </h3>
                  <div className="relative flex flex-col gap-8">
                    <div className="absolute start-[11px] top-2 bottom-2 w-[2px] bg-surface-container-high" />

                    {data.timeline.map((step, idx) => {
                      const isCompleted = idx < resolvedIdx;
                      const isCurrent = idx === resolvedIdx;
                      const isPending = idx > resolvedIdx;

                      return (
                        <div
                          className="group relative flex items-center gap-6"
                          key={step.status}
                        >
                          {isCompleted && (
                            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                              <span
                                className="material-symbols-outlined text-on-primary text-sm"
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
                <div className="flex items-center gap-6 font-medium text-on-surface-variant text-xs">
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
                  {t("tracking_workshop_view")}
                </h4>
                <div className="group relative aspect-video overflow-hidden rounded-xl bg-surface-container-highest">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute start-3 bottom-3 flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
                    <span className="font-bold text-on-primary text-xs uppercase tracking-wide">
                      {t("tracking_live_workstation")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="mb-2 font-bold font-label text-on-surface-variant text-xs uppercase tracking-wide">
                    {t("tracking_repair_guarantee")}
                  </p>
                  <div className="space-y-3 rounded-xl bg-surface-container-lowest/50 p-4 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-primary">
                        verified_user
                      </span>
                      <span className="font-bold text-xs uppercase tracking-wide">
                        {t("tracking_repair_guarantee")}
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-xs leading-relaxed">
                      {t("tracking_guarantee_desc")}
                    </p>
                  </div>
                </div>

                <button
                  className="group mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-4 font-bold text-on-primary text-sm tracking-wide shadow-lg shadow-primary/20 transition-all hover:opacity-90"
                  disabled={!data.shopPhone}
                  onClick={() => {
                    if (data.shopPhone) {
                      window.location.href = `tel:${data.shopPhone}`;
                    }
                  }}
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
        </div>
      </main>

      <footer className="mt-auto w-full border-outline-variant/30 border-t py-8">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <span className="font-body text-on-surface-variant text-xs uppercase tracking-wider">
            © 2026 Reparilo. All rights reserved.
          </span>
          <span className="font-body text-on-surface-variant text-xs uppercase tracking-wider transition-all hover:text-on-surface">
            Powered by Reparilo Engineering
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function TrackingPage() {
  const { jobCode } = useParams<{ jobCode?: string }>();
  const { t } = useTranslation();
  const [trackedJob, setTrackedJob] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(
    async (code: string, phone4: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get(
          `/jobs/lookup?code=${encodeURIComponent(code)}&phone4=${encodeURIComponent(phone4)}`
        );
        const data = res.data;
        const createdDate = new Date(data.createdAt);
        const daysInShop = Math.max(
          1,
          Math.ceil(
            (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        const resolvedStatus = STATUS_FLOW.indexOf(
          data.status as (typeof STATUS_FLOW)[number]
        );
        const activeIdx = resolvedStatus === -1 ? 0 : resolvedStatus;
        const timeline = STATUS_FLOW.map((status, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const completedNote = t("tracking_step_completed", {
            status: t(`status.${status}`),
          });
          const inProgressNote = t("tracking_step_in_progress");
          const pendingNote = t("tracking_step_pending");
          let note: string;
          if (isCompleted) {
            note = completedNote;
          } else if (isCurrent) {
            note = inProgressNote;
          } else {
            note = pendingNote;
          }
          const date =
            isCompleted || isCurrent
              ? createdDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "";
          return { status, note, date };
        });

        const estimatedCompletion = data.estimatedDate
          ? new Date(data.estimatedDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : t("tracking_tbd");

        setTrackedJob({
          jobCode: data.jobCode,
          status: data.status,
          device: data.device,
          issue: data.reportedProblem,
          estimatedCompletion,
          daysInShop,
          shopName: "Reparilo",
          shopPhone: "",
          shopAddress: "",
          timeline,
        });
      } catch (err: unknown) {
        const status =
          err &&
          typeof err === "object" &&
          "response" in err &&
          (err.response as { status?: number })?.status;
        if (status === 429) {
          setError(
            t(
              "errors.too_many_attempts",
              "Too many attempts. Please try again later."
            )
          );
        } else {
          setError(t("tracking_job_not_found"));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (jobCode) {
      // URL-based lookup requires phone4 in query param
      const params = new URLSearchParams(window.location.search);
      const phone4 = params.get("phone4");
      if (phone4) {
        fetchJob(jobCode, phone4);
      }
    }
  }, [jobCode, fetchJob]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <nav className="sticky top-0 z-50 w-full bg-background">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
            <span className="font-bold font-headline text-2xl text-primary-container tracking-tight">
              Reparilo
            </span>
            <LanguageSwitcher />
          </div>
        </nav>
        <main className="flex flex-grow items-center justify-center px-4">
          <div className="text-center">
            <span className="material-symbols-outlined mb-4 block text-5xl text-error">
              error
            </span>
            <p className="font-bold font-headline text-on-surface text-xl">
              {error}
            </p>
            <button
              className="mt-4 rounded-xl bg-primary px-6 py-3 font-bold text-on-primary"
              onClick={() => {
                setError(null);
                setTrackedJob(null);
              }}
              type="button"
            >
              {t("tracking_try_again")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <nav className="sticky top-0 z-50 w-full bg-background">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
            <span className="font-bold font-headline text-2xl text-primary-container tracking-tight">
              Reparilo
            </span>
            <LanguageSwitcher />
          </div>
        </nav>
        <main className="flex flex-grow items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            <p className="font-body text-on-surface-variant">
              {t("tracking_loading")}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (trackedJob) {
    return (
      <StatusView
        data={trackedJob}
        onBack={() => {
          setTrackedJob(null);
        }}
      />
    );
  }

  return (
    <LookupForm
      onSearch={(code, phone4) => {
        fetchJob(code, phone4);
      }}
    />
  );
}
