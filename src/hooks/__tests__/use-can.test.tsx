// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentRole: { value: "FRONT_DESK" },
  checkRolePermission: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { role: string }) => unknown) =>
    selector({ role: mocks.currentRole.value }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    admin: { checkRolePermission: mocks.checkRolePermission },
  },
}));

import { useCan } from "../use-can";

describe("useCan", () => {
  beforeEach(() => {
    mocks.checkRolePermission.mockReset();
  });

  it("returns false when role lacks the permission", () => {
    mocks.currentRole.value = "FRONT_DESK";
    mocks.checkRolePermission.mockReturnValue(false);
    const { result } = renderHook(() => useCan({ jobs: ["edit"] }));
    expect(result.current).toBe(false);
  });

  it("returns true when role has the permission", () => {
    mocks.currentRole.value = "OWNER";
    mocks.checkRolePermission.mockReturnValue(true);
    const { result } = renderHook(() => useCan({ settings: ["edit"] }));
    expect(mocks.checkRolePermission).toHaveBeenCalledWith({
      permissions: { settings: ["edit"] },
      role: "OWNER",
    });
    expect(result.current).toBe(true);
  });
});
