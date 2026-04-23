import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreatePartInput,
  ListPartsQueryInput,
  UpdatePartInput,
} from "@shared/schemas/parts-catalog.schema";

export async function list(prisma: PrismaClient, query: ListPartsQueryInput) {
  const { category, cursor, isActive, limit, search } = query;

  const where: Prisma.PartsCatalogWhereInput = {};
  if (category) {
    where.category = category as Prisma.EnumPartCategoryFilter<"PartsCatalog">;
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

  const [parts, totalCount] = await Promise.all([
    prisma.partsCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit + 1,
    }),
    cursor ? Promise.resolve(null) : prisma.partsCatalog.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (parts.length > limit) {
    const last = parts.pop();
    if (last) {
      nextCursor = last.id;
    }
  }

  return { nextCursor, parts, totalCount };
}

export async function getById(prisma: PrismaClient, id: string) {
  return await prisma.partsCatalog.findUnique({ where: { id } });
}

export async function create(prisma: PrismaClient, input: CreatePartInput) {
  return await prisma.partsCatalog.create({
    data: {
      category: input.category,
      defaultPrice: input.defaultPrice,
      name: input.name,
      supplier: input.supplier ?? null,
    },
  });
}

export async function update(
  prisma: PrismaClient,
  id: string,
  input: UpdatePartInput
) {
  const part = await prisma.partsCatalog.findUnique({ where: { id } });
  if (!part) {
    return null;
  }

  return prisma.partsCatalog.update({
    data: input,
    where: { id },
  });
}

export async function toggleActive(
  prisma: PrismaClient,
  id: string,
  isActive: boolean
) {
  const part = await prisma.partsCatalog.findUnique({ where: { id } });
  if (!part) {
    return null;
  }

  return prisma.partsCatalog.update({
    data: { isActive },
    where: { id },
  });
}

export async function remove(prisma: PrismaClient, id: string) {
  return await prisma.$transaction(async (tx) => {
    const part = await tx.partsCatalog.findUnique({ where: { id } });
    if (!part) {
      return null;
    }

    const refCount = await tx.jobPart.count({ where: { partId: id } });
    if (refCount > 0) {
      throw new Error(
        `Cannot delete part "${part.name}" — referenced by ${refCount} job(s). Deactivate it instead.`
      );
    }

    return tx.partsCatalog.delete({ where: { id } });
  });
}
