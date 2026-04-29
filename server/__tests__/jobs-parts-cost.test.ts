import { AppError, isAppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobRoutes } from "../routes/jobs.js";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userHasPermission: vi.fn(),
  addPart: vi.fn(),
  removePart: vi.fn(),
  transitionStatus: vi.fn(),
  getById: vi.fn(),
  createJob: vi.fn(),
  listJobs: vi.fn(),
  getMetrics: vi.fn(),
  lookupByCode: vi.fn(),
  updateJob: vi.fn(),
  addNote: vi.fn(),
  listNotes: vi.fn(),
  addRepair: vi.fn(),
  removeRepair: vi.fn(),
  removePhoto: vi.fn(),
  uploadPhoto: vi.fn(),
  addWaitingPart: vi.fn(),
  removeWaitingPart: vi.fn(),
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/job.service.js", () => ({
  transitionStatus: mocks.transitionStatus,
  getById: mocks.getById,
  create: mocks.createJob,
  list: mocks.listJobs,
  getMetrics: mocks.getMetrics,
  lookupByCode: mocks.lookupByCode,
  update: mocks.updateJob,
}));

vi.mock("../services/job-notes.service.js", () => ({
  add: mocks.addNote,
  list: mocks.listNotes,
}));

vi.mock("../services/job-parts.service.js", () => ({
  add: mocks.addPart,
  remove: mocks.removePart,
}));

vi.mock("../services/job-photos.service.js", () => ({
  upload: mocks.uploadPhoto,
  remove: mocks.removePhoto,
}));

vi.mock("../services/job-repairs.service.js", () => ({
  add: mocks.addRepair,
  remove: mocks.removeRepair,
}));

vi.mock("../services/job-waiting-parts.service.js", () => ({
  add: mocks.addWaitingPart,
  remove: mocks.removeWaitingPart,
}));

vi.mock("../middlewares/rbac.js", () => ({
  requirePermission: () => async (request: any) => {
    if (!request.user) {
      throw new AppError("UNAUTHORIZED");
    }
    const result = await request.server.auth.api.userHasPermission({
      body: {
        role: request.user.role,
        permissions: { jobs: ["view"] },
      },
    });
    if (!result.success) {
      throw new AppError("FORBIDDEN");
    }
  },
}));

function buildApp(userId: string | null, role = "OWNER") {
  const app = Fastify();

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      const payload: Record<string, unknown> = {
        code: error.code,
        message: error instanceof Error ? error.message : "Internal error",
      };
      if (error.details !== undefined) {
        payload.details = error.details;
      }
      reply.status(error.status).send(payload);
      return;
    }
    reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Internal error",
    });
  });

  const mockSession = userId
    ? {
        user: {
          id: userId,
          name: "Test",
          username: "test",
          email: "test@test.com",
          role,
          isActive: true,
          mustChangePassword: false,
        },
        session: { id: "sess-1" },
      }
    : null;

  mocks.getSession.mockResolvedValue(mockSession);
  mocks.userHasPermission.mockResolvedValue({ success: true });

  (app.decorate as (name: string, value: unknown) => void)("auth", {
    api: {
      getSession: mocks.getSession,
      userHasPermission: mocks.userHasPermission,
    },
  });

  (app.decorate as (name: string, value: unknown) => void)("prisma", {});

  app.addHook("preHandler", async (request: any, _reply: any) => {
    const session = await app.auth.api.getSession({ headers: new Headers() });
    if (!session) {
      request.user = null;
      return;
    }
    request.user = session.user;
  });

  app.register(jobRoutes, { prefix: "/api/jobs" });
  return app;
}

describe("POST /api/jobs/:id/parts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 when adding a catalog part", async () => {
    mocks.addPart.mockResolvedValue({
      id: "jp-1",
      jobId: "job-1",
      partId: "p1",
      partName: "Screen",
      category: "SCREEN",
      unitPrice: 50,
      quantity: 2,
      totalCost: 100,
    });

    const app = buildApp("user-1");
    const res = await app.inject({
      method: "POST",
      url: "/api/jobs/job-1/parts",
      payload: {
        partId: "p1",
        partName: "Screen",
        category: "SCREEN",
        unitPrice: 50,
        quantity: 2,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.totalCost).toBe(100);
    expect(mocks.addPart).toHaveBeenCalledWith(
      expect.objectContaining({}),
      "job-1",
      expect.objectContaining({
        partId: "p1",
        partName: "Screen",
        category: "SCREEN",
        unitPrice: 50,
        quantity: 2,
      }),
      "user-1"
    );
  });

  it("returns 201 when adding an ad-hoc part without partId", async () => {
    mocks.addPart.mockResolvedValue({
      id: "jp-2",
      jobId: "job-1",
      partId: null,
      partName: "Custom Part",
      category: "OTHER",
      unitPrice: 15,
      quantity: 1,
      totalCost: 15,
    });

    const app = buildApp("user-1");
    const res = await app.inject({
      method: "POST",
      url: "/api/jobs/job-1/parts",
      payload: {
        partName: "Custom Part",
        category: "OTHER",
        unitPrice: 15,
        quantity: 1,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.partId).toBeNull();
    expect(body.totalCost).toBe(15);
  });

  it("returns 409 JOB_IN_TERMINAL_STATUS when adding to terminal job", async () => {
    mocks.addPart.mockResolvedValue({ error: "JOB_IN_TERMINAL_STATUS" });

    const app = buildApp("user-1");
    const res = await app.inject({
      method: "POST",
      url: "/api/jobs/job-1/parts",
      payload: {
        partName: "Screen",
        category: "SCREEN",
        unitPrice: 50,
        quantity: 1,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("JOB_IN_TERMINAL_STATUS");
  });
});

describe("DELETE /api/jobs/:id/parts/:partId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 when removing a part", async () => {
    mocks.removePart.mockResolvedValue(true);

    const app = buildApp("user-1");
    const res = await app.inject({
      method: "DELETE",
      url: "/api/jobs/job-1/parts/part-1",
    });

    expect(res.statusCode).toBe(204);
    expect(mocks.removePart).toHaveBeenCalledWith(
      expect.objectContaining({}),
      "job-1",
      "part-1",
      "user-1"
    );
  });

  it("returns 404 RESOURCE_NOT_FOUND when removing non-existent part", async () => {
    mocks.removePart.mockResolvedValue(null);

    const app = buildApp("user-1");
    const res = await app.inject({
      method: "DELETE",
      url: "/api/jobs/job-1/parts/non-existent",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
  });
});

describe("Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const app = buildApp(null);
    const res = await app.inject({
      method: "POST",
      url: "/api/jobs/job-1/parts",
      payload: {
        partName: "Screen",
        category: "SCREEN",
        unitPrice: 50,
        quantity: 1,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});
