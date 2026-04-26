import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAlertsStore } from "@/stores/alerts";
import { useSettingsStore } from "@/stores/settings";
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

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    QUEUED: "bg-warning-container text-on-warning-container",
    SENT: "bg-success/10 text-success",
    FAILED: "bg-error/10 text-error",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-xs ${colors[status] ?? "bg-surface-container-high text-on-surface-variant"}`}
    >
      {status === "QUEUED" && t("status_queued")}
      {status === "SENT" && t("status_sent")}
      {status === "FAILED" && t("status_failed")}
      {!["QUEUED", "SENT", "FAILED"].includes(status) && status}
    </span>
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
  const {
    whatsAppSettings,
    outboxLogs,
    notificationTemplates,
    fetchWhatsAppSettings,
    fetchOutboxLogs,
    fetchNotificationTemplates,
    saveWhatsAppSettings,
    sendTestNotification,
  } = useSettingsStore();
  const [whatsAppForm, setWhatsAppForm] = useState({
    apiToken: "",
    businessId: "",
    phoneNumberId: "",
    enabled: false,
  });
  const [whatsAppSaving, setWhatsAppSaving] = useState(false);
  const [testSendingId, setTestSendingId] = useState<string | null>(null);
  const [whatsAppLoaded, setWhatsAppLoaded] = useState(false);

  useEffect(() => {
    if (!whatsAppLoaded) {
      fetchWhatsAppSettings().catch(() => {
        /* intentionally swallowed */
      });
      fetchOutboxLogs().catch(() => {
        /* intentionally swallowed */
      });
      if (notificationTemplates.length === 0) {
        fetchNotificationTemplates().catch(() => {
          /* intentionally swallowed */
        });
      }
      setWhatsAppLoaded(true);
    }
  }, [
    whatsAppLoaded,
    fetchWhatsAppSettings,
    fetchOutboxLogs,
    fetchNotificationTemplates,
    notificationTemplates.length,
  ]);

  useEffect(() => {
    if (whatsAppSettings && !whatsAppSaving) {
      setWhatsAppForm((prev) => ({
        apiToken: prev.apiToken || "",
        businessId: whatsAppSettings.businessId ?? "",
        phoneNumberId: whatsAppSettings.phoneNumberId ?? "",
        enabled: whatsAppSettings.enabled,
      }));
    }
  }, [whatsAppSettings, whatsAppSaving]);

  const handleWhatsAppSave = useCallback(async () => {
    setWhatsAppSaving(true);
    try {
      await saveWhatsAppSettings({
        apiToken: whatsAppForm.apiToken || undefined,
        businessId: whatsAppForm.businessId || undefined,
        phoneNumberId: whatsAppForm.phoneNumberId || undefined,
        enabled: whatsAppForm.enabled,
      });
    } catch {
      // Error is stored in Zustand state
    } finally {
      setWhatsAppSaving(false);
    }
  }, [whatsAppForm, saveWhatsAppSettings]);

  const handleTestSend = useCallback(
    async (templateId: string) => {
      setTestSendingId(templateId);
      const result = await sendTestNotification(templateId);
      if (result.success) {
        useToastStore.getState().undoToast(t("notification_queued"), "", () => {
          /* no undo */
        });
        await fetchOutboxLogs();
      }
      setTestSendingId(null);
    },
    [sendTestNotification, fetchOutboxLogs, t]
  );

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

      {/* WhatsApp Settings */}
      <div className="mt-10">
        <h3 className="font-extrabold font-headline text-lg text-on-surface tracking-tight">
          {t("whatsapp_settings")}
        </h3>
        <div className="mt-4 rounded-2xl bg-surface-container-low p-5">
          <label className="flex cursor-pointer select-none items-center gap-3">
            <input
              checked={whatsAppForm.enabled}
              className="sr-only"
              onChange={(e) =>
                setWhatsAppForm((f) => ({ ...f, enabled: e.target.checked }))
              }
              type="checkbox"
            />
            <span
              className="relative inline-block h-6 w-11 rounded-full transition-colors"
              style={{
                backgroundColor: whatsAppForm.enabled
                  ? "var(--color-primary)"
                  : "var(--color-outline-variant)",
              }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-on-primary shadow-sm transition-all"
                style={{
                  insetInlineStart: whatsAppForm.enabled ? "22px" : "2px",
                }}
              />
            </span>
            <span className="font-medium text-on-surface text-sm">
              {t("whatsapp_enabled")}
            </span>
          </label>

          {whatsAppForm.enabled && (
            <div className="mt-5 space-y-4">
              <div>
                <label
                  className="mb-1.5 block font-medium text-on-surface text-sm"
                  htmlFor="wa-business-id"
                >
                  {t("whatsapp_business_id")}
                </label>
                <input
                  className="w-full rounded-xl bg-surface-container px-4 py-2.5 text-on-surface text-sm outline outline-1 outline-outline-variant focus:outline-2 focus:outline-primary"
                  id="wa-business-id"
                  onChange={(e) =>
                    setWhatsAppForm((f) => ({
                      ...f,
                      businessId: e.target.value,
                    }))
                  }
                  type="text"
                  value={whatsAppForm.businessId}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block font-medium text-on-surface text-sm"
                  htmlFor="wa-phone-id"
                >
                  {t("whatsapp_phone_number_id")}
                </label>
                <input
                  className="w-full rounded-xl bg-surface-container px-4 py-2.5 text-on-surface text-sm outline outline-1 outline-outline-variant focus:outline-2 focus:outline-primary"
                  id="wa-phone-id"
                  onChange={(e) =>
                    setWhatsAppForm((f) => ({
                      ...f,
                      phoneNumberId: e.target.value,
                    }))
                  }
                  type="text"
                  value={whatsAppForm.phoneNumberId}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block font-medium text-on-surface text-sm"
                  htmlFor="wa-api-token"
                >
                  {t("whatsapp_api_token")}
                </label>
                <input
                  autoComplete="off"
                  className="w-full rounded-xl bg-surface-container px-4 py-2.5 text-on-surface text-sm outline outline-1 outline-outline-variant focus:outline-2 focus:outline-primary"
                  id="wa-api-token"
                  onChange={(e) =>
                    setWhatsAppForm((f) => ({ ...f, apiToken: e.target.value }))
                  }
                  placeholder={whatsAppSettings?.hasApiToken ? "••••••••" : ""}
                  type="password"
                  value={whatsAppForm.apiToken}
                />
              </div>
              <button
                className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-semibold text-on-primary text-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                disabled={whatsAppSaving}
                onClick={handleWhatsAppSave}
                type="button"
              >
                {whatsAppSaving ? t("settings_saving") : t("save_changes")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notification Outbox Log */}
      <div className="mt-10">
        <h3 className="font-extrabold font-headline text-lg text-on-surface tracking-tight">
          {t("notification_outbox")}
        </h3>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-surface-container-low">
          {outboxLogs.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">
                outbox
              </span>
              <p className="mt-3 font-medium text-on-surface-variant text-sm">
                {t("no_notifications_sent")}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-outline-variant/50 border-b">
                  <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                    {t("template_name")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                    {t("customer_phone") ?? "Phone"}
                  </th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                    {t("status_label")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                    {t("channel")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                    {t("details")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                    {t("date_short", { val: new Date() })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {outboxLogs.map((log) => (
                  <tr
                    className="border-outline-variant/30 border-b last:border-0 hover:bg-surface-container-high/40"
                    key={log.id}
                  >
                    <td className="px-4 py-3 text-on-surface">
                      {log.templateName}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {log.recipientPhone}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {log.channel}
                    </td>
                    <td className="px-4 py-3">
                      {log.error && (
                        <span className="text-error text-xs">{log.error}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Test send buttons per template */}
        {notificationTemplates.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="font-medium text-on-surface text-sm">
              {t("test_send")}
            </p>
            <div className="flex flex-wrap gap-2">
              {notificationTemplates.map((tmpl) => (
                <button
                  className="flex items-center gap-1.5 rounded-xl bg-surface-container px-4 py-2 font-medium text-on-surface text-xs transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                  disabled={testSendingId === tmpl.id}
                  key={tmpl.id}
                  onClick={() => handleTestSend(tmpl.id)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {testSendingId === tmpl.id ? "progress_activity" : "send"}
                  </span>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
