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
