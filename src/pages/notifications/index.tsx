import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAlertsStore } from "@/stores/alerts";
import { useToastStore } from "@/stores/toast";

type FilterType = "all" | "unread" | "read";

const FILTER_KEYS: FilterType[] = ["all", "unread", "read"];

const TYPE_CONFIG: Record<string, { icon: string; labelKey: string }> = {
  WARRANTY_RETURN_CREATED: {
    icon: "autorenew",
    labelKey: "noti_type_warranty_return",
  },
  JOB_OVERDUE: {
    icon: "schedule",
    labelKey: "noti_type_job_overdue",
  },
};

function formatRelativeTime(
  ts: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) {
    return t("noti_time_now");
  }
  if (diffMin < 60) {
    return t("noti_time_min", { count: diffMin });
  }
  if (diffHr < 24) {
    return t("noti_time_hr", { count: diffHr });
  }
  if (diffDay < 7) {
    return t("noti_time_day", { count: diffDay });
  }
  return new Date(ts).toLocaleDateString();
}

function AlertItem({
  alert,
  onDismiss,
  onNavigate,
}: {
  alert: ReturnType<typeof useAlertsStore.getState>["alerts"][number];
  onDismiss: (id: string) => void;
  onNavigate: (jobId: string) => void;
}) {
  const { t } = useTranslation();
  const config = TYPE_CONFIG[alert.type] ?? {
    icon: "info",
    labelKey: "noti_type_generic",
  };

  const hasJob = Boolean(alert.job);
  const labelParts = [
    t(config.labelKey),
    alert.job?.jobCode,
    alert.read ? "" : t("noti_sr_unread"),
    formatRelativeTime(alert.timestamp, t),
  ].filter(Boolean);

  return (
    <div
      className={`group flex items-start gap-4 rounded-2xl px-4 py-4 text-start sm:px-5 ${
        alert.read
          ? "bg-surface-container-low hover:bg-surface-container-high/60"
          : "bg-surface-container-lowest hover:bg-surface-container-low"
      }`}
    >
      {hasJob ? (
        <button
          aria-label={labelParts.join(", ")}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          onClick={() => onNavigate(alert.job?.id ?? "")}
          type="button"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              alert.read
                ? "bg-surface-container-high text-on-surface-variant"
                : "bg-primary/10 text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {config.icon}
            </span>
          </div>
        </button>
      ) : (
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            alert.read
              ? "bg-surface-container-high text-on-surface-variant"
              : "bg-primary/10 text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">
            {config.icon}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        {hasJob ? (
          <button
            className="min-h-6 rounded-md transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            onClick={() => onNavigate(alert.job?.id ?? "")}
            type="button"
          >
            <span
              className={`font-bold text-sm ${
                alert.read ? "text-on-surface-variant" : "text-on-surface"
              }`}
            >
              {t(config.labelKey)}
            </span>
          </button>
        ) : (
          <span
            className={`font-bold text-sm ${
              alert.read ? "text-on-surface-variant" : "text-on-surface"
            }`}
          >
            {t(config.labelKey)}
          </span>
        )}
        {alert.job && (
          <span className="font-mono text-on-surface-variant text-xs">
            {" "}
            {alert.job.jobCode}
          </span>
        )}
        {!alert.read && <span className="sr-only"> {t("noti_sr_unread")}</span>}
        <p
          className={`mt-1 text-sm leading-relaxed ${
            alert.read ? "text-on-surface-variant" : "text-on-surface"
          }`}
        >
          {alert.message}
        </p>
        <p className="mt-1.5 text-on-surface-variant/70 text-xs">
          {formatRelativeTime(alert.timestamp, t)}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {!alert.read && (
          <span
            aria-hidden="true"
            className="mt-2 h-2.5 w-2.5 rounded-full bg-primary"
          />
        )}
        <button
          aria-label={t("noti_dismiss")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-on-surface-variant/50 transition-colors hover:bg-surface-container-high hover:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          onClick={() => onDismiss(alert.id)}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alerts = useAlertsStore((s) => s.alerts);
  const markRead = useAlertsStore((s) => s.markRead);
  const markAllRead = useAlertsStore((s) => s.markAllRead);
  const dismissAlert = useAlertsStore((s) => s.dismissAlert);
  const undoToast = useToastStore((s) => s.undoToast);
  const [filter, setFilter] = useState<FilterType>("all");
  const tabRefs = useRef<Record<FilterType, HTMLButtonElement | null>>({
    all: null,
    unread: null,
    read: null,
  });

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    if (filter === "unread") {
      return alerts.filter((a) => !a.read);
    }
    if (filter === "read") {
      return alerts.filter((a) => a.read);
    }
    return alerts;
  }, [alerts, filter]);

  const handleMarkAllRead = useCallback(() => {
    const previousReadState = alerts.map((a) => ({
      id: a.id,
      wasRead: a.read,
    }));
    markAllRead();
    const undoAction = () => {
      const store = useAlertsStore.getState();
      const restored = store.alerts.map((a) => {
        const prev = previousReadState.find((p) => p.id === a.id);
        return { ...a, read: prev?.wasRead ?? a.read };
      });
      useAlertsStore.setState({ alerts: restored });
    };
    undoToast(t("noti_all_read_toast"), t("noti_undo_mark_all"), undoAction);
  }, [alerts, markAllRead, undoToast, t]);

  const handleNavigate = useCallback(
    (jobId: string) => {
      if (!jobId) {
        return;
      }
      const alert = alerts.find((a) => a.job?.id === jobId);
      if (alert && !alert.read) {
        markRead(alert.id);
      }
      navigate(`/jobs/${jobId}`);
    },
    [alerts, markRead, navigate]
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismissAlert(id);
    },
    [dismissAlert]
  );

  function handleTabKeyDown(e: React.KeyboardEvent) {
    const currentIndex = FILTER_KEYS.indexOf(filter);
    let nextIndex: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % FILTER_KEYS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + FILTER_KEYS.length) % FILTER_KEYS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = FILTER_KEYS.length - 1;
    }
    if (nextIndex !== undefined) {
      e.preventDefault();
      const nextKey = FILTER_KEYS[nextIndex];
      setFilter(nextKey);
      tabRefs.current[nextKey]?.focus();
    }
  }

  const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
    { key: "all", label: t("noti_filter_all") },
    { key: "unread", label: t("noti_filter_unread") },
    { key: "read", label: t("noti_filter_read") },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("notifications")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("noti_subtitle")}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            className="flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 font-semibold text-primary text-sm transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            onClick={handleMarkAllRead}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              done_all
            </span>
            {t("noti_mark_all_read")}
          </button>
        )}
      </div>

      <div
        aria-label={t("noti_filter_label")}
        className="flex items-center gap-2 overflow-x-auto pb-2"
        role="tablist"
      >
        {FILTER_OPTIONS.map((opt) => (
          <button
            aria-selected={filter === opt.key}
            className={`whitespace-nowrap rounded-full px-4 py-2 font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
              filter === opt.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
            id={`noti-tab-${opt.key}`}
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            onKeyDown={handleTabKeyDown}
            ref={(el) => {
              tabRefs.current[opt.key] = el;
            }}
            role="tab"
            tabIndex={filter === opt.key ? 0 : -1}
            type="button"
          >
            {opt.label}
            {opt.key === "unread" && unreadCount > 0 && (
              <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-on-primary font-bold text-[10px] text-primary">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`noti-tab-${filter}`}
        aria-live="polite"
        className="mt-4 space-y-3"
        role="tabpanel"
      >
        {filteredAlerts.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">
              {filter === "unread"
                ? "notifications_active"
                : "notifications_off"}
            </span>
            <p className="mt-4 font-semibold text-on-surface-variant">
              {filter === "unread" && t("noti_no_unread")}
              {filter === "read" && t("noti_no_read")}
              {filter === "all" && t("noti_no_alerts")}
            </p>
            <p className="mt-1 text-on-surface-variant/70 text-sm">
              {filter === "all"
                ? t("noti_empty_desc")
                : t("noti_filter_empty_desc")}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertItem
              alert={alert}
              key={alert.id}
              onDismiss={handleDismiss}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </>
  );
}
