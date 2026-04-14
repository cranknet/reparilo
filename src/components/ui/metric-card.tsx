import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

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
  icon,
  iconColor = "text-primary",
  children,
  onClick,
}: MetricCardProps) {
  const inner = (
    <>
      <div className="mb-4 flex items-start justify-between">
        <p className="font-bold text-on-surface-variant text-xs uppercase tracking-widest">
          {label}
        </p>
        <Icon color={iconColor} name={icon} />
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

  const sharedClass = `relative overflow-hidden rounded-xl bg-surface-container-low p-6 transition-all ${
    onClick
      ? "cursor-pointer ring-1 ring-outline hover:bg-surface-container-low/60 active:scale-[0.98]"
      : ""
  }`;

  if (onClick) {
    return (
      <button className={sharedClass} onClick={onClick} type="button">
        {inner}
      </button>
    );
  }

  return <div className={sharedClass}>{inner}</div>;
}
