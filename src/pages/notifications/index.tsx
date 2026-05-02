import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import AlertList from "@/components/modules/notifications/alert-list";
import ChannelSettings from "@/components/modules/notifications/channel-settings";
import OutboxLog from "@/components/modules/notifications/outbox-log";
import { useAlertsStore } from "@/stores/alerts";
import { useSettingsStore } from "@/stores/settings";

type FilterType = "all" | "unread" | "read";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alerts = useAlertsStore((s) => s.alerts);
  const markRead = useAlertsStore((s) => s.markRead);
  const markAllRead = useAlertsStore((s) => s.markAllRead);
  const deleteAlert = useAlertsStore((s) => s.deleteAlert);
  const fetchAlerts = useAlertsStore((s) => s.fetchAlerts);
  const initialized = useAlertsStore((s) => s.initialized);
  const unreadCount = useAlertsStore((s) => s.unreadCount);
  const {
    whatsAppSettings,
    notificationTemplates,
    fetchWhatsAppSettings,
    fetchNotificationTemplates,
    saveWhatsAppSettings,
    fetchOutboxLogs,
  } = useSettingsStore();
  const [outboxLoaded, setOutboxLoaded] = useState(false);

  useEffect(() => {
    if (!initialized) {
      fetchAlerts();
    }
  }, [initialized, fetchAlerts]);

  useEffect(() => {
    if (!outboxLoaded) {
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
      setOutboxLoaded(true);
    }
  }, [
    outboxLoaded,
    fetchWhatsAppSettings,
    fetchOutboxLogs,
    fetchNotificationTemplates,
    notificationTemplates.length,
  ]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteAlert(id);
      toast(t("notification_deleted"));
    },
    [deleteAlert, t]
  );

  const handleNavigate = useCallback(
    (jobId: string) => {
      if (!jobId) {
        return;
      }
      const alert = alerts.find((a) => a.job?.id === jobId);
      if (alert && !alert.readAt) {
        markRead(alert.id);
      }
      navigate(`/jobs/${jobId}`);
    },
    [alerts, markRead, navigate]
  );

  const [filter, setFilter] = useState<FilterType>("all");

  return (
    <>
      <div className="mb-6">
        <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
          {t("notifications")}
        </h2>
        <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
          {t("noti_subtitle")}
        </p>
      </div>

      <AlertList
        alerts={alerts}
        filter={filter}
        onDelete={handleDelete}
        onFilterChange={setFilter}
        onMarkAllRead={handleMarkAllRead}
        onNavigate={handleNavigate}
        unreadCount={unreadCount}
      />

      <div className="mt-10">
        <ChannelSettings
          onFetchWhatsAppSettings={fetchWhatsAppSettings}
          onSaveWhatsAppSettings={saveWhatsAppSettings}
          whatsAppSettings={whatsAppSettings}
        />
      </div>

      <div className="mt-10">
        <OutboxLog />
      </div>
    </>
  );
}
