import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  incrementFailedAttempt,
  isAccountLocked,
  resetFailedAttempts,
} from "../services/account-lockout.service.js";

const mocks = vi.hoisted(() => ({
  findFailedAttempts: vi.fn(),
  incrementFailedAttempt: vi.fn(),
  resetFailedAttempts: vi.fn(),
}));

vi.mock("../repositories/user.repository.js", () => ({
  DbClient: {},
  findFailedAttempts: mocks.findFailedAttempts,
  incrementFailedAttempt: mocks.incrementFailedAttempt,
  resetFailedAttempts: mocks.resetFailedAttempts,
}));

const prisma = {} as never;

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments failedLoginAttempts by 1", async () => {
    mocks.findFailedAttempts.mockResolvedValue({ failedLoginAttempts: 2 });

    await incrementFailedAttempt(prisma, "user-1");

    expect(mocks.incrementFailedAttempt).toHaveBeenCalledWith(
      prisma,
      "user-1",
      { failedLoginAttempts: { increment: 1 } }
    );
  });

  it("sets lockedUntil when attempts reach threshold (5)", async () => {
    mocks.findFailedAttempts.mockResolvedValue({ failedLoginAttempts: 4 });

    await incrementFailedAttempt(prisma, "user-1");

    expect(mocks.incrementFailedAttempt).toHaveBeenCalledWith(
      prisma,
      "user-1",
      {
        failedLoginAttempts: { increment: 1 },
        lockedUntil: expect.any(Date),
      }
    );

    const call = mocks.incrementFailedAttempt.mock.calls[0][2];
    const lockedUntil = call.lockedUntil as Date;
    expect(lockedUntil.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("does nothing when user is not found", async () => {
    mocks.findFailedAttempts.mockResolvedValue(null);

    await incrementFailedAttempt(prisma, "missing-user");

    expect(mocks.incrementFailedAttempt).not.toHaveBeenCalled();
  });
});

describe("resetFailedAttempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets failedLoginAttempts to 0 and lockedUntil to null", async () => {
    await resetFailedAttempts(prisma, "user-1");

    expect(mocks.resetFailedAttempts).toHaveBeenCalledWith(prisma, "user-1");
  });
});
