import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetTzCache, dashboardScope } from "../dashboard-scope.js";

function buildApp(
  user: { id: string; role: string } | null,
  shopSettings: { timezone: string | null } | null
) {
  const app = Fastify();
  (app.decorate as (name: string, value: unknown) => void)("prisma", {
    shopSettings: { findFirst: vi.fn().mockResolvedValue(shopSettings) },
  });
  app.addHook("onRequest", (req, _reply, done) => {
    (req as { user: unknown }).user = user;
    done();
  });
  app.addHook("preHandler", dashboardScope);
  app.get("/probe", async (req) => ({
    scope: (req as { dashboardScope: unknown }).dashboardScope,
  }));
  return app;
}

beforeEach(() => __resetTzCache());

describe("dashboardScope middleware", () => {
  it("attaches scope from session and shop timezone", async () => {
    const app = buildApp(
      { id: "u1", role: "OWNER" },
      { timezone: "Africa/Algiers" }
    );
    const res = await app.inject({ method: "GET", url: "/probe" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).scope).toEqual({
      role: "OWNER",
      shopTz: "Africa/Algiers",
      userId: "u1",
    });
  });

  it("falls back to env TZ when ShopSettings has no timezone", async () => {
    vi.stubEnv("TZ", "UTC");
    const app = buildApp({ id: "u2", role: "TECHNICIAN" }, { timezone: null });
    const res = await app.inject({ method: "GET", url: "/probe" });
    expect(JSON.parse(res.body).scope.shopTz).toBe("UTC");
    vi.unstubAllEnvs();
  });

  it("returns 401 without session user", async () => {
    const app = buildApp(null, { timezone: "UTC" });
    const res = await app.inject({ method: "GET", url: "/probe" });
    expect(res.statusCode).toBe(401);
  });
});
