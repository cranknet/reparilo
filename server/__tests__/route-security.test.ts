import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECURITY,
  matchRoute,
  type RouteSecurityOverride,
  routeSecurity,
} from "../../server/config/route-security.js";

describe("matchRoute", () => {
  it("matches exact paths", () => {
    expect(matchRoute("/health", routeSecurity)).toBeDefined();
    expect(matchRoute("/health", routeSecurity)?.csrf).toBe(false);
  });

  it("matches wildcard patterns", () => {
    expect(matchRoute("/api/auth/sign-in", routeSecurity)?.csrf).toBe(false);
    expect(matchRoute("/api/auth/anything", routeSecurity)?.csrf).toBe(false);
  });

  it("returns first match (more specific wins)", () => {
    const result = matchRoute("/api/auth/change-password", routeSecurity);
    expect(result?.allowSensitiveKeys).toBe(true);
    expect(result?.rateLimit).toEqual({ max: 5, timeWindow: "1 minute" });
  });

  it("returns undefined for unmatched routes", () => {
    expect(matchRoute("/api/unknown/route", routeSecurity)).toBeUndefined();
  });

  it("does not match partial segments", () => {
    const customRules: [string, RouteSecurityOverride][] = [
      ["/api/auth/*", { csrf: false }],
    ];
    expect(matchRoute("/api/authx/sign-in", customRules)).toBeUndefined();
  });

  it("wildcard matches any single segment", () => {
    expect(matchRoute("/api/jobs", routeSecurity)).toBeDefined();
    expect(matchRoute("/api/parts", routeSecurity)).toBeDefined();
  });

  it("matches :param segments as wildcards", () => {
    expect(
      matchRoute("/api/users/42/reset-password", routeSecurity)
    ).toBeDefined();
    expect(
      matchRoute("/api/users/42/reset-password", routeSecurity)
        ?.allowSensitiveKeys
    ).toBe(true);
    expect(matchRoute("/api/users/99/status", routeSecurity)).toBeDefined();
  });
});

describe("DEFAULT_SECURITY", () => {
  it("has correct defaults", () => {
    expect(DEFAULT_SECURITY.rateLimit).toEqual({
      max: 100,
      timeWindow: "1 minute",
    });
    expect(DEFAULT_SECURITY.csrf).toBeUndefined();
    expect(DEFAULT_SECURITY.allowSensitiveKeys).toBe(false);
  });
});
