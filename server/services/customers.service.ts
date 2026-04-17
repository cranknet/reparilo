import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreateCustomerInput,
  CustomerListQueryInput,
  CustomerSearchQueryInput,
} from "@shared/schemas";

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
      email: true,
      id: true,
      name: true,
      phone: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });
}
