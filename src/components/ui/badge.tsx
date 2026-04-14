type BadgeVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "error"
  | "success"
  | "outline";
type BadgeSize = "sm" | "md";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  error: "bg-error-container text-on-error-container",
  success: "bg-primary/10 text-primary",
  outline: "border border-outline-variant text-on-surface-variant",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  size?: BadgeSize;
  variant?: BadgeVariant;
}

export function Badge({
  variant = "primary",
  size = "md",
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center whitespace-nowrap rounded-full font-bold uppercase tracking-wider",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
