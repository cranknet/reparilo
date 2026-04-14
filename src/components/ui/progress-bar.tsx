type ProgressBarColor = "primary" | "secondary" | "tertiary" | "error";

const COLOR_CLASSES: Record<ProgressBarColor, string> = {
  primary: "bg-primary",
  secondary: "bg-on-secondary-container",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

interface ProgressBarProps {
  className?: string;
  color?: ProgressBarColor;
  value: number;
}

export function ProgressBar({
  value,
  color = "primary",
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clamped}
      className={[
        "h-1 w-full overflow-hidden rounded-full bg-surface-container-highest",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${COLOR_CLASSES[color]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
