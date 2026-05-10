import { AppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../middlewares/rbac.js", () => ({
  requirePermission:
    (permissions: Record<string, string[]>) => async (request: any) => {
      if (!request.user) {
        throw new AppError("UNAUTHORIZED");
      }
      const result = await request.server.auth.api.userHasPermission({
        body: { role: request.user.role, permissions },
      });
      if (!result.success) {
        throw new AppError("FORBIDDEN");
      }
    },
}));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  triage: vi.fn(),
  spawnRework: vi.fn(),
  detachRework: vi.fn(),
  resolve: vi.fn(),
  uploadPhoto: vi.fn(),
  removePhoto: vi.fn(),
}));

vi.mock("../services/return-claim.service.js", () => mocks);

import { returnClaimsRoutes } from "../routes/return-claims.js";

function buildApp(role = "OWNER") {
  const app = Fastify();
  app.decorate("prisma", {} as never);
  app.decorate("auth", {
    api: {
      userHasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  } as never);
  app.addHook("onRequest", (req) => {
    (req as any).user = { id: "user-1", role, isActive: true } as never;
    (req as any).locale = "en";
  });
  app.register(returnClaimsRoutes);
  return app;
}

describe("POST /return-claims", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(async () => undefined);

  it("creates a claim with valid input", async () => {
    mocks.create.mockResolvedValue({ id: "rc-1" });
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: { originalJobId: "job-1", returnReason: "screen flickers" },
    });

    expect(res.statusCode).toBe(201);
    expect(mocks.create).toHaveBeenCalled();
  });

  it("returns 400 on validation failure", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /return-claims/:id/resolve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves rework outcomes", async () => {
    mocks.resolve.mockResolvedValue({ id: "rc-1", status: "RESOLVED" });
    const app = buildApp("TECHNICIAN");
    const res = await app.inject({
      method: "PATCH",
      url: "/rc-1/resolve",
      payload: { resolutionOutcome: "REWORK_FREE" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("blocks technicians from refund outcomes", async () => {
    const app = Fastify();
    app.decorate("prisma", {} as never);
    app.decorate("auth", {
      api: {
        userHasPermission: vi.fn().mockImplementation((args: any) => {
          const has = !args.body.permissions.returns?.includes("resolveRefund");
          return { success: has };
        }),
      },
    } as never);
    app.addHook("onRequest", (req) => {
      (req as any).user = { id: "u", role: "TECHNICIAN", isActive: true };
      (req as any).locale = "en";
    });
    app.register(returnClaimsRoutes);

    const res = await app.inject({
      method: "PATCH",
      url: "/rc-1/resolve",
      payload: { resolutionOutcome: "REFUND_FULL", refundAmount: 100 },
    });

    expect(res.statusCode).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
