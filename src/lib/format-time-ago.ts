import i18n from "@/i18n";

export function formatTimeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) {
    return i18n.t("time_ago.just_now");
  }
  if (diffMin < 60) {
    return i18n.t("time_ago.minutes_ago", { count: diffMin });
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return i18n.t("time_ago.hours_ago", { count: diffH });
  }
  const diffD = Math.floor(diffH / 24);
  return i18n.t("time_ago.days_ago", { count: diffD });
}
