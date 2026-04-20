# Plan — Implement Repair Status Change + Parts-Cost Link for Jobs

## Context

Reparilo's backend already enforces a full job-status state machine (`JOB_STATUS_FLOW` in `shared/constants/job-statuses.ts`), role-based `jobStatus` permissions in `shared/permissions.ts`, and automatic audit logging via `createAuditLog()` (`server/services/audit.service.ts`). The `PATCH /jobs/:id/status` endpoint (`server/routes/jobs.ts:191`) and the frontend store action `transitionStatus` (`src/stores/jobs.ts:152`) are wired up — **but no UI exposes the ability to change a job's status**. `StatusBadge` (`src/components/modules/jobs/status-badge.tsx`) is read-only, and there is no job detail page.

Similarly for parts: the `JobPart` model already snapshots `unitPrice`, `quantity`, and `totalCost` (`prisma/schema.prisma:341`); `addJobPartSchema` accepts both catalog (`partId`) and ad-hoc entries; `POST /:id/parts` + `DELETE /:id/parts/:partId` work; and `computeFinalCost()` (`server/services/job.service.ts:47`) already sums `JobPart.totalCost + JobRepair.price` into `finalCost` on every job read. **The gap is the UI** — there is no way to add parts to a job, nor to see how parts contribute to the job total.

**Goal:** let authorized staff (a) change a job's status from two places — inline on the jobs list row (fast triage) and on a new job detail page (with a history timeline), and (b) add/remove parts to a job from that same detail page, with each part's cost automatically rolling into the job's `finalCost`. Destructive transitions (`CANCELLED`, `ON_HOLD`) require a short reason note. Customer tracking stays on HTTP polling (no realtime work in this scope).

**User decisions captured (via AskUserQuestion):**
- Status UI location: **inline on list + new detail page**
- Realtime: **no, HTTP polling only**
- Reason: **required for `CANCELLED` and `ON_HOLD` only**
- Part source: **catalog pick + ad-hoc fallback** (primary: pick from `PartsCatalog` with `defaultPrice` pre-fill; secondary: free-form custom part)
- Cost model: **single price field only** — no separate supplier cost, no margin tracking, no Prisma migration

---

## Scope

**In scope**
1. Backend: accept optional `reason` on status transition; require it for `CANCELLED`/`ON_HOLD`; persist to `AuditLog.metadata.reason` and `AuditLog.note`.
2. Backend: new `GET /jobs/:id/history` endpoint returning `AuditLog` entries for the job.
3. Frontend: inline status-change menu on each jobs-list row (table + mobile card).
4. Frontend: new job detail page at `/jobs/:id` with header, status panel, history timeline, **and a parts section**.
5. Reason dialog component shared by inline menu and detail page.
6. Permission gating via existing `useCan` / `<Can>` wrapper + `JOB_STATUS_FLOW` filter.
7. **Parts-on-job UI**: list existing `JobPart` rows, add new parts (catalog pick with `defaultPrice` pre-fill, or ad-hoc fallback), remove parts, and show running totals that match the server-side `finalCost`.
8. i18n keys (English source in `src/i18n/locales/en.json`), synced via `pnpm run sync-locales`.
9. Targeted tests (backend) + manual QA via Chrome DevTools MCP.

**Out of scope** (explicit non-goals)
- WebSocket push / realtime updates.
- SMS/WhatsApp customer notification on status change (infra enums exist but no driver is wired — separate feature).
- Editing the job's other fields on the detail page (notes, repairs, technician assignment, estimated date — untouched for v1). Parts are in scope; the rest stay editable only where they already are.
- Separate supplier cost / margin tracking. Matches user decision: single-price model, no Prisma migration.
- New roles or permission changes — existing `jobStatus` and `jobs.edit` permissions are sufficient (`POST /:id/parts` already requires `jobs.edit`).

---

## Backend Changes

> **No Prisma migration is needed.** Every field this feature touches already exists: `JobPart.unitPrice/quantity/totalCost`, `AuditLog.note/metadata`, `Job.status`, `JOB_STATUS_FLOW`, `jobStatus` permissions. Only schema (Zod) and service tweaks below.

### 1. Extend `transitionStatusSchema` — `shared/schemas/job.schema.ts:42`

Add optional `reason` and enforce it conditionally:

```ts
export const transitionStatusSchema = z
  .object({
    status: z.enum([/* 8 statuses, unchanged */]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    const requiresReason =
      val.status === JobStatus.CANCELLED || val.status === JobStatus.ON_HOLD;
    if (requiresReason && (!val.reason || val.reason.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Reason is required for CANCELLED and ON_HOLD",
      });
    }
  });
```

### 2. Forward `reason` to the service — `server/routes/jobs.ts:191`

Pass `parsed.data.reason` through to `transitionStatus()`.

### 3. Extend service signature — `server/services/job.service.ts:322`

```ts
export async function transitionStatus(
  prisma, id, newStatus, userId,
  options?: { requestingRole: RoleType; reason?: string }
)
```

In the `createAuditLog()` call (line 356), add:
- `note: options?.reason`
- `metadata: options?.reason ? { reason: options.reason } : undefined`

The existing `AuditLog` schema already supports both fields (see `server/services/audit.service.ts`) — no Prisma migration needed.

### 4. New history endpoint — `server/routes/jobs.ts`

```ts
app.get("/:id/history", async (req, reply) => {
  // auth: require jobs.view permission
  // fetch AuditLog where jobId = req.params.id, orderBy createdAt desc,
  // include user { id, name, role } for display
  // return array of { id, action, fromValue, toValue, note, metadata, createdAt, user }
});
```

Add a matching Zod schema `jobHistoryItemSchema` (or a plain TS type) exported from `shared/schemas/job.schema.ts` so the frontend can type responses.

### 5. Parts endpoints — no code change required

`POST /:id/parts` (`server/routes/jobs.ts:304`) and `DELETE /:id/parts/:partId` (line 338) already:
- accept `addJobPartSchema` (catalog + ad-hoc supported via optional `partId`),
- require `jobs.edit` permission,
- block adds on jobs in terminal status (`JOB_IN_TERMINAL_STATUS` error),
- rely on the service layer to compute `totalCost = unitPrice × quantity` and refresh `finalCost` on read.

Before building the UI, **confirm by reading `server/services/job.service.ts`** that `addPart()` sets `JobPart.totalCost` server-side; if it derives from client input, make the server compute it from trusted `unitPrice × quantity` so the client can't decouple them. If this is already the case, leave it alone — do not refactor for its own sake.

### 6. Backend tests

Add `server/__tests__/jobs-status-transition.test.ts` following the pattern of the existing `server/__tests__/users-acknowledge.test.ts`:
- 400 when `CANCELLED`/`ON_HOLD` is sent without `reason`.
- 200 persists `reason` into `AuditLog.note` and `AuditLog.metadata.reason`.
- 200 for routine transitions without `reason`.
- 403 `FORBIDDEN_STATUS_TRANSITION` when role lacks `jobStatus` for target.
- 409 `CONFLICT_STATUS_TRANSITION` when target violates `JOB_STATUS_FLOW`.
- `GET /jobs/:id/history` returns entries in descending `createdAt` order.

Add a targeted `server/__tests__/jobs-parts-cost.test.ts`:
- 201 adding a catalog part → `JobPart.totalCost = unitPrice × quantity`, `finalCost` on subsequent `GET /:id` reflects the added cost.
- 201 adding an ad-hoc part (no `partId`) works and contributes to `finalCost`.
- 409 `JOB_IN_TERMINAL_STATUS` when adding to a `DELIVERED`/`CANCELLED`/`RETURNED` job.
- 204 removing a part decreases `finalCost` accordingly.

Run with existing test tooling (check `package.json` scripts; likely `pnpm test`).

---

## Frontend Changes

### 1. New hook: `src/hooks/use-job-history.ts`

Zustand-agnostic thin wrapper that fetches `GET /jobs/:id/history` via `api` (same axios client used elsewhere). Returns `{ data, loading, error, refetch }`. Follows the pattern of `src/hooks/use-profile-multi-user.ts` (seen in working-tree status).

### 2. Extend jobs store — `src/stores/jobs.ts:152`

Update signature: `transitionStatus: (id, status, reason?) => Promise<Job>`. Pass `reason` in POST body. On success, store returns updated job (already happens). Make sure errors surface server error codes so the UI can toast the right message.

### 3. New component: `src/components/modules/jobs/status-change-menu.tsx`

- Props: `job: Job`, `onChanged?: (job: Job) => void`.
- Reads `useCan({ jobStatus: [nextStatus] })` for each candidate.
- Candidates = intersection of `JOB_STATUS_FLOW[job.status]` and statuses the user has `jobStatus` permission for.
- Renders a dropdown/menu (shadcn-style — check `src/components/ui/` for existing Menu/DropdownMenu component; if none, use an accessible disclosure pattern matching the rest of the UI).
- Trigger visually uses the existing `StatusBadge` styling with a caret to signal it's interactive.
- If candidate is `CANCELLED` or `ON_HOLD` → open `<StatusChangeReasonDialog />`.
- Otherwise → call `transitionStatus(id, status)` directly.
- On success: toast success; on error: toast mapped message for each server error code:
  - `VALIDATION_ERROR` → `errors.status_change.validation`
  - `FORBIDDEN_STATUS_TRANSITION` → `errors.status_change.forbidden`
  - `CONFLICT_STATUS_TRANSITION` → `errors.status_change.invalid_transition`
  - `CANCEL_WINDOW_EXPIRED` → `errors.status_change.cancel_window`
  - `CANCEL_NOT_CREATOR` → `errors.status_change.not_creator`
- If the user has **no** permitted transitions, render the plain read-only `StatusBadge` (no caret).

### 4. New component: `src/components/modules/jobs/status-change-reason-dialog.tsx`

Simple modal (match pattern of `intake-modal.tsx`: plain `useState`, no react-hook-form — CLAUDE.md's "follow existing patterns" rule).
- Textarea, 500-char counter, Cancel / Confirm buttons.
- Confirm disabled until reason has ≥1 char.
- Submits `{ status, reason }` to the store action.

### 5. New component: `src/components/modules/jobs/status-history-timeline.tsx`

Vertical timeline of audit entries for the detail page:
- Each row: `action` localized, `fromValue → toValue` with `StatusBadge` pills, actor name + role, relative time, and `note` if present.
- Filter action types so only status-relevant actions (`STATUS_CHANGED`, `JOB_CREATED`) appear by default; expandable to include other actions (`TECHNICIAN_ASSIGNED`, `COST_UPDATED`, etc.) — start simple, show all actions, let layout do the filtering visually.

### 6. Wire inline change menu into the jobs list

- `src/components/modules/jobs/jobs-table.tsx:85` — replace the bare `StatusBadge` cell with `<StatusChangeMenu job={row.job} />`.
- `src/components/modules/jobs/mobile-card.tsx` — replace the inline status badge similarly.
- `src/components/modules/jobs/jobs-shared.ts` — the `jobToRow` transformer likely drops fields; make sure the full `Job` object flows through (or accept `job` alongside `row`).

### 7. New job detail page: `src/pages/jobs/[id].tsx`

Components layout (top → bottom):
- **Back to jobs** link.
- **Header card**: job code (copy-to-clipboard), device + problem, customer name/phone, estimated date, current `<StatusBadge />`.
- **Status panel**: "Change status to" label followed by buttons — one per allowed transition the user can perform, each firing the same flow as the inline menu (reuse `<StatusChangeMenu />` rendered in "buttons" mode, or accept a `variant?: "menu" | "buttons"` prop).
- **Parts section**: `<JobPartsSection job={job} onChanged={refetch} />` — list + add/remove + totals (see §7b).
- **Cost summary card**: small two-line card — *Parts subtotal · Repairs subtotal · Deposit · Final cost* — all read from the already-returned `finalCost` and the `job.parts` / `job.repairs` arrays. Repairs row is informational only (no editing in this scope).
- **History timeline**: `<StatusHistoryTimeline jobId={id} />`.

Data loading:
- Fetch via a new `fetchJobById(id)` action in the jobs store (or reuse list cache with a fallback fetch if `id` not present). The `GET /:id` response already includes `parts`, `repairs`, and `finalCost`.
- On status change or parts add/remove, refetch the job (cheap single `GET`) so `finalCost` and both lists stay authoritative — do **not** recompute totals on the client.

### 7b. Parts section components

`src/components/modules/jobs/job-parts-section.tsx` *(new)*
- Reads `job.parts: JobPart[]` from the job object.
- Renders a simple table (desktop) / stacked list (mobile): name, category (localized), qty, unit price, line total, remove button.
- Footer row: parts subtotal (sum of `totalCost`).
- "Add part" button (visible only if `useCan({ jobs: ["edit"] })` is true and the job is not in a terminal status — reuse `INACTIVE_STATUSES` from `shared/constants/job-statuses.ts` to decide).
- "Add part" opens `<AddPartDialog />`.
- Remove button calls the existing `removePart(jobId, partId)` store action (confirm the action exists in `src/stores/jobs.ts`; if not, add it mirroring `addPart`'s pattern — `DELETE /jobs/:id/parts/:partId`).

`src/components/modules/jobs/add-part-dialog.tsx` *(new)*
- Two tabs or a mode toggle: **From catalog** (default) / **Custom part**.
- Catalog mode:
  - Searchable list of `PartsCatalog` entries filtered by `isActive=true`.
  - Fetch via the existing parts-catalog data source (check `src/pages/parts/` / any `src/stores/parts.ts` for an existing hook or store; reuse it — do not refetch with a new pathway).
  - On pick: pre-fills `partName`, `category`, `supplier`, `unitPrice` (from `defaultPrice`). `partId` is set.
  - Fields that stay editable after pick: `unitPrice` (real-world price can vary), `quantity`.
- Ad-hoc mode:
  - Blank form: `partName` (required), `category` (select from `PartCategory` enum), `supplier` (optional), `unitPrice` (required, min 0), `quantity` (default 1).
  - `partId` is omitted — the schema already allows this.
- Submit → `addPart(jobId, { partId?, partName, category, unitPrice, quantity, supplier? })` via the existing store action.
- On success: close dialog, trigger the page-level refetch, toast success with the new line total formatted via existing currency formatter in `src/lib/` (check `src/lib/` for `formatCurrency` — reuse it).
- Error mapping: `JOB_IN_TERMINAL_STATUS` → localized "Can't add parts to a finished job"; `VALIDATION_ERROR` → field-level messages.
- Form state: match the existing pattern in `intake-modal.tsx` (plain `useState`, no react-hook-form) per CLAUDE.md's "follow existing patterns" rule.

Do **not** display or compute supplier cost / margin — the plan is explicit that the single `unitPrice` field is what the customer pays and what the job total uses.

### 8. Register route in `src/App.tsx`

Add inside the protected route block (around line 64, after `/jobs`):

```tsx
<Route path="/jobs/:id" element={<DashboardLayout><JobDetailPage /></DashboardLayout>} />
```

No `RequirePermission` wrapper needed — any authenticated role can view jobs. Action buttons inside the page gate themselves via `useCan`.

### 9. Make the list row link to the detail page

- `jobs-table.tsx`: wrap the job-code / device cells in a `<Link to={`/jobs/${id}`}>`. Keep the status cell as a menu trigger (do not let it trigger the link).
- `mobile-card.tsx`: same — card body links to detail, status area remains interactive.

### 10. i18n keys — `src/i18n/locales/en.json`

Add under appropriate namespaces:
- `jobs.status_change.menu_label`, `.to`, `.reason_title`, `.reason_placeholder`, `.confirm`, `.cancel`, `.success`
- `jobs.status_change.errors.validation`, `.forbidden`, `.invalid_transition`, `.cancel_window`, `.not_creator`, `.unknown`
- `jobs.detail.back`, `.history`, `.no_history`, `.change_to`, `.cost_summary`, `.parts_subtotal`, `.repairs_subtotal`, `.deposit`, `.final_cost`
- `jobs.parts.title`, `.add`, `.empty`, `.remove`, `.catalog_tab`, `.custom_tab`, `.search_placeholder`, `.part_name`, `.category`, `.unit_price`, `.quantity`, `.supplier`, `.line_total`, `.terminal_status_error`, `.added_success`, `.removed_success`, `.confirm_remove`
- `jobs.history.actions.<AuditAction>` — one per audit action used

Then run `pnpm run sync-locales` to auto-translate to AR/FR (per CLAUDE.md).

---

## Critical Files

**Backend**
- `shared/schemas/job.schema.ts` — extend `transitionStatusSchema`.
- `server/routes/jobs.ts` — forward `reason`; add `GET /:id/history`.
- `server/services/job.service.ts` — accept `reason` in `transitionStatus`; verify `addPart` computes `totalCost` server-side.
- `server/__tests__/jobs-status-transition.test.ts` *(new)*.
- `server/__tests__/jobs-parts-cost.test.ts` *(new)*.

**Frontend**
- `src/App.tsx` — register `/jobs/:id` route.
- `src/stores/jobs.ts` — extend `transitionStatus(id, status, reason?)`; add `fetchJobById`; confirm/add `removePart`.
- `src/hooks/use-job-history.ts` *(new)*.
- `src/components/modules/jobs/status-change-menu.tsx` *(new)*.
- `src/components/modules/jobs/status-change-reason-dialog.tsx` *(new)*.
- `src/components/modules/jobs/status-history-timeline.tsx` *(new)*.
- `src/components/modules/jobs/job-parts-section.tsx` *(new)*.
- `src/components/modules/jobs/add-part-dialog.tsx` *(new)*.
- `src/components/modules/jobs/jobs-table.tsx` — wire inline menu + link to detail.
- `src/components/modules/jobs/mobile-card.tsx` — same.
- `src/components/modules/jobs/jobs-shared.ts` — ensure `Job` object flows through.
- `src/pages/jobs/[id].tsx` *(new)* — job detail page.
- `src/i18n/locales/en.json` — new keys.

**Reused (do not rewrite)**
- `src/hooks/use-can.ts` — permission hook (recently refactored, commit `981cc3e`).
- `src/components/modules/can.tsx` — gating wrapper.
- `src/components/modules/jobs/status-badge.tsx` — display badge.
- `src/lib/api.ts` — axios instance.
- `src/lib/` — existing currency formatter (reuse; do **not** create a new one).
- Existing parts-catalog fetch logic under `src/pages/parts/` / `src/stores/` — reuse for the catalog picker.
- `shared/constants/job-statuses.ts` — `JOB_STATUS_FLOW`, `INACTIVE_STATUSES`.
- `shared/permissions.ts` — `jobStatus` and `jobs.edit` allowlists.

---

## Verification

**Backend (unit/integration)**
1. `pnpm test server/__tests__/jobs-status-transition.test.ts` — all new cases pass.
2. `pnpm test` — full suite still green (no regressions in permissions tests at `shared/__tests__/permissions.test.ts`).

**Static checks**
3. `pnpm typecheck` (or `tsc --noEmit`) — clean.
4. `pnpm lint` / ultracite — clean per CLAUDE.md ("never suppress lint warnings").

**Manual QA via Chrome DevTools MCP** (per CLAUDE.md: login as `admin` with `SEED_ADMIN_PASSWORD`)
5. Log in as **OWNER**; open `/jobs`:
   - Click the status cell on an `INTAKE` job → menu shows all `JOB_STATUS_FLOW[INTAKE]` options.
   - Transition `INTAKE → IN_REPAIR`: no dialog, toast success, badge updates immediately.
   - Transition `IN_REPAIR → ON_HOLD`: reason dialog appears, submit empty = disabled, submit with reason = succeeds.
   - Transition `ON_HOLD → CANCELLED`: reason required.
   - Click the job row → lands on `/jobs/:id`.
   - Detail page shows header, current status, allowed-transition buttons, **parts section (empty)**, cost summary (final cost = estimated), and a history timeline with entries for every change above (most recent first), including the reason text under each cancel/hold entry.
6. **Parts flow (still as OWNER on detail page):**
   - Click **Add part** → dialog opens in Catalog mode.
   - Search for a part, pick one → `unitPrice` pre-fills from `defaultPrice`; change qty to 2.
   - Submit → part appears in the section, line total = unitPrice × 2, parts subtotal updates, **cost summary `final_cost` increases by the line total** (validate against server response, not local compute).
   - Switch to **Custom part** tab: add an ad-hoc part with a made-up name, category=OTHER, unitPrice=15, qty=1.
   - Confirm it shows in the list and contributes to `final_cost`.
   - Remove one part → confirmation → `final_cost` decreases.
   - Transition the job to `DELIVERED` (terminal) → the **Add part** button is hidden or disabled, and an API add attempt (via devtools) returns 409 `JOB_IN_TERMINAL_STATUS`.
7. Log in as **TECHNICIAN**:
   - Inline menu only shows `{WAITING_FOR_PARTS, IN_REPAIR, ON_HOLD, DONE, CANCELLED}`; `DELIVERED`/`RETURNED` do not appear even when valid transitions.
   - Detail-page buttons mirror the menu.
   - Can add parts if `jobs.edit` is in their role's allowlist (check `shared/permissions.ts`); otherwise the button is hidden.
8. Log in as **FRONT_DESK**:
   - Can only reach `DELIVERED`/`RETURNED`/`CANCELLED`.
   - Attempting `CANCELLED` on a >30-min-old job owned by someone else → toast `errors.status_change.cancel_window` or `.not_creator`.
   - Parts add/remove is gated by the same `jobs.edit` permission as for other roles.
9. Collect console errors — none should appear (CLAUDE.md rule).
10. Open `/tracking/<jobCode>` (public) after a status change — next page load reflects the new status and translated label. (Parts detail is intentionally **not** exposed on the public tracking page.)

**Cross-locale**
11. Switch UI to `fr` and `ar`; confirm translated status labels, part category labels, RTL layout for the new components, and that the reason dialog + add-part dialog render correctly in both directions.

**Data integrity cross-check**
12. After each parts add/remove in step 6, compare the page's `final_cost` to the value returned by `curl GET /api/jobs/:id` — they must match exactly. If they diverge, the client is computing totals locally; fix by always rendering the server's `finalCost` rather than recomputing.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `transitionStatusSchema` change breaks existing API consumers | `reason` is optional by default; only required for 2 statuses. No existing client sends `reason`, so shape is backward-compatible for all other transitions. |
| Detail page fetches history before job is in store cache | `fetchJobById` fallback always fetches from server; history endpoint is independent. |
| Inline menu conflicts with row-click navigation | Stop propagation on the menu trigger; wrap only non-status cells in the `<Link>`. |
| Adding `reason` may require Prisma migration | No — `AuditLog.note` (text) and `AuditLog.metadata` (Json) already exist in `prisma/schema.prisma`. |
| Client-side cost drift from the server's `finalCost` | Always render the server-returned `finalCost`; refetch the job after every parts add/remove rather than recomputing client-side. Verification step 12 catches regressions. |
| Catalog search performance on large catalogs | Reuse the existing parts-catalog data source (already paginated/filtered for the catalog page). Do not introduce a new unbounded fetch. |
| Ad-hoc parts can't be reported/rolled up (no catalog linkage) | Expected trade-off — the schema already supports this via nullable `partId`. If reporting pain emerges later, a follow-up can prompt to promote ad-hoc parts to the catalog. |
| ultracite / lint surprise on new files | Match surrounding files' formatting; do not suppress warnings. |

---

## Out-of-scope follow-ups (log to `docs/session-notes.md` per CLAUDE.md)

- Wire `NOTIFICATION_SENT` audit action + SMS/WhatsApp driver so the customer is informed on status change.
- WebSocket broadcast so staff and the tracking page refresh without reload.
- Expand the detail page to include notes/repairs editing and technician reassignment.
- Add a separate `supplierCost` field to `JobPart` and a margin view (the `jobs.viewMargin` permission already exists, so this is a schema + UI task for a later PR).
- Promote frequently-used ad-hoc parts into `PartsCatalog` (one-click "Save to catalog" from the parts list).
