import type { ReactNode } from "react";

interface MetricCardProps {
  children?: ReactNode;
  detail: string;
  icon: string;
  iconColor?: string;
  label: string;
  onClick?: () => void;
  unit?: string;
  value: string;
}

export function MetricCard({
  label,
  value,
  unit,
  detail,
  icon: _icon,
  iconColor: _iconColor,
  children,
  onClick,
}: MetricCardProps) {
  const inner = (
    <>
      <p className="font-medium text-on-surface-variant text-xs uppercase tracking-wide">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-extrabold font-headline text-4xl text-on-surface">
          {value}
        </span>
        {unit && (
          <span className="font-medium text-on-surface-variant text-sm">
            {unit}
          </span>
        )}
      </div>
      <p className="mt-1 text-on-surface-variant text-xs">{detail}</p>
      {children && <div className="mt-3">{children}</div>}
    </>
  );

  const sharedClass = `relative overflow-hidden rounded-xl bg-surface-container-low p-5 transition-all ${
    onClick
      ? "cursor-pointer hover:bg-surface-container-high active:scale-[0.98] w-full text-start"
      : ""
  }`;

  if (onClick) {
    return (
      <button className={sharedClass} onClick={onClick} type="button">
        {inner}
      </button>
    );
  }

  return (
    <div className={sharedClass} role="status">
      {inner}
    </div>
  );
}

export default MetricCard;
