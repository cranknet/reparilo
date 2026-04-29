import type { Prisma, PrismaClient } from "@generated/client";
import type {
  CreateCustomerInput,
  CustomerListQueryInput,
  CustomerSearchQueryInput,
  UpdateCustomerInput,
} from "@shared/schemas/customer.schema";

export async function create(prisma: PrismaClient, input: CreateCustomerInput) {
  const email = input.email?.trim() || null;

  const updateData: Record<string, unknown> = {};
  if (input.name) {
    updateData.name = input.name;
  }
  if (email) {
    updateData.email = email;
  }

  return await prisma.customer.upsert({
    where: { phone: input.phone },
    update: updateData,
    create: {
      email,
      name: input.name,
      phone: input.phone,
    },
  });
}

export async function update(
  prisma: PrismaClient,
  id: string,
  data: UpdateCustomerInput
) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.phone !== undefined) {
    updateData.phone = data.phone;
  }
  if (data.email !== undefined) {
    updateData.email = data.email?.trim() || null;
  }

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  return await prisma.customer.update({
    where: { id },
    data: updateData,
  });
}

export async function list(
  prisma: PrismaClient,
  query: CustomerListQueryInput
) {
  const { cursor, limit, search } = query;

  const where: Prisma.CustomerWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }
  if (cursor) {
    where.id = { lt: cursor };
  }

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { jobs: true } } },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    cursor ? Promise.resolve(null) : prisma.customer.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (customers.length > limit) {
    const last = customers.pop();
    if (last) {
      nextCursor = last.id;
    }
  }

  return { customers, nextCursor, totalCount };
}

export async function search(
  prisma: PrismaClient,
  query: CustomerSearchQueryInput
) {
  const { q, limit } = query;

  return await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { startsWith: q } },
      ],
    },
    select: {
      _count: { select: { jobs: true } },
      email: true,
      id: true,
      name: true,
      phone: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });
}

export async function getById(prisma: PrismaClient, id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        include: {
          device: { select: { brand: true, model: true } },
          repairs: { select: { repairName: true, price: true } },
          partsUsed: { select: { partName: true, totalCost: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!customer) {
    return null;
  }
  const { jobs, ...customerInfo } = customer;
  return {
    ...customerInfo,
    jobs: jobs.map((j) => ({
      createdAt: j.createdAt.toISOString(),
      deviceModel: `${j.device.brand} ${j.device.model}`,
      estimatedCost: Number(j.estimatedCost),
      finalCost:
        j.repairs.reduce((sum, r) => sum + Number(r.price), 0) +
        j.partsUsed.reduce((sum, p) => sum + Number(p.totalCost), 0),
      id: j.id,
      jobCode: j.jobCode,
      reportedProblem: j.reportedProblem,
      status: j.status,
    })),
  };
}
