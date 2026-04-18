/**
 * Resolves a user image value to a usable src string.
 * - data: URLs (base64 in DB) → as-is
 * - http/https/blob: URLs → as-is
 * - Relative paths (legacy file system) → prefixed with /api/uploads/
 * - null/undefined → undefined
 */
export function getAvatarSrc(
  image: string | null | undefined
): string | undefined {
  if (!image) {
    return;
  }
  if (
    image.startsWith("data:") ||
    image.startsWith("http") ||
    image.startsWith("blob:")
  ) {
    return image;
  }
  return `/api/uploads/${image}`;
}

const WORD_BOUNDARY = /\s+/;

export function getInitials(name: string): string {
  if (!name) {
    return "?";
  }
  const parts = name.trim().split(WORD_BOUNDARY);
  if (parts.length >= 2) {
    const last = parts.at(-1);
    return (parts[0][0] + (last?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
