// @vitest-environment jsdom

import { render, renderHook, screen } from "@testing-library/react";
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

import { Can } from "@/components/modules/can";
import { can, useCan } from "../use-can";

describe("can", () => {
  beforeEach(() => {
    mocks.checkRolePermission.mockReset();
  });

  it("passes role and permissions to checkRolePermission", () => {
    mocks.checkRolePermission.mockReturnValue(true);
    const result = can("OWNER", { jobs: ["delete"] });
    expect(mocks.checkRolePermission).toHaveBeenCalledWith({
      role: "OWNER",
      permissions: { jobs: ["delete"] },
    });
    expect(result).toBe(true);
  });

  it("returns false when checkRolePermission returns false", () => {
    mocks.checkRolePermission.mockReturnValue(false);
    expect(can("FRONT_DESK", { settings: ["edit"] })).toBe(false);
  });
});

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

describe("Can", () => {
  beforeEach(() => {
    mocks.checkRolePermission.mockReset();
    mocks.currentRole.value = "OWNER";
  });

  it("renders children when allowed", () => {
    mocks.checkRolePermission.mockReturnValue(true);
    render(<Can perm={{ jobs: ["delete"] }}>allowed content</Can>);
    expect(screen.getByText("allowed content")).toBeTruthy();
  });

  it("renders fallback when denied", () => {
    mocks.checkRolePermission.mockReturnValue(false);
    render(
      <Can fallback={<span>no access</span>} perm={{ jobs: ["delete"] }}>
        allowed content
      </Can>
    );
    expect(screen.queryByText("allowed content")).toBeNull();
    expect(screen.getByText("no access")).toBeTruthy();
  });

  it("renders nothing when denied and no fallback", () => {
    mocks.checkRolePermission.mockReturnValue(false);
    const { container } = render(
      <Can perm={{ jobs: ["delete"] }}>allowed content</Can>
    );
    expect(container.firstChild).toBeNull();
  });
});
