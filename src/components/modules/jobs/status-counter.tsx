import type { JobStatusType } from "@shared/constants";

interface StatusCounterProps {
  isActive?: boolean;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  status?: JobStatusType;
  value: number;
}

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
  return (
    <button
      className={[
        "group flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-all",
        bgClass(isActive, primary),
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
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
          "font-bold font-label text-[11px] uppercase tracking-wider",
          labelColorClass(isActive, primary),
        ].join(" ")}
      >
        {label}
      </span>
      {onClick && !isActive && (
        <span className="material-symbols-outlined ml-auto text-[14px] text-outline-variant transition-colors group-hover:text-primary">
          filter_list
        </span>
      )}
      {isActive && (
        <span className="material-symbols-outlined ml-auto text-[14px] text-primary">
          filter_list
        </span>
      )}
      {status && !onClick && (
        <span
          className="ml-auto h-2 w-2 rounded-full"
          style={{
            backgroundColor: isActive
              ? "var(--color-primary)"
              : "var(--color-outline-variant)",
          }}
        />
      )}
    </button>
  );
}
