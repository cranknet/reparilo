import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "@/hooks/use-can";
import { useWs } from "@/hooks/use-ws";
import { useAlertsStore } from "@/stores/alerts";
import { useUiStore } from "@/stores/ui";
import LanguageToggle from "./language-toggle";

export default function TopBar() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const canCreateJob = useCan({ jobs: ["create"] });
  const openIntakeModal = useUiStore((s) => s.openIntakeModal);
  const alerts = useAlertsStore((s) => s.alerts);
  const addAlert = useAlertsStore((s) => s.addAlert);
  const markRead = useAlertsStore((s) => s.markRead);
  const unreadCount = useAlertsStore((s) => s.unreadCount());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useWs((msg) => {
    if (msg.type === "WARRANTY_RETURN_CREATED" && msg.job) {
      addAlert({
        type: msg.type,
        job: msg.job,
        message: `Warranty return: ${msg.job.jobCode}`,
      });
    } else if (msg.type === "JOB_OVERDUE" && msg.job) {
      addAlert({
        type: msg.type,
        job: msg.job,
        message: `Job overdue: ${msg.job.jobCode}`,
      });
    }
  });

  const handleToggleAlerts = useCallback(() => {
    setShowAlerts((prev) => !prev);
  }, []);

  return (
    <header className="fixed top-0 right-0 z-40 flex h-16 w-full items-center justify-between border-outline-variant border-b bg-surface/95 px-4 shadow-sm backdrop-blur-sm md:px-8 lg:w-[calc(100%-16rem)]">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="material-symbols-outlined font-black font-headline text-primary text-sm uppercase tracking-tighter">
            build_circle
          </span>
          <span className="font-black font-headline text-on-surface text-sm uppercase tracking-tighter">
            Reparilo
          </span>
        </div>
        <div className="group relative hidden w-full max-w-xs md:block md:w-96">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">
            search
          </span>
          <input
            className="w-full rounded-full border-none bg-surface-container-high py-2 pr-4 pl-10 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            type="text"
            value={search}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <LanguageToggle />
        <div className="relative" ref={dropdownRef}>
          <button
            aria-label={t("notifications")}
            className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
            onClick={handleToggleAlerts}
            type="button"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-bold text-[10px] text-on-error">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showAlerts && (
            <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-xl bg-surface-container-lowest shadow-xl ring-1 ring-outline-variant">
              <div className="border-outline-variant border-b px-4 py-3">
                <h3 className="font-bold font-headline text-on-surface text-sm">
                  {t("notifications")}
                </h3>
              </div>
              {alerts.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">
                    notifications_off
                  </span>
                  <p className="mt-2 text-on-surface-variant text-sm">
                    {t("no_alerts")}
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {alerts.map((alert) => (
                    <button
                      className="flex w-full items-start gap-3 border-outline-variant border-b px-4 py-3 text-start last:border-b-0 hover:bg-surface-container-high"
                      key={alert.id}
                      onClick={() => markRead(alert.id)}
                      type="button"
                    >
                      <span
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${alert.read ? "bg-outline" : "bg-primary"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-on-surface text-sm">
                          {alert.message}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="hidden h-8 w-px bg-outline-variant md:block" />
        <button
          className={`hidden items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-br from-primary to-surface-tint px-3 py-2 font-semibold text-on-primary text-xs shadow-md transition-transform hover:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 md:flex md:px-4 md:text-sm ${canCreateJob ? "" : "cursor-not-allowed opacity-50"}`}
          disabled={!canCreateJob}
          onClick={() => openIntakeModal()}
          type="button"
        >
          <span className="material-symbols-outlined">add_circle</span>
          {t("new_checkin")}
        </button>
      </div>
    </header>
  );
}
