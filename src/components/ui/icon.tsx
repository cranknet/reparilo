type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<IconSize, string> = {
  xs: "text-[14px]",
  sm: "text-[18px]",
  md: "text-[20px]",
  lg: "text-[24px]",
  xl: "text-[32px]",
};

interface IconProps {
  "aria-hidden"?: boolean;
  "aria-label"?: string;
  className?: string;
  color?: string;
  name: string;
  size?: IconSize;
}

export function Icon({
  name,
  size = "md",
  color,
  className,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
}: IconProps) {
  const isDecorative = !ariaLabel;
  return (
    <span
      aria-hidden={ariaHidden ?? (isDecorative ? true : undefined)}
      className={[
        "material-symbols-outlined",
        SIZE_CLASSES[size],
        color,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={isDecorative ? undefined : "img"}
    >
      {name}
    </span>
  );
}
