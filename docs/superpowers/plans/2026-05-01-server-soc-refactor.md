# Server Separation of Concerns Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the server from a 2-layer (routes → services) to a 3-layer (controller → service → repository) architecture across all modules.

**Architecture:** Factory functions with `prisma` as first param. Controllers handle HTTP only, services handle business logic, repositories handle Prisma queries. Services own `$transaction` scopes and pass `tx` to repos. Repos accept `PrismaClient | Prisma.TransactionClient`.

**Tech Stack:** TypeScript, Fastify, Prisma 7, Zod

---

## File Structure

### New files to create (19 repositories + 2 services):

```
server/repositories/
├── ai.repository.ts
├── audit.repository.ts
├── auth.repository.ts
├── avatar.repository.ts
├── customer.repository.ts
├── dashboard.repository.ts
├── device.repository.ts
├── job-note.repository.ts
├── job-part.repository.ts
├── job-photo.repository.ts
├── job-repair.repository.ts
├── job-waiting-parts.repository.ts
├── job.repository.ts
├── notification.repository.ts
├── part.repository.ts
├── report.repository.ts
├── repair.repository.ts
├── settings.repository.ts
└── user.repository.ts

server/services/
├── auth.service.ts   (NEW)
└── user.service.ts   (NEW)
```

### Existing files to modify:

All files in `server/services/` (except `notification-renderer.ts` and `notification-sender.ts`) — replace direct Prisma calls with repo imports.

6 route files — remove inline Prisma/business logic.

---

## Shared Type for Transaction-Safe Repos

All repositories accept a shared type that covers both `PrismaClient` and transaction client:

```ts
import type { PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;
```

This matches the existing `PrismaOrTx` pattern already used in `audit.service.ts`.

---

### Task 1: Create `server/repositories/` directory and `audit.repository.ts`

**Files:**
- Create: `server/repositories/audit.repository.ts`

- [ ] **Step 1: Create repository directory and audit repository file**

```ts
import type { AuditAction, Prisma } from "@generated/client";
import type { PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function create(
  prisma: DbClient,
  data: {
    jobId: string | null;
    userId: string;
    action: AuditAction;
    fromValue?: string;
    toValue?: string;
    note?: string;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      jobId: data.jobId,
      userId: data.userId,
      action: data.action,
      fromValue: data.fromValue,
      toValue: data.toValue,
      note: data.note,
      metadata: data.metadata,
    },
  });
}

export async function findMany(
  prisma: DbClient,
  where: Prisma.AuditLogWhereInput,
  select?: Prisma.AuditLogSelect,
  orderBy?: Prisma.AuditLogOrderByWithRelationInput,
  take?: number
) {
  return prisma.auditLog.findMany({ where, select, orderBy, take });
}

export async function findUnique(
  prisma: DbClient,
  where: Prisma.AuditLogWhereUniqueInput,
  select?: Prisma.AuditLogSelect
) {
  return prisma.auditLog.findUnique({ where, select });
}

export async function findById(prisma: DbClient, id: string) {
  return prisma.auditLog.findUnique({ where: { id } });
}
```

- [ ] **Step 2: Update `audit.service.ts` to use `audit.repository`**

Modify `server/services/audit.service.ts`:

```ts
import type { AuditAction, Prisma } from "@generated/client";
import type { PrismaClient } from "@generated/client";
import * as auditRepo from "../repositories/audit.repository.js";

type PrismaOrTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

interface AuditInput {
  action: AuditAction;
  fromValue?: string;
  jobId: string;
  metadata?: Record<string, unknown>;
  note?: string;
  toValue?: string;
  userId: string;
}

export async function createAuditLog(
  prisma: PrismaOrTx,
  input: AuditInput
): Promise<void> {
  await auditRepo.create(prisma, {
    jobId: input.jobId,
    userId: input.userId,
    action: input.action,
    fromValue: input.fromValue,
    toValue: input.toValue,
    note: input.note,
    metadata: (input.metadata ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
  });
}
```

- [ ] **Step 3: Run `bun run check` to verify**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add server/repositories/ server/services/audit.service.ts
git commit -m "refactor: add audit.repository, update audit.service to use repo"
```

---

### Task 2: `customer.repository.ts` + update `customers.service.ts`

**Files:**
- Create: `server/repositories/customer.repository.ts`
- Modify: `server/services/customers.service.ts`

- [ ] **Step 1: Create `customer.repository.ts`**

Extract all 5 Prisma calls from `customers.service.ts`:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function upsert(
  prisma: DbClient,
  where: { phone: string },
  update: Record<string, unknown>,
  create: Prisma.CustomerCreateInput
) {
  return prisma.customer.upsert({ where, update, create });
}

export async function findUnique(prisma: DbClient, id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

export async function findUniqueWithJobs(prisma: DbClient, id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        include: {
          device: {
            select: { model: true, brand: { select: { name: true } } },
          },
          repairs: { select: { repairName: true, price: true } },
          partsUsed: { select: { partName: true, totalCost: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function findMany(
  prisma: DbClient,
  where: Prisma.CustomerWhereInput,
  include: Prisma.CustomerInclude,
  orderBy: Prisma.CustomerOrderByWithRelationInput,
  take: number
) {
  return prisma.customer.findMany({ where, include, orderBy, take });
}

export async function count(
  prisma: DbClient,
  where: Prisma.CustomerWhereInput
) {
  return prisma.customer.count({ where });
}

export async function search(
  prisma: DbClient,
  where: Prisma.CustomerWhereInput,
  select: Prisma.CustomerSelect,
  take: number,
  orderBy: Prisma.CustomerOrderByWithRelationInput
) {
  return prisma.customer.findMany({ where, select, take, orderBy });
}

export async function update(
  prisma: DbClient,
  id: string,
  data: Record<string, unknown>
) {
  return prisma.customer.update({ where: { id }, data });
}
```

- [ ] **Step 2: Update `customers.service.ts` to use `customer.repository`**

Replace all direct `prisma.customer.*` calls with `customerRepo.*` imports. Business logic (email trimming, update data construction, pagination cursor math, job summary formatting) stays in the service.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/customer.repository.ts server/services/customers.service.ts
git commit -m "refactor: add customer.repository, update customers.service to use repo"
```

---

### Task 3: `device.repository.ts` + update `device.service.ts`

**Files:**
- Create: `server/repositories/device.repository.ts`
- Modify: `server/services/device.service.ts`

- [ ] **Step 1: Create `device.repository.ts`**

Extract from `device.service.ts` — brand and device CRUD:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findBrands(
  prisma: DbClient,
  where?: Prisma.BrandWhereInput,
  orderBy?: Prisma.BrandOrderByWithRelationInput,
  take?: number
) {
  return prisma.brand.findMany({ where, orderBy, take });
}

export async function findBrandById(prisma: DbClient, id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

export async function findBrandByName(
  prisma: DbClient,
  name: string
) {
  return prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
}

export async function createBrand(prisma: DbClient, data: { name: string }) {
  return prisma.brand.create({ data });
}

export async function findDevices(
  prisma: DbClient,
  where: Prisma.DeviceWhereInput,
  select: Prisma.DeviceSelect,
  orderBy?: Prisma.DeviceOrderByWithRelationInput,
  take?: number
) {
  return prisma.device.findMany({ where, select, orderBy, take });
}

export async function findDeviceByModel(
  prisma: DbClient,
  brandId: string,
  model: string
) {
  return prisma.device.findFirst({
    where: { brandId, model: { equals: model, mode: "insensitive" } },
  });
}

export async function createDevice(
  prisma: DbClient,
  data: { brandId: string; model: string }
) {
  return prisma.device.create({ data });
}
```

- [ ] **Step 2: Update `device.service.ts`**

Replace all `prisma.brand.*` and `prisma.device.*` calls with repo functions. Keep `AppError("BRAND_NOT_FOUND")` and P2002 error handling in the service.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/device.repository.ts server/services/device.service.ts
git commit -m "refactor: add device.repository, update device.service to use repo"
```

---

### Task 4: `part.repository.ts` + update `parts-catalog.service.ts`

**Files:**
- Create: `server/repositories/part.repository.ts`
- Modify: `server/services/parts-catalog.service.ts`

- [ ] **Step 1: Create `part.repository.ts`**

Extract from `parts-catalog.service.ts` — PartsCatalog + JobPart (for reference count):

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findMany(
  prisma: DbClient,
  where: Prisma.PartsCatalogWhereInput,
  orderBy: Prisma.PartsCatalogOrderByWithRelationInput,
  take: number
) {
  return prisma.partsCatalog.findMany({ where, orderBy, take });
}

export async function count(
  prisma: DbClient,
  where: Prisma.PartsCatalogWhereInput
) {
  return prisma.partsCatalog.count({ where });
}

export async function findUnique(prisma: DbClient, id: string) {
  return prisma.partsCatalog.findUnique({ where: { id } });
}

export async function create(
  prisma: DbClient,
  data: Prisma.PartsCatalogCreateInput
) {
  return prisma.partsCatalog.create({ data });
}

export async function update(
  prisma: DbClient,
  id: string,
  data: Prisma.PartsCatalogUpdateInput
) {
  return prisma.partsCatalog.update({ where: { id }, data });
}

export async function remove(prisma: DbClient, id: string) {
  return prisma.partsCatalog.delete({ where: { id } });
}

export async function jobPartCount(prisma: DbClient, partId: string) {
  return prisma.jobPart.count({ where: { partId } });
}
```

- [ ] **Step 2: Update `parts-catalog.service.ts`**

Replace all `prisma.partsCatalog.*`, `prisma.jobPart.*`, and `prisma.$transaction` with repo function calls. The `$transaction` in `remove()` becomes: service calls `prisma.$transaction(async (tx) => { ... })` using repo functions with `tx`.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/part.repository.ts server/services/parts-catalog.service.ts
git commit -m "refactor: add part.repository, update parts-catalog.service to use repo"
```

---

### Task 5: `repair.repository.ts` + update `repair-catalog.service.ts`

**Files:**
- Create: `server/repositories/repair.repository.ts`
- Modify: `server/services/repair-catalog.service.ts`

- [ ] **Step 1: Create `repair.repository.ts`**

Extract from `repair-catalog.service.ts`:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findMany(
  prisma: DbClient,
  where: Prisma.RepairCatalogWhereInput,
  orderBy: Prisma.RepairCatalogOrderByWithRelationInput,
  take: number
) {
  return prisma.repairCatalog.findMany({ where, orderBy, take });
}

export async function count(
  prisma: DbClient,
  where: Prisma.RepairCatalogWhereInput
) {
  return prisma.repairCatalog.count({ where });
}

export async function findUnique(prisma: DbClient, id: string) {
  return prisma.repairCatalog.findUnique({ where: { id } });
}

export async function create(
  prisma: DbClient,
  data: Prisma.RepairCatalogCreateInput
) {
  return prisma.repairCatalog.create({ data });
}

export async function update(
  prisma: DbClient,
  id: string,
  data: Prisma.RepairCatalogUpdateInput
) {
  return prisma.repairCatalog.update({ where: { id }, data });
}

export async function remove(prisma: DbClient, id: string) {
  return prisma.repairCatalog.delete({ where: { id } });
}

export async function jobRepairCount(prisma: DbClient, repairId: string) {
  return prisma.jobRepair.count({ where: { repairId } });
}
```

- [ ] **Step 2: Update `repair-catalog.service.ts`**

Replace all Prisma calls with repo functions. Keep `AppError("REPAIR_IN_USE")` and null checks in service.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/repair.repository.ts server/services/repair-catalog.service.ts
git commit -m "refactor: add repair.repository, update repair-catalog.service to use repo"
```

---

### Task 6: `settings.repository.ts` + update `settings.service.ts`

**Files:**
- Create: `server/repositories/settings.repository.ts`
- Modify: `server/services/settings.service.ts`

- [ ] **Step 1: Create `settings.repository.ts`**

Extract from `settings.service.ts` — AiSettings, ShopSettings, NotificationTemplate models:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findAiSettings(prisma: DbClient) {
  return prisma.aiSettings.findUnique({ where: { id: "default" } });
}

export async function upsertAiSettings(
  prisma: DbClient,
  create: Prisma.AiSettingsCreateInput,
  update: Record<string, unknown>
) {
  return prisma.aiSettings.upsert({
    where: { id: "default" },
    create,
    update,
  });
}

export async function findShopSettings(prisma: DbClient) {
  return prisma.shopSettings.findUnique({ where: { id: "default" } });
}

export async function upsertShopSettings(
  prisma: DbClient,
  create: Prisma.ShopSettingsCreateInput,
  update: Record<string, unknown>
) {
  return prisma.shopSettings.upsert({
    where: { id: "default" },
    create,
    update,
  });
}

export async function findNotificationTemplates(prisma: DbClient) {
  return prisma.notificationTemplate.findMany({ orderBy: { createdAt: "desc" } });
}

export async function findNotificationTemplateById(prisma: DbClient, id: string) {
  return prisma.notificationTemplate.findUnique({ where: { id } });
}

export async function updateNotificationTemplate(
  prisma: DbClient,
  id: string,
  data: Prisma.NotificationTemplateUpdateInput
) {
  return prisma.notificationTemplate.update({ where: { id }, data });
}
```

- [ ] **Step 2: Update `settings.service.ts`**

Replace all `prisma.aiSettings.*`, `prisma.shopSettings.*`, `prisma.notificationTemplate.*` with repo calls. Keep business logic (encryption, `publicAiSettings` projection, `testAiConnection` HTTP logic, WhatsApp settings projection).

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/settings.repository.ts server/services/settings.service.ts
git commit -m "refactor: add settings.repository, update settings.service to use repo"
```

---

### Task 7: Job sub-service repositories (5 files)

**Files:**
- Create: `server/repositories/job-note.repository.ts`
- Create: `server/repositories/job-part.repository.ts`
- Create: `server/repositories/job-repair.repository.ts`
- Create: `server/repositories/job-photo.repository.ts`
- Create: `server/repositories/job-waiting-parts.repository.ts`
- Modify: `server/services/job-notes.service.ts`
- Modify: `server/services/job-parts.service.ts`
- Modify: `server/services/job-repairs.service.ts`
- Modify: `server/services/job-photos.service.ts`
- Modify: `server/services/job-waiting-parts.service.ts`

- [ ] **Step 1: Create `job-note.repository.ts`**

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export async function findMany(
  prisma: DbClient,
  jobId: string
) {
  return prisma.jobNote.findMany({
    where: { jobId },
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(
  prisma: DbClient,
  data: Prisma.JobNoteCreateInput
) {
  return prisma.jobNote.create({
    data,
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
  });
}
```

- [ ] **Step 2: Create `job-part.repository.ts`**

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export async function create(
  prisma: DbClient,
  data: Prisma.JobPartCreateInput
) {
  return prisma.jobPart.create({ data });
}

export async function findFirstWithJob(
  prisma: DbClient,
  partId: string,
  jobId: string
) {
  return prisma.jobPart.findFirst({
    where: { id: partId, jobId },
    include: { job: { select: { status: true } } },
  });
}

export async function remove(prisma: DbClient, id: string) {
  return prisma.jobPart.delete({ where: { id } });
}
```

- [ ] **Step 3: Create `job-repair.repository.ts`**

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export async function findDuplicate(
  prisma: DbClient,
  jobId: string,
  repairId: string
) {
  return prisma.jobRepair.findFirst({
    where: { jobId, repairId },
  });
}

export async function create(
  prisma: DbClient,
  data: Prisma.JobRepairCreateInput
) {
  return prisma.jobRepair.create({ data });
}

export async function findFirstWithJob(
  prisma: DbClient,
  repairId: string,
  jobId: string
) {
  return prisma.jobRepair.findFirst({
    where: { id: repairId, jobId },
    include: { job: { select: { status: true } } },
  });
}

export async function remove(prisma: DbClient, id: string) {
  return prisma.jobRepair.delete({ where: { id } });
}
```

- [ ] **Step 4: Create `job-photo.repository.ts`**

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export async function countByJob(prisma: DbClient, jobId: string) {
  return prisma.jobPhoto.count({ where: { jobId } });
}

export async function create(
  prisma: DbClient,
  data: Prisma.JobPhotoCreateInput
) {
  return prisma.jobPhoto.create({ data });
}

export async function findFirstById(
  prisma: DbClient,
  photoId: string,
  jobId: string
) {
  return prisma.jobPhoto.findFirst({
    where: { id: photoId, jobId },
  });
}

export async function remove(prisma: DbClient, id: string) {
  return prisma.jobPhoto.delete({ where: { id } });
}
```

- [ ] **Step 5: Create `job-waiting-parts.repository.ts`**

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findJobById(prisma: DbClient, jobId: string) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

export async function create(
  prisma: DbClient,
  data: Prisma.JobPartsWaitingCreateInput
) {
  return prisma.jobPartsWaiting.create({ data });
}

export async function findFirstById(
  prisma: DbClient,
  waitingId: string,
  jobId: string
) {
  return prisma.jobPartsWaiting.findFirst({
    where: { id: waitingId, jobId },
  });
}

export async function remove(prisma: DbClient, id: string) {
  return prisma.jobPartsWaiting.delete({ where: { id } });
}
```

- [ ] **Step 6: Update all 5 job sub-services to use their repos**

For each service, replace all direct `prisma.*` calls with the corresponding repo function. The `createAuditLog` call stays as-is (already goes through `audit.service`). `$transaction` calls in services use repos with `tx` parameter:

```ts
// Before (job-parts.service.ts remove)
await prisma.$transaction(async (tx) => {
  await tx.jobPart.delete({ where: { id: partId } });
  await createAuditLog(tx, { ... });
});

// After
await prisma.$transaction(async (tx) => {
  await jobPartRepo.remove(tx, partId);
  await createAuditLog(tx, { ... });
});
```

- [ ] **Step 7: Run `bun run check`**

- [ ] **Step 8: Commit**

```bash
git add server/repositories/job-note.repository.ts server/repositories/job-part.repository.ts server/repositories/job-repair.repository.ts server/repositories/job-photo.repository.ts server/repositories/job-waiting-parts.repository.ts server/services/job-notes.service.ts server/services/job-parts.service.ts server/services/job-repairs.service.ts server/services/job-photos.service.ts server/services/job-waiting-parts.service.ts
git commit -m "refactor: add job sub-service repositories, update services to use repos"
```

---

### Task 8: `job.repository.ts` + update `job.service.ts`

**Files:**
- Create: `server/repositories/job.repository.ts`
- Modify: `server/services/job.service.ts`

This is the most complex service (620 lines). All Prisma calls must move to the repo.

- [ ] **Step 1: Create `job.repository.ts`**

Extract all `prisma.job.*`, `prisma.customer.*`, `prisma.brand.*`, `prisma.device.*` calls from `job.service.ts`. Key functions:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

const JOB_INCLUDE = {
  customer: true,
  device: { include: { brand: true } },
  notes: {
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  partsUsed: true,
  partsWaiting: true,
  photos: true,
  repairs: true,
  technician: { select: { id: true, name: true, username: true } },
} as const satisfies Prisma.JobInclude;

export async function findMany(
  prisma: DbClient,
  where: Prisma.JobWhereInput,
  include: Prisma.JobInclude,
  orderBy: Prisma.JobOrderByWithRelationInput,
  take: number
) {
  return prisma.job.findMany({ where, include, orderBy, take });
}

export async function findUnique(prisma: DbClient, id: string) {
  return prisma.job.findUnique({ where: { id }, include: JOB_INCLUDE });
}

export async function findUniqueNoInclude(prisma: DbClient, id: string) {
  return prisma.job.findUnique({ where: { id } });
}

export async function findUniqueWithCustomer(prisma: DbClient, id: string) {
  return prisma.job.findUnique({ where: { id }, include: { customer: true } });
}

export async function findByJobCode(prisma: DbClient, jobCode: string) {
  return prisma.job.findUnique({ where: { jobCode }, include: JOB_INCLUDE });
}

export async function count(prisma: DbClient, where: Prisma.JobWhereInput) {
  return prisma.job.count({ where });
}

export async function groupBy(
  prisma: DbClient,
  by: ["status"],
  where: Prisma.JobWhereInput
) {
  return prisma.job.groupBy({ by, _count: true, where });
}

export async function create(
  prisma: DbClient,
  data: Prisma.JobCreateInput
) {
  return prisma.job.create({ data, include: JOB_INCLUDE });
}

export async function update(
  prisma: DbClient,
  id: string,
  data: Prisma.JobUpdateInput
) {
  return prisma.job.update({ where: { id }, data, include: JOB_INCLUDE });
}

export async function userFindUnique(
  prisma: DbClient,
  where: Prisma.UserWhereUniqueInput
) {
  return prisma.user.findUnique({ where });
}

export async function customerFindUnique(
  prisma: DbClient,
  where: Prisma.CustomerWhereUniqueInput
) {
  return prisma.customer.findUnique({ where });
}

export async function customerUpsert(
  prisma: DbClient,
  where: { phone: string },
  update: Record<string, unknown>,
  create: Prisma.CustomerCreateInput
) {
  return prisma.customer.upsert({ where, update, create });
}

export async function brandFindFirst(
  prisma: DbClient,
  where: Prisma.BrandWhereInput
) {
  return prisma.brand.findFirst({ where });
}

export async function brandCreate(
  prisma: DbClient,
  data: Prisma.BrandCreateInput
) {
  return prisma.brand.create({ data });
}

export async function deviceUpsert(
  prisma: DbClient,
  where: { brandId_model: { brandId: string; model: string } },
  create: Prisma.DeviceCreateInput
) {
  return prisma.device.upsert({ where, update: {}, create });
}

export async function auditLogFindMany(
  prisma: DbClient,
  where: Prisma.AuditLogWhereInput,
  select: Prisma.AuditLogSelect,
  orderBy: Prisma.AuditLogOrderByWithRelationInput,
  take: number
) {
  return prisma.auditLog.findMany({ where, select, orderBy, take });
}

export async function shopSettingsFindUnique(prisma: DbClient) {
  return prisma.shopSettings.findUnique({ where: { id: "default" } });
}
```

- [ ] **Step 2: Update `job.service.ts`**

Replace all 30+ direct Prisma calls with corresponding repo function calls. Keep all business logic (status validation, technician validation, margin computation, notification dispatch). Pass `tx` to repos inside `$transaction` blocks.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/job.repository.ts server/services/job.service.ts
git commit -m "refactor: add job.repository, update job.service to use repo"
```

---

### Task 9: `dashboard.repository.ts` + update `dashboard.service.ts` + fix `dashboard.route.ts`

**Files:**
- Create: `server/repositories/dashboard.repository.ts`
- Modify: `server/services/dashboard.service.ts`
- Modify: `server/routes/dashboard.ts`

- [ ] **Step 1: Create `dashboard.repository.ts`**

Extract all Prisma calls from `dashboard.service.ts` (566 lines, many queries). Group by query purpose:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function jobGroupByStatus(prisma: DbClient, where: Prisma.JobWhereInput) {
  return prisma.job.groupBy({ by: ["status"], _count: { _all: true }, where });
}

export async function jobCount(prisma: DbClient, where: Prisma.JobWhereInput) {
  return prisma.job.count({ where });
}

export async function jobFindMany(
  prisma: DbClient,
  where: Prisma.JobWhereInput,
  include: Prisma.JobInclude,
  orderBy: Prisma.JobOrderByWithRelationInput,
  take: number
) {
  return prisma.job.findMany({ where, include, orderBy, take });
}

export async function jobFindManySimple(
  prisma: DbClient,
  where: Prisma.JobWhereInput,
  select: Prisma.JobSelect,
  orderBy: Prisma.JobOrderByWithRelationInput,
  take: number
) {
  return prisma.job.findMany({ where, select, orderBy, take });
}

export async function auditLogFindMany(
  prisma: DbClient,
  where: Prisma.AuditLogWhereInput,
  select?: Prisma.AuditLogSelect,
  orderBy?: Prisma.AuditLogOrderByWithRelationInput,
  take?: number
) {
  return prisma.auditLog.findMany({ where, select, orderBy, take });
}

export async function auditLogCount(
  prisma: DbClient,
  where: Prisma.AuditLogWhereInput
) {
  return prisma.auditLog.count({ where });
}

export async function auditLogGroupBy(
  prisma: DbClient,
  by: Prisma.AuditLogScalarFieldEnum[],
  where: Prisma.AuditLogWhereInput,
  _count: Prisma.AuditLogCountAggregateInput,
  _sum: Prisma.AuditLogSumAggregateInput
) {
  return prisma.auditLog.groupBy({ by, where, _count, _sum });
}

export async function shopSettingsFindUnique(prisma: DbClient) {
  return prisma.shopSettings.findUnique({ where: { id: "default" } });
}

export async function jobAggregate(
  prisma: DbClient,
  where: Prisma.JobWhereInput,
  _sum: Prisma.JobSumAggregateInput,
  _count: Prisma.JobCountAggregateInput
) {
  return prisma.job.aggregate({ where, _sum, _count });
}

export async function jobGroupByDate(
  prisma: DbClient,
  by: Prisma.JobScalarFieldEnum[],
  where: Prisma.JobWhereInput,
  _sum: Prisma.JobSumAggregateInput,
  _count: Prisma.JobCountAggregateInput
) {
  return prisma.job.groupBy({ by, where, _sum, _count });
}

export async function rawQuery<T>(
  prisma: PrismaClient,
  query: Prisma.Sql
) {
  return prisma.$queryRaw<T>(query);
}
```

- [ ] **Step 2: Update `dashboard.service.ts`**

Replace all direct Prisma calls with repo function calls. Keep all business logic (date calculations, DTO mapping, aggregation math).

- [ ] **Step 3: Fix inline Prisma in `dashboard.route.ts`**

Replace the inline `app.prisma.job.count({ where: { technicianId: scope.userId, status: "WAITING_FOR_PARTS" } })` on line 92 with a call to `dashboard.service`. Add a new function `waitingForPartsCount(prisma, userId)` to `dashboard.service` that uses the repo.

- [ ] **Step 4: Run `bun run check`**

- [ ] **Step 5: Commit**

```bash
git add server/repositories/dashboard.repository.ts server/services/dashboard.service.ts server/routes/dashboard.ts
git commit -m "refactor: add dashboard.repository, update service and fix inline Prisma in route"
```

---

### Task 10: `report.repository.ts` + update `reports.service.ts`

**Files:**
- Create: `server/repositories/report.repository.ts`
- Modify: `server/services/reports.service.ts`

- [ ] **Step 1: Create `report.repository.ts`**

Extract all Prisma queries from `reports.service.ts` (530 lines):

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function jobGroupBy(
  prisma: DbClient,
  by: Prisma.JobScalarFieldEnum[],
  where: Prisma.JobWhereInput,
  _sum: Prisma.JobSumAggregateInput,
  _count: Prisma.JobCountAggregateInput
) {
  return prisma.job.groupBy({ by, where, _sum, _count });
}

export async function jobAggregate(
  prisma: DbClient,
  where: Prisma.JobWhereInput,
  _sum: Prisma.JobSumAggregateInput,
  _count: Prisma.JobCountAggregateInput
) {
  return prisma.job.aggregate({ where, _sum, _count });
}

export async function jobCount(
  prisma: DbClient,
  where: Prisma.JobWhereInput
) {
  return prisma.job.count({ where });
}

export async function jobFindMany(
  prisma: DbClient,
  where: Prisma.JobWhereInput,
  select: Prisma.JobSelect,
  orderBy: Prisma.JobOrderByWithRelationInput,
  take: number
) {
  return prisma.job.findMany({ where, select, orderBy, take });
}

export async function jobRepairGroupBy(
  prisma: DbClient,
  by: Prisma.JobRepairScalarFieldEnum[],
  where: Prisma.JobRepairWhereInput,
  _sum: Prisma.JobRepairSumAggregateInput,
  _count: Prisma.JobRepairCountAggregateInput
) {
  return prisma.jobRepair.groupBy({ by, where, _sum, _count });
}

export async function auditLogFindMany(
  prisma: DbClient,
  where: Prisma.AuditLogWhereInput,
  select?: Prisma.AuditLogSelect,
  orderBy?: Prisma.AuditLogOrderByWithRelationInput,
  take?: number
) {
  return prisma.auditLog.findMany({ where, select, orderBy, take });
}

export async function auditLogGroupBy(
  prisma: DbClient,
  by: Prisma.AuditLogScalarFieldEnum[],
  where: Prisma.AuditLogWhereInput,
  _count: Prisma.AuditLogCountAggregateInput
) {
  return prisma.auditLog.groupBy({ by, where, _count });
}

export async function customerCount(
  prisma: DbClient,
  where: Prisma.CustomerWhereInput
) {
  return prisma.customer.count({ where });
}

export async function rawQuery<T>(
  prisma: PrismaClient,
  query: Prisma.Sql
) {
  return prisma.$queryRaw<T>(query);
}
```

- [ ] **Step 2: Update `reports.service.ts`**

Replace all direct Prisma calls with repo functions. Keep all business logic (range calculation, period comparison, DTO mapping, margin calculations).

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/report.repository.ts server/services/reports.service.ts
git commit -m "refactor: add report.repository, update reports.service to use repo"
```

---

### Task 11: `ai.repository.ts` + update `ai-chat.service.ts` and `ai-agent.service.ts`

**Files:**
- Create: `server/repositories/ai.repository.ts`
- Modify: `server/services/ai-chat.service.ts`
- Modify: `server/services/ai-agent.service.ts`

- [ ] **Step 1: Create `ai.repository.ts`**

Extract from both AI services — AiConversation, AiMessage, AiAgentDefinition, AiMemory, AiInstruction:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findConversations(
  prisma: DbClient,
  where: Prisma.AiConversationWhereInput,
  orderBy: Prisma.AiConversationOrderByWithRelationInput,
  take: number,
  cursor?: Prisma.AiConversationWhereUniqueInput,
  skip?: number,
  select: Prisma.AiConversationSelect
) {
  return prisma.aiConversation.findMany({ where, orderBy, take, cursor, skip, select });
}

export async function rawDistinctOn<T>(
  prisma: PrismaClient,
  query: Prisma.Sql
) {
  return prisma.$queryRaw<T>(query);
}

export async function findConversationUnique(
  prisma: DbClient,
  where: Prisma.AiConversationWhereUniqueInput
) {
  return prisma.aiConversation.findUnique({ where });
}

export async function createConversation(
  prisma: DbClient,
  data: Prisma.AiConversationCreateInput
) {
  return prisma.aiConversation.create({ data });
}

export async function updateConversation(
  prisma: DbClient,
  id: string,
  data: Prisma.AiConversationUpdateInput
) {
  return prisma.aiConversation.update({ where: { id }, data });
}

export async function deleteConversation(
  prisma: DbClient,
  id: string
) {
  return prisma.aiConversation.delete({ where: { id } });
}

export async function deleteManyConversations(
  prisma: DbClient,
  where: Prisma.AiConversationWhereInput
) {
  return prisma.aiConversation.deleteMany({ where });
}

export async function findMessages(
  prisma: DbClient,
  where: Prisma.AiMessageWhereInput,
  orderBy: Prisma.AiMessageOrderByWithRelationInput,
  take: number,
  cursor?: Prisma.AiMessageWhereUniqueInput,
  skip?: number
) {
  return prisma.aiMessage.findMany({ where, orderBy, take, cursor, skip });
}

export async function createMessage(
  prisma: DbClient,
  data: Prisma.AiMessageCreateInput
) {
  return prisma.aiMessage.create({ data });
}

export async function updateMessage(
  prisma: DbClient,
  id: string,
  data: Prisma.AiMessageUpdateInput
) {
  return prisma.aiMessage.update({ where: { id }, data });
}

export async function findAgentDefinitions(prisma: DbClient) {
  return prisma.aiAgentDefinition.findMany({ orderBy: { createdAt: "asc" } });
}

export async function findAgentDefinitionById(prisma: DbClient, id: string) {
  return prisma.aiAgentDefinition.findUnique({ where: { id } });
}

export async function createAgentDefinition(
  prisma: DbClient,
  data: Prisma.AiAgentDefinitionCreateInput
) {
  return prisma.aiAgentDefinition.create({ data });
}

export async function updateAgentDefinition(
  prisma: DbClient,
  id: string,
  data: Prisma.AiAgentDefinitionUpdateInput
) {
  return prisma.aiAgentDefinition.update({ where: { id }, data });
}

export async function deleteAgentDefinition(prisma: DbClient, id: string) {
  return prisma.aiAgentDefinition.delete({ where: { id } });
}

export async function findMemories(prisma: DbClient) {
  return prisma.aiMemory.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createMemory(
  prisma: DbClient,
  data: Prisma.AiMemoryCreateInput
) {
  return prisma.aiMemory.create({ data });
}

export async function findMemoryById(prisma: DbClient, id: string) {
  return prisma.aiMemory.findUnique({ where: { id } });
}

export async function updateMemory(
  prisma: DbClient,
  id: string,
  data: Prisma.AiMemoryUpdateInput
) {
  return prisma.aiMemory.update({ where: { id }, data });
}

export async function findInstructions(prisma: DbClient) {
  return prisma.aiInstruction.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInstruction(
  prisma: DbClient,
  data: Prisma.AiInstructionCreateInput
) {
  return prisma.aiInstruction.create({ data });
}

export async function findInstructionById(prisma: DbClient, id: string) {
  return prisma.aiInstruction.findUnique({ where: { id } });
}

export async function updateInstruction(
  prisma: DbClient,
  id: string,
  data: Prisma.AiInstructionUpdateInput
) {
  return prisma.aiInstruction.update({ where: { id }, data });
}
```

- [ ] **Step 2: Update `ai-chat.service.ts`**

Replace `prisma.aiConversation.*`, `prisma.aiMessage.*`, `prisma.$queryRaw` with repo calls.

- [ ] **Step 3: Update `ai-agent.service.ts`**

Replace `prisma.aiAgentDefinition.*`, `prisma.aiMemory.*`, `prisma.aiInstruction.*` with repo calls.

- [ ] **Step 4: Run `bun run check`**

- [ ] **Step 5: Commit**

```bash
git add server/repositories/ai.repository.ts server/services/ai-chat.service.ts server/services/ai-agent.service.ts
git commit -m "refactor: add ai.repository, update ai services to use repo"
```

---

### Task 12: `notification.repository.ts` + update notification services + fix `notifications.route.ts`

**Files:**
- Create: `server/repositories/notification.repository.ts`
- Modify: `server/services/notification-dispatch.ts`
- Modify: `server/services/notification-inapp.service.ts`
- Modify: `server/services/notification-outbox.service.ts`
- Modify: `server/services/receipt.service.ts`
- Modify: `server/routes/notifications.ts`

- [ ] **Step 1: Create `notification.repository.ts`**

Extract from all 3 notification services:

```ts
import { type Prisma, type PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findTemplatesByName(
  prisma: DbClient,
  name: string
) {
  return prisma.notificationTemplate.findMany({
    where: { name },
  });
}

export async function findTemplateById(prisma: DbClient, id: string) {
  return prisma.notificationTemplate.findUnique({ where: { id } });
}

export async function findUsersByRole(
  prisma: DbClient,
  role: string
) {
  return prisma.user.findMany({
    select: { id: true },
    where: { isActive: true, role },
  });
}

export async function createInAppNotifications(
  prisma: DbClient,
  data: Prisma.InAppNotificationCreateManyInput[]
) {
  return prisma.inAppNotification.createManyAndReturn({ data });
}

export async function findInAppNotifications(
  prisma: DbClient,
  where: Record<string, unknown>,
  include: Prisma.InAppNotificationInclude,
  orderBy: Prisma.InAppNotificationOrderByWithRelationInput,
  take: number
) {
  return prisma.inAppNotification.findMany({ where, include, orderBy, take });
}

export async function countUnreadInApp(
  prisma: DbClient,
  userId: string
) {
  return prisma.inAppNotification.count({
    where: { userId, readAt: null },
  });
}

export async function findInAppNotificationById(
  prisma: DbClient,
  id: string,
  userId: string
) {
  return prisma.inAppNotification.findFirst({ where: { id, userId } });
}

export async function updateInAppNotification(
  prisma: DbClient,
  id: string,
  data: Prisma.InAppNotificationUpdateInput
) {
  return prisma.inAppNotification.update({ where: { id }, data });
}

export async function updateManyInAppNotifications(
  prisma: DbClient,
  data: Prisma.InAppNotificationUpdateInput,
  where: Prisma.InAppNotificationWhereInput
) {
  return prisma.inAppNotification.updateMany({ data, where });
}

export async function deleteManyInAppNotifications(
  prisma: DbClient,
  where: Prisma.InAppNotificationWhereInput
) {
  return prisma.inAppNotification.deleteMany({ where });
}

export async function createOutboxEntry(
  prisma: DbClient,
  data: Prisma.NotificationOutboxCreateInput
) {
  return prisma.notificationOutbox.create({ data });
}

export async function findPendingOutbox(
  prisma: DbClient,
  where: Prisma.NotificationOutboxWhereInput,
  orderBy: Prisma.NotificationOutboxOrderByWithRelationInput,
  take: number
) {
  return prisma.notificationOutbox.findMany({ where, orderBy, take });
}

export async function updateOutboxEntry(
  prisma: DbClient,
  id: string,
  data: Prisma.NotificationOutboxUpdateInput
) {
  return prisma.notificationOutbox.update({ where: { id }, data });
}

export async function findOutboxLogs(
  prisma: DbClient,
  orderBy: Prisma.NotificationOutboxOrderByWithRelationInput,
  take: number
) {
  return prisma.notificationOutbox.findMany({ orderBy, take });
}

export async function findShopSettings(prisma: DbClient) {
  return prisma.shopSettings.findUnique({ where: { id: "default" } });
}
```

- [ ] **Step 2: Update `notification-dispatch.ts`**

Replace `app.prisma.notificationTemplate.findMany`, `prisma.user.findMany`, `prisma.inAppNotification.createManyAndReturn` with repo calls.

- [ ] **Step 3: Update `notification-inapp.service.ts`**

Replace all `prisma.inAppNotification.*` calls with repo calls.

- [ ] **Step 4: Update `notification-outbox.service.ts`**

Replace all `prisma.notificationOutbox.*`, `prisma.shopSettings.*` calls with repo calls. Also use `settings.repository` for `getWhatsAppConfig` instead of direct `shopSettings` query.

- [ ] **Step 5: Update `receipt.service.ts`**

Replace `prisma.shopSettings.findUnique` with `settingsRepo.findShopSettings(prisma)`.

- [ ] **Step 6: Fix inline Prisma in `notifications.route.ts`**

Replace `app.prisma.notificationTemplate.findUnique` and `app.prisma.shopSettings.findUnique` in the `/test/:templateId` endpoint with service calls. Add `testNotification` function to `notification-inapp.service.ts` (or a new `notification-testing.service.ts`) that uses repos.

- [ ] **Step 7: Run `bun run check`**

- [ ] **Step 8: Commit**

```bash
git add server/repositories/notification.repository.ts server/services/notification-dispatch.ts server/services/notification-inapp.service.ts server/services/notification-outbox.service.ts server/services/receipt.service.ts server/routes/notifications.ts
git commit -m "refactor: add notification.repository, update notification services and fix route"
```

---

### Task 13: `auth.repository.ts` + `auth.service.ts` + update `auth.route.ts`

**Files:**
- Create: `server/repositories/auth.repository.ts`
- Create: `server/services/auth.service.ts`
- Modify: `server/routes/auth.ts`

- [ ] **Step 1: Create `auth.repository.ts`**

Extract from `auth.route.ts` inline Prisma:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findCredentialAccount(
  prisma: DbClient,
  userId: string
) {
  return prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
}

export async function updatePassword(
  prisma: DbClient,
  userId: string,
  hashedPassword: string
) {
  return prisma.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: hashedPassword },
  });
}

export async function updateMustChangePassword(
  prisma: DbClient,
  userId: string,
  mustChangePassword: boolean
) {
  return prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword },
  });
}

export async function changePasswordTransaction(
  prisma: PrismaClient,
  userId: string,
  hashedPassword: string,
  mustChangePassword: boolean
) {
  return prisma.$transaction([
    prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashedPassword },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword },
    }),
  ]);
}
```

- [ ] **Step 2: Create `auth.service.ts`**

Business logic extracted from `auth.route.ts`:

```ts
import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import * as authRepo from "../repositories/auth.repository.js";

export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  oldPassword: string,
  newPassword: string
) {
  if (oldPassword === newPassword) {
    throw new AppError("PASSWORD_SAME_AS_OLD");
  }

  const account = await authRepo.findCredentialAccount(prisma, userId);
  if (!account?.password) {
    throw new AppError("NO_PASSWORD_SET");
  }

  const isValid = await verifyPassword({
    hash: account.password,
    password: oldPassword,
  });
  if (!isValid) {
    throw new AppError("CURRENT_PASSWORD_INCORRECT");
  }

  const hashedNewPassword = await hashPassword(newPassword);

  await authRepo.changePasswordTransaction(
    prisma,
    userId,
    hashedNewPassword,
    false
  );

  return { success: true };
}
```

- [ ] **Step 3: Update `auth.route.ts`**

Replace inline logic with `auth.service` call:

```ts
import { changePassword } from "../services/auth.service.js";

// In handler:
const result = await changePassword(app.prisma, session.user.id, oldPassword, newPassword);
return reply.send(result);
```

Remove `PrismaClient` import, `hashPassword`, `verifyPassword` imports from route.

- [ ] **Step 4: Run `bun run check`**

- [ ] **Step 5: Commit**

```bash
git add server/repositories/auth.repository.ts server/services/auth.service.ts server/routes/auth.ts
git commit -m "refactor: add auth.repository and auth.service, clean up auth route"
```

---

### Task 14: `user.repository.ts` + `user.service.ts` + update `users.route.ts`

**Files:**
- Create: `server/repositories/user.repository.ts`
- Create: `server/services/user.service.ts`
- Modify: `server/routes/users.ts`

- [ ] **Step 1: Create `user.repository.ts`**

Extract all User, Account, Session, AuditLog queries from `users.route.ts`:

```ts
import type { Prisma, PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  image: true,
  createdAt: true,
} as const;

const USER_SELECT_NO_IMAGE = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export async function findMany(
  prisma: DbClient,
  where: Prisma.UserWhereInput,
  select: Prisma.UserSelect,
  orderBy: Prisma.UserOrderByWithRelationInput,
  take: number
) {
  return prisma.user.findMany({ where, select, orderBy, take });
}

export async function count(prisma: DbClient, where: Prisma.UserWhereInput) {
  return prisma.user.count({ where });
}

export async function findUnique(
  prisma: DbClient,
  id: string,
  select: Prisma.UserSelect
) {
  return prisma.user.findUnique({ where: { id }, select });
}

export async function findFirst(
  prisma: DbClient,
  where: Prisma.UserWhereInput
) {
  return prisma.user.findFirst({ where });
}

export async function update(
  prisma: DbClient,
  id: string,
  data: Prisma.UserUpdateInput,
  select: Prisma.UserSelect
) {
  return prisma.user.update({ where: { id }, data, select });
}

export async function updateStatus(
  prisma: DbClient,
  id: string,
  isActive: boolean
) {
  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: USER_SELECT_NO_IMAGE,
  });
}

export async function updateProfile(
  prisma: DbClient,
  id: string,
  data: { name?: string; email?: string; username?: string }
) {
  return prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT_NO_IMAGE,
  });
}

export async function resetPasswordTransaction(
  prisma: PrismaClient,
  userId: string,
  hashedPassword: string
) {
  return prisma.$transaction([
    prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashedPassword },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    }),
    prisma.session.deleteMany({
      where: { userId },
    }),
  ]);
}

export async function findSessions(
  prisma: DbClient,
  userId: string
) {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findSessionById(prisma: DbClient, id: string) {
  return prisma.session.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
}

export async function deleteSession(prisma: DbClient, id: string) {
  return prisma.session.delete({ where: { id } });
}

export async function jobCount(prisma: DbClient, where: Prisma.JobWhereInput) {
  return prisma.job.count({ where });
}

export { USER_SELECT, USER_SELECT_NO_IMAGE };
```

- [ ] **Step 2: Create `user.service.ts`**

Business logic extracted from `users.route.ts`:

```ts
import { Prisma } from "@generated/client";
import type { PrismaClient } from "@generated/client";
import type { RoleType } from "@shared/constants/roles";
import { AppError } from "@shared/errors/app-error.js";
import { hashPassword } from "better-auth/crypto";
import * as auditRepo from "../repositories/audit.repository.js";
import * as userRepo from "../repositories/user.repository.js";

async function checkUniqueFields(
  prisma: PrismaClient,
  checks: Array<{ field: "email" | "username"; value: string }>,
  excludeId: string
): Promise<string | null> {
  for (const { field, value } of checks) {
    const existing = await userRepo.findFirst(prisma, {
      [field]: value,
      NOT: { id: excludeId },
    });
    if (existing) {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      return `${label} already in use`;
    }
  }
  return null;
}

function isUniqueViolation(err: unknown): string | null {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return null;
  }
  const target = (err.meta as { target: string[] })?.target?.[0];
  const label = target
    ? target.charAt(0).toUpperCase() + target.slice(1)
    : "Field";
  return `${label} already in use`;
}

export async function list(prisma: PrismaClient, query: {
  cursor?: string;
  limit: number;
  search?: string;
}) {
  const { cursor, limit, search } = query;
  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (cursor) {
    where.id = { lt: cursor };
  }

  const [users, totalCount] = await Promise.all([
    userRepo.findMany(prisma, where, userRepo.USER_SELECT, { id: "desc" }, limit + 1),
    cursor ? Promise.resolve(null) : userRepo.count(prisma, where),
  ]);

  let nextCursor: string | null = null;
  if (users.length > limit) {
    users.pop();
    nextCursor = users.at(-1)?.id ?? null;
  }

  return { users, nextCursor, totalCount };
}

export async function getById(prisma: PrismaClient, id: string) {
  return userRepo.findUnique(prisma, id, userRepo.USER_SELECT);
}

export async function createUser(
  prisma: PrismaClient,
  authApi: { createUser: (args: any) => Promise<any> },
  headers: Headers,
  data: { username: string; email: string; password: string; role: RoleType },
  userId: string
) {
  const { username, email, password, role } = data;

  const existing = await userRepo.findFirst(prisma, {
    OR: [{ username }, { email }],
  });
  if (existing) {
    const errorCode =
      existing.username === username ? "USERNAME_EXISTS" : "EMAIL_EXISTS";
    throw new AppError(errorCode);
  }

  const created = await authApi.createUser({
    headers,
    body: {
      email,
      password,
      name: username,
      role,
      data: { username, mustChangePassword: true },
    },
  });

  if (!created?.user?.id) {
    throw new AppError("INTERNAL_ERROR");
  }

  const user = await userRepo.findUnique(
    prisma,
    created.user.id,
    userRepo.USER_SELECT_NO_IMAGE
  );

  await auditRepo.create(prisma, {
    jobId: null,
    userId,
    action: "USER_CREATED",
    toValue: `${username} (${role})`,
  });

  return user;
}

export async function toggleStatus(
  prisma: PrismaClient,
  id: string,
  isActive: boolean
) {
  return userRepo.updateStatus(prisma, id, isActive);
}

export async function resetPassword(
  prisma: PrismaClient,
  id: string,
  newPassword: string,
  userId: string
) {
  const targetUser = await userRepo.findUnique(
    prisma,
    id,
    userRepo.USER_SELECT_NO_IMAGE
  );
  if (!targetUser) {
    throw new AppError("USER_NOT_FOUND");
  }

  const hashedPassword = await hashPassword(newPassword);

  await userRepo.resetPasswordTransaction(prisma, id, hashedPassword);

  await auditRepo.create(prisma, {
    jobId: null,
    userId,
    action: "PASSWORD_RESET",
    toValue: `Password reset for ${targetUser.username}`,
  });

  return { success: true };
}

export async function updateProfile(
  prisma: PrismaClient,
  id: string,
  data: { name?: string; email?: string; username?: string }
) {
  const { email, username } = data;
  const checks: Array<{ field: "email" | "username"; value: string }> = [];
  if (email) checks.push({ field: "email", value: email });
  if (username) checks.push({ field: "username", value: username });

  if (checks.length > 0) {
    const conflict = await checkUniqueFields(prisma, checks, id);
    if (conflict) {
      throw new AppError("CONFLICT", { message: conflict });
    }
  }

  try {
    const updated = await userRepo.updateProfile(prisma, id, data);
    return updated;
  } catch (err) {
    const conflictMsg = isUniqueViolation(err);
    if (conflictMsg) {
      throw new AppError("CONFLICT", { message: conflictMsg });
    }
    throw err;
  }
}

export async function getActivity(
  prisma: PrismaClient,
  id: string,
  query: { limit: number; cursor?: string }
) {
  const { limit, cursor } = query;
  let cursorFilter = {};
  if (cursor) {
    const cursorLog = await auditRepo.findUnique(prisma, { id: cursor }, { createdAt: true });
    if (!cursorLog) {
      throw new AppError("INVALID_CURSOR");
    }
    cursorFilter = {
      OR: [
        { createdAt: { lt: cursorLog.createdAt } },
        {
          createdAt: cursorLog.createdAt,
          id: { lt: cursor },
        },
      ],
    };
  }

  const logs = await auditRepo.findMany(
    prisma,
    { userId: id, ...cursorFilter },
    {
      id: true,
      action: true,
      fromValue: true,
      toValue: true,
      metadata: true,
      createdAt: true,
    },
    [{ createdAt: "desc" }, { id: "desc" }],
    limit
  );

  const nextCursor = logs.length === limit ? logs.at(-1)?.id : null;
  return { items: logs, nextCursor };
}

export async function getStats(prisma: PrismaClient, id: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [completedJobs, monthlyJobs] = await Promise.all([
    userRepo.jobCount(prisma, {
      technicianId: id,
      status: { in: ["DONE", "DELIVERED"] },
    }),
    userRepo.jobCount(prisma, {
      technicianId: id,
      status: { in: ["DONE", "DELIVERED"] },
      createdAt: { gte: monthStart },
    }),
  ]);

  return { completedJobs, monthlyJobs };
}

export async function getSessions(prisma: PrismaClient, id: string) {
  return userRepo.findSessions(prisma, id);
}

export async function revokeSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  currentSessionId: string
) {
  const session = await userRepo.findSessionById(prisma, sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError("SESSION_NOT_FOUND");
  }
  if (sessionId === currentSessionId) {
    throw new AppError("CANNOT_END_CURRENT_SESSION");
  }
  await userRepo.deleteSession(prisma, sessionId);
  return { success: true };
}

export { checkUniqueFields, isUniqueViolation };
```

- [ ] **Step 3: Update `users.route.ts`**

Remove ALL direct Prisma calls, helper functions (`checkUniqueFields`, `updateProfile`, `buildUpdateData`, `checkProfileUniqueness`, `isUniqueViolation`), and `PrismaClient`/`Prisma` imports. Replace with calls to `user.service` functions. Keep `canAccessUser` helper (uses better-auth, not Prisma). Keep request validation and response shaping.

- [ ] **Step 4: Run `bun run check`**

- [ ] **Step 5: Commit**

```bash
git add server/repositories/user.repository.ts server/services/user.service.ts server/routes/users.ts
git commit -m "refactor: add user.repository and user.service, clean up users route"
```

---

### Task 15: `avatar.repository.ts` + update `avatar.service.ts`

**Files:**
- Create: `server/repositories/avatar.repository.ts`
- Modify: `server/services/avatar.service.ts`

- [ ] **Step 1: Create `avatar.repository.ts`**

```ts
import type { PrismaClient } from "@generated/client";

type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findUserImage(
  prisma: DbClient,
  userId: string
) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
}

export async function updateImage(
  prisma: DbClient,
  userId: string,
  image: string | null
) {
  return prisma.user.update({
    where: { id: userId },
    data: { image },
  });
}
```

- [ ] **Step 2: Update `avatar.service.ts`**

Replace `prisma.user.findUnique` and `prisma.user.update` with `avatarRepo.*` calls.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/repositories/avatar.repository.ts server/services/avatar.service.ts
git commit -m "refactor: add avatar.repository, update avatar.service to use repo"
```

---

### Task 16: Update `account-lockout.service.ts` to use `user.repository`

**Files:**
- Modify: `server/services/account-lockout.service.ts`

- [ ] **Step 1: Update `account-lockout.service.ts`**

Replace `prisma.user.findUnique` and `prisma.user.update` with `userRepo.findUnique` and `userRepo.update`. Import from `user.repository`. Keep `isAccountLocked` as pure function (no Prisma).

- [ ] **Step 2: Run `bun run check`**

- [ ] **Step 3: Commit**

```bash
git add server/services/account-lockout.service.ts
git commit -m "refactor: update account-lockout.service to use user.repository"
```

---

### Task 17: Fix inline Prisma in `jobs.route.ts`

**Files:**
- Modify: `server/routes/jobs.ts`

- [ ] **Step 1: Move inline auditLog.findMany to job.service**

Add `getJobHistory` function to `job.service.ts` that uses `auditRepo.findMany`. Remove `app.prisma.auditLog.findMany` from the route and call the new service function instead.

- [ ] **Step 2: Verify jobs route has no more direct Prisma calls**

The in-memory lockout for the public job lookup endpoint stays in the route since it's request-scope rate limiting (not a DB concern), but verify no more `app.prisma.*` calls exist.

- [ ] **Step 3: Run `bun run check`**

- [ ] **Step 4: Commit**

```bash
git add server/routes/jobs.ts server/services/job.service.ts
git commit -m "refactor: move inline auditLog query from jobs route to job.service"
```

---

### Task 18: Final verification

- [ ] **Step 1: Grep for any remaining direct Prisma usage in routes**

Run: `rg 'app\.prisma\.' server/routes/ --include '*.ts'`

Expected: Only `health.ts` with `$queryRaw` (acceptable per spec).

- [ ] **Step 2: Grep for direct Prisma query usage in services**

Run: `rg 'prisma\.\w+\.(findMany|findUnique|findFirst|create|update|delete|count|groupBy|aggregate|upsert|deleteMany|updateMany|createManyAndReturn|\$queryRaw|\$transaction)' server/services/ --include '*.ts'`

Expected: Only `$transaction` calls (which are OK — services own transaction scopes) and `notification-renderer.ts`/`notification-sender.ts` (no Prisma).

- [ ] **Step 3: Run `bun run check`**

Expected: All types pass, no errors.

- [ ] **Step 4: Run test suite**

Run: `bun test` (or whatever test command the project uses)

Expected: All existing tests pass.

- [ ] **Step 5: Run `bun run fix` to ensure code style**

Run: `bun run fix`
Expected: Clean exit, no unresolved issues.

- [ ] **Step 6: Update `AGENTS.md` folder structure**

Add `repositories/` to the server folder structure in AGENTS.md, and sync to CLAUDE.md/GEMINI.md using `cp`.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "refactor: complete server 3-layer SoC refactor — controller/service/repository"
```