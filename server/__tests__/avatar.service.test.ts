import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAvatar, uploadAvatar } from "../services/avatar.service.js";

function makeBuffer(magic: number[], extra = 0) {
  const bytes = [...magic];
  for (let i = 0; i < extra; i++) {
    bytes.push(0x00);
  }
  return Buffer.from(bytes);
}

function makePrisma(userImage: string | null | undefined) {
  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          userImage === undefined ? null : { image: userImage }
        ),
      update: vi.fn().mockResolvedValue(undefined),
    },
  } as any;
}

function makeFile(mimetype: string, buffer: Buffer) {
  return {
    mimetype,
    toBuffer: vi.fn().mockResolvedValue(buffer),
  };
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46];

describe("uploadAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves avatar and returns data URL", async () => {
    const prisma = makePrisma(null);
    const buffer = makeBuffer(JPEG_MAGIC, 10);
    const file = makeFile("image/jpeg", buffer);

    const result = await uploadAvatar(prisma, "user-1", file);

    expect(result).toEqual({
      image: `data:image/jpeg;base64,${buffer.toString("base64")}`,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { image: expect.stringContaining("data:image/jpeg;base64,") },
    });
  });

  it("returns INVALID_FILE_TYPE for unsupported mime", async () => {
    const prisma = makePrisma(null);
    const file = makeFile("image/gif", Buffer.from([0x47, 0x49, 0x46]));

    const result = await uploadAvatar(prisma, "user-1", file);

    expect(result).toEqual({ error: "INVALID_FILE_TYPE" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns FILE_TOO_LARGE when file exceeds 2 MB", async () => {
    const prisma = makePrisma(null);
    const bigBuffer = makeBuffer(JPEG_MAGIC, 2 * 1024 * 1024 + 1);
    const file = makeFile("image/jpeg", bigBuffer);

    const result = await uploadAvatar(prisma, "user-1", file);

    expect(result).toEqual({ error: "FILE_TOO_LARGE" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns INVALID_FILE_CONTENT when magic bytes don't match mime", async () => {
    const prisma = makePrisma(null);
    const mismatchedBuffer = makeBuffer(PNG_MAGIC, 10);
    const file = makeFile("image/jpeg", mismatchedBuffer);

    const result = await uploadAvatar(prisma, "user-1", file);

    expect(result).toEqual({ error: "INVALID_FILE_CONTENT" });
  });

  it("returns null for nonexistent user", async () => {
    const prisma = makePrisma(undefined);
    const buffer = makeBuffer(JPEG_MAGIC, 10);
    const file = makeFile("image/jpeg", buffer);

    const result = await uploadAvatar(prisma, "user-x", file);

    expect(result).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("validates WEBP requires RIFF header plus WEBP marker", async () => {
    const validWebp = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00, // file size placeholder
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ]);
    const prisma = makePrisma(null);
    const file = makeFile("image/webp", validWebp);

    const result = await uploadAvatar(prisma, "user-1", file);

    expect(result).toEqual({
      image: `data:image/webp;base64,${validWebp.toString("base64")}`,
    });
  });

  it("rejects WEBP with invalid marker", async () => {
    const invalidWebp = makeBuffer(WEBP_MAGIC, 10);
    const prisma = makePrisma(null);
    const file = makeFile("image/webp", invalidWebp);

    const result = await uploadAvatar(prisma, "user-1", file);

    expect(result).toEqual({ error: "INVALID_FILE_CONTENT" });
  });
});

describe("deleteAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears image path and returns null", async () => {
    const prisma = makePrisma("data:image/png;base64,abc123");

    const result = await deleteAvatar(prisma, "user-1");

    expect(result).toEqual({ image: null });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { image: null },
    });
  });

  it("returns null for nonexistent user", async () => {
    const prisma = makePrisma(undefined);

    const result = await deleteAvatar(prisma, "user-x");

    expect(result).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns { image: null } when user has no avatar", async () => {
    const prisma = makePrisma(null);

    const result = await deleteAvatar(prisma, "user-1");

    expect(result).toEqual({ image: null });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
