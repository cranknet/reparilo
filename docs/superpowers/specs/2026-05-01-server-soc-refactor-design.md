# Server Separation of Concerns Refactor

## Date: 2026-05-01

## Motivation

The server currently uses a 2-layer architecture (routes → services). About half the routes cleanly delegate to services, but several bypass the service layer with inline Prisma calls and business logic. This refactor introduces a consistent 3-layer architecture across all modules: Controller → Service → Repository.

## Architecture

### Three Layers

| Layer | Location | Responsibility |
|---|---|---|
| **Controller** | `server/routes/` | HTTP concerns only: validation, auth checks, request parsing, response shaping, error mapping. Never touches Prisma. |
| **Service** | `server/services/` | Business logic, orchestration, state transitions, cross-service calls. Calls repos for data access, never Prisma directly. Imports Prisma types only. |
| **Repository** | `server/repositories/` | Data access only: Prisma queries. No business logic, no error messages, no HTTP concerns. |

### Dependency Injection Pattern

Factory functions with `PrismaClient` as first param (matches current code style):

```ts
// repository
export async function findById(prisma: PrismaClient | Prisma.TransactionClient, id: string) {
  return prisma.job.findUnique({ where: { id } });
}

// service
import * as jobRepo from "../repositories/job.repository.js";
export async function getJob(prisma: PrismaClient, id: string) {
  const job = await jobRepo.findById(prisma, id);
  if (!job) throw new AppError("NOT_FOUND", "Job not found");
  return job;
}
```

### Transaction Handling

- Services own `$transaction` scopes and pass `tx` to repos.
- Repo functions accept `PrismaClient | Prisma.TransactionClient`.
- Matches existing `audit.service.ts` pattern.

### Cross-Cutting Concerns

- Services may call other services (e.g., `job.service` → `notification-dispatch`).
- Services never call other services' repositories directly.
- Pure logic modules (`notification-renderer.ts`, `notification-sender.ts`) stay in services as-is (no Prisma).

## Repository Files

19 new repository files in `server/repositories/`:

| Repository | Extracted From | Prisma Models |
|---|---|---|
| `job.repository.ts` | `job.service.ts` | Job, Customer, Brand, Device |
| `job-note.repository.ts` | `job-notes.service.ts` | JobNote, Job |
| `job-part.repository.ts` | `job-parts.service.ts` | JobPart, Job |
| `job-repair.repository.ts` | `job-repairs.service.ts` | JobRepair, Job |
| `job-photo.repository.ts` | `job-photos.service.ts` | JobPhoto, Job |
| `job-waiting-parts.repository.ts` | `job-waiting-parts.service.ts` | JobPartsWaiting, Job |
| `customer.repository.ts` | `customers.service.ts` | Customer |
| `user.repository.ts` | NEW (from `users.route.ts` inline logic) | User, Account, Session |
| `device.repository.ts` | `device.service.ts` | Brand, Device |
| `part.repository.ts` | `parts-catalog.service.ts` | PartsCatalog, JobPart |
| `repair.repository.ts` | `repair-catalog.service.ts` | RepairCatalog, JobRepair |
| `notification.repository.ts` | `notification-inapp.service.ts`, `notification-outbox.service.ts`, `notification-dispatch.ts`, `notifications.route.ts` | InAppNotification, NotificationOutbox, NotificationTemplate, User |
| `settings.repository.ts` | `settings.service.ts` | ShopSettings, AiSettings, NotificationTemplate |
| `dashboard.repository.ts` | `dashboard.service.ts` | Job, AuditLog, ShopSettings |
| `report.repository.ts` | `reports.service.ts` | Job, JobRepair, AuditLog, Customer |
| `ai.repository.ts` | `ai-chat.service.ts`, `ai-agent.service.ts` | AiConversation, AiMessage, AiAgentDefinition, AiMemory, AiInstruction |
| `auth.repository.ts` | NEW (from `auth.route.ts` inline logic) | Account, User |
| `audit.repository.ts` | `audit.service.ts` | AuditLog |
| `avatar.repository.ts` | `avatar.service.ts` | User |

## New Service Files

| Service | Extracted From |
|---|---|
| `auth.service.ts` | Inline logic in `routes/auth.ts` |
| `user.service.ts` | Inline logic in `routes/users.ts` |

## Service Changes

Every existing service will have all direct Prisma calls extracted to its corresponding repository. The service keeps business logic and orchestrates repo calls.

| Service | Change |
|---|---|
| `job.service.ts` | Prisma calls → `job.repository` |
| `customers.service.ts` | Prisma calls → `customer.repository` |
| `device.service.ts` | Prisma calls → `device.repository` |
| `parts-catalog.service.ts` | Prisma calls → `part.repository` |
| `repair-catalog.service.ts` | Prisma calls → `repair.repository` |
| `settings.service.ts` | Prisma calls → `settings.repository` |
| `dashboard.service.ts` | Prisma calls → `dashboard.repository` |
| `reports.service.ts` | Prisma calls → `report.repository` |
| `ai-chat.service.ts` | Prisma calls → `ai.repository` |
| `ai-agent.service.ts` | Prisma calls → `ai.repository` |
| `notification-dispatch.ts` | Prisma calls → `notification.repository` |
| `notification-inapp.service.ts` | Prisma calls → `notification.repository` |
| `notification-outbox.service.ts` | Prisma calls → `notification.repository`, `settings.repository` |
| `receipt.service.ts` | Prisma calls (ShopSettings) → `settings.repository` |
| `audit.service.ts` | Prisma calls → `audit.repository` |
| `avatar.service.ts` | Prisma calls → `avatar.repository` |
| `account-lockout.service.ts` | Prisma calls → `user.repository` |
| `job-notes.service.ts` | Prisma calls → `job-note.repository`, `audit.repository` |
| `job-parts.service.ts` | Prisma calls → `job-part.repository`, `audit.repository` |
| `job-repairs.service.ts` | Prisma calls → `job-repair.repository`, `audit.repository` |
| `job-photos.service.ts` | Prisma calls → `job-photo.repository`, `audit.repository` |
| `job-waiting-parts.service.ts` | Prisma calls → `job-waiting-parts.repository`, `audit.repository` |
| `notification-renderer.ts` | No change (pure logic, no Prisma) |
| `notification-sender.ts` | No change (no Prisma, calls `lib/crypto`) |

## Route Changes

| Route | Change |
|---|---|
| `auth.ts` | Remove all inline logic → call `auth.service` |
| `users.ts` | Remove all inline logic → call `user.service` |
| `jobs.ts` | Remove inline Prisma (`auditLog.findMany`) and in-memory lockout → delegate to services |
| `dashboard.ts` | Remove inline `prisma.job.count` → delegate to `dashboard.service` |
| `notifications.ts` | Remove inline Prisma (`notificationTemplate.findUnique`, `shopSettings.findUnique`) → delegate to services |
| `health.ts` | Keep raw SQL as-is (health check, no service needed) |
| All other routes | Minimal — update service import signatures if they change |

## Rules

1. Routes never import `PrismaClient` or call `app.prisma.*`
2. Services never import from `@generated/client` for queries (only for types)
3. Repositories only contain Prisma queries — no business logic, no error messages, no HTTP status codes
4. Services own `$transaction` scopes and pass `tx` to repos
5. Services may call other services; services never call other services' repos
6. Pure logic modules (`notification-renderer`, `notification-sender`) remain in services/ unchanged
7. `audit.repository` is SSOT for audit writes; other repos (job, user, dashboard, report) may read AuditLog for domain-specific queries but all writes go through `audit.repository`

## Migration Order

Work module by module, in order of complexity (simplest first):

1. **Simple CRUD modules** (no inline route logic, thin services):
   - customers, devices, parts, repairs, settings, customer repository, device repository, part repository, repair repository, settings repository
2. **Job sub-services** (thin but with audit cross-cutting concern):
   - job-notes, job-parts, job-repairs, job-photos, job-waiting-parts
3. **Job module** (most complex service):
   - job.service → job.repository
4. **Dashboard & Reports** (complex aggregation services):
   - dashboard, reports
5. **AI module** (two services → one repository):
   - ai-chat, ai-agent → ai.repository
6. **Notifications** (multiple services sharing one repo):
   - notification-dispatch, notification-inapp, notification-outbox → notification.repository
7. **Leaky routes** (require new services):
   - auth → auth.service + auth.repository
   - users → user.service + user.repository
8. **Supporting services** (small extractions):
   - audit, avatar, account-lockout

Each module migration:
1. Create repository file, extract all Prisma calls
2. Update service to call repository instead of Prisma
3. For leaky routes: create service, move inline logic
4. Update route to call service (no direct Prisma imports)
5. Run `bun run check` to verify types
6. Run existing tests

## Rollback

Each module migration is self-contained and reversible. If a module migration breaks, revert just that module's changes. No database or schema changes required.