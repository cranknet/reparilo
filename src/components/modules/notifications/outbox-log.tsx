import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settings";

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    CANCELLED: "bg-surface-container-high text-on-surface-variant",
    FAILED: "bg-error/10 text-error",
    QUEUED: "bg-warning-container text-on-warning-container",
    SENT: "bg-success/10 text-success",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-xs ${colors[status] ?? "bg-surface-container-high text-on-surface-variant"}`}
    >
      {status === "QUEUED" && t("status_queued")}
      {status === "SENT" && t("status_sent")}
      {status === "FAILED" && t("status_failed")}
      {status === "CANCELLED" && t("status_cancelled")}
      {!["QUEUED", "SENT", "FAILED", "CANCELLED"].includes(status) && status}
    </span>
  );
}

export default function OutboxLog() {
  const { t } = useTranslation();
  const { outboxLogs, fetchOutboxLogs, cancelOutboxEntry } = useSettingsStore();

  const handleCancel = useCallback(
    async (id: string) => {
      const result = await cancelOutboxEntry(id);
      if (result.success) {
        toast(t("notification_cancelled"), { duration: 5000 });
        await fetchOutboxLogs();
      }
    },
    [cancelOutboxEntry, fetchOutboxLogs, t]
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
                <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase">
                  {t("actions")}
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
                  <td className="px-4 py-3">
                    {log.status === "QUEUED" && (
                      <button
                        aria-label={t("cancel")}
                        className="flex items-center gap-1 rounded-xl bg-error/10 px-3 py-1.5 font-medium text-error text-xs transition-colors hover:bg-error/20 focus-visible:outline-2 focus-visible:outline-error focus-visible:outline-offset-2"
                        onClick={() => handleCancel(log.id)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          cancel
                        </span>
                        {t("cancel")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
