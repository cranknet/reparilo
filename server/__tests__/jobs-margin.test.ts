import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobRoutes } from "../routes/jobs.js";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userHasPermission: vi.fn(),
  getById: vi.fn(),
  transitionStatus: vi.fn(),
  createJob: vi.fn(),
  listJobs: vi.fn(),
  getMetrics: vi.fn(),
  lookupByCode: vi.fn(),
  updateJob: vi.fn(),
  addNote: vi.fn(),
  listNotes: vi.fn(),
  addPart: vi.fn(),
  removePart: vi.fn(),
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
  computeMargin: vi.fn().mockReturnValue(2000),
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
  requirePermission: () => async (request: any, reply: any) => {
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }
    const result = await request.server.auth.api.userHasPermission({
      body: {
        role: request.user.role,
        permissions: { jobs: ["view"] },
      },
    });
    if (!result.success) {
      await reply.status(403).send({ error: "Insufficient permissions" });
      return;
    }
  },
}));

function buildApp(userId: string | null, role = "OWNER") {
  const app = Fastify();

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

  app.addHook("preHandler", async (request: any) => {
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

describe("GET /api/jobs/:id — margin field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes margin for users with reports.viewMargin", async () => {
    mocks.getById.mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
      finalCost: 5000,
      partsUsed: [{ totalCost: 2000 }, { totalCost: 1000 }],
    });

    const app = buildApp("user-1", "OWNER");
    mocks.userHasPermission.mockImplementation(
      ({ body: { permissions } }: any) => {
        if (permissions.reports?.includes("viewMargin")) {
          return { success: true };
        }
        if (permissions.jobs?.includes("view")) {
          return { success: true };
        }
        return { success: false };
      }
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/jobs/job-1",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.margin).toBe(2000);
  });

  it("excludes margin for users without reports.viewMargin", async () => {
    mocks.getById.mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
      finalCost: 5000,
      partsUsed: [{ totalCost: 2000 }],
    });

    const app = buildApp("user-1", "TECHNICIAN");
    mocks.userHasPermission.mockImplementation(
      ({ body: { permissions } }: any) => {
        if (permissions.reports?.includes("viewMargin")) {
          return { success: false };
        }
        if (permissions.jobs?.includes("view")) {
          return { success: true };
        }
        return { success: true };
      }
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/jobs/job-1",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.margin).toBeUndefined();
  });
});
