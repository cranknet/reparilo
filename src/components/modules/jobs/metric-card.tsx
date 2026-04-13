interface MetricCardProps {
  detail: string;
  icon: string;
  iconColor?: string;
  label: string;
  value: string;
}

export default function JobMetricCard({
  label,
  value,
  detail,
  icon,
  iconColor = "text-primary",
}: MetricCardProps) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 transition-all">
      <div className="flex items-start justify-between">
        <p className="font-body font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
          {label}
        </p>
        <span
          className={`material-symbols-outlined text-lg opacity-50 ${iconColor}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-extrabold font-headline text-3xl text-on-surface md:text-4xl">
          {value}
        </span>
        <span className="font-bold text-xs">{detail}</span>
      </div>
    </div>
  );
}
