import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { add, list } from "../job-notes.service";

vi.mock("../audit.service.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function mockPrisma() {
  const mock = {
    job: {
      findUnique: vi.fn(),
    },
    jobNote: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(mock)),
  };
  return mock as unknown as PrismaClient;
}

describe("list", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns null when job not found", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await list(prisma, "job-1");

    expect(result).toBeNull();
  });

  it("returns notes with createdBy info when job exists", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
    });
    (prisma.jobNote.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        content: "Test note",
        createdAt: new Date("2024-01-01"),
        createdBy: { id: "user-1", name: "John", username: "john" },
        id: "note-1",
      },
    ]);

    const result = await list(prisma, "job-1");

    expect(result).toHaveLength(1);
    expect(result?.[0]).toHaveProperty("content", "Test note");
    expect(result?.[0]?.createdBy).toHaveProperty("name", "John");
  });

  it("orders notes by createdAt desc", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
    });
    (prisma.jobNote.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await list(prisma, "job-1");

    const findManyCall = (prisma.jobNote.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(findManyCall[0].orderBy).toEqual({ createdAt: "desc" });
  });
});

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
        content: "Test note",
        isCustomerVisible: false,
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
        content: "Test note",
        isCustomerVisible: false,
      },
      "user-1"
    );

    expect(result).toEqual({ error: "JOB_IN_TERMINAL_STATUS" });
  });

  it("creates note with correct data", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
    });
    (prisma.jobNote.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "Customer will pick up tomorrow",
      createdBy: { id: "user-1", name: "Tech", username: "tech1" },
      id: "note-1",
      isCustomerVisible: true,
    });

    const result = await add(
      prisma,
      "job-1",
      {
        content: "Customer will pick up tomorrow",
        isCustomerVisible: true,
      },
      "user-1"
    );

    if (result === null) {
      expect.fail("Expected result to be non-null");
    }
    if ("error" in result) {
      expect.fail("Expected result not to have error");
    }
    expect(result.content).toBe("Customer will pick up tomorrow");
    expect(result.isCustomerVisible).toBe(true);
  });

  it("creates internal note when isCustomerVisible is false", async () => {
    (prisma.job.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      status: "IN_REPAIR",
    });
    (prisma.jobNote.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "Internal note",
      createdBy: { id: "user-1", name: "Tech", username: "tech1" },
      id: "note-1",
      isCustomerVisible: false,
    });

    const result = await add(
      prisma,
      "job-1",
      {
        content: "Internal note",
        isCustomerVisible: false,
      },
      "user-1"
    );

    if (result === null) {
      expect.fail("Expected result to be non-null");
    }
    if ("error" in result) {
      expect.fail("Expected result not to have error");
    }
    expect(result.isCustomerVisible).toBe(false);
  });
});
