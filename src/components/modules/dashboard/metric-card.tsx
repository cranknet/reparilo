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

export default function MetricCard({
  label,
  value,
  unit,
  detail,
  icon,
  iconColor = "text-primary",
  children,
  onClick,
}: MetricCardProps) {
  const className = `relative overflow-hidden rounded-xl p-6 transition-all ${
    onClick
      ? "cursor-pointer bg-surface-container-low hover:bg-surface-container-high active:scale-[0.98]"
      : "bg-surface-container-low"
  }`;

  const content = (
    <>
      <div className="mb-4 flex items-start justify-between">
        <p className="font-bold text-on-surface-variant text-xs uppercase tracking-widest">
          {label}
        </p>
        <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-extrabold font-headline text-4xl text-on-surface">
          {value}
        </span>
        {unit && (
          <span className="font-bold text-on-surface-variant text-sm">
            {unit}
          </span>
        )}
      </div>
      <p className="mt-1 font-bold text-on-surface-variant text-xs">{detail}</p>
      {children && <div className="mt-4">{children}</div>}
    </>
  );

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <div className={className} role="status">
      {content}
    </div>
  );
}
