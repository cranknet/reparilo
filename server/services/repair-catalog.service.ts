import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreateRepairInput,
  ListRepairsQueryInput,
  UpdateRepairInput,
} from "@shared/schemas/repair-catalog.schema";

export async function list(prisma: PrismaClient, query: ListRepairsQueryInput) {
  const { cursor, limit, search, category, isActive } = query;

  const where: Prisma.RepairCatalogWhereInput = {};
  if (category) {
    where.category = category as Prisma.EnumRepairCategoryFilter;
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (cursor) {
    where.id = { lt: cursor };
  }

  const [repairs, totalCount] = await Promise.all([
    prisma.repairCatalog.findMany({
      orderBy: { name: "asc" },
      take: limit + 1,
      where,
    }),
    cursor ? Promise.resolve(null) : prisma.repairCatalog.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (repairs.length > limit) {
    const last = repairs.pop();
    if (last) {
      nextCursor = last.id;
    }
  }

  return { nextCursor, repairs, totalCount };
}

export async function getById(prisma: PrismaClient, id: string) {
  return await prisma.repairCatalog.findUnique({ where: { id } });
}

export async function create(prisma: PrismaClient, input: CreateRepairInput) {
  return await prisma.repairCatalog.create({
    data: {
      category: input.category,
      defaultPrice: input.defaultPrice,
      name: input.name,
    },
  });
}

export async function update(
  prisma: PrismaClient,
  id: string,
  input: UpdateRepairInput
) {
  const existing = await prisma.repairCatalog.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  return await prisma.repairCatalog.update({
    data: input,
    where: { id },
  });
}

export async function toggleActive(
  prisma: PrismaClient,
  id: string,
  isActive: boolean
) {
  const existing = await prisma.repairCatalog.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  return await prisma.repairCatalog.update({
    data: { isActive },
    where: { id },
  });
}
