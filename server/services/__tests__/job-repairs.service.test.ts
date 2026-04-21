import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { add, remove } from "../job-repairs.service";

vi.mock("../audit.service.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function mockPrisma() {
  const mock = {
    job: {
      findUnique: vi.fn(),
    },
    jobRepair: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(mock)),
  };
  return mock as unknown as PrismaClient;
}

describe("add", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns null when job not found", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await add(
      prisma,
      "job-1",
      {
        category: "SCREEN_REPAIR",
        price: 100,
        repairId: null,
        repairName: "Screen Replacement",
      },
      "user-1"
    );

    expect(result).toBeNull();
  });

  it("returns error when job is in terminal status", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      status: "CANCELLED",
    });

    const result = await add(
      prisma,
      "job-1",
      {
        category: "SCREEN_REPAIR",
        price: 100,
        repairId: null,
        repairName: "Screen Replacement",
      },
      "user-1"
    );

    expect(result).toEqual({ error: "JOB_IN_TERMINAL_STATUS" });
  });

  it("returns error when duplicate repair exists", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
    });
    (prisma.jobRepair.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-repair",
      repairId: "repair-catalog-1",
    });

    const result = await add(
      prisma,
      "job-1",
      {
        category: "SCREEN_REPAIR",
        price: 100,
        repairId: "repair-catalog-1",
        repairName: "Screen Replacement",
      },
      "user-1"
    );

    expect(result).toEqual({ error: "DUPLICATE_REPAIR" });
  });

  it("creates repair when no repairId specified", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
    });
    (prisma.jobRepair.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "repair-1",
      price: 100,
      repairName: "Screen Fix",
    });

    const result = await add(
      prisma,
      "job-1",
      {
        category: "SCREEN_REPAIR",
        price: 100,
        repairId: null,
        repairName: "Screen Fix",
      },
      "user-1"
    );

    if (result === null) {
      expect.fail("Expected result to be non-null");
    }
    if ("error" in result) {
      expect.fail("Expected result not to have error");
    }
    expect(result.id).toBe("repair-1");
    expect(prisma.jobRepair.create).toHaveBeenCalled();
  });

  it("creates repair with repairId when specified and not duplicate", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
    });
    (prisma.jobRepair.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (prisma.jobRepair.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "repair-1",
      price: 150,
      repairId: "catalog-1",
      repairName: "Battery Replacement",
    });

    const result = await add(
      prisma,
      "job-1",
      {
        category: "BATTERY_REPLACEMENT",
        price: 150,
        repairId: "catalog-1",
        repairName: "Battery Replacement",
      },
      "user-1"
    );

    if (result === null) {
      expect.fail("Expected result to be non-null");
    }
    if ("error" in result) {
      expect.fail("Expected result not to have error");
    }
    expect(result.repairId).toBe("catalog-1");
  });
});

describe("remove", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns null when repair not found", async () => {
    (prisma.jobRepair.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await remove(prisma, "job-1", "repair-1", "user-1");

    expect(result).toBeNull();
  });

  it("returns error when job is in terminal status", async () => {
    (prisma.jobRepair.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "repair-1",
      job: { status: "RETURNED" },
      repairName: "Screen Fix",
    });

    const result = await remove(prisma, "job-1", "repair-1", "user-1");

    expect(result).toEqual({ error: "JOB_IN_TERMINAL_STATUS" });
  });

  it("deletes repair and returns true on success", async () => {
    (prisma.jobRepair.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "repair-1",
      job: { status: "IN_REPAIR" },
      repairName: "Screen Fix",
      price: 100,
    });
    (prisma.jobRepair.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await remove(prisma, "job-1", "repair-1", "user-1");

    expect(result).toBe(true);
    expect(prisma.jobRepair.delete).toHaveBeenCalledWith({
      where: { id: "repair-1" },
    });
  });
});
