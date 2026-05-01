import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type {
  BrandSearchQueryInput,
  CreateBrandInput,
  CreateModelInput,
  ModelSearchQueryInput,
} from "@shared/schemas/device.schema";

export async function searchBrands(
  prisma: PrismaClient,
  query: BrandSearchQueryInput
) {
  const { q, limit } = query;
  if (!q) {
    return await prisma.brand.findMany({
      orderBy: { name: "asc" },
      take: limit,
    });
  }
  return await prisma.brand.findMany({
    where: {
      name: { startsWith: q, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function searchModels(
  prisma: PrismaClient,
  brandId: string,
  query: ModelSearchQueryInput
) {
  const { q, limit } = query;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw new AppError("BRAND_NOT_FOUND");
  }
  if (!q) {
    return await prisma.device.findMany({
      where: { brandId },
      select: { id: true, brandId: true, model: true },
      orderBy: { model: "asc" },
      take: limit,
    });
  }
  return await prisma.device.findMany({
    where: {
      brandId,
      model: { startsWith: q, mode: "insensitive" },
    },
    select: { id: true, brandId: true, model: true },
    orderBy: { model: "asc" },
    take: limit,
  });
}

export async function createBrand(
  prisma: PrismaClient,
  input: CreateBrandInput
) {
  const existing = await prisma.brand.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (existing) {
    return existing;
  }
  try {
    return await prisma.brand.create({
      data: { name: input.name },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return await prisma.brand.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
      });
    }
    throw err;
  }
}

export async function createModel(
  prisma: PrismaClient,
  brandId: string,
  input: CreateModelInput
) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw new AppError("BRAND_NOT_FOUND");
  }
  const existing = await prisma.device.findFirst({
    where: {
      brandId,
      model: { equals: input.model, mode: "insensitive" },
    },
  });
  if (existing) {
    return existing;
  }
  try {
    return await prisma.device.create({
      data: { brandId, model: input.model },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return await prisma.device.findFirst({
        where: {
          brandId,
          model: { equals: input.model, mode: "insensitive" },
        },
      });
    }
    throw err;
  }
}
