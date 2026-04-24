import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";

interface SessionButtonProps {
  loading: boolean;
  onClick: () => void;
  sessionCount: number;
}

export function SessionButton({
  loading,
  onClick,
  sessionCount,
}: SessionButtonProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-on-surface text-sm uppercase tracking-wider">
        {t("profile_active_sessions")}
      </h4>
      <button
        className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container-low"
        onClick={onClick}
        type="button"
      >
        <div className="flex items-center gap-3">
          <Icon className="text-on-surface-variant" name="devices" size="md" />
          <span className="font-medium text-sm">
            {loading
              ? t("loading")
              : t("profile_sessions_count", { count: sessionCount })}
          </span>
        </div>
        <Icon
          className="text-on-surface-variant"
          name="chevron_right"
          size="sm"
        />
      </button>
    </div>
  );
}
