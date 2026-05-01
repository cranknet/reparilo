import type { Prisma, PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type {
  CreateRepairInput,
  ListRepairsQueryInput,
  UpdateRepairInput,
} from "@shared/schemas/repair-catalog.schema";
import {
  countJobRepairsByRepairId,
  count as countRepairs,
  create as createRepair,
  deleteRepair as deleteRepairRepo,
  findMany as findManyRepairs,
  findUnique as findRepairUnique,
  update as updateRepair,
} from "../repositories/repair.repository.js";

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
    findManyRepairs(prisma, where, { name: "asc" }, limit + 1),
    cursor ? Promise.resolve(null) : countRepairs(prisma, where),
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
  return await findRepairUnique(prisma, id);
}

export async function create(prisma: PrismaClient, input: CreateRepairInput) {
  return await createRepair(prisma, {
    category: input.category,
    defaultPrice: input.defaultPrice,
    name: input.name,
  });
}

export async function update(
  prisma: PrismaClient,
  id: string,
  input: UpdateRepairInput
) {
  const existing = await findRepairUnique(prisma, id);
  if (!existing) {
    return null;
  }

  return await updateRepair(prisma, id, input);
}

export async function toggleActive(
  prisma: PrismaClient,
  id: string,
  isActive: boolean
) {
  const existing = await findRepairUnique(prisma, id);
  if (!existing) {
    return null;
  }

  return await updateRepair(prisma, id, { isActive });
}

export async function remove(prisma: PrismaClient, id: string) {
  const existing = await findRepairUnique(prisma, id);
  if (!existing) {
    return null;
  }

  const refCount = await countJobRepairsByRepairId(prisma, id);
  if (refCount > 0) {
    throw new AppError("REPAIR_IN_USE");
  }

  return await deleteRepairRepo(prisma, id);
}
