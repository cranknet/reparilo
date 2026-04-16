import type { Prisma, PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import type { JobStatusType } from "@shared/constants";
import {
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  JOB_STATUS_FLOW,
} from "@shared/constants";
import type {
  CreateJobInput,
  JobListQueryInput,
  UpdateJobInput,
} from "@shared/schemas";
import { generateJobCode } from "../utils/job-code.js";
import { createAuditLog } from "./audit.service.js";

const JOB_INCLUDE = {
  customer: true,
  device: true,
  notes: {
    include: { createdBy: true },
    orderBy: { createdAt: "desc" as const },
  },
  partsUsed: true,
  partsWaiting: true,
  photos: true,
  repairs: true,
  technician: true,
} as const satisfies Prisma.JobInclude;

const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

function computeFinalCost(
  job:
    | {
        partsUsed: { totalCost: { toNumber: () => number } }[];
        repairs: { price: { toNumber: () => number } }[];
      }
    | null
    | undefined
): number {
  if (!job) {
    return 0;
  }
  const repairsSum = job.repairs.reduce((s, r) => s + r.price.toNumber(), 0);
  const partsSum = job.partsUsed.reduce(
    (s, p) => s + p.totalCost.toNumber(),
    0
  );
  return repairsSum + partsSum;
}

export async function list(prisma: PrismaClient, query: JobListQueryInput) {
  const { cursor, limit, search, status, technicianId } = query;

  const where: Prisma.JobWhereInput = {};
  if (status) {
    where.status = status as Prisma.EnumJobStatusFilter<"Job">;
  }
  if (technicianId) {
    where.technicianId = technicianId;
  }
  if (search) {
    where.OR = [
      { jobCode: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { device: { brand: { contains: search, mode: "insensitive" } } },
      { device: { model: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (cursor) {
    where.id = { lt: cursor };
  }

  const [jobs, totalCount] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        customer: true,
        device: true,
        technician: { select: { id: true, name: true, username: true } },
      },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    cursor ? Promise.resolve(null) : prisma.job.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (jobs.length > limit) {
    const last = jobs.pop();
    if (last) {
      nextCursor = last.id;
    }
  }

  return { jobs, nextCursor, totalCount };
}

export async function getById(prisma: PrismaClient, id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: JOB_INCLUDE,
  });
  if (!job) {
    return null;
  }

  const finalCost = computeFinalCost(job);
  return { ...job, finalCost };
}

export async function getMetrics(prisma: PrismaClient) {
  const groups = await prisma.job.groupBy({
    by: ["status"],
    _count: true,
  });

  const allStatuses = [...ACTIVE_STATUSES, ...INACTIVE_STATUSES];
  const metrics: Record<string, number> = {};
  for (const s of allStatuses) {
    metrics[s] = 0;
  }
  for (const g of groups) {
    metrics[g.status] = g._count;
  }
  return metrics;
}

export async function create(
  prisma: PrismaClient,
  input: CreateJobInput,
  userId: string
) {
  const customer = await prisma.customer.upsert({
    where: { phone: input.customerPhone },
    update: { name: input.customerName },
    create: { name: input.customerName, phone: input.customerPhone },
  });

  const device = await prisma.device.upsert({
    where: {
      brand_model: { brand: input.deviceBrand, model: input.deviceModel },
    },
    update: {},
    create: { brand: input.deviceBrand, model: input.deviceModel },
  });

  const { accessCode, jobCode } = await generateJobCode(prisma);

  const job = await prisma.job.create({
    data: {
      accessCode,
      color: input.color ?? null,
      conditionNotes: input.conditionNotes ?? null,
      createdById: userId,
      customerId: customer.id,
      depositAmount: input.depositAmount ?? null,
      deviceId: device.id,
      estimatedCost: input.estimatedCost,
      estimatedDate: input.estimatedDate ? new Date(input.estimatedDate) : null,
      isWarrantyReturn: input.isWarrantyReturn ?? false,
      jobCode,
      reportedProblem: input.reportedProblem,
      technicianId: input.technicianId ?? null,
      warrantyForJobId: input.warrantyForJobId ?? null,
    },
    include: JOB_INCLUDE,
  });

  await createAuditLog(prisma, {
    action: AuditAction.JOB_CREATED,
    jobId: job.id,
    toValue: jobCode,
    userId,
  });

  return { ...job, finalCost: computeFinalCost(job) };
}

export async function update(
  prisma: PrismaClient,
  id: string,
  input: UpdateJobInput,
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return null;
  }
  if (TERMINAL_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  if (input.technicianId !== undefined) {
    const tech = await prisma.user.findUnique({
      where: { id: input.technicianId },
    });
    if (!tech) {
      return { error: "INVALID_TECHNICIAN" as const };
    }
    if (!["OWNER", "TECHNICIAN"].includes(tech.role)) {
      return { error: "INVALID_TECHNICIAN" as const };
    }
  }

  const updated = await prisma.job.update({
    data: input,
    include: JOB_INCLUDE,
    where: { id },
  });

  if (input.technicianId && input.technicianId !== job.technicianId) {
    await createAuditLog(prisma, {
      action: AuditAction.TECHNICIAN_ASSIGNED,
      fromValue: job.technicianId ?? undefined,
      jobId: id,
      toValue: input.technicianId,
      userId,
    });
  }

  await createAuditLog(prisma, {
    action: AuditAction.COST_UPDATED,
    jobId: id,
    metadata: input,
    note: "Job fields updated",
    userId,
  });

  return { ...updated, finalCost: computeFinalCost(updated) };
}

export async function transitionStatus(
  prisma: PrismaClient,
  id: string,
  newStatus: JobStatusType,
  userId: string
) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return null;
  }

  const allowed = JOB_STATUS_FLOW[job.status as JobStatusType] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      allowedTransitions: allowed,
      currentStatus: job.status,
      error: "CONFLICT_STATUS_TRANSITION" as const,
    };
  }

  const updated = await prisma.job.update({
    data: { status: newStatus, updatedById: userId },
    include: JOB_INCLUDE,
    where: { id },
  });

  await createAuditLog(prisma, {
    action: AuditAction.STATUS_CHANGED,
    fromValue: job.status,
    jobId: id,
    toValue: newStatus,
    userId,
  });

  return { ...updated, finalCost: computeFinalCost(updated) };
}
