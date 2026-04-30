import type { NotificationTemplate } from "@shared/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settings";

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

interface OutboxLogProps {
  notificationTemplates: NotificationTemplate[];
}

export default function OutboxLog({ notificationTemplates }: OutboxLogProps) {
  const { t } = useTranslation();
  const { outboxLogs, fetchOutboxLogs, sendTestNotification } =
    useSettingsStore();
  const [testSendingId, setTestSendingId] = useState<string | null>(null);

  const handleTestSend = useCallback(
    async (templateId: string) => {
      setTestSendingId(templateId);
      const result = await sendTestNotification(templateId);
      if (result.success) {
        toast(t("notification_queued"), { duration: 5000 });
        await fetchOutboxLogs();
      }
      setTestSendingId(null);
    },
    [sendTestNotification, fetchOutboxLogs, t]
  );

  return (
    <div>
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
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-outline-variant/50 border-b">
                <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                  {t("template_name")}
                </th>
                <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                  {t("customer_phone")}
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
                  {t("date")}
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
  );
}
