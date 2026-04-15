import type { JobStatusType } from "@shared/constants";

interface StatusCounterProps {
  isActive?: boolean;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  status?: JobStatusType;
  value: number;
}

const STATUS_DOT_COLOR: Record<JobStatusType, string> = {
  CANCELLED: "var(--color-outline-variant)",
  DELIVERED: "var(--color-primary-fixed)",
  DONE: "var(--color-primary)",
  IN_REPAIR: "var(--color-primary)",
  INTAKE: "var(--color-secondary)",
  ON_HOLD: "var(--color-on-surface-variant)",
  RETURNED: "var(--color-error)",
  WAITING_FOR_PARTS: "var(--color-tertiary)",
};

const bgClass = (
  isActive: boolean | undefined,
  primary: boolean | undefined
) => {
  if (isActive) {
    return "bg-primary/10 ring-1 ring-primary/30";
  }
  if (primary) {
    return "bg-surface-container hover:bg-surface-container-high";
  }
  return "bg-surface-container-low hover:bg-surface-container";
};

const labelColorClass = (
  isActive: boolean | undefined,
  primary: boolean | undefined
) => {
  if (isActive) {
    return "text-primary";
  }
  if (primary) {
    return "text-on-surface";
  }
  return "text-on-surface-variant";
};

export default function StatusCounter({
  label,
  value,
  status,
  onClick,
  isActive,
  primary,
}: StatusCounterProps) {
  const inner = (
    <>
      <span
        className={[
          "font-extrabold font-headline tabular-nums",
          primary ? "text-3xl" : "text-2xl",
          isActive ? "text-primary" : "text-on-surface",
        ].join(" ")}
      >
        {value}
      </span>
      <span
        className={[
          "font-bold font-label text-xs uppercase tracking-wider",
          labelColorClass(isActive, primary),
        ].join(" ")}
      >
        {label}
      </span>
      {onClick && !isActive && (
        <span className="material-symbols-outlined ms-auto text-[14px] text-outline-variant transition-colors group-hover:text-primary">
          filter_list
        </span>
      )}
      {isActive && (
        <span className="material-symbols-outlined ms-auto text-[14px] text-primary">
          filter_list
        </span>
      )}
      {status && !onClick && (
        <span
          className="ms-auto h-2 w-2 rounded-full"
          style={{
            backgroundColor: STATUS_DOT_COLOR[status],
          }}
        />
      )}
    </>
  );

  const className = [
    "group flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-all",
    bgClass(isActive, primary),
  ].join(" ");

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {inner}
      </button>
    );
  }

  return (
    <div className={className} role="status">
      {inner}
    </div>
  );
}
