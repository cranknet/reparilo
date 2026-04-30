import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "../routes/auth.js";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  accountFindFirst: vi.fn(),
  accountUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-new-pw"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn().mockReturnValue(new Headers()),
}));

function buildApp(userId: string | null, mustChangePassword = true) {
  const app = Fastify();

  const mockSession = userId
    ? {
        user: {
          id: userId,
          name: "Test User",
          username: "testuser",
          email: "test@example.com",
          role: "OWNER",
          isActive: true,
          mustChangePassword,
        },
        session: { id: "sess-1" },
      }
    : null;

  mocks.getSession.mockResolvedValue(mockSession);

  (app.decorate as (name: string, value: unknown) => void)("auth", {
    api: { getSession: mocks.getSession },
  });

  mocks.accountUpdateMany.mockResolvedValue({ count: 1 });
  mocks.userUpdate.mockResolvedValue({
    id: userId,
    mustChangePassword: false,
  });
  mocks.$transaction.mockResolvedValue([
    { count: 1 },
    { id: userId, mustChangePassword: false },
  ]);

  (app.decorate as (name: string, value: unknown) => void)("prisma", {
    account: {
      findFirst: mocks.accountFindFirst,
      updateMany: mocks.accountUpdateMany,
    },
    user: { update: mocks.userUpdate },
    $transaction: mocks.$transaction,
  });

  app.register(authRoutes);

  return app;
}

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mocks.getSession.mockResolvedValue(null);
    const app = buildApp(null);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      payload: { oldPassword: "Old12345", newPassword: "New12345" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("clears mustChangePassword atomically within the password change transaction", async () => {
    mocks.accountFindFirst.mockResolvedValue({ password: "hashed-old" });

    const app = buildApp("user-1", true);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      payload: { oldPassword: "Oldpassword1", newPassword: "Newpassword1" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);

    const transactionArg = mocks.$transaction.mock.calls[0][0];
    expect(Array.isArray(transactionArg)).toBe(true);
    expect(transactionArg).toHaveLength(2);
  });
});
