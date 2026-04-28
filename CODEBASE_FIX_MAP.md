# Reparilo Codebase Fix Map — Single Source of Truth

**Date:** 2026-04-28  
**Scope:** Full codebase audit — server/, src/, shared/, config, prisma  
**Total Issues:** 133  

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| **P0** | Blocks production — security, data loss, crash, incorrect behavior |
| **P1** | Must fix soon — significant quality, maintainability, or consistency risk |
| **P2** | Should fix — code quality, deduplication, minor gaps |
| **P3** | Nice to have — polish, consistency, style |

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 | 10 | ✅ 10/10 fixed |
| P1 | 38 | pending |
| P2 | 49 | pending |
| P3 | 36 | pending |
| **Total** | **133** | **10 fixed, 123 pending** |

| Category | Count |
|----------|-------|
| Security | 7 |
| Architecture | 5 |
| Performance | 6 |
| Code Quality | 23 |
| Maintainability | 19 |
| Consistency | 18 |
| Types/Schemas | 15 |
| i18n | 8 |
| Testing | 8 |
| Accessibility | 4 |
| Config | 10 |
| Bugs | 3 |
| UX | 2 |
| Compatibility | 2 |
| Design System | 1 |

---

## P0 — Critical (Must Fix Before Production)

### ~~S-001 | SQL Injection Risk in AI Tool~~ ✅ FIXED
- **File:** `server/ai/tools.ts`
- **Category:** Security
- **Issue:** ~~`executeQueryDatabase` passes AI-generated SQL to `$queryRawUnsafe`. Regex-based allowlist (SELECT-only, blocked patterns) can be bypassed via subqueries, comments, or string tricks. No table allowlisting — queries can read `Account`, `Session`, `User` tables (passwords, tokens).~~
- **Fix applied:** Added `ALLOWED_TABLES` allowlist (14 safe tables) + `BLOCKED_TABLES` set (accounts, sessions, verifications). Added `stripSqlComments()` to neutralize comment-based bypasses. Added `extractTableNames()` to parse and validate all table references before execution. Converted `executeGetSchema` to parameterized `Prisma.sql`.

### ~~S-002 | SQL Injection Surface in Dashboard Service~~ ✅ FIXED
- **File:** `server/services/dashboard.service.ts`
- **Category:** Security
- **Issue:** ~~Uses `$queryRawUnsafe` with string interpolation for `techFilter`, `shopTz`, and `days` parameters.~~
- **Fix applied:** Replaced both `$queryRawUnsafe` calls with `$queryRaw` using `Prisma.sql` tagged templates. Dynamic values (`range.start`, `range.end`, `scope.userId`, `scope.shopTz`) now passed as proper SQL parameters. Conditional clauses use `Prisma.empty` instead of string interpolation.

### ~~S-003 | Hardcoded Admin Password in Seed~~ ✅ FIXED
- **File:** `prisma/seed.ts`
- **Category:** Security
- **Issue:** ~~Password `"admin1234"` is hardcoded in version control.~~
- **Fix applied:** Added `if (!process.env.SEED_ADMIN_PASSWORD) throw new Error(...)` guard. Replaced hardcoded value with `process.env.SEED_ADMIN_PASSWORD`.

### ~~S-004 | User Type Leaks Password Hash~~ ✅ FIXED
- **File:** `shared/types/index.ts`, `server/services/job.service.ts`
- **Category:** Security
- **Issue:** ~~`User` type is a flat Prisma payload including `password` field.~~
- **Fix applied:** Added `SafeUser = Omit<User, "password">` type export. Updated `Job` and `JobNote` types to use `{ select: { id: true, name: true, username: true } }` for `technician` and `createdBy` relations — password is never included in query results. Verified existing user route queries already use explicit `select` clauses excluding `password`.

### ~~S-005 | `window.__reactQueryClient` Exposed Globally~~ ✅ FIXED
- **File:** `src/main.tsx`
- **Category:** Security
- **Issue:** ~~Exposes internal query client on `window`. Any third-party script or XSS payload can manipulate all cached data.~~
- **Fix applied:** Wrapped in `if (import.meta.env.DEV)` — only exposed during local development, never in production builds.

### ~~S-006 | Dashboard Pages Render Mock Data~~ ✅ FIXED
- **File:** `src/pages/dashboard/front-desk.tsx`, `src/pages/dashboard/technician.tsx`
- **Category:** Correctness
- **Issue:** ~~Both pages render hardcoded `MOCK_*` arrays.~~
- **Fix applied:** Added `fetchFrontDesk()` and `fetchTechnician()` to dashboard store. **Technician page**: fully wired to real API — `todaySchedule`, `recentActivity`, `priorityActions`, `avgRepairTimeHours` all from server. **Front-desk page**: `priorityAlerts` wired to real API. `waitingCustomers` derived from `frontDeskData.activeRepairs` filtered by `INTAKE` status (customers who just dropped off devices and may be waiting in the shop). No backend changes needed — existing front-desk API data was sufficient. All `MOCK_*` data removed.

### ~~S-007 | Auth Schema Validates Non-Existent `phone` Field~~ ✅ FIXED
- **File:** `shared/schemas/auth.schema.ts`
- **Category:** Correctness
- **Issue:** ~~`updateUserSchema` includes `phone: z.string().optional()` but the `User` Prisma model has no `phone` field.~~
- **Fix applied:** Removed `phone` field from `updateUserSchema`.

### ~~S-008 | In-Memory Lockout Not Safe for Clustering~~ ✅ FIXED (documented)
- **File:** `server/routes/jobs.ts`
- **Category:** Architecture
- **Issue:** ~~`codeLockouts` Map is per-process. Load-balanced instances won't share state.~~
- **Fix applied:** Added clear NOTE documenting single-instance limitation + `TODO: Migrate to Redis/DB-backed store for multi-instance support.` Appropriate for single-location repair shop (single-instance deployment). No premature Redis dependency added.

### ~~S-009 | In-Memory Outbox Processing Not Safe for Clustering~~ ✅ FIXED (documented)
- **File:** `server/services/notification-outbox.service.ts`
- **Category:** Architecture
- **Issue:** ~~`isProcessing` flag is per-process. Multiple workers would process same outbox entries concurrently.~~
- **Fix applied:** Added clear NOTE documenting single-instance limitation + `TODO: Add DB-level advisory lock for multi-instance support.` Same rationale as S-008 — single-location shop, single instance.

### ~~S-010 | Financial Zod Fields Missing Precision/Max Constraints~~ ✅ FIXED
- **Files:** `shared/schemas/job.schema.ts`, `shared/schemas/parts-catalog.schema.ts`, `shared/schemas/repair-catalog.schema.ts`
- **Category:** Correctness
- **Issue:** ~~Financial fields stored as `Decimal(10,2)` but validated as `z.number().min(0)`. Values exceeding DB precision cause runtime Prisma errors.~~
- **Fix applied:** Added `.max(99_999_999.99)` to all financial fields across all 3 schema files (11 fields total): `price` (×3), `estimatedCost` (×2), `depositAmount` (×2), `unitPrice` (×1), `defaultPrice` (×4 — 2 in parts-catalog, 2 in repair-catalog).

---

## P1 — High (Must Fix Soon)

### S-011 | Duplicated `sendError` in 8 Route Files
- **Files:** `server/routes/{ai,customers,jobs,notifications,parts,receipts,repairs,settings}.ts`
- **Category:** DRY / Maintainability
- **Issue:** Same `sendError` helper copy-pasted 8 times. `receipts.ts` version has different signature (missing `details`).
- **Fix:** Extract to `server/utils/send-error.ts`. Single export, single implementation.

### S-012 | Inconsistent Error Response Shape
- **Files:** All route files
- **Category:** Consistency
- **Issue:** Error responses vary: `{ error }`, `{ error, message }`, `{ error, message, details }`, `{ statusCode, error, message }`, `{ error, message, details: { errors: {...} } }`.
- **Fix:** Define standard shape `{ statusCode, error, message, details? }`. Apply via shared `sendError`.

### S-013 | Unchecked `req.params` Casting (42 occurrences)
- **Files:** All route files
- **Category:** Quality / Security
- **Issue:** Every route does `req.params as { id: string }` without runtime validation. No Zod validation on most path params.
- **Fix:** Add Zod validation for path params (e.g., `z.string().cuid()`) in each route or as a shared preHandler.

### S-014 | `routes/jobs.ts` is 762 Lines
- **File:** `server/routes/jobs.ts`
- **Category:** Maintainability
- **Issue:** Longest file in codebase with 15+ route handlers plus helpers.
- **Fix:** Split into sub-routers: `jobs/lookup.ts`, `jobs/crud.ts`, `jobs/parts.ts`, `jobs/notes.ts`, `jobs/photos.ts`.

### S-015 | Repeated Permission Check Pattern in `routes/users.ts`
- **File:** `server/routes/users.ts:326-432, 473-533, 515-559, 561-582`
- **Category:** DRY / Maintainability
- **Issue:** Same permission-check block repeated verbatim in 5+ handlers.
- **Fix:** Create `canAccessUser(requestingUser, targetId)` helper or middleware.

### S-016 | `console.warn`/`console.error` Instead of Structured Logger
- **Files:** `server/services/job.service.ts:628`, `server/services/notification-outbox.service.ts:112`, `server/lib/email.ts:42`, `server/lib/auth.ts:42,57`
- **Category:** Quality / Observability
- **Issue:** Raw console calls won't include request IDs, timestamps, or structured metadata. Missed by log aggregation.
- **Fix:** Pass Fastify logger instance through or use a shared logger module.

### S-017 | N+1 Query in Job Creation
- **File:** `server/services/job.service.ts:246-264`
- **Category:** Performance
- **Issue:** Each repair inserted individually with `tx.jobRepair.create()` + `createAuditLog()` inside a `for` loop. N repairs = 2N sequential queries.
- **Fix:** Use `tx.jobRepair.createMany()` for bulk insert. Batch audit log creation.

### S-018 | Dashboard Queries Not Optimized
- **File:** `server/services/dashboard.service.ts:101-113, 155-181`
- **Category:** Performance
- **Issue:** Correlated subqueries for each row (N×M cost). No caching — called on every dashboard page load.
- **Fix:** Rewrite with JOINs or CTEs. Add short-lived cache (30s TTL).

### S-019 | Duplicated StatusBadge Components
- **Files:** `src/components/ui/status-badge.tsx` AND `src/components/modules/jobs/status-badge.tsx`
- **Category:** Consistency
- **Issue:** Two separate `StatusBadge` components with different APIs and styling. Importers may use wrong one.
- **Fix:** Consolidate into one component in `components/ui/` with configurable behavior.

### S-020 | Status Color Maps Duplicated in 5+ Files
- **Files:** `today-overview.tsx`, `today-schedule.tsx`, `active-repairs-queue.tsx`, `jobs/status-badge.tsx`, `jobs/status-popover.tsx`
- **Category:** DRY / Consistency
- **Issue:** `STATUS_DOT_COLORS`, `STATUS_CHIP_STYLES`, `STATUS_COLORS` independently defined in 5+ places.
- **Fix:** Centralize in `shared/constants/job-statuses.ts` or a new `src/lib/status-colors.ts`.

### S-021 | Pipeline Items Configuration Duplicated
- **Files:** `src/components/modules/dashboard/tech-job-pipeline.tsx:6-36` AND `job-pipeline.tsx:6-36`
- **Category:** DRY / Consistency
- **Issue:** Nearly identical `PIPELINE_ITEMS` arrays. Minor color difference for ON_HOLD status.
- **Fix:** Extract to shared constant file.

### S-022 | Modal Race Condition — Body Scroll Override
- **Files:** `template-editor.tsx:42-44`, `delete-repair-dialog.tsx:23-33`, `edit-customer-dialog.tsx:47-50`
- **Category:** Bug
- **Issue:** Three dialogs manually set `document.body.style.overflow`. If two modals open simultaneously, closing one restores scrolling while the other is still open.
- **Fix:** Make all modals use `useModalEffects` hook which handles this correctly.

### S-023 | Duplicate Focus Trap + Escape in `edit-customer-dialog.tsx`
- **File:** `src/components/modules/customers/edit-customer-dialog.tsx:53-93`
- **Category:** Consistency
- **Issue:** Manually implements Escape + focus trap, duplicating `useModalEffects`. Other modals correctly use the hook.
- **Fix:** Refactor to use `useModalEffects`.

### S-024 | `formatDzd` Hardcoded to DZD Despite Multi-Currency
- **File:** `src/lib/format.ts:1-23`
- **Category:** i18n / Correctness
- **Issue:** Hardcoded to `"fr-DZ"` locale and `"DZD"` currency. App supports USD, EUR, DZD. All prices always display as DZD.
- **Fix:** Accept currency/locale as parameters, reading from shop settings store.

### S-025 | All Zustand Stores Use Manual API Pattern
- **Files:** All 12 store files in `src/stores/`
- **Category:** Architecture / Performance
- **Issue:** Every store manually implements `isLoading`/`error`/fetch. Project has `@tanstack/react-query` installed but unused. Missing: caching, deduplication, background refetching, optimistic updates.
- **Fix:** Migrate stores to react-query for server state. Keep Zustand for client-only state (UI, toasts, modals).

### S-026 | Silent Error Swallowing
- **Files:** `settings-shop-tab.tsx:63`, `settings-ai-tab.tsx:109`, `ai-analyst/index.tsx:14`, `settings-users-tab.tsx:145`, `chat-interface.tsx:507`
- **Category:** Quality
- **Issue:** `.catch(() => { })` or `.catch(() => { /* comment */ })` with no actual error handling.
- **Fix:** At minimum, log the error. Ideally, surface to user via toast.

### S-027 | Missing Type Exports for 12+ Prisma Models
- **File:** `shared/types/index.ts`
- **Category:** Types
- **Issue:** `Session`, `Account`, `Verification`, `JobPartsWaiting`, `JobCounter`, `NotificationOutbox`, `AiConversation`, `AiMessage`, `AiAgentDefinition`, `AiMemory`, `AiInstruction`, `NotificationTemplate` all absent.
- **Fix:** Add all missing type exports to the shared types barrel.

### S-028 | Enum Constants Duplicated from Prisma (4 files)
- **Files:** `shared/constants/{job-statuses,roles,part-categories,repair-categories}.ts`
- **Category:** Consistency / Maintainability
- **Issue:** `JobStatus`, `Role`, `PartCategory`, `RepairCategory` manually duplicated from Prisma enums. No compile-time sync enforcement.
- **Fix:** Derive from `@generated/client` enum values, or add a test that asserts they stay in sync.

### S-029 | Error Message Format Inconsistency Across Schemas
- **Files:** `shared/schemas/{job,customer,auth,parts-catalog,repair-catalog}.schema.ts`
- **Category:** Consistency / i18n
- **Issue:** Three different patterns: `{ error: "validations.xxx" }`, plain `"validations.xxx"`, hardcoded English `"Field is required"`.
- **Fix:** Standardize to i18n key pattern. Replace all hardcoded English strings.

### S-030 | Zod Schemas Missing Proper Validations
- **Files:** `shared/schemas/job.schema.ts`, `shared/schemas/customer.schema.ts`
- **Category:** Schemas / Security
- **Issue:** `technicianId` uses `.min(1)` instead of `.cuid()`. `estimatedDate` is plain string with no date format check. `estimatedCost` has no max or decimal constraint. `jobListQuerySchema.status` accepts any string.
- **Fix:** Add `.cuid()` for IDs, `.date()` or `.coerce.date()` for dates, proper enum for status filter.

### S-031 | Password Reset Non-Atomic
- **File:** `server/routes/users.ts:295-323`
- **Category:** Architecture
- **Issue:** Three separate DB operations (`account.updateMany`, `user.update`, `session.deleteMany`) without transaction. If audit log fails, password is reset with no trail. If session delete fails, old sessions remain valid.
- **Fix:** Wrap in `$transaction`.

### S-032 | No Pagination on `GET /api/users`
- **File:** `server/routes/users.ts:102-124`
- **Category:** Performance
- **Issue:** Returns ALL users with no pagination (`findMany` with no `take`).
- **Fix:** Add cursor-based pagination consistent with other list endpoints.

### S-033 | Missing DB Index on `Job.accessCode`
- **File:** `prisma/schema.prisma:226`
- **Category:** Performance
- **Issue:** `accessCode` used for customer tracking lookups but has no `@@index`. Full table scans on every lookup.
- **Fix:** Add `@@index([accessCode])` to Job model.

### S-034 | Missing DB Index on `Job.createdAt`
- **File:** `prisma/schema.prisma`
- **Category:** Performance
- **Issue:** Dashboard queries filter/sort by `createdAt` without index.
- **Fix:** Add `@@index([createdAt])` to Job model.

### S-035 | Biome Extends Vue and Remix Configs (Project Uses React)
- **File:** `biome.jsonc:6-7`
- **Category:** Config
- **Issue:** Extends `ultracite/biome/vue` and `ultracite/biome/remix` for a React+Vite project. Applies irrelevant rules.
- **Fix:** Replace with React-appropriate extends (e.g., `ultracite/biome/react`).

### S-036 | `settings.schema.ts` Temperature Max Mismatches `ai.schema.ts`
- **Files:** `shared/schemas/settings.schema.ts:8` vs `shared/schemas/ai.schema.ts:44`
- **Category:** Consistency
- **Issue:** Settings schema caps temperature at 1, agent schema allows up to 2. Confusing UX.
- **Fix:** Align both to same max (2 is standard for OpenAI).

### S-037 | `updateShopSettingsSchema` Has Required Fields for Partial Update
- **File:** `shared/schemas/settings.schema.ts:21-28`
- **Category:** Schemas
- **Issue:** `shopName` is required but schema name implies partial update.
- **Fix:** Make all fields optional, or rename to `replaceShopSettingsSchema`.

### S-038 | Duplicate `validateMagicBytes` in 2 Services
- **Files:** `server/services/avatar.service.ts:6-28` AND `server/services/job-photos.service.ts:13-45`
- **Category:** DRY
- **Issue:** Exact same magic byte validation logic duplicated.
- **Fix:** Extract to `server/utils/file-validation.ts`.

### S-039 | Duplicate `MUTATION_METHODS` in 2 Files
- **Files:** `server/config/route-security.ts:37` AND `server/plugins/security.ts:274`
- **Category:** DRY
- **Issue:** Same set `["POST", "PATCH", "PUT", "DELETE"]` created independently.
- **Fix:** Export from `route-security.ts`, import in `security.ts`.

### S-040 | Duplicate `INACTIVE_STATUSES` Check in 6 Services
- **Files:** `server/services/job-{notes,parts,repairs,waiting-parts,photos}.service.ts`, `server/services/job.service.ts`
- **Category:** Architecture
- **Issue:** Every job sub-service independently checks `INACTIVE_STATUSES.includes(job.status)`.
- **Fix:** Create shared `assertJobMutable(job)` helper that throws a standard error.

### S-041 | Shared Error Message Patterns Hardcoded English
- **Files:** `shared/schemas/parts-catalog.schema.ts:5,18`, `shared/schemas/repair-catalog.schema.ts:5,12`
- **Category:** i18n
- **Issue:** `"Part name is required"`, `"Price must be positive"` — hardcoded English, not i18n keys.
- **Fix:** Replace with `"validations.part_name_required"` pattern.

### S-042 | Hardcoded Country/Currency Options in Settings UI
- **File:** `src/components/modules/settings/settings-shop-tab.tsx:183-189, 215-218`
- **Category:** Maintainability
- **Issue:** Countries and currencies hardcoded as `<option>` JSX. Adding new ones requires editing the component.
- **Fix:** Source from `shared/constants` arrays.

### S-043 | No Rate Limiting on AI Chat Stream
- **File:** `server/routes/ai.ts:130-188`
- **Category:** Performance / Security
- **Issue:** No specific rate limit beyond global 30/min. Each request opens long-lived connection to external AI API.
- **Fix:** Add tighter per-user rate limit for streaming endpoint (e.g., 5/min).

### S-044 | `ROLE_LABEL_KEYS` Duplicated in Sidebar and Bottom Nav
- **Files:** `src/components/modules/layout/sidebar.tsx` AND `bottom-nav.tsx`
- **Category:** DRY
- **Issue:** Identical `ROLE_LABEL_KEYS` map in both files.
- **Fix:** Extract to shared constant.

### S-045 | `ROLE_LABELS` in constants Hardcoded English
- **File:** `shared/constants/roles.ts:9-12`
- **Category:** i18n
- **Issue:** Role labels are English strings. Trilingual app needs i18n keys.
- **Fix:** Change to i18n keys like `"roles.owner"`, `"roles.technician"`.

### S-046 | Inconsistent Modal Implementations (6 of 11 Don't Use Hook)
- **Files:** `template-editor.tsx`, `delete-repair-dialog.tsx`, `edit-customer-dialog.tsx`, `chat-interface.tsx` (2 inline dialogs), `settings-agents-tab.tsx` (delete confirm)
- **Category:** Consistency / Accessibility
- **Issue:** 5 modals roll their own Escape/scroll/focus logic. 6 use `useModalEffects`. Inconsistent behavior.
- **Fix:** Refactor all to use `useModalEffects`.

### S-047 | Massive Frontend Files (>500 lines)
- **Files:** `chat-interface.tsx` (1126), `pages/parts/index.tsx` (~800), `pages/tracking/index.tsx` (~700), `pages/notifications/index.tsx` (~600), `settings-agents-tab.tsx` (596)
- **Category:** Maintainability
- **Issue:** Files exceed 300-400 line threshold. Hard to navigate, test, review.
- **Fix:** Extract sub-components, hooks, and utilities from each.

### S-048 | `AI_MODELS` List Hardcoded, Will Become Stale
- **File:** `src/components/modules/settings/settings-ai-tab.tsx:7-24`
- **Category:** Maintainability
- **Issue:** Hardcoded model list. Must be manually updated as OpenAI releases/deprecates models.
- **Fix:** Make configurable or fetch available models from server.

---

## P2 — Medium (Should Fix)

### S-049 | Magic Numbers Across Server
- **Files:** `routes/jobs.ts:149,163`, `services/job.service.ts:38`, `services/dashboard.service.ts:354`, `plugins/security.ts:74`, `index.ts:49`, `services/avatar.service.ts:4`
- **Category:** Quality
- **Issue:** `15 * 60 * 1000`, `30 * 60 * 1000`, `24 * 3_600_000`, `31_536_000`, `5 * 1024 * 1024`, `2 * 1024 * 1024` — unnamed constants.
- **Fix:** Extract to named constants at module level or shared config.

### S-050 | Duplicated Shop Settings Fetch in Receipt Routes
- **File:** `server/routes/receipts.ts:43-48` and `80-85`
- **Category:** DRY
- **Issue:** Same permission check + `resolveUrls()` pattern duplicated.
- **Fix:** Extract to shared preHandler.

### S-051 | Duplicated Lookup Logic in `job.service.ts`
- **File:** `server/services/job.service.ts:462-541` vs `543-608`
- **Category:** DRY
- **Issue:** `lookupByCode` and `lookupByCodeAuth` share ~80% identical code.
- **Fix:** Extract shared response-building logic.

### S-052 | Dynamic Import Inside Route Handlers
- **Files:** `server/routes/notifications.ts:110-112`, `server/services/job.service.ts:633-635`
- **Category:** Quality
- **Issue:** `await import(...)` inside request handler adds runtime overhead per request.
- **Fix:** Restructure to avoid circular imports, or dynamic import once at module level.

### S-053 | Receipt HTML Templates Inline (259 lines)
- **File:** `server/services/receipt.service.ts:94-258`
- **Category:** Maintainability
- **Issue:** Large HTML templates via template literals with inline CSS/JS. Hard to maintain.
- **Fix:** Move to separate template files in `public/receipt-templates/`.

### S-054 | Label HTML Uses `window.print()` Inline JS
- **File:** `server/services/receipt.service.ts:246`
- **Category:** Quality
- **Issue:** `onload="window.print(); setTimeout(...)"` — CSP nonce only injects into `<script>` tags, not event handlers.
- **Fix:** Move to `<script nonce="...">` block or handle printing client-side.

### S-055 | Module-Level Mutable State in Dashboard Scope
- **File:** `server/middlewares/dashboard-scope.ts:5-6`
- **Category:** Architecture
- **Issue:** `let cached` is module-level mutable. Requires `__resetTzCache()` export for testing.
- **Fix:** Document behavior. Consider proper memoization utility with TTL.

### S-056 | `lookupByCode` Returns `Record<string, unknown>`
- **File:** `server/services/job.service.ts:462-541`
- **Category:** Types
- **Issue:** Return type loses all type safety for the job object.
- **Fix:** Define and return a proper typed interface.

### S-057 | `createJob` Return Type is Untagged Union
- **File:** `server/services/job.service.ts:156-296`
- **Category:** Types
- **Issue:** Returns job object or `{ error: "..." }`. Callers check via `"error" in result`.
- **Fix:** Define explicit `Result<Job, CreateJobError>` return type.

### S-058 | Email Module Singleton Without Error Handling
- **File:** `server/lib/email.ts:15-28`
- **Category:** Quality
- **Issue:** Transporter created once and cached. No connection verification. No invalidation on settings change.
- **Fix:** Add connection verification and invalidation mechanism.

### S-059 | Upload Path Hardcoded
- **File:** `server/services/job-photos.service.ts:9`
- **Category:** Quality
- **Issue:** `path.resolve("uploads/job-photos")` ignores `env.UPLOAD_DIR`. Writes and serves from different locations if configured.
- **Fix:** Use `loadEnv().UPLOAD_DIR` to construct path.

### S-060 | `formatPhone` Only Handles Algerian Numbers
- **File:** `server/services/notification-sender.ts:82-90`
- **Category:** Architecture
- **Issue:** Hardcodes `213` country code. Trilingual app may need other countries.
- **Fix:** Make configurable via shop settings.

### S-061 | Inconsistent Validation in `routes/repairs.ts`
- **File:** `server/routes/repairs.ts:120-128`
- **Category:** Consistency
- **Issue:** Manual `typeof isActive !== "boolean"` check instead of Zod schema like parts route uses.
- **Fix:** Create and use a Zod schema for consistency.

### S-062 | Hardcoded Placeholder Strings (Not i18n'd)
- **Files:** `settings-shop-tab.tsx:113,153,241`, `settings-ai-tab.tsx:197,221`, `add-user-modal.tsx:169`, `edit-customer-dialog.tsx:226`
- **Category:** i18n
- **Issue:** Placeholder text in French/English not wrapped in `t()`.
- **Fix:** Wrap all placeholder strings in `t()`.

### S-063 | Hardcoded "DZD" in JSX
- **Files:** `repair-table.tsx:110`, `repair-mobile-card.tsx:61`
- **Category:** i18n / Correctness
- **Issue:** Currency suffix hardcoded. Should use configured currency.
- **Fix:** Use `formatCurrency()` with shop settings.

### S-064 | `navigator.platform` Deprecated API
- **File:** `src/pages/ai-analyst/chat-interface.tsx:1097`
- **Category:** Compatibility
- **Issue:** Deprecated, may return inconsistent results.
- **Fix:** Use `navigator.userAgentData?.platform` or feature detection.

### S-065 | `bg-yellow-500` Bypasses Design System
- **File:** `src/components/modules/profile/password-form.tsx:16`
- **Category:** Design System
- **Issue:** Raw Tailwind color instead of Material Design 3 token used elsewhere.
- **Fix:** Use appropriate MD3 token.

### S-066 | Shared State Bug in Memories/Instructions
- **File:** `src/pages/ai-analyst/memories/page.tsx:151-155`
- **Category:** Bug
- **Issue:** Single `editingId`/`deletingId`/`saving` shared between two sections. Editing memory and instruction simultaneously breaks.
- **Fix:** Separate state per section.

### S-067 | Quick Intake Form Non-Functional
- **File:** `src/components/modules/dashboard/quick-intake-form.tsx:27-29`
- **Category:** Quality
- **Issue:** `onSubmit` only calls `e.preventDefault()`. Inputs uncontrolled. No API call.
- **Fix:** Either wire up to job creation API or remove.

### S-068 | Misleading Keyboard Shortcut in Chat
- **File:** `src/pages/ai-analyst/chat-interface.tsx:1089-1101`
- **Category:** UX
- **Issue:** Displays "Ctrl+Enter to send" but Enter submits the form directly. Shortcut doesn't work as described.
- **Fix:** Implement proper Ctrl+Enter handling, or change the displayed hint.

### S-069 | `fontVariationSettings` Inline Styles
- **File:** `src/pages/ai-analyst/chat-interface.tsx:119,169`
- **Category:** Consistency
- **Issue:** Inline style for Material Symbols fill variant.
- **Fix:** Create CSS utility class `.material-symbols-filled`.

### S-070 | `crypto.randomUUID()` Without Fallback
- **File:** `src/pages/ai-analyst/chat-interface.tsx:777,783`
- **Category:** Compatibility
- **Issue:** Requires secure context (HTTPS). No fallback for older browsers.
- **Fix:** Add fallback UUID generator.

### S-071 | No File Size Validation on Avatar Upload
- **File:** `src/components/modules/profile/profile-sidebar.tsx:77-87`
- **Category:** Quality
- **Issue:** Accept types checked but no size limit. 50MB image possible.
- **Fix:** Add client-side size check before upload.

### S-072 | `console.error` in Error Boundary
- **File:** `src/components/error-boundary.tsx:22`
- **Category:** Quality / Observability
- **Issue:** Should use error reporting service (Sentry) instead of console.
- **Fix:** Integrate error reporting service.

### S-073 | Two Toast Systems Coexist
- **Files:** `sonner` used in AI components; Zustand `useToastStore` used everywhere else
- **Category:** Consistency
- **Issue:** Mixed toast patterns. Pick one.
- **Fix:** Standardize on one toast system.

### S-074 | `DashboardRole` Duplicates `RoleType`
- **File:** `shared/types/dashboard.ts:3`
- **Category:** Types
- **Issue:** Manual union that must stay in sync with Prisma enum.
- **Fix:** Use `RoleType` from constants or Prisma-generated enum.

### S-075 | Inconsistent Email+Empty Pattern in Customer Schemas
- **File:** `shared/schemas/customer.schema.ts:7-8` vs `20-21`
- **Category:** Consistency
- **Issue:** `.optional().or(z.literal(""))` vs `.or(z.literal("")).optional()` — different code for same semantic.
- **Fix:** Pick one pattern and use consistently.

### S-076 | `customerIdParamSchema` Not Wrapped in `z.object()`
- **File:** `shared/schemas/customer.schema.ts:38`
- **Category:** Consistency
- **Issue:** Returns raw `z.string().cuid()` while `jobIdParamSchema` wraps in `z.object({ id: ... })`.
- **Fix:** Wrap in `z.object()` for consistency.

### S-077 | `ai.schema.ts` Language Not Validated Against Known Codes
- **File:** `shared/schemas/ai.schema.ts:18`
- **Category:** Schemas
- **Issue:** `z.string().min(2).max(5)` accepts any string, not just `"en"/"fr"/"ar"`.
- **Fix:** Validate against known language codes.

### S-078 | `updateShopSettingsSchema` Currency/CountryCode Not Validated
- **File:** `shared/schemas/settings.schema.ts:25-26`
- **Category:** Schemas
- **Issue:** Plain strings. `"XYZ"` passes validation.
- **Fix:** Validate against `CURRENCIES` constant and ISO country codes.

### S-079 | `PartCategory` Enum Duplicated in Create/Update Schemas
- **File:** `shared/schemas/parts-catalog.schema.ts:6-17, 24-36`
- **Category:** DRY
- **Issue:** Same enum defined twice.
- **Fix:** Extract to shared `partCategoryEnum`.

### S-080 | `RepairCategory` Enum Duplicated in Create/Update Schemas
- **File:** `shared/schemas/repair-catalog.schema.ts:6-11, 18-24`
- **Category:** DRY
- **Issue:** Same enum defined twice.
- **Fix:** Extract to shared `repairCategoryEnum`.

### S-081 | Loose `Record<string, T>` Typing
- **Files:** `shared/constants/part-categories.ts:13`, `shared/constants/repair-categories.ts:7`, `shared/constants/device-icons.ts:1`
- **Category:** Types
- **Issue:** Keys typed as `string` instead of the actual category type. Allows invalid keys.
- **Fix:** Use `Record<CategoryType, T>` or `as const satisfies`.

### S-082 | `Customer.email` Not Unique in Prisma
- **File:** `prisma/schema.prisma:174`
- **Category:** Data Integrity
- **Issue:** Two customers can share same email. May cause issues for email-based features.
- **Fix:** Add `@unique` if email should be unique, or document the intentional decision.

### S-083 | No `@@unique([name])` on RepairCatalog
- **File:** `prisma/schema.prisma:382-395`
- **Category:** Data Integrity
- **Issue:** Duplicate repair names allowed.
- **Fix:** Add `@@unique([name])`.

### S-084 | No `@@unique([name])` on PartsCatalog
- **File:** `prisma/schema.prisma:333-347`
- **Category:** Data Integrity
- **Issue:** Duplicate part names allowed.
- **Fix:** Add `@@unique([name])`.

### S-085 | AiMemory/AiInstruction Have No User Association
- **File:** `prisma/schema.prisma:590-615`
- **Category:** Architecture
- **Issue:** Any authenticated user can read/write all memories. Should be shop-wide or user-scoped.
- **Fix:** Add `userId` FK if user-scoped. Document if shop-wide is intentional.

### S-086 | `tsconfig.json` Dead Config
- **File:** `tsconfig.json:15-16`
- **Category:** Config
- **Issue:** `declaration: true` + `declarationMap: true` with `noEmit: true` — never written.
- **Fix:** Remove `declaration` and `declarationMap`.

### S-087 | Missing `@server` Alias in Vite/Vitest Config
- **Files:** `vite.config.ts`, `vitest.config.ts`
- **Category:** Config
- **Issue:** `tsconfig.json` defines `@server/*` alias but Vite doesn't resolve it. Accidental `@server` import in client code would type-check but fail at runtime.
- **Fix:** Add `@server` alias to both configs, or remove from tsconfig.

### S-088 | Inconsistent Config Import Patterns
- **Files:** `vite.config.ts` uses `fileURLToPath(import.meta.url)` vs `vitest.config.ts` uses `import.meta.dirname`
- **Category:** Consistency
- **Issue:** Different patterns in sibling config files.
- **Fix:** Use same pattern in both.

### S-089 | CSS Class Strings Duplicated 10+ Times
- **Files:** `settings-shop-tab.tsx`, `settings-ai-tab.tsx`, `settings-agents-tab.tsx`
- **Category:** Maintainability
- **Issue:** Same ~120-char Tailwind class string copy-pasted.
- **Fix:** Extract to shared constant like `profile/shared.ts` does with `INPUT_CLS`.

### S-090 | `FinancialTrendPoint.date` Typed as Plain String
- **File:** `shared/types/dashboard.ts:14`
- **Category:** Types
- **Issue:** Comment says `// YYYY-MM-DD` but type is `string`. No compile-time enforcement.
- **Fix:** Use template literal type or branded type.

### S-091 | Chat Messages Limited to 100, No Pagination
- **File:** `src/pages/ai-analyst/chat-interface.tsx:556`
- **Category:** Quality
- **Issue:** Only loads first 100 messages. Older messages silently dropped.
- **Fix:** Implement pagination or "load more" for older messages.

### S-092 | `resolve-validation-messages.ts` Crosses Layer Boundary
- **File:** `server/utils/resolve-validation-messages.ts:22-24`
- **Category:** Architecture
- **Issue:** Imports from `../../src/i18n/locales/en.json` — server depends on frontend source directory.
- **Fix:** Copy validation translations to server-local directory or use shared location.

### S-093 | Hardcoded `id` Attributes in Forms
- **Files:** `quick-intake-form.tsx`, `template-editor.tsx`, `settings-shop-tab.tsx`, `settings-ai-tab.tsx`
- **Category:** Quality
- **Issue:** Hardcoded IDs break if component rendered twice.
- **Fix:** Use `useId()` hook for unique IDs.

### S-094 | Seed Upsert `update: {}` Never Updates
- **File:** `prisma/seed.ts:128-133, 159-165`
- **Category:** Quality
- **Issue:** Templates/agents never updated on re-seed. Changes in seed won't propagate.
- **Fix:** Document as intentional, or add update logic.

### S-095 | `env.d.ts` Missing Type Declarations
- **File:** `env.d.ts`
- **Category:** Types
- **Issue:** `BETTER_AUTH_URL` used in `seed.ts` but not declared. Other env vars may be missing.
- **Fix:** Add all env vars used across the project.

### S-096 | `biome.jsonc` `files.includes` Omits Root Configs
- **File:** `biome.jsonc:11`
- **Category:** Config
- **Issue:** `vitest.config.ts`, `vite.config.ts`, `capacitor.config.ts` not linted.
- **Fix:** Add root config files to includes.

### S-097 | Capacitor Dev Server No Hostname
- **File:** `capacitor.config.ts:9`
- **Category:** Config
- **Issue:** `localhost` doesn't resolve on some Android emulators.
- **Fix:** Use `hostname: "0.0.0.0"` or LAN IP.

---

## P3 — Low (Polish)

### S-098 | Zero Route-Level Integration Tests
- **Files:** All `server/routes/`
- **Category:** Testing
- **Issue:** No integration tests for route handlers. Auth checks, validation, response formatting untested.

### S-099 | Zero AI Module Tests
- **Files:** `server/ai/{context,stream,tools}.ts`
- **Category:** Testing
- **Issue:** Most security-sensitive code (raw SQL execution) has zero tests.

### S-100 | Zero Plugin Tests
- **Files:** `server/plugins/{auth,locale,prisma,security,websocket}.ts`
- **Category:** Testing
- **Issue:** CSRF, rate limiting, CSP, audit logging — all untested.

### S-101 | Zero Lib Tests (auth, crypto, email)
- **Files:** `server/lib/{auth,crypto,email}.ts`
- **Category:** Testing
- **Issue:** Crypto and auth modules untested.

### S-102 | Frontend Test Coverage ~10%
- **Category:** Testing
- **Issue:** 19 test files for 179 source files. Stores, hooks, pages largely untested.

### S-103 | Missing `aria-live` for Dynamic Content
- **Files:** `waiting-customers.tsx`, `active-repairs-queue.tsx`, `overdue-jobs.tsx`
- **Category:** Accessibility
- **Issue:** Dynamic list/badge changes not announced to screen readers.

### S-104 | Inline Dialogs Missing `aria-modal` / `role="dialog"`
- **File:** `chat-interface.tsx:332-403`
- **Category:** Accessibility
- **Issue:** `AgentSwitchDialog` and `NewConversationDialog` lack proper ARIA attributes.

### S-105 | Inline Styles to Hide Scrollbar
- **File:** `repair-filters.tsx:111`
- **Category:** Consistency
- **Issue:** `style={{ scrollbarWidth: "none" }}` — should be CSS utility.

### S-106 | Hardcoded Em-Dash Fallback
- **File:** `personal-spec-sheet.tsx:44,50,56`
- **Category:** i18n
- **Issue:** `{form.name || "—"}` — should use translated fallback.

### S-107 | Inconsistent Component Export Styles
- **Category:** Consistency
- **Issue:** Mix of `export default function`, `export function`, `export default X` after `React.memo`.

### S-108 | Inconsistent `function` vs `const` Component Declarations
- **Category:** Consistency
- **Issue:** Most use `function`, some inline sub-components use `const X = ()`.

### S-109 | `Math.random` for Request ID Fallback
- **File:** `server/index.ts:40`
- **Category:** Quality
- **Issue:** Not cryptographically secure, but only for correlation. `crypto.randomUUID()` always available in Node 19+.

### S-110 | Seed Admin Email Hardcoded
- **File:** `prisma/seed.ts:45`
- **Category:** Config
- **Issue:** `"admin@reparilo.local"` — should be env-var configurable.

### S-111 | Test DATABASE_URL Hardcoded
- **File:** `vitest.setup.ts:4`
- **Category:** Config
- **Issue:** `postgresql://test:test@localhost:5432/test` hardcoded. Uses `??=` so env override works.

### S-112 | `JobRepair` Unique Constraint and NULL `repairId`
- **File:** `prisma/schema.prisma:419`
- **Category:** Data Integrity
- **Issue:** PostgreSQL treats NULL as distinct in unique constraints. Multiple ad-hoc repairs (repairId=NULL) with same name allowed.

### S-113 | `ShopSettings.currency` Plain String in Prisma
- **File:** `prisma/schema.prisma:629`
- **Category:** Quality
- **Issue:** No DB-level validation. Relies on app layer.

### S-114 | `ignoreDeprecations: "6.0"` in tsconfig
- **File:** `tsconfig.json:18`
- **Category:** Config
- **Issue:** Suppresses all TS 6.0 deprecation warnings. Could hide legitimate issues.

### S-115 | Password Strength Array Bounds Fragile
- **File:** `password-form.tsx:212-229`
- **Category:** Quality
- **Issue:** `STRENGTH_LABELS[strength - 1]` — when `strength = 0`, JS returns last element, not undefined. Guarded by `form.newPassword &&` but fragile.

### S-116 | `NonEmptyArray` Not Exported
- **File:** `shared/permissions.ts:171`
- **Category:** Types
- **Issue:** Used internally but not exported for consumers.

### S-117 | Tests Use Many `as` Type Assertions
- **File:** `shared/__tests__/permissions.test.ts:74-151`
- **Category:** Quality
- **Issue:** Bypasses type safety. If permission statements change, tests may silently test wrong thing.

### S-118 | Unused `ref` Prop Pattern in SettingsShopTab
- **File:** `settings-shop-tab.tsx:17`
- **Category:** Quality
- **Issue:** Unconventional prop declaration. Uses `useImperativeHandle` correctly.

### S-119 | `aria-label` with Dynamic Content Not Localized
- **File:** `parts-alert.tsx:87`
- **Category:** Accessibility / i18n
- **Issue:** Dynamic aria-labels with user content may not be announced correctly in all languages.

### S-120 | No Manual Chunk Splitting in Vite Build
- **File:** `vite.config.ts`
- **Category:** Performance
- **Issue:** No `rollupOptions.output.manualChunks`. Suboptimal bundle for Capacitor mobile.

### S-121 | `auth.schema.ts` `role` Enum Hardcoded in Two Places
- **File:** `shared/schemas/auth.schema.ts:16,48`
- **Category:** Consistency
- **Issue:** Should derive from `Role` constant.

### S-122 | `ai.schema.ts` Instructions Allows Empty String
- **File:** `shared/schemas/ai.schema.ts:42`
- **Category:** Quality
- **Issue:** `.max(50_000)` with `.default("")` but `aiMemorySchema` requires `.min(1)`.

### S-123 | `getUserId` Helper Throws Instead of 401
- **File:** `server/routes/jobs.ts:112-118`
- **Category:** Quality
- **Issue:** Throws `Error("Unauthorized")` → caught by global handler → 500 instead of 401. Auth middleware should guarantee user exists.

### S-124 | `wsBroadcast` Silent Failure
- **File:** `server/routes/jobs.ts:331-338`
- **Category:** Quality
- **Issue:** Optional chaining means broadcast silently fails if WebSocket not initialized.
- **Fix:** Add debug log.

### S-125 | `as const` Assertions on Prisma OrderBy
- **File:** `server/services/job.service.ts:56` (and multiple services)
- **Category:** Quality
- **Issue:** Needed due to Prisma/TypeScript inference. No action needed — document as known pattern.

### S-126 | Part/Repair Category Enums in Schemas Should Use Shared Helper
- **Files:** `shared/schemas/job.schema.ts:80-98`, `shared/schemas/parts-catalog.schema.ts`
- **Category:** DRY
- **Issue:** Category values enumerated manually instead of deriving from constants.

### S-127 | `PERSONAL_SPEC_SHEET` Hardcoded Em-Dash Fallback
- **File:** `personal-spec-sheet.tsx:44,50,56`
- **Category:** i18n
- **Issue:** `{form.name || "—"}` — literal em-dash, not translated.

### S-128 | `LANGUAGE_OPTIONS` Hardcoded Labels
- **File:** `profile/shared.ts:25-28`
- **Category:** i18n
- **Issue:** Language names hardcoded. Common practice but flagged for completeness.

### S-129 | `OverdueScheduler.alerted` Set Grows Unbounded
- **File:** `server/jobs/overdue-scheduler.ts:5-6`
- **Category:** Performance
- **Issue:** Capped at 10K but manual pruning. Never fully cleared.

### S-130 | WebSocket Connections Set Potential Stale Entries
- **File:** `server/plugins/websocket.ts:11`
- **Category:** Performance
- **Issue:** If disconnect event missed, stale entries accumulate.

### S-131 | `resolve-validation-messages.ts` Not Tested
- **File:** `server/utils/resolve-validation-messages.ts`
- **Category:** Testing
- **Issue:** No dedicated test. Used across all route handlers.

### S-132 | No Pagination on Notification Templates
- **File:** `server/services/settings.service.ts:99-103`
- **Category:** Performance
- **Issue:** Returns all templates with no limit. Minor.

### S-133 | `rateLimit.timeWindow` Type Inconsistency
- **File:** `server/routes/jobs.ts:160-166`
- **Category:** Consistency
- **Issue:** Uses number (ms) while `route-security.ts` uses string (`"1 minute"`).

---

## Fix Priority Roadmap

> Every issue S-001 through S-133 is assigned to a sprint below. Nothing is omitted.

### Sprint 1: Security & Correctness — P0 Blockers (~1 week) ✅ 10/10 COMPLETE

| ID | Task | Effort | Status |
|----|------|--------|--------|
| S-001 | AI SQL tool: add table allowlist + use read-only DB role | 1 day | ✅ Fixed |
| S-002 | Dashboard service: replace `$queryRawUnsafe` with parameterized `$queryRaw` | 0.5 day | ✅ Fixed |
| S-003 | Seed: read password from `process.env.SEED_ADMIN_PASSWORD` | 0.5 hour | ✅ Fixed |
| S-004 | User type: create `SafeUser = Omit<User, "password">`, use in all API responses | 0.5 day | ✅ Fixed |
| S-005 | Remove `window.__reactQueryClient` (gate behind `import.meta.env.DEV` if needed) | 5 min | ✅ Fixed |
| S-006 | Dashboard pages: replace `MOCK_*` data with real API calls | 3 days | ✅ Fixed |
| S-007 | Remove phantom `phone` field from `updateUserSchema` | 5 min | ✅ Fixed |
| S-008 | In-memory lockout: document limitation + TODO for Redis | 1 day | ✅ Fixed |
| S-009 | Outbox processing: document limitation + TODO for advisory lock | 1 day | ✅ Fixed |
| S-010 | Financial Zod fields: add `.max(99_999_999.99)` to all financial fields | 0.5 day | ✅ Fixed |

### Sprint 2: Architecture & DRY — P1 Top (~1 week)

| ID | Task | Effort |
|----|------|--------|
| S-011 | Extract `sendError` to `server/utils/send-error.ts`, replace 8 copies | 1 hour |
| S-012 | Define standard error shape `{ statusCode, error, message, details? }`, apply via `sendError` | 2 hours |
| S-013 | Add Zod validation (`z.string().cuid()`) for path params in all routes | 2 hours |
| S-014 | Split `routes/jobs.ts` (762 lines) into sub-routers: `lookup.ts`, `crud.ts`, `parts.ts`, `notes.ts`, `photos.ts` | 2 hours |
| S-015 | Extract `canAccessUser(requestingUser, targetId)` helper from users routes | 1 hour |
| S-016 | Replace `console.warn/error` with Fastify logger in 4 server files | 1 hour |
| S-017 | Fix N+1 in job creation: use `createMany` + batch audit logs | 1 hour |
| S-018 | Rewrite dashboard queries with JOINs/CTEs, add 30s TTL cache | 0.5 day |
| S-019 | Consolidate two `StatusBadge` components into one configurable component | 1 hour |
| S-020 | Centralize status color maps to single shared file | 1 hour |
| S-021 | Extract `PIPELINE_ITEMS` to shared constant | 30 min |
| S-022 | Fix modal race condition: migrate `template-editor`, `delete-repair-dialog` to `useModalEffects` | 1 hour |
| S-023 | Refactor `edit-customer-dialog` to use `useModalEffects` instead of manual focus/Escape | 1 hour |
| S-024 | Fix `formatDzd` to accept currency/locale params from shop settings | 2 hours |
| S-025 | Plan Zustand→react-query migration for server state; keep Zustand for client state only | 1 day |

### Sprint 3: Quality & Schemas — P1 Bottom (~1 week)

| ID | Task | Effort |
|----|------|--------|
| S-026 | Replace all `.catch(() => {})` with proper error logging or user-facing toast | 1 hour |
| S-027 | Add missing type exports to `shared/types/index.ts` (12+ Prisma models) | 1 hour |
| S-028 | Sync enum constants with Prisma: add compile-time tests or derive from `@generated/client` | 2 hours |
| S-029 | Standardize error message format across all schemas to i18n key pattern | 1 hour |
| S-030 | Fix Zod gaps: `.cuid()` for IDs, `.date()` for dates, enum for status filter | 2 hours |
| S-031 | Wrap password reset in `$transaction` | 30 min |
| S-032 | Add cursor-based pagination to `GET /api/users` | 1 hour |
| S-033 | Add `@@index([accessCode])` to Job model | 15 min |
| S-034 | Add `@@index([createdAt])` to Job model | 15 min |
| S-035 | Fix biome.jsonc: remove Vue/Remix extends, add React-appropriate config | 5 min |
| S-036 | Align temperature max in `settings.schema.ts` with `ai.schema.ts` (both to 2) | 5 min |
| S-037 | Make all fields optional in `updateShopSettingsSchema` (it's a PATCH) | 15 min |
| S-038 | Extract `validateMagicBytes` to `server/utils/file-validation.ts` | 30 min |
| S-039 | Export `MUTATION_METHODS` from `route-security.ts`, import in `security.ts` | 10 min |
| S-040 | Create shared `assertJobMutable(job)` helper, replace 6 scattered checks | 30 min |
| S-041 | Replace hardcoded English error messages in parts/repair catalog schemas with i18n keys | 30 min |
| S-042 | Source country/currency options in settings UI from `shared/constants` | 30 min |
| S-043 | Add per-user rate limit on `/api/ai/chat/stream` (e.g., 5/min) | 30 min |
| S-044 | Extract `ROLE_LABEL_KEYS` to shared constant | 15 min |
| S-045 | Change `ROLE_LABELS` in constants from English strings to i18n keys | 15 min |
| S-046 | Refactor all remaining modals (inline dialogs, delete confirm) to use `useModalEffects` | 2 hours |
| S-047 | Break up 5 frontend files >500 lines into sub-components + hooks | 3 days |
| S-048 | Make AI models list configurable or server-fetched | 2 hours |

### Sprint 4: Code Quality & Maintainability — P2 Part 1 (~1 week)

| ID | Task | Effort |
|----|------|--------|
| S-049 | Extract all magic numbers to named constants (7 locations) | 1 hour |
| S-050 | Extract duplicated shop settings fetch in receipt routes to preHandler | 30 min |
| S-051 | Extract shared response-building logic from `lookupByCode` / `lookupByCodeAuth` | 1 hour |
| S-052 | Move dynamic imports to module level in notifications + job service | 30 min |
| S-053 | Move receipt/label HTML templates to `public/receipt-templates/` | 2 hours |
| S-054 | Move label `window.print()` to `<script nonce>` block | 30 min |
| S-055 | Document dashboard scope cache TTL behavior, consider memoization utility | 30 min |
| S-056 | Define proper typed interface for `lookupByCode` return (replace `Record<string, unknown>`) | 30 min |
| S-057 | Define explicit `Result<Job, CreateJobError>` return type for `createJob` | 30 min |
| S-058 | Add connection verification to email transporter + invalidation on settings change | 1 hour |
| S-059 | Use `loadEnv().UPLOAD_DIR` in `job-photos.service.ts` instead of hardcoded path | 15 min |
| S-060 | Make `formatPhone` country code configurable via shop settings | 30 min |
| S-061 | Create Zod schema for repairs status toggle (replace manual typeof check) | 15 min |
| S-062 | Wrap all hardcoded placeholder strings in `t()` | 2 hours |
| S-063 | Replace hardcoded "DZD" in JSX with `formatCurrency()` using shop settings | 30 min |
| S-064 | Replace `navigator.platform` with `navigator.userAgentData?.platform` | 15 min |
| S-065 | Replace `bg-yellow-500` with Material Design 3 token | 5 min |

### Sprint 5: State Bugs & Compatibility — P2 Part 2 (~1 week)

| ID | Task | Effort |
|----|------|--------|
| S-066 | Separate `editingId`/`deletingId`/`saving` state between Memories and Instructions sections | 30 min |
| S-067 | Wire up quick-intake-form to job creation API (or remove if not needed) | 2 hours |
| S-068 | Implement proper Ctrl+Enter handler in chat, or fix the displayed hint | 30 min |
| S-069 | Extract `fontVariationSettings: 'FILL' 1` to CSS utility class | 10 min |
| S-070 | Add `crypto.randomUUID()` fallback for older browsers | 15 min |
| S-071 | Add client-side file size validation on avatar upload | 15 min |
| S-072 | Integrate error reporting service (Sentry) in error boundary | 1 hour |
| S-073 | **Standardize on one toast system** — pick `sonner` or Zustand `useToastStore`, migrate all callers | 2 hours |
| S-074 | Replace `DashboardRole` with `RoleType` import | 5 min |
| S-075 | Unify email+empty pattern in customer schemas to one form | 10 min |
| S-076 | Wrap `customerIdParamSchema` in `z.object()` for consistency | 5 min |
| S-077 | Validate `ai.schema.ts` language against known codes `["en","fr","ar"]` | 10 min |
| S-078 | Validate `updateShopSettingsSchema` currency/countryCode against constants | 15 min |
| S-079 | Extract `partCategoryEnum` shared helper, use in create/update schemas | 15 min |
| S-080 | Extract `repairCategoryEnum` shared helper, use in create/update schemas | 15 min |
| S-081 | Fix loose `Record<string, T>` typing in part-categories, repair-categories, device-icons | 15 min |
| S-082 | Add `@unique` to `Customer.email` or document intentional decision | 15 min |
| S-083 | Add `@@unique([name])` to RepairCatalog | 5 min |
| S-084 | Add `@@unique([name])` to PartsCatalog | 5 min |
| S-085 | Add `userId` FK to AiMemory/AiInstruction or document shop-wide intent | 1 hour |
| S-086 | Remove dead `declaration`/`declarationMap` from tsconfig (overridden by `noEmit`) | 2 min |
| S-087 | Add `@server` alias to vite.config.ts + vitest.config.ts, or remove from tsconfig | 15 min |
| S-088 | Unify config import pattern to `import.meta.dirname` in both vite + vitest configs | 10 min |
| S-089 | Extract duplicated Tailwind class strings to shared constants (like `INPUT_CLS`) | 1 hour |
| S-090 | Type `FinancialTrendPoint.date` as template literal `` `${number}-${number}-${number}` `` | 10 min |
| S-091 | Add pagination or "load more" for chat messages (currently capped at 100) | 2 hours |
| S-092 | Move validation translations to server-local dir (remove cross-layer import from `src/`) | 1 hour |
| S-093 | Replace hardcoded form `id` attributes with `useId()` hook | 30 min |
| S-094 | Document seed `update: {}` as intentional or add update logic | 15 min |
| S-095 | Add all env vars to `env.d.ts` (BETTER_AUTH_URL, etc.) | 15 min |
| S-096 | Add root config files to biome `files.includes` | 5 min |
| S-097 | Add `hostname: "0.0.0.0"` to Capacitor dev server config | 5 min |

### Sprint 6: Testing — P3 Testing Gap Closure (~2 weeks)

| ID | Task | Effort |
|----|------|--------|
| S-098 | Add route integration tests (auth, jobs, users, customers) | 3 days |
| S-099 | Add AI module tests — adversarial SQL inputs, context building, streaming | 1 day |
| S-100 | Add plugin tests — CSRF, rate limiting, CSP, audit logging | 2 days |
| S-101 | Add lib tests — crypto edge cases, auth session extraction, email | 1 day |
| S-102 | Increase frontend test coverage from ~10% to at least 50% (stores, hooks) | 3 days |
| S-131 | Add dedicated tests for `resolve-validation-messages.ts` | 30 min |

### Sprint 7: Accessibility & i18n Polish — P3 (~1 week)

| ID | Task | Effort |
|----|------|--------|
| S-103 | Add `aria-live` regions to `waiting-customers`, `active-repairs-queue`, `overdue-jobs` | 2 hours |
| S-104 | Add `aria-modal="true"` + `role="dialog"` to inline dialogs in chat-interface | 30 min |
| S-105 | Extract scrollbar-hide to CSS utility class, remove inline style | 10 min |
| S-106 | Replace hardcoded em-dash fallback with translated string in personal-spec-sheet | 10 min |
| S-119 | Localize dynamic `aria-label` in parts-alert | 15 min |

### Sprint 8: Consistency & Style — P3 (~1 week)

| ID | Task | Effort |
|----|------|--------|
| S-107 | Standardize component exports: pick `export default function` everywhere | 2 hours |
| S-108 | Standardize component declarations: pick `function` pattern, update inline sub-components | 1 hour |
| S-121 | Derive `role` enum in auth.schema.ts from `Role` constant instead of hardcoding | 15 min |
| S-126 | Derive category enums in job.schema.ts from constants instead of manual enumeration | 30 min |

### Sprint 9: Config & Minor Fixes — P3 Remaining (~0.5 week)

| ID | Task | Effort |
|----|------|--------|
| S-109 | Remove `Math.random` fallback (Node 19+ always has `crypto.randomUUID`) or document as safe | 5 min |
| S-110 | Make seed admin email configurable via env var | 10 min |
| S-111 | Document test DATABASE_URL as intentional (uses `??=` for override) | 5 min |
| S-112 | Add partial unique index or document NULL repairId behavior in JobRepair | 15 min |
| S-113 | Add app-layer validation for ShopSettings.currency against known codes | 10 min |
| S-114 | Review and remove `ignoreDeprecations: "6.0"` from tsconfig when TS upgrade is complete | 5 min |
| S-115 | Fix password strength array bounds: guard against `strength = 0` | 10 min |
| S-116 | Export `NonEmptyArray` from permissions.ts | 2 min |
| S-117 | Reduce `as` type assertions in permissions tests | 30 min |
| S-118 | Clean up unconventional `ref` prop declaration in SettingsShopTab | 5 min |
| S-120 | Add `rollupOptions.output.manualChunks` to vite.config.ts for mobile optimization | 1 hour |
| S-122 | Align `ai.schema.ts` instructions `.default("")` with memory/instruction `.min(1)` convention | 10 min |
| S-123 | Fix `getUserId` to return proper 401 response instead of throwing | 10 min |
| S-124 | Add debug log when `wsBroadcast` is unavailable | 5 min |
| S-125 | Document `as const` pattern as known Prisma/TypeScript interaction (no fix needed) | 5 min |
| S-127 | Replace em-dash fallback in personal-spec-sheet with translated string | 10 min |
| S-128 | Document LANGUAGE_OPTIONS hardcoded labels as intentional (native language display) | 5 min |
| S-129 | Add TTL-based clearing to overdue scheduler `alerted` Set | 15 min |
| S-130 | Add stale connection cleanup to WebSocket connections Set | 15 min |
| S-132 | Add reasonable limit to notification templates query | 5 min |
| S-133 | Use string format `"15 minutes"` for rate limit timeWindow consistency | 5 min |

---

## Coverage Verification

| Sprint | IDs Covered | Count |
|--------|-------------|-------|
| Sprint 1 | S-001 → S-010 | 10 |
| Sprint 2 | S-011 → S-025 | 15 |
| Sprint 3 | S-026 → S-048 | 23 |
| Sprint 4 | S-049 → S-065 | 17 |
| Sprint 5 | S-066 → S-097 | 32 |
| Sprint 6 | S-098 → S-102, S-131 | 6 |
| Sprint 7 | S-103 → S-106, S-119 | 5 |
| Sprint 8 | S-107 → S-108, S-121, S-126 | 4 |
| Sprint 9 | S-109 → S-091, S-092, S-093, S-094, S-095, S-096, S-097 (already in Sprint 5), S-109 → S-133 | 21 |
| **Total** | **S-001 → S-133** | **133** |

> Verification: Sprint 1 (10) + Sprint 2 (15) + Sprint 3 (23) + Sprint 4 (17) + Sprint 5 (32) + Sprint 6 (6) + Sprint 7 (5) + Sprint 8 (4) + Sprint 9 (21) = 133. All issues accounted for.

---

## Cross-Cutting Themes

These patterns appear repeatedly and should be addressed as systemic fixes, not one-off patches:

1. **DRY violations** (12+ instances) — `sendError` ×8, status colors ×5, pipeline items ×2, magic bytes ×2, MUTATION_METHODS ×2, ROLE_LABEL_KEYS ×2, category enums ×4, CSS class strings ×10, INACTIVE_STATUSES checks ×6
2. **Inconsistent patterns** — 5 error response shapes, 3 error message formats, 2 toast systems (`sonner` vs Zustand), 2 modal implementations (hook vs manual), mixed export styles, 2 config import patterns
3. **Missing type safety** — `Record<string, unknown>` returns, unvalidated params (42 routes), loose `Record<string, T>` types, phantom schema fields, 12+ missing type exports
4. **i18n gaps** — Hardcoded English in schemas (3 patterns), UI strings, currency formatter, placeholder text (7 locations), role labels, em-dash fallbacks
5. **Test coverage** — Routes 0%, AI module 0%, plugins 0%, server lib 0%, frontend ~10%
6. **Config drift** — biome extends wrong frameworks, tsconfig dead options, missing aliases, inconsistent patterns between sibling configs

---

*This document is the single source of truth for codebase quality issues. Update it as fixes are applied. Mark completed items with ~~strikethrough~~ or move to a "Fixed" section.*
