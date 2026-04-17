import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface SessionItem {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  userAgent: string | null;
}

interface SessionsModalProps {
  loading: boolean;
  onClose: () => void;
  onRevoke: (sessionId: string) => void;
  sessions: SessionItem[];
}

function parseUserAgent(ua: string): string {
  if (ua.includes("Firefox")) {
    return "Firefox";
  }
  if (ua.includes("Edg")) {
    return "Edge";
  }
  if (ua.includes("Chrome")) {
    return "Chrome";
  }
  if (ua.includes("Safari")) {
    return "Safari";
  }
  return ua.slice(0, 30);
}

export default function SessionsModal({
  loading,
  onClose,
  onRevoke,
  sessions,
}: SessionsModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-hidden="true"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-[20px]"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onClose();
          }
        }}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby="sessions-modal-title"
        aria-modal="true"
        className="relative z-10 mx-4 flex max-h-[80vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl"
        role="dialog"
      >
        <div className="bg-surface-container-low px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="font-bold font-headline text-on-surface text-xl tracking-tight"
                id="sessions-modal-title"
              >
                {t("profile_active_sessions")}
              </h2>
              <p className="mt-0.5 text-on-surface-variant text-sm">
                {t("profile_sessions_count", { count: sessions.length })}
              </p>
            </div>
            <button
              aria-label={t("close")}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              onClick={onClose}
              type="button"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <span className="material-symbols-outlined animate-spin text-[24px] text-on-surface-variant">
                progress_activity
              </span>
            </div>
          )}
          {!loading && sessions.length === 0 && (
            <p className="py-6 text-center text-on-surface-variant text-sm">
              {t("profile_no_sessions")}
            </p>
          )}
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                className="flex items-center justify-between rounded-xl bg-surface-container-low p-4"
                key={session.id}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                    {session.userAgent?.includes("Mobile")
                      ? "smartphone"
                      : "laptop_mac"}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">
                      {session.userAgent
                        ? parseUserAgent(session.userAgent)
                        : t("profile_unknown_device")}
                      {session.isCurrent
                        ? ` — ${t("profile_current_session")}`
                        : ""}
                    </p>
                    <p className="text-on-surface-variant text-xs">
                      {session.ipAddress ?? t("profile_unknown_ip")}
                    </p>
                    <p className="mt-0.5 text-on-surface-variant/60 text-xs">
                      {t("profile_login_time")}:{" "}
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.isCurrent ? (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-success" />
                      <span className="font-bold text-success text-xs uppercase">
                        {t("profile_active")}
                      </span>
                    </>
                  ) : (
                    <button
                      className="font-bold text-tertiary text-xs transition-colors hover:text-tertiary-container"
                      onClick={() => onRevoke(session.id)}
                      type="button"
                    >
                      {t("profile_end_session")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-outline-variant/10 border-t px-6 py-4">
          <Button onClick={onClose} type="button" variant="secondary">
            {t("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
