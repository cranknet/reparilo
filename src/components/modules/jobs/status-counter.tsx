import type { JobStatusType } from "@shared/constants";

interface StatusCounterProps {
  isActive?: boolean;
  label: string;
  onClick?: () => void;
  status?: JobStatusType;
  value: number;
}

const STATUS_COLORS: Record<JobStatusType, string> = {
  CANCELLED: "bg-outline-variant/30 text-on-surface-variant",
  DELIVERED: "bg-primary-fixed/20 text-on-primary-fixed",
  DONE: "bg-primary/15 text-primary",
  IN_REPAIR: "bg-primary/15 text-primary",
  INTAKE: "bg-secondary/15 text-on-secondary-container",
  ON_HOLD: "bg-on-surface-variant/15 text-on-surface-variant",
  RETURNED: "bg-error/15 text-error",
  WAITING_FOR_PARTS: "bg-tertiary/15 text-on-tertiary-container",
};

const STATUS_DOT: Record<JobStatusType, string> = {
  CANCELLED: "bg-outline-variant",
  DELIVERED: "bg-primary-fixed",
  DONE: "bg-primary",
  IN_REPAIR: "bg-primary",
  INTAKE: "bg-secondary",
  ON_HOLD: "bg-on-surface-variant",
  RETURNED: "bg-error",
  WAITING_FOR_PARTS: "bg-tertiary",
};

export default function StatusCounter({
  label,
  value,
  status,
  onClick,
  isActive,
}: StatusCounterProps) {
  const colorSet = status ? STATUS_COLORS[status] : "";
  const dotColor = status ? STATUS_DOT[status] : "";

  const baseCls =
    "group inline-flex min-h-[36px] items-center gap-2 rounded-full px-3 py-1.5 font-bold font-label text-xs uppercase tracking-wider transition-all focus-visible:ring-2 focus-visible:ring-primary/30";

  if (onClick) {
    return (
      <button
        className={[
          baseCls,
          isActive
            ? "bg-primary text-on-primary ring-2 ring-primary/30"
            : colorSet
              ? `${colorSet} hover:brightness-110`
              : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
        ].join(" ")}
        onClick={onClick}
        type="button"
      >
        {dotColor && (
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`}
          />
        )}
        <span>{label}</span>
        <span
          className={[
            "tabular-nums",
            isActive ? "text-on-primary" : "text-on-surface-variant",
          ].join(" ")}
        >
          {value}
        </span>
      </button>
    );
  }

  return (
    <div
      className={[
        baseCls,
        colorSet || "bg-surface-container-low text-on-surface-variant",
      ].join(" ")}
      role="status"
    >
      {dotColor && (
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
      )}
      <span>{label}</span>
      <span className="text-on-surface-variant tabular-nums">{value}</span>
    </div>
  );
}
