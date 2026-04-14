import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";

type BadgeSize = "sm" | "md";

const STATUS_STYLES: Record<JobStatusType, string> = {
  INTAKE: "bg-secondary-container text-on-secondary-container",
  WAITING_FOR_PARTS: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  IN_REPAIR: "bg-primary/10 text-primary",
  ON_HOLD: "bg-surface-container-high text-on-surface-variant",
  DONE: "bg-primary-fixed text-on-primary-fixed-variant",
  DELIVERED: "bg-surface-container text-on-surface-variant",
  RETURNED: "bg-error-container text-on-error-container",
  CANCELLED: "bg-surface-container-high text-on-surface-variant line-through",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
};

interface StatusBadgeProps {
  size?: BadgeSize;
  status: JobStatusType;
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      className={[
        "inline-flex items-center whitespace-nowrap rounded-full font-extrabold uppercase tracking-wider",
        SIZE_CLASSES[size],
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {t(`status.${status}`)}
    </span>
  );
}
