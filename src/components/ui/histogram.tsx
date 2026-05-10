interface HistogramBar {
  count: number;
  label: string;
}

interface HistogramProps {
  ariaLabel?: string;
  bars: HistogramBar[];
}

export function Histogram({ ariaLabel, bars }: HistogramProps) {
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div
      aria-label={ariaLabel ?? "Histogram"}
      className="flex items-end gap-2"
      role="img"
    >
      {bars.map((bar) => {
        const heightPct = (bar.count / maxCount) * 100;
        return (
          <div className="flex flex-1 flex-col items-center" key={bar.label}>
            <span className="mb-1 text-on-surface-variant text-xs tabular-nums">
              {bar.count}
            </span>
            <div
              className="w-full rounded-t-md bg-tertiary transition-all"
              role="presentation"
              style={{
                height: `${heightPct}%`,
                minHeight: bar.count > 0 ? "4px" : "0",
              }}
              title={`${bar.label}: ${bar.count}`}
            />
            <span className="mt-1 text-center text-[10px] text-on-surface-variant">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
