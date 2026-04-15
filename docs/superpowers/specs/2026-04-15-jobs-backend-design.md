# Jobs Feature — Backend Design Spec

**Date:** 2026-04-15
**Scope:** Full backend implementation for the Jobs domain
**Architecture:** Service layer pattern — thin routes, business logic in services
**Frontend:** No changes — frontend continues using mock data

---

## 1. API Surface

### Core Job CRUD

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/api/jobs` | List jobs (cursor-paginated, filterable) | `jobs:read` |
| `GET` | `/api/jobs/metrics` | Aggregated counts by status | `jobs:read` |
| `GET` | `/api/jobs/:id` | Get single job with all relations | `jobs:read` |
| `POST` | `/api/jobs` | Create job (intake) | `jobs:write` |
| `PATCH` | `/api/jobs/:id` | Update job fields | `jobs:write` |

### Status Transitions

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `PATCH` | `/api/jobs/:id/status` | Transition status (flow-validated) | `jobs:update_status` |

### Job Parts (consumed)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/api/jobs/:id/parts` | Add part (snapshotted) | `jobs:write` |
| `DELETE` | `/api/jobs/:id/parts/:partId` | Remove part | `jobs:write` |

### Job Repairs (performed)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/api/jobs/:id/repairs` | Add repair (snapshotted) | `jobs:write` |
| `DELETE` | `/api/jobs/:id/repairs/:repairId` | Remove repair | `jobs:write` |

### Job Notes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/api/jobs/:id/notes` | List notes for job | `jobs:read` |
| `POST` | `/api/jobs/:id/notes` | Add note (internal or customer-visible) | `jobs:write` |

### Job Photos

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/api/jobs/:id/photos` | Upload photo (multipart, max 5) | `jobs:write` |
| `DELETE` | `/api/jobs/:id/photos/:photoId` | Delete photo | `jobs:write` |

### Waiting for Parts

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/api/jobs/:id/waiting-parts` | Add waiting part entry | `jobs:write` |
| `DELETE` | `/api/jobs/:id/waiting-parts/:waitingId` | Remove waiting part | `jobs:write` |

### Key API Decisions

- Status transition is a separate endpoint because it has distinct validation (flow enforcement) and RBAC (`jobs:update_status` vs `jobs:write`).
- Parts and repairs are sub-resources — they only exist in the context of a job.
- No `DELETE /api/jobs/:id` for MVP — `Restrict` foreign keys + audit requirements make deletion risky.
- Metrics is a separate endpoint to keep the list endpoint fast.
- Photos served at `/api/uploads/job-photos/{jobId}/{filename}` with no auth (tracking page needs access).

---

## 2. Service Layer Architecture

### File Structure

```
server/
├── services/
│   ├── job.service.ts          # Core job CRUD + status transitions
│   ├── job-parts.service.ts    # Add/remove consumed parts (snapshotted)
│   ├── job-repairs.service.ts  # Add/remove performed repairs (snapshotted)
│   ├── job-notes.service.ts    # Add/list notes
│   ├── job-photos.service.ts   # Upload/delete photos (local disk)
│   └── audit.service.ts        # Shared audit logging
├── routes/
│   └── jobs.ts                 # Thin route handlers → call services
└── utils/
    └── job-code.ts             # Job code generation (REP-2026-0042-X7K)
```

### Service Method Contracts

**`job.service.ts`** — Core orchestrator:

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `list(filters, cursor, limit)` | status?, technicianId?, search?, cursor?, limit? | `{ jobs[], nextCursor, totalCount }` | None |
| `getById(id)` | job ID | Full job with all relations + computed `finalCost` | None |
| `getMetrics()` | — | `{ INTAKE: n, IN_REPAIR: n, ... }` per status | None |
| `create(input, userId)` | Validated CreateJobInput | Created job | Upserts customer (by phone), upserts device (by brand+model), generates jobCode + accessCode, audit log |
| `update(id, input, userId)` | Partial job fields | Updated job | Audit log for changed fields |
| `transitionStatus(id, newStatus, userId)` | Job ID + target status | Updated job | Validates against `JOB_STATUS_FLOW`, audit log with from/to values |

**`job-parts.service.ts`:**

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `add(jobId, input, userId)` | partId?, partName, category, unitPrice, quantity, supplier? | Created JobPart | Snapshots all fields from catalog if `partId` provided; computes `totalCost = unitPrice * quantity`; audit log |
| `remove(jobId, partId, userId)` | IDs | void | Audit log |

**`job-repairs.service.ts`:**

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `add(jobId, input, userId)` | repairId?, repairName, category, price | Created JobRepair | Snapshots from catalog if `repairId` provided; audit log |
| `remove(jobId, repairId, userId)` | IDs | void | Audit log |

**`job-notes.service.ts`:**

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `list(jobId)` | job ID | JobNote[] with createdBy user | None |
| `add(jobId, content, isCustomerVisible, userId)` | Note fields | Created JobNote | Audit log |

**`job-photos.service.ts`:**

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `upload(jobId, file, userId)` | Multipart file | Created JobPhoto | Saves to `./uploads/job-photos/{jobId}/`, enforces max 5, audit log |
| `remove(jobId, photoId, userId)` | IDs | void | Deletes file from disk, audit log |

**`audit.service.ts`:**

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `log(jobId, userId, action, from?, to?, note?, metadata?)` | Audit fields | Created AuditLog | Single insert |

### Job Code Generation (`job-code.ts`)

Uses `JobCounter` model in a serializable `$transaction`:

1. Read or create `JobCounter` row for `year = new Date().getFullYear()`
2. Increment `lastSeq` within the transaction (prevents race conditions via `@@unique([year])` constraint)
3. Format: `REP-{year}-{seq.toString().padStart(4, '0')}-{randomSuffix(3)}`
4. `accessCode` = `crypto.randomBytes(8).toString('hex')`

### Design Rules

- All mutations go through services — route handlers never touch Prisma directly.
- Every mutation creates an audit log via `audit.service.ts`.
- Status transition validation uses existing `JOB_STATUS_FLOW` from `@shared/constants`.
- Customer auto-linking: `create()` looks up by phone, reuses or creates new. Same for device (brand+model unique key).
- Snapshot pattern: catalog values are copied at add time — catalog changes never affect historical records.
- No transactions spanning services — each service method is self-contained. Only transaction is in job code generation.

---

## 3. Validation & Error Handling

### Validation Layers

**Layer 1 — Route handler (Zod):**

| Endpoint | Schema | Validates |
|----------|--------|-----------|
| `POST /api/jobs` | `createJobSchema` (exists) | Customer name/phone, device brand/model, problem, cost |
| `PATCH /api/jobs/:id` | `updateJobSchema` (new) | Partial: problem, conditionNotes, estimatedCost, estimatedDate, technicianId, color |
| `PATCH /api/jobs/:id/status` | `transitionStatusSchema` (new) | `status: z.enum([all 8 values])` |
| `POST /api/jobs/:id/parts` | `addJobPartSchema` (new) | partId?, partName, category, unitPrice, quantity, supplier? |
| `POST /api/jobs/:id/repairs` | `addJobRepairSchema` (new) | repairId?, repairName, category, price |
| `POST /api/jobs/:id/notes` | `addJobNoteSchema` (new) | content, isCustomerVisible |
| `POST /api/jobs/:id/photos` | Multipart | Content-type, file size < 5MB, max 5 per job |
| `GET /api/jobs` | `jobListQuerySchema` (new) | cursor?, limit (max 100), status?, technicianId?, search? |

**Layer 2 — Service (business rules):**

| Rule | Where | Error |
|------|-------|-------|
| Status must follow `JOB_STATUS_FLOW` | `job.service.transitionStatus()` | `409 CONFLICT_STATUS_TRANSITION` |
| Max 5 photos per job | `job-photos.service.upload()` | `409 PHOTO_LIMIT_REACHED` |
| No mutations on terminal statuses (CANCELLED, DELIVERED, RETURNED) | All sub-services | `409 JOB_IN_TERMINAL_STATUS` |
| Technician must have TECHNICIAN or OWNER role | `job.service.update()` | `400 INVALID_TECHNICIAN` |
| `totalCost` auto-computed as `unitPrice * quantity` | `job-parts.service.add()` | Computed, no error |
| Warranty link must be existing completed job for same customer | `job.service.create()` | `400 INVALID_WARRANTY_REFERENCE` |

### Error Response Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {}
}
```

### Error Codes

| HTTP | Code | When |
|------|------|------|
| `400` | `VALIDATION_ERROR` | Zod schema failure |
| `400` | `INVALID_TECHNICIAN` | Assigned user lacks TECHNICIAN/OWNER role |
| `400` | `INVALID_WARRANTY_REFERENCE` | Warranty link validation failed |
| `404` | `JOB_NOT_FOUND` | Job ID doesn't exist |
| `404` | `RESOURCE_NOT_FOUND` | Sub-resource not found on this job |
| `409` | `CONFLICT_STATUS_TRANSITION` | Status transition not allowed |
| `409` | `JOB_IN_TERMINAL_STATUS` | Mutation on CANCELLED/DELIVERED/RETURNED job |
| `409` | `PHOTO_LIMIT_REACHED` | Already 5 photos |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

---

## 4. Cursor Pagination

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | string? | — | Job ID to start after (omit for first page) |
| `limit` | number? | `20` | Page size (max 100) |
| `status` | JobStatus? | — | Filter by single status |
| `technicianId` | string? | — | Filter by assigned technician |
| `search` | string? | — | Search jobCode, customer name, device brand+model (case-insensitive `ilike`) |

### Response

```json
{
  "jobs": [...],
  "nextCursor": "clt_abc123" | null,
  "totalCount": 142
}
```

- `totalCount` only computed on first page (no cursor). When cursor present, `totalCount` is `null`.
- Cursor uses job `id` (cuid — lexicographically sortable). Query: `WHERE id < cursor ORDER BY id DESC LIMIT limit+1`.

### Metrics Endpoint

Single query via `Prisma.job.groupBy({ by: ['status'], _count: true })`:

```json
{
  "INTAKE": 12,
  "WAITING_FOR_PARTS": 4,
  "IN_REPAIR": 8,
  "ON_HOLD": 3,
  "DONE": 2,
  "DELIVERED": 0,
  "RETURNED": 0,
  "CANCELLED": 0
}
```

---

## 5. Photo Storage

### Storage Layout

```
uploads/
└── job-photos/
    ├── clt_abc123/
    │   ├── clt_photo001.jpg
    │   └── clt_photo002.png
    └── clt_def456/
        └── clt_photo003.jpg
```

### Upload Constraints

| Rule | Implementation |
|------|---------------|
| Max file size | Fastify multipart: `limits.fileSize: 5MB` |
| Allowed types | `image/jpeg`, `image/png`, `image/webp` |
| Max per job | Count query before save, reject if >= 5 |
| Filename safety | cuid-based filename, never user-supplied |
| Path storage | Relative: `job-photos/{jobId}/{filename}` |

### Static Serving

Fastify static plugin serves `./uploads/` at `/api/uploads/`. No auth — tracking page needs access.

### Photo Deletion

1. Verify photo belongs to job
2. Delete file from disk (`fs.unlink`, ignore ENOENT)
3. Delete JobPhoto DB record
4. Audit log with `PHOTO_ADDED` action and `note: "Photo deleted: {filename}"` (no new enum value for MVP)

---

## 6. Cost Calculation

Computed at read time on `GET /api/jobs/:id` — no `finalCost` column:

```ts
const finalCost = job.repairs.reduce((sum, r) => sum + Number(r.price), 0)
  + job.partsUsed.reduce((sum, p) => sum + Number(p.totalCost), 0);
```

Returned as a computed field alongside `estimatedCost`. Frontend can flag the difference.

---

## 7. Shared Code Changes

### New Zod Schemas (added to `shared/schemas/job.schema.ts`)

| Schema | Fields |
|--------|--------|
| `updateJobSchema` | reportedProblem?, conditionNotes?, estimatedCost?, estimatedDate?, technicianId?, color? |
| `transitionStatusSchema` | `status: z.enum([all 8 JobStatus values])` |
| `addJobPartSchema` | partId?, partName, category (PartCategory), unitPrice, quantity (default 1), supplier? |
| `addJobRepairSchema` | repairId?, repairName, category (RepairCategory), price |
| `addJobNoteSchema` | content, isCustomerVisible (default false) |
| `addWaitingPartSchema` | partName, supplier? |
| `jobListQuerySchema` | cursor?, limit? (max 100), status?, technicianId?, search? |

### No Changes Needed

| What | Reason |
|------|--------|
| Prisma schema | Already complete — all models, enums, indexes in place |
| `shared/types/index.ts` | `Job` type already includes all relations |
| `shared/constants/job-statuses.ts` | `JOB_STATUS_FLOW` already defines valid transitions |
| `shared/constants/roles.ts` | RBAC permissions already include all `jobs:*` entries |
| `server/middlewares/rbac.ts` | Already wired — just needs correct permission string per route |
| `src/lib/api.ts` | Already configured with `/api` prefix and 401 interceptor |

### New Server Dependencies

| Package | Purpose |
|---------|---------|
| `@fastify/multipart` | Handle file uploads |
| `@fastify/static` | Serve uploaded photos |

### Route Permission Mapping

| Endpoint Pattern | Permission |
|-----------------|-----------|
| `GET /`, `GET /metrics`, `GET /:id`, `GET /:id/notes` | `jobs:read` |
| `POST /`, `PATCH /:id`, `POST/DELETE /:id/parts/*`, `POST/DELETE /:id/repairs/*`, `POST /:id/notes`, `POST/DELETE /:id/photos/*`, `POST/DELETE /:id/waiting-parts/*` | `jobs:write` |
| `PATCH /:id/status` | `jobs:update_status` |

---

## 8. Implementation Summary

**Files to create (8):**
- `server/services/job.service.ts`
- `server/services/job-parts.service.ts`
- `server/services/job-repairs.service.ts`
- `server/services/job-notes.service.ts`
- `server/services/job-photos.service.ts`
- `server/services/audit.service.ts`
- `server/utils/job-code.ts`
- `uploads/job-photos/.gitkeep`

**Files to modify (2):**
- `server/routes/jobs.ts` — rewrite from stub to full route handlers
- `shared/schemas/job.schema.ts` — add 7 new schemas

**Dependencies to install (2):**
- `@fastify/multipart`
- `@fastify/static`

**Prisma schema changes:** None
**Frontend changes:** None
