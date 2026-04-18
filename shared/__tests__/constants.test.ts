import {
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  JOB_STATUS_FLOW,
  JobStatus,
} from "@shared/constants/job-statuses";
import { ROLE_LABELS, Role } from "@shared/constants/roles";
import { roles } from "@shared/permissions";
import { describe, expect, it } from "vitest";

describe("Job Status Constants", () => {
  it("has all expected statuses", () => {
    const statuses = Object.values(JobStatus);
    expect(statuses).toHaveLength(8);
    expect(statuses).toContain("INTAKE");
    expect(statuses).toContain("CANCELLED");
  });

  it("every status has a flow entry", () => {
    for (const status of Object.values(JobStatus)) {
      expect(JOB_STATUS_FLOW).toHaveProperty(status);
    }
  });

  it("active and inactive are disjoint and cover all statuses", () => {
    const active = new Set(ACTIVE_STATUSES);
    const inactive = new Set(INACTIVE_STATUSES);
    for (const s of active) {
      expect(inactive.has(s)).toBe(false);
    }
    expect(active.size + inactive.size).toBe(Object.values(JobStatus).length);
  });
});

describe("Role Constants", () => {
  it("has OWNER, TECHNICIAN, FRONT_DESK", () => {
    expect(Role.OWNER).toBe("OWNER");
    expect(Role.TECHNICIAN).toBe("TECHNICIAN");
    expect(Role.FRONT_DESK).toBe("FRONT_DESK");
  });

  it("every role has a label", () => {
    for (const role of Object.values(Role)) {
      expect(ROLE_LABELS[role]).toBeDefined();
    }
  });

  it("every role has defined permissions", () => {
    for (const role of Object.values(Role)) {
      const roleDef = roles[role as keyof typeof roles];
      expect(roleDef).toBeDefined();
      expect(typeof roleDef.authorize).toBe("function");
    }
  });
});
