interface StockBarProps {
  className?: string;
  level: number;
  max: number;
}

export function StockBar({ level, max, className }: StockBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((level / max) * 100)) : 0;

  let color = "bg-primary";
  let textColor = "text-on-surface";
  let pctColor = "text-primary";
  if (pct < 10) {
    color = "bg-error";
    textColor = "text-error";
    pctColor = "text-error";
  } else if (pct < 30) {
    color = "bg-tertiary";
  }

  return (
    <div
      className={["flex flex-col gap-1", className].filter(Boolean).join(" ")}
    >
      <div className="flex justify-between font-bold text-xs">
        <span className={textColor}>
          {level} {pct < 10 && "\u26A1"}
        </span>
        <span className={pctColor}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
