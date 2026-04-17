import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "../../server/middlewares/rbac.js";

const mocks = vi.hoisted(() => ({
  userHasPermission: vi.fn(),
}));

function makeReply() {
  const reply = { status: vi.fn(), send: vi.fn() };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply;
}

function makeRequest(role: string | null) {
  return {
    user: role ? { id: "u1", role, sessionId: "s1" } : null,
    server: { auth: { api: { userHasPermission: mocks.userHasPermission } } },
  } as unknown as Parameters<ReturnType<typeof requirePermission>>[0];
}

describe("requirePermission", () => {
  beforeEach(() => {
    mocks.userHasPermission.mockReset();
  });

  it("returns 401 when no user on request", async () => {
    const reply = makeReply();
    const handler = requirePermission({ jobs: ["view"] });
    await handler(makeRequest(null), reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(mocks.userHasPermission).not.toHaveBeenCalled();
  });

  it("returns 403 when userHasPermission.success is false", async () => {
    mocks.userHasPermission.mockResolvedValue({ success: false });
    const reply = makeReply();
    const handler = requirePermission({ jobs: ["edit"] });
    await handler(makeRequest("FRONT_DESK"), reply as never);
    expect(mocks.userHasPermission).toHaveBeenCalledWith({
      body: { role: "FRONT_DESK", permissions: { jobs: ["edit"] } },
    });
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("passes through when userHasPermission.success is true", async () => {
    mocks.userHasPermission.mockResolvedValue({ success: true });
    const reply = makeReply();
    const handler = requirePermission({ jobStatus: ["DELIVERED"] });
    await handler(makeRequest("FRONT_DESK"), reply as never);
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
