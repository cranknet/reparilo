import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobRoutes } from "../routes/jobs.js";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userHasPermission: vi.fn(),
  createJob: vi.fn(),
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/job.service.js", () => ({
  create: mocks.createJob,
  transitionStatus: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  getMetrics: vi.fn(),
  lookupByCode: vi.fn(),
  update: vi.fn(),
  computeMargin: vi.fn().mockReturnValue(0),
}));

vi.mock("../services/job-notes.service.js", () => ({
  add: vi.fn(),
  list: vi.fn(),
}));

vi.mock("../services/job-parts.service.js", () => ({
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../services/job-photos.service.js", () => ({
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../services/job-repairs.service.js", () => ({
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../services/job-waiting-parts.service.js", () => ({
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../middlewares/rbac.js", () => ({
  requirePermission: () => async (request: any, reply: any) => {
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }
    await request.server.auth.api.userHasPermission({
      body: { role: request.user.role, permissions: { jobs: ["view"] } },
    });
  },
}));

function buildApp() {
  const app = Fastify();
  const broadcastCalls: Array<{
    predicate: (client: { role: string }) => boolean;
    payload: Record<string, unknown>;
  }> = [];

  mocks.getSession.mockResolvedValue({
    user: {
      id: "u1",
      name: "Owner",
      role: "OWNER",
      email: "o@t.com",
      isActive: true,
      mustChangePassword: false,
    },
    session: { id: "s1" },
  });
  mocks.userHasPermission.mockResolvedValue({ success: true });

  (app.decorate as (name: string, value: unknown) => void)("auth", {
    api: {
      getSession: mocks.getSession,
      userHasPermission: mocks.userHasPermission,
    },
  });

  (app.decorate as (name: string, value: unknown) => void)(
    "wsBroadcast",
    (
      predicate: (client: { role: string }) => boolean,
      payload: Record<string, unknown>
    ) => {
      broadcastCalls.push({ payload, predicate });
    }
  );

  (app.decorate as (name: string, value: unknown) => void)("prisma", {});

  app.addHook("preHandler", async (request: any) => {
    const session = await app.auth.api.getSession({ headers: new Headers() });
    request.user = session?.user ?? null;
  });

  app.register(jobRoutes, { prefix: "/api/jobs" });

  return { app, broadcastCalls };
}

describe("Warranty return broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("broadcasts WARRANTY_RETURN_CREATED when warranty return is created", async () => {
    mocks.createJob.mockResolvedValue({
      id: "job-1",
      isWarrantyReturn: true,
      jobCode: "RPR-001",
    });

    const { app, broadcastCalls } = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        reportedProblem: "Broken again",
        deviceBrand: "Apple",
        deviceModel: "iPhone 15",
        estimatedCost: 5000,
        customerName: "Test",
        customerPhone: "+1234567890",
        isWarrantyReturn: true,
        warrantyForJobId: "original-job",
      },
    });

    expect(res.statusCode).toBe(201);
    const warrantyCalls = broadcastCalls.filter(
      (c) => c.payload.type === "WARRANTY_RETURN_CREATED"
    );
    const dashboardCalls = broadcastCalls.filter(
      (c) => c.payload.type === "dashboard:invalidate"
    );
    expect(warrantyCalls).toHaveLength(1);
    expect(warrantyCalls[0].payload.job).toEqual({
      id: "job-1",
      jobCode: "RPR-001",
    });

    const ownerClient = { role: "OWNER" };
    const techClient = { role: "TECHNICIAN" };
    expect(warrantyCalls[0].predicate(ownerClient)).toBe(true);
    expect(warrantyCalls[0].predicate(techClient)).toBe(false);

    expect(dashboardCalls.length).toBe(2);
  });

  it("does not broadcast when job is not a warranty return", async () => {
    mocks.createJob.mockResolvedValue({
      id: "job-2",
      isWarrantyReturn: false,
      jobCode: "RPR-002",
    });

    const { app, broadcastCalls } = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        reportedProblem: "Broken screen",
        deviceBrand: "Samsung",
        deviceModel: "Galaxy S24",
        estimatedCost: 3000,
        customerName: "Test",
        customerPhone: "+1234567890",
      },
    });

    expect(res.statusCode).toBe(201);
    const warrantyCalls = broadcastCalls.filter(
      (c) => c.payload.type === "WARRANTY_RETURN_CREATED"
    );
    const dashboardCalls = broadcastCalls.filter(
      (c) => c.payload.type === "dashboard:invalidate"
    );
    expect(warrantyCalls).toHaveLength(0);
    expect(dashboardCalls.length).toBe(2);
  });
});
