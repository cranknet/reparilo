const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

export function validateMagicBytes(buffer: Buffer, mime: string): boolean {
  const expected = MAGIC_BYTES[mime];
  if (!expected) {
    return false;
  }
  const headerMatch = expected.every((byte, i) => buffer[i] === byte);
  if (!headerMatch) {
    return false;
  }
  if (mime === "image/webp") {
    const offset = 8;
    return WEBP_MARKER.every((byte, i) => buffer[offset + i] === byte);
  }
  return true;
}
