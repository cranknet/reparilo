# Reparilo Codebase Audit

**Date:** 2026-04-28
**Scope:** `src/`, `server/`, `shared/`, `scripts/`, `package.json`
**Stats:** 303 source files · ~46 100 LOC TS/TSX · 12 route files · 19 services · 12 stores · 13 hooks · 1 222 i18n keys
**Audit type:** scan-only — no edits applied. Awaiting human sign-off on each item before any change.

> **In-flight feature notice.** The branch contains uncommitted work for an AI-agent system (`server/routes/ai.ts`, `server/services/ai-*.ts`, `server/ai/*`, `shared/schemas/ai.schema.ts`, `src/pages/ai-analyst/*`, `src/components/modules/ai-analyst/*`, settings AI/agents tabs, AI i18n keys). Items in those files are tagged **(in-flight)** and should not be deleted; clutter notes still apply but the feature owner should review before refactoring.

---

## 1 · Dead Code

### 1.1 Unused npm dependencies
| Package | Verification | Confidence |
|---|---|---|
| `escpos@3.0.0-alpha.6` | 0 imports anywhere | **High** — safe to remove |

### 1.2 Stub / unwired scripts
| File | What | Confidence |
|---|---|---|
| `scripts/scan-i18n.ts` | Logs "not yet implemented" and exits 1. References non-existent `src/lib/i18n-scanner/`. Wired to `pnpm scan-i18n`. | **High** — AI-generated stub. Either implement or delete the script + the npm script. |
| `scripts/playwright-auth.ts` | Generates `e2e/.auth/admin.json` for Playwright. No Playwright dep installed, no `playwright.config.*`, no `e2e/` dir, not referenced in any npm script. | **High** — orphan. Delete, or restore Playwright + e2e dir if intended. |

### 1.3 Unused component files (verified by `from ".../<file>"` grep)
| File | LOC | Notes |
|---|---:|---|
| `src/components/modules/jobs/status-change-menu.tsx` | 213 | Never imported. Functionality covered by `status-popover.tsx` (293 LOC, actively used). |
| `src/components/modules/jobs/status-change-reason-dialog.tsx` | 99 | Never imported. |
| `src/components/modules/jobs/intake-modal/hooks.ts` | 47 | Defines `useRepairHandlers`; logic was inlined into sibling `use-intake-modal.ts`. |
| `src/components/modules/jobs/intake-modal/repair-services-section.tsx` | 85 | Never imported; replaced by step-2-content. |
| `src/hooks/use-job-history.ts` | 40 | `useJobHistory` exported but never imported. |

**Total dead .tsx/.ts: ~484 LOC across 5 files.**

### 1.4 Unused exports (still-used files)
| Symbol | File | Notes |
|---|---|---|
| `sendEmail` | `server/lib/email.ts` | Only consumed inside `email.ts` itself — drop the `export`. |
| `Statement` | `shared/permissions.ts` | Type never referenced. |
| `TechnicianDashboardDTO` | `shared/types/dashboard.ts` | DTO never imported. The page builds its data shape inline. |
| `FrontDeskDashboardDTO` | `shared/types/dashboard.ts` | Same. |
| `JobPhoto` | `shared/types/index.ts` | Never imported. |
| `AuditLog` | `shared/types/index.ts` | Never imported. |
| `AiChatHistory` | `shared/types/index.ts` | **(in-flight)** — leave. |
| `NativeCameraResult` | `src/hooks/use-native-camera.ts` | Possibly used as a return type alias only — verify before removing. |

### 1.5 Stale `.gitkeep` files
The following directories now have content; the `.gitkeep` is stale: `src/hooks/`, `src/stores/`, `server/middlewares/`, `server/services/`, `server/utils/`, `server/ai/`. (`src/assets/.gitkeep` is legitimate — directory is empty.)

### 1.6 Orphan i18n keys
**187 non-AI keys** in `src/i18n/locales/en.json` are never referenced in the source. Full list saved at `/tmp/dead_i18n_keys.txt` (1 222 total → 248 unused → 187 non-AI / 61 AI-in-flight).

Notable clusters:
- `auth_*` (~25 keys): `auth_atelier`, `auth_engineering_atelier`, `auth_precision_engine`, `auth_metrics`, `auth_intake`, `auth_hero_desc`, `auth_start_journey`, `auth_terms`, `auth_privacy`, etc. Suggests an earlier marketing-style auth screen was redesigned.
- `gpt_3_5_turbo`, `gpt_4o_default` and similar legacy AI-model labels.
- `dashboard_page.warranty_phantom_touch`, `dashboard_page.warranty_charging_port` — verify these aren't dynamically constructed (`t(\`dashboard_page.${reason}\`)`) before deleting.
- `errors.csrf_unavailable`, `errors.fetch_users`, `errors.create_user`, `errors.toggle_user_status` — possibly accessed via fallback chains; double-check.

> ⚠️ Each key still needs human eyes. Static grep cannot catch dynamic key construction (`t(\`prefix.\${var}\`)`). Recommend: implement `pnpm scan-i18n` properly (the existing stub was AI-generated for exactly this purpose) or run a manual review pass.

### 1.7 No TODO / FIXME / XXX / HACK markers found
Clean signal — the codebase has not accumulated explicit-debt comments.

---

## 2 · Duplicate Code

### 2.1 ⚠️ Per-route `sendError` helper (8 copies, byte-identical)
```ts
// declared identically in:
server/routes/customers.ts:19
server/routes/parts.ts:19
server/routes/notifications.ts:11
server/routes/settings.ts:25
server/routes/repairs.ts:18
server/routes/jobs.ts:100
server/routes/ai.ts:53          // (in-flight)
server/routes/receipts.ts:11
```
Each file declares the same `function sendError(reply, status, code, message, details?)`. **Canonical home:** `server/utils/send-error.ts` (or `server/lib/reply-helpers.ts`).

### 2.2 ⚠️ Validation block boilerplate (~48 occurrences across routes)
Every route handler with body/query parsing repeats:
```ts
const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return sendError(reply, 400, "VALIDATION_ERROR", "...", {
    errors: resolveZodErrors(parsed.error.flatten().fieldErrors, req.locale),
  });
}
```
**Canonical fix:** a small `parseOrFail(reply, schema, req.body, req.locale)` helper, or — better — a Fastify `preValidation` hook that attaches `req.parsed` and rejects on failure. Either choice removes ~6 lines per handler × 48 handlers ≈ **~300 LOC**.

### 2.3 ⚠️ Two near-identical Zustand stores
`src/stores/parts-catalog.ts` (114 LOC) and `src/stores/repair-catalog.ts` (90 LOC) are 90% identical: same state shape (`items[]`, `totalCount`, `nextCursor`, `isLoading`, `error`), same fetch/create/update/delete/toggle actions, same error-handling idiom. Only differences: `parts-catalog` has `loadMoreParts` + `isLoadingMore`, plus the entity name.
**Canonical fix:** generic `createCatalogStore<T>({ resource, errorKey })` factory. Cuts ~70 LOC and guarantees behavioral parity.

### 2.4 Repeated store scaffolding (12 stores)
Every store repeats:
- `error: string | null` + `clearError()`
- `isLoading: boolean`
- `import i18n from "@/i18n"; import api from "@/lib/api"`
- `try { ... } catch (err) { const message = err instanceof Error ? err.message : i18n.t("errors.X"); set({ isLoading: false, error: message }) }`

`set({ isLoading: true, error: null })` appears **12 times**; `err instanceof Error ? err.message : i18n.t(...)` appears **32 times**. Lower-priority than 2.3 — the symmetry is currently a *feature*, but a `runWithLoading(set, fn, errorKey)` helper would still be a net win.

### 2.5 ⚠️ Modal/dialog overlay reimplemented inline (14+ files)
Every modal hand-rolls its own backdrop:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center …">
```
Files: `customers/edit-customer-dialog.tsx`, `bottom-nav.tsx`, `settings/reset-password-modal.tsx`, `settings/add-user-modal.tsx`, `settings/template-editor.tsx`, `settings/settings-agents-tab.tsx` *(in-flight)*, `repairs/delete-repair-dialog.tsx`, `repairs/add-repair-modal.tsx`, `profile/sessions-modal.tsx`, `parts/add-part-modal.tsx`, `jobs/add-part-dialog.tsx`, `jobs/status-change-reason-dialog.tsx` *(dead — see 1.3)*, `jobs/job-photos-section.tsx`, `jobs/intake-modal/index.tsx`, `jobs/intake-modal/photo-upload-zone.tsx`.

Z-index drift: mostly `z-50`, but `customers/edit-customer-dialog.tsx` uses `z-[60]` and `settings-agents-tab.tsx` uses `z-40` — no documented stacking convention.

No focus trap, no ESC-to-close, no scroll lock are uniformly implemented. Some have it, some don't.

**Canonical fix:** one `<Modal>` primitive in `src/components/ui/modal.tsx` (overlay + portal + focus trap + ESC handler + scroll-lock). Replace 14 inline overlays. Touches a lot of files but each replacement is mechanical.

### 2.6 Two `StatusBadge` components (job status)
| File | Export | Used by |
|---|---|---|
| `src/components/ui/status-badge.tsx` (41 LOC) | named `StatusBadge`, supports `size` prop | `pages/customers/detail.tsx` |
| `src/components/modules/jobs/status-badge.tsx` (29 LOC) | default export, no size prop | `jobs-table.tsx`, `mobile-card.tsx`, `status-popover.tsx`, `status-change-menu.tsx` *(dead)* |

Both share the same `STATUS_STYLES` map. **Canonical fix:** keep `src/components/ui/status-badge.tsx`; switch the four jobs imports; delete `modules/jobs/status-badge.tsx`.

A third inline `StatusBadge` exists in `src/pages/notifications/index.tsx:172` for *notification* statuses (different domain — leave, but extract to its own file).

### 2.7 Currency / date formatting reimplemented inline
`src/lib/format.ts` has only `formatDzd(value)`. Inconsistencies:
- `src/components/modules/jobs/add-part-dialog.tsx:250,393` and `job-parts-section.tsx:119` use raw `Number(x).toLocaleString()` instead of `formatDzd`.
- The `formatDzd(n) + " DZD"` wrapper is redeclared in `cost-summary.tsx:6` and `job-parts-section.tsx:17` (one-line local function in each).
- 8+ files inline `new Date(...).toLocaleDateString(...)` with varying option objects. `pages/dashboard/front-desk.tsx:37` and `pages/notifications/index.tsx:44` each define their own local `formatDate`.

**Canonical fix:** add `formatDzdSuffix`, `formatDate(d, opts?)`, `formatDateTime(d)` to `src/lib/format.ts`; replace inline calls.

---

## 3 · Cluttered Code

| File | LOC | What's clutter | Suggested extraction |
|---|---:|---|---|
| `src/pages/parts/index.tsx` | **1117** | 7 sub-components inlined: `ConfirmToggle` (L52), `SkeletonRow` (L95), `DesktopPartRow` (L125), `MobilePartCard` (L273), `CategoryFilterPills` (L422), `PartsDesktopTable` (L485), `EmptyCatalogState` (L642), `ToastNotification` (L672). The page proper is still ~440 LOC after them. | Move each sub-component to `src/components/modules/parts/*.tsx`. Page should be ≤200 LOC. |
| `src/pages/tracking/index.tsx` | **830** | `LookupForm` (L71-229, 158 LOC), `StatusView` (L230-579, **349 LOC**), `mapJobToTrackingData` (L580+). | Split into `tracking/lookup-form.tsx`, `tracking/status-view.tsx`, `tracking/map-tracking-data.ts`. |
| `src/pages/notifications/index.tsx` | **673** | Inline `formatRelativeTime`, `AlertItem` (124 LOC), `StatusBadge`. | Move helpers to `lib/format.ts`; extract `AlertItem` and notification-specific `StatusBadge` to module dir. |
| `server/routes/jobs.ts` | **762** | 25 endpoints in one file, plus inline `sendError`, `sendNotFound`, `getUserId`, `validateLookupParams`, `trackFailedAttempt`, `jobDashboardTargets`. | Once `sendError` is centralized (2.1), remaining helpers stay file-local. Consider splitting into `jobs.routes.ts` (CRUD), `jobs.notes.routes.ts`, `jobs.parts.routes.ts`, `jobs.repairs.routes.ts` — endpoints are already thematically grouped. |
| `server/routes/users.ts` | **650** | Full CRUD with **18 direct `app.prisma.*` calls** — only route file (besides `auth.ts`) that bypasses the service layer. | Extract a `server/services/users.service.ts` mirroring `customers.service.ts`. Pure cleanup, no behavior change. |
| `server/services/job.service.ts` | **644** | Single file, many concerns: notes, photos, parts, repairs, status. | Already partially split (`job-notes.service.ts`, `job-parts.service.ts`, `job-photos.service.ts`, `job-repairs.service.ts`). Audit which functions remain in `job.service.ts` for further redistribution. |
| `src/pages/profile/index.tsx` | **554** | Mostly orchestration around already-extracted profile subcomponents. Low priority. | None required. |
| **(in-flight)** `src/pages/ai-analyst/chat-interface.tsx` | **1126** | Single component file. Owner of the AI feature should consider extraction once feature stabilizes. | Defer — feature in active development. |
| **(in-flight)** `src/components/modules/settings/settings-agents-tab.tsx` | **596** | Same — defer. | Defer. |
| `src/components/modules/bottom-nav.tsx` | **424** | Three internal components (`MoreSheetProfile`, `NavTab`, `FabButton`) plus the nav itself, plus an inline modal sheet. | Split into `bottom-nav/index.tsx`, `more-sheet.tsx`, `nav-tab.tsx`, `fab-button.tsx`. |

---

## 4 · Inconsistent Patterns

| Concern | Variants observed | Files | Recommended canonical |
|---|---|---|---|
| **Route validation** | `safeParse` + `sendError` block (canonical) | 48 occurrences across routes | Extract to `parseOrFail()` or `preValidation` hook (see 2.2). |
| **Error envelope** | Local `sendError` helper (canonical) vs ad-hoc `reply.status(400).send({ ... })` | 8 dup'd helpers vs 3 ad-hoc in `jobs.ts:69-83` | Centralize `sendError` (see 2.1) and use it everywhere. |
| **Routes → DB access** | Service layer (canonical, 10 of 12 routes) vs direct `app.prisma.*` | Direct: `users.ts` (18×), `auth.ts` (4×), `jobs.ts` (2×) | Service layer always. `users.ts` is the worst offender — see 3 above. |
| **Auth/role checks** | `app.addHook("preHandler", requirePermission(...))` plus per-route `preHandler` overrides — consistent across customers/parts/repairs/jobs/settings/notifications | n/a | Already canonical. No action. |
| **Logging** | `req.log` / `app.log` (17 hits, canonical) vs `console.error/warn` | `console.*` in `server/lib/email.ts:42`, `server/lib/auth.ts:42,57`, `server/services/notification-outbox.service.ts:112`, `server/services/job.service.ts:628` | Replace with Fastify logger; pass `app.log` into services or accept a logger param. |
| **Env access** | Centralized `loadEnv()` from `server/config/env.ts` (6 importers, canonical) vs raw `process.env` | Bypassed in `server/lib/email.ts` (5×), `server/middlewares/dashboard-scope.ts` (1×) | Add SMTP + TZ fields to the Zod env schema; consume `loadEnv()`. |
| **Status-badge component** | `ui/status-badge.tsx` (named export, with size prop) vs `modules/jobs/status-badge.tsx` (default export) | See 2.6 | Keep the `ui/` version as canonical. |
| **Forms** | All hand-rolled `useState`+manual error handling (uniform) | All forms | Uniform — no immediate violation. Long-term, `react-hook-form` would slash boilerplate, but that is **outside the scope of this audit** (architectural change, not cleanup). |
| **Store loading/error** | `isLoading: boolean` + `error: string \| null` (uniform across all 12 stores) | All stores | Already canonical. Optional: extract `runWithLoading` helper (see 2.4). |
| **Modal scaffolding** | 14 inline overlays, no shared primitive | See 2.5 | Extract `<Modal>` to `src/components/ui/modal.tsx`. |
| **Component file naming** | `kebab-case.tsx` everywhere (canonical) | All | No action. |
| **Component export style** | Mixed default + named (especially in `components/modules/`) | Many | No strict canonical needed; pick a rule and apply via biome — low priority. |
| **Translations** | `t("key")` from `react-i18next`, uniform | All visible strings spot-checked | Looks consistent; the dead-i18n-key list (1.6) suggests legacy strings, not hardcoded ones. |

---

## 5 · Top 10 Highest-Impact Fixes (ranked by reviewability × value)

1. **Centralize `sendError` (2.1)** — delete 7 copies, ~70 LOC. One PR, one helper file, find/replace. Trivially reviewable.
2. **Extract `parseOrFail` validation helper (2.2)** — ~300 LOC removed across 48 handlers. Reviewable per-route.
3. **Delete dead components (1.3)** — 5 files, ~484 LOC. **Verify each is unimported once more before deleting** — mechanical.
4. **Remove `escpos` dep + dead scripts (1.1, 1.2)** — `pnpm install` cleanup + 2 file deletes.
5. **Consolidate `StatusBadge` (2.6)** — 4 import-path changes, 1 file deletion.
6. **Generic `createCatalogStore` factory (2.3)** — ~70 LOC saved, parts/repairs catalogs become identical-by-construction.
7. **`<Modal>` primitive (2.5)** — biggest UX-quality win (consistent ESC/focus/scroll behavior). Touches ~14 files; do per-modal commits.
8. **Extract sub-components from `pages/parts/index.tsx` (3)** — reduces a 1117-line file to <200. Commit-per-extraction.
9. **`users.ts` route → service layer (3)** — restores the canonical route-→-service pattern across the API surface.
10. **i18n key cleanup (1.6)** — only after `pnpm scan-i18n` is implemented properly, so the deletion list is verifiable. ~187 keys × 3 locale files.

**Deferred / outside scope:**
- AI-analyst feature clutter (`chat-interface.tsx`, `settings-agents-tab.tsx`) — wait for feature owner.
- Form-library migration (`react-hook-form`) — architectural change, not cleanup.
- Splitting `jobs.ts` by sub-resource — judgement call; many teams prefer one route-per-domain.

---

## 6 · Items Requiring Human Decision Before Any Edit

1. Delete or implement `scripts/scan-i18n.ts` and the `pnpm scan-i18n` npm script?
2. Delete or restore `scripts/playwright-auth.ts` (and reinstall Playwright + create `e2e/`)?
3. Are the 187 orphan i18n keys truly dead, or are some accessed via dynamic templating? Recommend implementing `scan-i18n` first.
4. `ConfirmDiscardDialog` already exists at `src/components/ui/confirm-discard-dialog.tsx` (used by 3 callers). Should the new `<Modal>` primitive (2.5) absorb it, or remain its own component?
5. Splitting `server/routes/jobs.ts` into sub-files — yes or keep as one?
6. Branch strategy: keep current AI-agent in-flight work where it is, or stash before starting cleanup?

**Recommended cadence:** one PR per category in the order above (1 → 4 → 5 → 6 → 9 → 7 → 2 → 3 → 8 → 10). Each is independently revertable.
