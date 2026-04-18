import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    },
  },
}));

function buildApp(userId: string | null) {
  const app = Fastify();

  app.decorate("prisma", {
    user: {
      update: mocks.userUpdate,
    },
  });

  app.addHook("preHandler", (request, _reply, done) => {
    request.user = userId
      ? {
          id: userId,
          name: "Test User",
          username: "testuser",
          email: "test@example.com",
          role: "OWNER",
          isActive: true,
          mustChangePassword: true,
          sessionId: "sess-1",
        }
      : null;
    done();
  });

  app.post("/me/acknowledge-password-change", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    await app.prisma.user.update({
      where: { id: request.user.id },
      data: { mustChangePassword: false },
    });
    return reply.send({ success: true });
  });

  return app;
}

describe("POST /me/acknowledge-password-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const app = buildApp(null);
    const res = await app.inject({
      method: "POST",
      url: "/me/acknowledge-password-change",
    });
    expect(res.statusCode).toBe(401);
  });

  it("clears mustChangePassword in DB and returns success", async () => {
    mocks.userUpdate.mockResolvedValue({
      id: "user-1",
      mustChangePassword: false,
    });
    const app = buildApp("user-1");
    const res = await app.inject({
      method: "POST",
      url: "/me/acknowledge-password-change",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { mustChangePassword: false },
    });
  });
});
