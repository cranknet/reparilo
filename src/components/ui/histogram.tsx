interface HistogramBar {
  count: number;
  label: string;
}

interface HistogramProps {
  bars: HistogramBar[];
}

export function Histogram({ bars }: HistogramProps) {
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div className="flex items-end gap-2" role="img">
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
                height: `${Math.max(heightPct, bar.count > 0 ? 4 : 0)}px`,
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
