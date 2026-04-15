# Jobs Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete backend for the Jobs feature — service layer, route handlers, validation, audit logging, photo uploads, and cursor-paginated listing.

**Architecture:** Service layer pattern. Thin Fastify route handlers validate input with Zod and delegate to service modules. Each service method owns its Prisma queries and audit logging. The `audit.service.ts` module is shared across all services.

**Tech Stack:** Fastify 5, Prisma 7, PostgreSQL 17, Zod 4, @fastify/multipart, @fastify/static, TypeScript (ESM)

**Spec:** `docs/superpowers/specs/2026-04-15-jobs-backend-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `shared/constants/repair-categories.ts` | Create | RepairCategory enum constant |
| `shared/constants/index.ts` | Modify | Export RepairCategory |
| `shared/schemas/job.schema.ts` | Modify | Add 7 new Zod schemas |
| `shared/schemas/index.ts` | Modify | Export new schemas and types |
| `server/utils/job-code.ts` | Create | Job code + access code generation |
| `server/services/audit.service.ts` | Create | Shared audit log creation |
| `server/services/job.service.ts` | Create | Core job CRUD + status transitions |
| `server/services/job-parts.service.ts` | Create | Add/remove consumed parts |
| `server/services/job-repairs.service.ts` | Create | Add/remove performed repairs |
| `server/services/job-notes.service.ts` | Create | Add/list notes |
| `server/services/job-photos.service.ts` | Create | Upload/delete photos |
| `server/routes/jobs.ts` | Rewrite | Full route handlers calling services |
| `server/index.ts` | Modify | Add static serving for uploads in dev |
| `uploads/job-photos/.gitkeep` | Create | Ensure upload directory exists |

---

### Task 1: RepairCategory constant + shared schema expansion

**Files:**
- Create: `shared/constants/repair-categories.ts`
- Modify: `shared/constants/index.ts`
- Modify: `shared/schemas/job.schema.ts`
- Modify: `shared/schemas/index.ts`

- [ ] **Step 1: Create `shared/constants/repair-categories.ts`**

```ts
export type RepairCategoryType =
  | "HARDWARE"
  | "SOFTWARE"
  | "DIAGNOSTIC"
  | "OTHER";

export const RepairCategory: Record<string, RepairCategoryType> = {
  HARDWARE: "HARDWARE",
  SOFTWARE: "SOFTWARE",
  DIAGNOSTIC: "DIAGNOSTIC",
  OTHER: "OTHER",
};
```

- [ ] **Step 2: Modify `shared/constants/index.ts` — add RepairCategory exports**

Add after the PartCategory exports:

```ts
export type { RepairCategoryType } from "./repair-categories";
export { RepairCategory } from "./repair-categories";
```

- [ ] **Step 3: Add new Zod schemas to `shared/schemas/job.schema.ts`**

Append these schemas after the existing `createJobSchema`:

```ts
import {
  JobStatus,
  type JobStatusType,
  PartCategory,
  type PartCategoryType,
  RepairCategory,
  type RepairCategoryType,
} from "@shared/constants";

export const updateJobSchema = z.object({
  reportedProblem: z.string().min(1).optional(),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  estimatedDate: z.string().optional(),
  technicianId: z.string().optional(),
  color: z.string().optional(),
});

export const transitionStatusSchema = z.object({
  status: z.enum([
    JobStatus.INTAKE,
    JobStatus.WAITING_FOR_PARTS,
    JobStatus.IN_REPAIR,
    JobStatus.ON_HOLD,
    JobStatus.DONE,
    JobStatus.DELIVERED,
    JobStatus.RETURNED,
    JobStatus.CANCELLED,
  ]),
});

export const addJobPartSchema = z.object({
  partId: z.string().optional(),
  partName: z.string().min(1),
  category: z.enum([
    PartCategory.SCREEN,
    PartCategory.BATTERY,
    PartCategory.CHARGING_PORT,
    PartCategory.CAMERA,
    PartCategory.SPEAKER,
    PartCategory.MICROPHONE,
    PartCategory.MOTHERBOARD,
    PartCategory.HOUSING,
    PartCategory.BUTTON,
    PartCategory.OTHER,
  ]),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
  supplier: z.string().optional(),
});

export const addJobRepairSchema = z.object({
  repairId: z.string().optional(),
  repairName: z.string().min(1),
  category: z.enum([
    RepairCategory.HARDWARE,
    RepairCategory.SOFTWARE,
    RepairCategory.DIAGNOSTIC,
    RepairCategory.OTHER,
  ]),
  price: z.number().min(0),
});

export const addJobNoteSchema = z.object({
  content: z.string().min(1),
  isCustomerVisible: z.boolean().default(false),
});

export const addWaitingPartSchema = z.object({
  partName: z.string().min(1),
  supplier: z.string().optional(),
});

export const jobListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  technicianId: z.string().optional(),
  search: z.string().optional(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
export type AddJobPartInput = z.infer<typeof addJobPartSchema>;
export type AddJobRepairInput = z.infer<typeof addJobRepairSchema>;
export type AddJobNoteInput = z.infer<typeof addJobNoteSchema>;
export type AddWaitingPartInput = z.infer<typeof addWaitingPartSchema>;
export type JobListQueryInput = z.infer<typeof jobListQuerySchema>;
```

Note: The imports for `JobStatus`, `PartCategory`, `RepairCategory` need to be added at the top of the file, replacing or extending the existing imports.

- [ ] **Step 4: Modify `shared/schemas/index.ts` — export new schemas**

```ts
export type {
  AddJobNoteInput,
  AddJobPartInput,
  AddJobRepairInput,
  AddWaitingPartInput,
  CreateJobInput,
  JobListQueryInput,
  TransitionStatusInput,
  UpdateJobInput,
} from "./job.schema";
export {
  addJobNoteSchema,
  addJobPartSchema,
  addJobRepairSchema,
  addWaitingPartSchema,
  createJobSchema,
  jobListQuerySchema,
  transitionStatusSchema,
  updateJobSchema,
} from "./job.schema";
```

- [ ] **Step 5: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add shared/
git commit -m "feat(jobs): add shared Zod schemas and RepairCategory constant"
```

---

### Task 2: Job code generation utility

**Files:**
- Create: `server/utils/job-code.ts`

**Context:** The server already has `server/utils/auth.ts` and `server/utils/email.ts`. This follows the same pattern. The `JobCounter` Prisma model uses `@@unique([year])` for race-condition safety. The `$transaction` with serializable isolation prevents double-increments.

- [ ] **Step 1: Create `server/utils/job-code.ts`**

```ts
import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export async function generateJobCode(prisma: PrismaClient): Promise<{
  jobCode: string;
  accessCode: string;
}> {
  const year = new Date().getFullYear();
  const accessCode = crypto.randomBytes(8).toString("hex");

  const counter = await prisma.$transaction(async (tx) => {
    const existing = await tx.jobCounter.findUnique({ where: { year } });
    if (existing) {
      return tx.jobCounter.update({
        where: { year },
        data: { lastSeq: { increment: 1 } },
      });
    }
    return tx.jobCounter.create({
      data: { year, lastSeq: 1 },
    });
  });

  const seq = counter.lastSeq.toString().padStart(4, "0");
  const suffix = crypto.randomBytes(2).toString("hex").slice(0, 3).toUpperCase();
  const jobCode = `REP-${year}-${seq}-${suffix}`;

  return { jobCode, accessCode };
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/utils/job-code.ts
git commit -m "feat(jobs): add job code generation utility"
```

---

### Task 3: Audit service

**Files:**
- Create: `server/services/audit.service.ts`

**Context:** The `AuditAction` enum is already in Prisma schema with values like `JOB_CREATED`, `STATUS_CHANGED`, `TECHNICIAN_ASSIGNED`, `COST_UPDATED`, `PART_ADDED`, `PART_REMOVED`, `REPAIR_ADDED`, `REPAIR_REMOVED`, `NOTE_ADDED`, `PHOTO_ADDED`. The `request.user` object has `id`, `role`, `username`, `isActive`, `mustChangePassword` (see `server/plugins/auth.ts:194-202`).

- [ ] **Step 1: Create `server/services/audit.service.ts`**

```ts
import { AuditAction } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

interface AuditInput {
  jobId: string;
  userId: string;
  action: AuditAction;
  fromValue?: string;
  toValue?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(
  prisma: PrismaClient,
  input: AuditInput,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      jobId: input.jobId,
      userId: input.userId,
      action: input.action,
      fromValue: input.fromValue,
      toValue: input.toValue,
      note: input.note,
      metadata: input.metadata ?? undefined,
    },
  });
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/services/audit.service.ts
git commit -m "feat(jobs): add shared audit service"
```

---

### Task 4: Job service — core CRUD + status transitions

**Files:**
- Create: `server/services/job.service.ts`

**Context:** This is the main orchestrator. It handles:
- `list()` — cursor-paginated listing with filters and search
- `getById()` — single job with all relations + computed `finalCost`
- `getMetrics()` — status counts via groupBy
- `create()` — upsert customer by phone, upsert device by brand+model, generate job code, create audit
- `update()` — partial update with audit for changed fields
- `transitionStatus()` — validate against `JOB_STATUS_FLOW`, update, audit with from/to

The `createJobSchema` input has `customerName`, `customerPhone`, `deviceBrand`, `deviceModel` (not IDs) — the service resolves them.

Terminal statuses (DELIVERED, RETURNED, CANCELLED) block all mutations except read.

- [ ] **Step 1: Create `server/services/job.service.ts`**

```ts
import { AuditAction } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ACTIVE_STATUSES, INACTIVE_STATUSES, JOB_STATUS_FLOW } from "@shared/constants";
import type { JobStatusType } from "@shared/constants";
import type { CreateJobInput, JobListQueryInput, UpdateJobInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";
import { generateJobCode } from "../utils/job-code.js";

const JOB_INCLUDE = {
  customer: true,
  device: true,
  technician: true,
  photos: true,
  notes: { include: { createdBy: true }, orderBy: { createdAt: "desc" as const } },
  partsUsed: true,
  repairs: true,
  partsWaiting: true,
} as const;

function computeFinalCost(job: {
  repairs: { price: { toNumber: () => number } }[];
  partsUsed: { totalCost: { toNumber: () => number } }[];
}): number {
  const repairsSum = job.repairs.reduce((s, r) => s + r.price.toNumber(), 0);
  const partsSum = job.partsUsed.reduce((s, p) => s + p.totalCost.toNumber(), 0);
  return repairsSum + partsSum;
}

export async function list(
  prisma: PrismaClient,
  query: JobListQueryInput,
) {
  const { cursor, limit, status, technicianId, search } = query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (technicianId) where.technicianId = technicianId;
  if (search) {
    where.OR = [
      { jobCode: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { device: { brand: { contains: search, mode: "insensitive" } } },
      { device: { model: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (cursor) where.id = { lt: cursor };

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
    nextCursor = last!.id;
  }

  return { jobs, nextCursor, totalCount };
}

export async function getById(prisma: PrismaClient, id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: JOB_INCLUDE,
  });
  if (!job) return null;

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
  userId: string,
) {
  const customer = await prisma.customer.upsert({
    where: { phone: input.customerPhone },
    update: { name: input.customerName },
    create: { name: input.customerName, phone: input.customerPhone },
  });

  const device = await prisma.device.upsert({
    where: { brand_model: { brand: input.deviceBrand, model: input.deviceModel } },
    update: {},
    create: { brand: input.deviceBrand, model: input.deviceModel },
  });

  const { jobCode, accessCode } = await generateJobCode(prisma);

  const job = await prisma.job.create({
    data: {
      jobCode,
      accessCode,
      customerId: customer.id,
      deviceId: device.id,
      color: input.color,
      reportedProblem: input.reportedProblem,
      conditionNotes: input.conditionNotes,
      estimatedCost: input.estimatedCost,
      estimatedDate: input.estimatedDate ?? null,
      depositAmount: input.depositAmount ?? null,
      technicianId: input.technicianId ?? null,
      isWarrantyReturn: input.isWarrantyReturn ?? false,
      warrantyForJobId: input.warrantyForJobId ?? null,
      createdById: userId,
    },
    include: JOB_INCLUDE,
  });

  await createAuditLog(prisma, {
    jobId: job.id,
    userId,
    action: AuditAction.JOB_CREATED,
    toValue: jobCode,
  });

  return { ...job, finalCost: computeFinalCost(job) };
}

export async function update(
  prisma: PrismaClient,
  id: string,
  input: UpdateJobInput,
  userId: string,
) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return null;
  if (["DELIVERED", "RETURNED", "CANCELLED"].includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  if (input.technicianId !== undefined) {
    const tech = await prisma.user.findUnique({
      where: { id: input.technicianId },
    });
    if (!tech || !["OWNER", "TECHNICIAN"].includes(tech.role)) {
      return { error: "INVALID_TECHNICIAN" as const };
    }
  }

  const updated = await prisma.job.update({
    where: { id },
    data: input,
    include: JOB_INCLUDE,
  });

  if (input.technicianId && input.technicianId !== job.technicianId) {
    await createAuditLog(prisma, {
      jobId: id,
      userId,
      action: AuditAction.TECHNICIAN_ASSIGNED,
      fromValue: job.technicianId ?? undefined,
      toValue: input.technicianId,
    });
  }

  await createAuditLog(prisma, {
    jobId: id,
    userId,
    action: AuditAction.COST_UPDATED,
    note: "Job fields updated",
    metadata: input,
  });

  return { ...updated, finalCost: computeFinalCost(updated) };
}

export async function transitionStatus(
  prisma: PrismaClient,
  id: string,
  newStatus: JobStatusType,
  userId: string,
) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return null;

  const allowed = JOB_STATUS_FLOW[job.status as JobStatusType] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      error: "CONFLICT_STATUS_TRANSITION" as const,
      currentStatus: job.status,
      allowedTransitions: allowed,
    };
  }

  const updated = await prisma.job.update({
    where: { id },
    data: { status: newStatus, updatedById: userId },
    include: JOB_INCLUDE,
  });

  await createAuditLog(prisma, {
    jobId: id,
    userId,
    action: AuditAction.STATUS_CHANGED,
    fromValue: job.status,
    toValue: newStatus,
  });

  return { ...updated, finalCost: computeFinalCost(updated) };
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: May need fixes — resolve any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add server/services/job.service.ts
git commit -m "feat(jobs): add job service with CRUD, status transitions, and metrics"
```

---

### Task 5: Job parts service

**Files:**
- Create: `server/services/job-parts.service.ts`

**Context:** Parts are snapshotted — all fields copied from catalog at add time. `totalCost` is computed as `unitPrice * quantity`. The `PartCategory` enum values must match Prisma schema. Ad-hoc parts (no `partId`) are fully supported.

- [ ] **Step 1: Create `server/services/job-parts.service.ts`**

```ts
import { AuditAction } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AddJobPartInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobPartInput,
  userId: string,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (TERMINAL_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const totalCost = input.unitPrice * input.quantity;

  const jobPart = await prisma.jobPart.create({
    data: {
      jobId,
      partId: input.partId ?? null,
      partName: input.partName,
      category: input.category,
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      supplier: input.supplier ?? null,
      totalCost,
      createdById: userId,
    },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PART_ADDED,
    toValue: `${input.partName} x${input.quantity}`,
    metadata: { partId: input.partId, totalCost },
  });

  return jobPart;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  partId: string,
  userId: string,
) {
  const part = await prisma.jobPart.findFirst({
    where: { id: partId, jobId },
  });
  if (!part) return null;

  await prisma.jobPart.delete({ where: { id: partId } });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PART_REMOVED,
    fromValue: `${part.partName} x${part.quantity}`,
  });

  return true;
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/services/job-parts.service.ts
git commit -m "feat(jobs): add job parts service with snapshotted add/remove"
```

---

### Task 6: Job repairs service

**Files:**
- Create: `server/services/job-repairs.service.ts`

**Context:** Mirrors the parts service pattern. Repairs are snapshotted from catalog or ad-hoc. Price is stored directly (no quantity — each repair is one entry).

- [ ] **Step 1: Create `server/services/job-repairs.service.ts`**

```ts
import { AuditAction } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AddJobRepairInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobRepairInput,
  userId: string,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (TERMINAL_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const jobRepair = await prisma.jobRepair.create({
    data: {
      jobId,
      repairId: input.repairId ?? null,
      repairName: input.repairName,
      category: input.category,
      price: input.price,
      createdById: userId,
    },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.REPAIR_ADDED,
    toValue: `${input.repairName} — ${input.price}`,
    metadata: { repairId: input.repairId },
  });

  return jobRepair;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  repairId: string,
  userId: string,
) {
  const repair = await prisma.jobRepair.findFirst({
    where: { id: repairId, jobId },
  });
  if (!repair) return null;

  await prisma.jobRepair.delete({ where: { id: repairId } });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.REPAIR_REMOVED,
    fromValue: `${repair.repairName} — ${repair.price}`,
  });

  return true;
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/services/job-repairs.service.ts
git commit -m "feat(jobs): add job repairs service with snapshotted add/remove"
```

---

### Task 7: Job notes service

**Files:**
- Create: `server/services/job-notes.service.ts`

- [ ] **Step 1: Create `server/services/job-notes.service.ts`**

```ts
import { AuditAction } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AddJobNoteInput } from "@shared/schemas";
import { createAuditLog } from "./audit.service.js";

export async function list(prisma: PrismaClient, jobId: string) {
  return prisma.jobNote.findMany({
    where: { jobId },
    include: { createdBy: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobNoteInput,
  userId: string,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;

  const note = await prisma.jobNote.create({
    data: {
      jobId,
      content: input.content,
      isCustomerVisible: input.isCustomerVisible,
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true, username: true } } },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.NOTE_ADDED,
    note: input.isCustomerVisible ? "Customer-visible note" : "Internal note",
    metadata: { contentLength: input.content.length, isCustomerVisible: input.isCustomerVisible },
  });

  return note;
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/services/job-notes.service.ts
git commit -m "feat(jobs): add job notes service"
```

---

### Task 8: Job photos service + upload directory setup

**Files:**
- Create: `server/services/job-photos.service.ts`
- Create: `uploads/job-photos/.gitkeep`

**Context:** Photos save to `./uploads/job-photos/{jobId}/{cuid}.{ext}`. The multipart plugin is already registered in `server/index.ts:29` with `fileSize: 5MB`. Static serving for uploads will be added in Task 9.

- [ ] **Step 1: Create `uploads/job-photos/.gitkeep`**

Empty file to ensure the directory is tracked by git.

- [ ] **Step 2: Create `server/services/job-photos.service.ts`**

```ts
import { AuditAction } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { createAuditLog } from "./audit.service.js";

const UPLOAD_DIR = path.resolve("uploads/job-photos");
const MAX_PHOTOS = 5;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function upload(
  prisma: PrismaClient,
  jobId: string,
  file: { mimetype: string; toBuffer: () => Promise<Buffer> },
  userId: string,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (TERMINAL_STATUSES.includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }

  const photoCount = await prisma.jobPhoto.count({ where: { jobId } });
  if (photoCount >= MAX_PHOTOS) {
    return { error: "PHOTO_LIMIT_REACHED" as const };
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return { error: "INVALID_FILE_TYPE" as const };
  }

  const ext = extFromMime(file.mimetype);
  const filename = `${createId()}.${ext}`;
  const jobDir = path.join(UPLOAD_DIR, jobId);
  const filePath = path.join(jobDir, filename);

  await fs.mkdir(jobDir, { recursive: true });
  const buffer = await file.toBuffer();
  await fs.writeFile(filePath, buffer);

  const relativePath = `job-photos/${jobId}/${filename}`;
  const photo = await prisma.jobPhoto.create({
    data: { jobId, path: relativePath },
  });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PHOTO_ADDED,
    toValue: filename,
  });

  return photo;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  photoId: string,
  userId: string,
) {
  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, jobId },
  });
  if (!photo) return null;

  const fullPath = path.join(UPLOAD_DIR, "..", photo.path);
  try {
    await fs.unlink(fullPath);
  } catch {
    // File already deleted or missing — not an error
  }

  await prisma.jobPhoto.delete({ where: { id: photoId } });

  await createAuditLog(prisma, {
    jobId,
    userId,
    action: AuditAction.PHOTO_ADDED,
    note: `Photo deleted: ${photo.path}`,
  });

  return true;
}
```

Note: `@paralleldrive/cuid2` — check if installed. If not, use `crypto.randomUUID()` as a fallback for filename generation.

- [ ] **Step 3: Run lint + typecheck**

Run: `pnpm check`
Expected: May need to install cuid2 or adjust import. Fix any errors.

- [ ] **Step 4: Commit**

```bash
git add server/services/job-photos.service.ts uploads/
git commit -m "feat(jobs): add job photos service with local disk storage"
```

---

### Task 9: Wire up static file serving for uploads (dev mode)

**Files:**
- Modify: `server/index.ts`

**Context:** In production, the static plugin serves `dist/`. In development, we need a separate static serving for `uploads/` so photos are accessible. The existing code in `server/index.ts:46-54` only registers static in production. We add a dev-only upload serving.

- [ ] **Step 1: Modify `server/index.ts` — add dev upload serving**

After the existing production static block (line 54), add:

```ts
if (process.env.NODE_ENV !== "production") {
  await app.register(staticPlugin, {
    root: path.resolve("uploads"),
    prefix: "/api/uploads/",
    decorateReply: false,
  });
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat(jobs): serve uploaded photos in dev mode"
```

---

### Task 10: Jobs route handlers — full rewrite

**Files:**
- Rewrite: `server/routes/jobs.ts`

**Context:** This replaces the existing stub with full route handlers. Each route validates with Zod, calls the appropriate service, and returns consistent error responses. The route file is registered with prefix `/api/jobs` in `server/index.ts:38`, so paths here are relative (e.g., `/` means `/api/jobs`).

The `requirePermission` middleware is already used in the stub. Routes need different permissions: most use `jobs:write`, list/get use `jobs:read`, status uses `jobs:update_status`.

- [ ] **Step 1: Rewrite `server/routes/jobs.ts`**

```ts
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import * as jobService from "../services/job.service.js";
import * as jobPartsService from "../services/job-parts.service.js";
import * as jobRepairsService from "../services/job-repairs.service.js";
import * as jobNotesService from "../services/job-notes.service.js";
import * as jobPhotosService from "../services/job-photos.service.js";
import {
  addJobNoteSchema,
  addJobPartSchema,
  addJobRepairSchema,
  addWaitingPartSchema,
  createJobSchema,
  jobListQuerySchema,
  transitionStatusSchema,
  updateJobSchema,
} from "@shared/schemas";

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply.status(status).send({ error: code, message, details: details ?? {} });
}

import type { FastifyReply } from "fastify";

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("jobs:read"));

  app.get("/metrics", async (_req, reply) => {
    const metrics = await jobService.getMetrics(app.prisma);
    return reply.send(metrics);
  });

  app.get("/", async (req, reply) => {
    const parsed = jobListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid query parameters", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await jobService.list(app.prisma, parsed.data);
    return reply.send(result);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await jobService.getById(app.prisma, id);
    if (!job) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    return reply.send(job);
  });

  app.post("/", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const userId = req.user!.id;
    const job = await jobService.create(app.prisma, parsed.data, userId);
    return reply.status(201).send(job);
  });

  app.patch("/:id", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const parsed = updateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const result = await jobService.update(app.prisma, id, parsed.data, userId);
    if (!result) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    if ("error" in result) {
      if (result.error === "JOB_IN_TERMINAL_STATUS") return sendError(reply, 409, "JOB_IN_TERMINAL_STATUS", "Cannot modify a job in terminal status");
      if (result.error === "INVALID_TECHNICIAN") return sendError(reply, 400, "INVALID_TECHNICIAN", "Assigned user must have TECHNICIAN or OWNER role");
    }
    return reply.send(result);
  });

  app.patch("/:id/status", { preHandler: requirePermission("jobs:update_status") }, async (req, reply) => {
    const parsed = transitionStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const result = await jobService.transitionStatus(app.prisma, id, parsed.data.status, userId);
    if (!result) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    if ("error" in result) {
      return sendError(reply, 409, "CONFLICT_STATUS_TRANSITION", `Cannot transition from ${result.currentStatus} to ${parsed.data.status}`, {
        details: { currentStatus: result.currentStatus, allowedTransitions: result.allowedTransitions },
      });
    }
    return reply.send(result);
  });

  app.get("/:id/notes", async (req, reply) => {
    const { id } = req.params as { id: string };
    const notes = await jobNotesService.list(app.prisma, id);
    return reply.send(notes);
  });

  app.post("/:id/notes", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const parsed = addJobNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const note = await jobNotesService.add(app.prisma, id, parsed.data, userId);
    if (!note) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    return reply.status(201).send(note);
  });

  app.post("/:id/parts", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const parsed = addJobPartSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const result = await jobPartsService.add(app.prisma, id, parsed.data, userId);
    if (!result) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    if ("error" in result) return sendError(reply, 409, result.error, "Cannot modify a job in terminal status");
    return reply.status(201).send(result);
  });

  app.delete("/:id/parts/:partId", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const { id, partId } = req.params as { id: string; partId: string };
    const userId = req.user!.id;
    const result = await jobPartsService.remove(app.prisma, id, partId, userId);
    if (!result) return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Part not found on this job");
    return reply.status(204).send();
  });

  app.post("/:id/repairs", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const parsed = addJobRepairSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const result = await jobRepairsService.add(app.prisma, id, parsed.data, userId);
    if (!result) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    if ("error" in result) return sendError(reply, 409, result.error, "Cannot modify a job in terminal status");
    return reply.status(201).send(result);
  });

  app.delete("/:id/repairs/:repairId", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const { id, repairId } = req.params as { id: string; repairId: string };
    const userId = req.user!.id;
    const result = await jobRepairsService.remove(app.prisma, id, repairId, userId);
    if (!result) return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Repair not found on this job");
    return reply.status(204).send();
  });

  app.post("/:id/photos", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const data = await req.file();
    if (!data) return sendError(reply, 400, "VALIDATION_ERROR", "No file uploaded");
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const result = await jobPhotosService.upload(app.prisma, id, data, userId);
    if (!result) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    if ("error" in result) {
      if (result.error === "PHOTO_LIMIT_REACHED") return sendError(reply, 409, "PHOTO_LIMIT_REACHED", "Photo limit reached (max 5)");
      if (result.error === "JOB_IN_TERMINAL_STATUS") return sendError(reply, 409, "JOB_IN_TERMINAL_STATUS", "Cannot modify a job in terminal status");
      if (result.error === "INVALID_FILE_TYPE") return sendError(reply, 400, "INVALID_FILE_TYPE", "Allowed types: JPEG, PNG, WebP");
    }
    return reply.status(201).send(result);
  });

  app.delete("/:id/photos/:photoId", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const { id, photoId } = req.params as { id: string; photoId: string };
    const userId = req.user!.id;
    const result = await jobPhotosService.remove(app.prisma, id, photoId, userId);
    if (!result) return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Photo not found on this job");
    return reply.status(204).send();
  });

  app.post("/:id/waiting-parts", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const parsed = addWaitingPartSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const job = await app.prisma.job.findUnique({ where: { id } });
    if (!job) return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    const wp = await app.prisma.jobPartsWaiting.create({
      data: { jobId: id, partName: parsed.data.partName, supplier: parsed.data.supplier ?? null },
    });
    return reply.status(201).send(wp);
  });

  app.delete("/:id/waiting-parts/:waitingId", { preHandler: requirePermission("jobs:write") }, async (req, reply) => {
    const { id, waitingId } = req.params as { id: string; waitingId: string };
    const wp = await app.prisma.jobPartsWaiting.findFirst({ where: { id: waitingId, jobId: id } });
    if (!wp) return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Waiting part not found on this job");
    await app.prisma.jobPartsWaiting.delete({ where: { id: waitingId } });
    return reply.status(204).send();
  });
};
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm check`
Expected: May have issues with the spread pattern in `sendError` calls. Fix to use explicit args. Resolve all type errors.

- [ ] **Step 3: Run server to verify startup**

Run: `pnpm run server` (with .env loaded)
Expected: Server starts without crash on route registration. "Reparilo server running on 0.0.0.0:4000"

- [ ] **Step 4: Commit**

```bash
git add server/routes/jobs.ts
git commit -m "feat(jobs): rewrite jobs routes with full CRUD, status transitions, and sub-resources"
```

---

### Task 11: Smoke test with curl

**Files:** None — manual testing only

**Context:** The auth system uses Better Auth. The `AUTH_BYPASS=true` env var bypasses auth in dev mode (see `server/plugins/auth.ts:151-162`), setting `request.user` to `{ id: "dev", role: "OWNER", ... }`. This lets us test without logging in.

- [ ] **Step 1: Start the server**

Run: `AUTH_BYPASS=true pnpm run server`
Expected: Server starts on port 4000

- [ ] **Step 2: Test metrics endpoint**

Run: `curl -s http://localhost:4000/api/jobs/metrics | jq .`
Expected: `{ "INTAKE": 0, "WAITING_FOR_PARTS": 0, ... }` — all zeros if no jobs in DB

- [ ] **Step 3: Test create job**

Run:
```bash
curl -s -X POST http://localhost:4000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Karim Benali",
    "customerPhone": "0555123456",
    "deviceBrand": "Apple",
    "deviceModel": "iPhone 14 Pro Max",
    "color": "Space Black",
    "reportedProblem": "Cracked screen, touch not working on bottom half",
    "conditionNotes": "Minor scratches on back",
    "estimatedCost": 8000,
    "estimatedDate": "2026-04-20",
    "depositAmount": 3000
  }' | jq .
```
Expected: `201` with full job object including `jobCode` like `REP-2026-0001-X7K`, `finalCost: 0`

- [ ] **Step 4: Test list jobs**

Run: `curl -s http://localhost:4000/api/jobs | jq .`
Expected: `{ "jobs": [...], "nextCursor": null, "totalCount": 1 }`

- [ ] **Step 5: Test status transition**

Run (using the job ID from step 3):
```bash
curl -s -X PATCH http://localhost:4000/api/jobs/{JOB_ID}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_REPAIR"}' | jq .
```
Expected: Job with `status: "IN_REPAIR"`

- [ ] **Step 6: Test invalid transition**

Run:
```bash
curl -s -X PATCH http://localhost:4000/api/jobs/{JOB_ID}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "DELIVERED"}' | jq .
```
Expected: `409` with `CONFLICT_STATUS_TRANSITION` error

- [ ] **Step 7: Test add part**

Run:
```bash
curl -s -X POST http://localhost:4000/api/jobs/{JOB_ID}/parts \
  -H "Content-Type: application/json" \
  -d '{
    "partName": "iPhone 14 Pro Max Screen",
    "category": "SCREEN",
    "unitPrice": 4500,
    "quantity": 1,
    "supplier": "AliExpress"
  }' | jq .
```
Expected: `201` with snapshotted part, `totalCost: 4500`

- [ ] **Step 8: Test add note**

Run:
```bash
curl -s -X POST http://localhost:4000/api/jobs/{JOB_ID}/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Screen replacement in progress", "isCustomerVisible": true}' | jq .
```
Expected: `201` with created note

- [ ] **Step 9: Verify audit logs**

Run:
```bash
curl -s "http://localhost:4000/api/jobs/{JOB_ID}" | jq '.auditLogs'
```
Expected: Array of audit entries — JOB_CREATED, STATUS_CHANGED, PART_ADDED, NOTE_ADDED

---

### Task 12: Final lint + typecheck pass

**Files:** None — verification only

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: Zero errors, zero warnings

- [ ] **Step 2: Run tests if any exist**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "chore(jobs): lint fixes from implementation"
```
