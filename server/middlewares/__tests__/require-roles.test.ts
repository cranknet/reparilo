import { isAppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { requireRoles } from "../require-roles.js";

function app(userRole: string | null) {
  const a = Fastify();
  a.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply
        .status(error.status)
        .send({ code: error.code, message: error.message });
    } else {
      reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Internal error",
      });
    }
  });
  a.addHook("onRequest", (req, _r, done) => {
    (req as { user: unknown }).user = userRole
      ? { id: "u", role: userRole }
      : null;
    done();
  });
  a.get("/o", { preHandler: [requireRoles("OWNER")] }, async () => ({
    ok: true,
  }));
  a.get(
    "/t",
    { preHandler: [requireRoles("OWNER", "TECHNICIAN")] },
    async () => ({ ok: true })
  );
  return a;
}

describe("requireRoles", () => {
  it("401 without session", async () => {
    expect(
      (await app(null).inject({ method: "GET", url: "/o" })).statusCode
    ).toBe(401);
  });

  it("403 when role not allowed", async () => {
    expect(
      (await app("FRONT_DESK").inject({ method: "GET", url: "/o" })).statusCode
    ).toBe(403);
  });

  it("200 when role matches", async () => {
    expect(
      (await app("OWNER").inject({ method: "GET", url: "/o" })).statusCode
    ).toBe(200);
    expect(
      (await app("TECHNICIAN").inject({ method: "GET", url: "/t" })).statusCode
    ).toBe(200);
  });
});
