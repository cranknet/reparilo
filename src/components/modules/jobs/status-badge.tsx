import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";

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

interface StatusBadgeProps {
  status: JobStatusType;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-extrabold text-[11px] uppercase tracking-wider ${STATUS_STYLES[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
