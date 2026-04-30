import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  incrementFailedAttempt,
  isAccountLocked,
  resetFailedAttempts,
} from "../services/account-lockout.service.js";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@generated/client", () => ({
  PrismaClient: class {
    user = {
      findUnique: mocks.findUnique,
      update: mocks.update,
    };
  },
}));

describe("isAccountLocked", () => {
  it("returns true when lockedUntil is in the future", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isAccountLocked({ lockedUntil: future })).toBe(true);
  });

  it("returns false when lockedUntil is in the past", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isAccountLocked({ lockedUntil: past })).toBe(false);
  });

  it("returns false when lockedUntil is null", () => {
    expect(isAccountLocked({ lockedUntil: null })).toBe(false);
  });
});

describe("incrementFailedAttempt", () => {
  let prisma: {
    user: { findUnique: typeof mocks.findUnique; update: typeof mocks.update };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = { user: { findUnique: mocks.findUnique, update: mocks.update } };
  });

  it("increments failedLoginAttempts by 1", async () => {
    mocks.findUnique.mockResolvedValue({ failedLoginAttempts: 2 });

    await incrementFailedAttempt(prisma as never, "user-1");

    expect(mocks.update).toHaveBeenCalledWith({
      data: { failedLoginAttempts: { increment: 1 } },
      where: { id: "user-1" },
    });
  });

  it("sets lockedUntil when attempts reach threshold (5)", async () => {
    mocks.findUnique.mockResolvedValue({ failedLoginAttempts: 4 });

    await incrementFailedAttempt(prisma as never, "user-1");

    expect(mocks.update).toHaveBeenCalledWith({
      data: {
        failedLoginAttempts: { increment: 1 },
        lockedUntil: expect.any(Date),
      },
      where: { id: "user-1" },
    });

    const call = mocks.update.mock.calls[0][0];
    const lockedUntil = call.data.lockedUntil as Date;
    expect(lockedUntil.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("does nothing when user is not found", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await incrementFailedAttempt(prisma as never, "missing-user");

    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("resetFailedAttempts", () => {
  let prisma: { user: { update: typeof mocks.update } };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = { user: { update: mocks.update } };
  });

  it("resets failedLoginAttempts to 0 and lockedUntil to null", async () => {
    await resetFailedAttempts(prisma as never, "user-1");

    expect(mocks.update).toHaveBeenCalledWith({
      data: { failedLoginAttempts: 0, lockedUntil: null },
      where: { id: "user-1" },
    });
  });
});
