interface StackedBarSegment {
  color: string;
  label: string;
  value: number;
}

interface StackedBarRow {
  label: string;
  segments: StackedBarSegment[];
  total: number;
}

interface StackedBarProps {
  rows: StackedBarRow[];
}

export function StackedBar({ rows }: StackedBarProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate font-medium text-on-surface">
              {row.label}
            </span>
            <span className="ml-2 shrink-0 text-on-surface-variant tabular-nums">
              {row.total}
            </span>
          </div>
          <div
            className="flex h-6 overflow-hidden rounded-md"
            title={`${row.label}: ${row.total}`}
          >
            {row.segments.map((seg) => {
              const pct = row.total > 0 ? (seg.value / row.total) * 100 : 0;
              if (pct < 0.5) {
                return null;
              }
              return (
                <div
                  className={`${seg.color} flex items-center justify-center font-medium text-[10px] text-on-primary-container transition-all`}
                  key={`${row.label}-${seg.label}`}
                  style={{ width: `${pct}%` }}
                  title={`${seg.label}: ${seg.value}`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {row.segments
              .filter((s) => s.value > 0)
              .map((seg) => (
                <span
                  className="flex items-center gap-1 text-on-surface-variant text-xs"
                  key={`legend-${row.label}-${seg.label}`}
                >
                  <span
                    className={`inline-block size-2 rounded-full ${seg.color}`}
                  />
                  {seg.label} ({seg.value})
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
