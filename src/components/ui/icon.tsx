type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<IconSize, string> = {
  xs: "text-[14px]",
  sm: "text-[18px]",
  md: "text-[20px]",
  lg: "text-[24px]",
  xl: "text-[32px]",
};

interface IconProps {
  className?: string;
  color?: string;
  name: string;
  size?: IconSize;
}

export function Icon({ name, size = "md", color, className }: IconProps) {
  return (
    <span
      className={[
        "material-symbols-outlined",
        SIZE_CLASSES[size],
        color,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {name}
    </span>
  );
}
