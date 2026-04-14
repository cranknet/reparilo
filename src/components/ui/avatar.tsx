type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

interface AvatarProps {
  alt?: string;
  className?: string;
  initials?: string;
  size?: AvatarSize;
  src?: string;
}

export function Avatar({
  initials,
  src,
  alt,
  size = "md",
  className,
}: AvatarProps) {
  if (src) {
    return (
      <img
        alt={alt ?? ""}
        className={["rounded-full object-cover", SIZE_CLASSES[size], className]
          .filter(Boolean)
          .join(" ")}
        height={SIZE_PX[size]}
        src={src}
        width={SIZE_PX[size]}
      />
    );
  }

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full bg-surface-container-high font-bold font-headline text-on-surface-variant",
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {initials}
    </div>
  );
}
