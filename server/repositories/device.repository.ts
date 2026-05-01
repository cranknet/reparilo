import type { Prisma, PrismaClient } from "@generated/client";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

type BrandWhereInput = Prisma.BrandWhereInput;
type BrandOrderByWithRelationInput = Prisma.BrandOrderByWithRelationInput;
type DeviceWhereInput = Prisma.DeviceWhereInput;
type DeviceSelect = Prisma.DeviceSelect;
type DeviceOrderByWithRelationInput = Prisma.DeviceOrderByWithRelationInput;
type BrandCreateInput = Prisma.BrandCreateInput;
type DeviceCreateInput = Prisma.DeviceCreateInput;

export async function findBrands(
  prisma: DbClient,
  where: BrandWhereInput,
  orderBy: BrandOrderByWithRelationInput,
  take: number
) {
  return await prisma.brand.findMany({ where, orderBy, take });
}

export async function findBrandUnique(prisma: DbClient, id: string) {
  return await prisma.brand.findUnique({ where: { id } });
}

export async function findBrandFirst(prisma: DbClient, where: BrandWhereInput) {
  return await prisma.brand.findFirst({ where });
}

export async function createBrand(prisma: DbClient, data: BrandCreateInput) {
  return await prisma.brand.create({ data });
}

export async function findDevices(
  prisma: DbClient,
  where: DeviceWhereInput,
  select: DeviceSelect,
  orderBy: DeviceOrderByWithRelationInput,
  take: number
) {
  return await prisma.device.findMany({ where, select, orderBy, take });
}

export async function findDeviceFirst(
  prisma: DbClient,
  where: DeviceWhereInput
) {
  return await prisma.device.findFirst({ where });
}

export async function createDevice(prisma: DbClient, data: DeviceCreateInput) {
  return await prisma.device.create({ data });
}
