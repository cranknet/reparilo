import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";

const ACTION_ICONS: Record<string, string> = {
  JOB_CREATED: "add_circle",
  STATUS_CHANGED: "edit_square",
  TECHNICIAN_ASSIGNED: "person_add",
  COST_UPDATED: "payments",
  PART_ADDED: "inventory_2",
  PART_REMOVED: "remove_circle",
  REPAIR_ADDED: "build",
  REPAIR_REMOVED: "remove_circle",
  NOTE_ADDED: "note_add",
  PHOTO_ADDED: "photo_camera",
  PHOTO_REMOVED: "remove_circle",
  JOB_UPDATED: "edit_square",
  WARRANTY_RETURN_CREATED: "replay",
  NOTIFICATION_SENT: "notifications",
  USER_SIGN_IN: "login",
  USER_SIGN_OUT: "logout",
  USER_CREATED: "person_add",
  PASSWORD_RESET: "lock_reset",
  API_MUTATION: "api",
};

interface ActivityItem {
  action: string;
  createdAt: string;
  fromValue: string | null;
  id: string;
  metadata?: { jobId?: string } | null;
  toValue: string | null;
}

function formatAction(action: string): string {
  return `profile_activity_${action.toLowerCase()}`;
}

function formatTimeAgo(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) {
    return t("profile_just_now");
  }
  if (diffMins < 60) {
    return t("profile_minutes_ago", { count: diffMins });
  }
  if (diffHours < 24) {
    return t("profile_hours_ago", { count: diffHours });
  }
  if (diffDays < 7) {
    return t("profile_days_ago", { count: diffDays });
  }
  return t("date_short", { val: date });
}

interface ActivityItemRowProps {
  item: ActivityItem;
  showConnector: boolean;
}

export const ActivityItemRow = memo(function ActivityItemRow({
  item,
  showConnector,
}: ActivityItemRowProps) {
  const { t } = useTranslation();
  const hasIcon = !!ACTION_ICONS[item.action];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${hasIcon ? "bg-primary-tint text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
        >
          <Icon name={ACTION_ICONS[item.action] ?? "history"} size="sm" />
        </div>
        {showConnector && (
          <div className="my-1 h-full w-0.5 bg-surface-container-high" />
        )}
      </div>
      <div className="pb-2">
        <p className="font-semibold text-sm">
          {t(formatAction(item.action), {
            from: item.fromValue ?? "",
            to: item.toValue ?? "",
          })}
        </p>
        <p className="mt-1 font-bold text-on-surface-variant text-xs uppercase">
          {formatTimeAgo(item.createdAt, t)}
        </p>
      </div>
    </div>
  );
});

export { ACTION_ICONS, type ActivityItem, formatAction, formatTimeAgo };
