import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  create,
  getById,
  list,
  toggleActive,
  update,
} from "../repair-catalog.service";

function mockPrisma() {
  return {
    repairCatalog: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("list", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns repairs with pagination", async () => {
    const mockRepairs = [
      {
        category: "HARDWARE",
        defaultPrice: 100,
        id: "1",
        isActive: true,
        name: "Screen Replacement",
      },
      {
        category: "HARDWARE",
        defaultPrice: 80,
        id: "2",
        isActive: true,
        name: "Battery Swap",
      },
    ];
    (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockRepairs);
    (prisma.repairCatalog.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      2
    );

    const result = await list(prisma, {
      category: undefined,
      cursor: undefined,
      isActive: undefined,
      limit: 10,
      search: undefined,
    });

    expect(result.repairs).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.nextCursor).toBeNull();
  });

  it("filters by category", async () => {
    (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (prisma.repairCatalog.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      0
    );

    await list(prisma, {
      category: "HARDWARE",
      cursor: undefined,
      isActive: undefined,
      limit: 10,
      search: undefined,
    });

    const findManyCall = (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(findManyCall[0].where.category).toBe("HARDWARE");
  });

  it("filters by isActive", async () => {
    (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (prisma.repairCatalog.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      0
    );

    await list(prisma, {
      category: undefined,
      cursor: undefined,
      isActive: false,
      limit: 10,
      search: undefined,
    });

    const findManyCall = (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(findManyCall[0].where.isActive).toBe(false);
  });

  it("searches by name", async () => {
    (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (prisma.repairCatalog.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      0
    );

    await list(prisma, {
      category: undefined,
      cursor: undefined,
      isActive: undefined,
      limit: 10,
      search: "screen",
    });

    const findManyCall = (
      prisma.repairCatalog.findMany as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(findManyCall[0].where.name).toEqual({
      contains: "screen",
      mode: "insensitive",
    });
  });
});

describe("getById", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns repair when found", async () => {
    (
      prisma.repairCatalog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      category: "HARDWARE",
      defaultPrice: 100,
      id: "repair-1",
      name: "Screen Fix",
    });

    const result = await getById(prisma, "repair-1");

    expect(result).toHaveProperty("id", "repair-1");
    expect(result).toHaveProperty("name", "Screen Fix");
  });

  it("returns null when not found", async () => {
    (
      prisma.repairCatalog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await getById(prisma, "non-existent");

    expect(result).toBeNull();
  });
});

describe("create", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("creates repair with correct data", async () => {
    (prisma.repairCatalog.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        category: "HARDWARE",
        defaultPrice: 120,
        id: "repair-1",
        name: "Screen Replacement",
      }
    );

    const result = await create(prisma, {
      category: "HARDWARE",
      defaultPrice: 120,
      name: "Screen Replacement",
    });

    expect(result).toHaveProperty("id", "repair-1");
    expect(result).toHaveProperty("name", "Screen Replacement");
  });
});

describe("update", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns null when repair not found", async () => {
    (
      prisma.repairCatalog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await update(prisma, "non-existent", { name: "New Name" });

    expect(result).toBeNull();
  });

  it("updates repair with provided data", async () => {
    (
      prisma.repairCatalog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "repair-1",
      name: "Old Name",
    });
    (prisma.repairCatalog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        category: "HARDWARE",
        defaultPrice: 90,
        id: "repair-1",
        name: "Battery Service",
      }
    );

    const result = await update(prisma, "repair-1", {
      name: "Battery Service",
      defaultPrice: 90,
    });

    expect(result).toHaveProperty("name", "Battery Service");
    expect(result).toHaveProperty("defaultPrice", 90);
  });
});

describe("toggleActive", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("returns null when repair not found", async () => {
    (
      prisma.repairCatalog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await toggleActive(prisma, "non-existent", false);

    expect(result).toBeNull();
  });

  it("toggles isActive status", async () => {
    (
      prisma.repairCatalog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "repair-1",
      isActive: true,
    });
    (prisma.repairCatalog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        id: "repair-1",
        isActive: false,
      }
    );

    const result = await toggleActive(prisma, "repair-1", false);

    expect(result).toHaveProperty("isActive", false);
  });
});
