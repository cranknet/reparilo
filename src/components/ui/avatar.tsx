import { useState } from "react";

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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const safeSrc = src && src !== failedSrc ? src : undefined;

  if (safeSrc) {
    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: img onError is for fallback behavior, not user interaction
      <img
        alt={alt ?? ""}
        className={["rounded-full object-cover", SIZE_CLASSES[size], className]
          .filter(Boolean)
          .join(" ")}
        height={SIZE_PX[size]}
        onError={() => setFailedSrc(src ?? null)}
        src={safeSrc}
        width={SIZE_PX[size]}
      />
    );
  }

  return (
    <div
      aria-label={alt || "User avatar"}
      className={[
        "flex items-center justify-center rounded-full bg-surface-container-high font-bold font-headline text-on-surface-variant",
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
    >
      {initials}
    </div>
  );
}
