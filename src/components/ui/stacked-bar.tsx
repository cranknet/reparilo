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
      {rows.map((row) => {
        const computedTotal = row.segments.reduce((s, seg) => s + seg.value, 0);
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate font-medium text-on-surface">
                {row.label}
              </span>
              <span className="ml-2 shrink-0 text-on-surface-variant tabular-nums">
                {computedTotal}
              </span>
            </div>
            <div
              aria-label={`${row.label}: ${row.segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
              className="flex h-6 overflow-hidden rounded-md"
              role="img"
              title={`${row.label}: ${computedTotal}`}
            >
              {row.segments.map((seg) => {
                const pct =
                  computedTotal > 0 ? (seg.value / computedTotal) * 100 : 0;
                if (pct < 0.5) {
                  return null;
                }
                return (
                  <div
                    className={`${seg.color} flex items-center justify-center font-medium text-[10px] text-on-primary-container transition-all`}
                    key={seg.label}
                    style={{ width: `${pct}%` }}
                    title={`${seg.label}: ${seg.value}`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {row.segments.map((seg) => {
                const pct =
                  computedTotal > 0 ? (seg.value / computedTotal) * 100 : 0;
                if (pct < 0.5) {
                  return null;
                }
                return (
                  <span
                    className="flex items-center gap-1 text-on-surface-variant text-xs"
                    key={`legend-${seg.label}`}
                  >
                    <span
                      className={`inline-block size-2 rounded-full ${seg.color}`}
                    />
                    {seg.label} ({seg.value})
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
