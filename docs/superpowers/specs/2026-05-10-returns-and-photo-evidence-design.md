# Returns Tracking & Photo Evidence — Design

**Date:** 2026-05-10
**Author:** Brainstormed with Claude (Opus 4.7)
**Status:** Approved — ready for implementation plan

## Goal

Build first-class **return analytics** for Reparilo so the shop owner can answer:

- Why do repairs come back? (workmanship vs defective part vs misdiagnosis)
- Which technicians, repair types, parts, and suppliers fail most often?
- How much does warranty rework actually cost the shop?
- How fast do failures appear after delivery?

Today the system has only a thin scaffold (`Job.isWarrantyReturn` flag, `Job.warrantyForJobId` link, a single notification, and a Reports KPI). It cannot model refund-only outcomes, has no fault attribution, no warranty period, and no resolution tracking.

## In scope

- **Return scenarios**: warranty rework, different problem post-delivery (with triage), refund / dissatisfaction
- **Fault attribution** (mandatory): `WORKMANSHIP`, `DEFECTIVE_PART`, `MISDIAGNOSIS`
- **Resolutions**: `REWORK_FREE`, `REWORK_PARTIAL_CHARGE`, `REFUND_PARTIAL`, `REFUND_FULL`
- **Warranty period** configurable shop-wide with per-repair-catalog override
- **Photos** — minimal: add a `stage` enum on `job_photos` with values `RETURN_INTAKE` and `RETURN_RESOLUTION`, plus an optional FK `returnClaimId`. No changes to the existing photo upload flow.
- New Reports tab with summary cards, fault breakdown, by-repair / by-part / by-technician tables, time-to-return histogram

## Out of scope

- Customer-fault returns (e.g., new drop after pickup) — triage that ends in "not warranty" creates a new paid Job and records no claim
- Stage-tagging of non-return photos (intake / in-repair / delivery photos remain untagged)
- Mandatory intake photos (a liability-defense feature deferred)
- Customer-facing self-service return portal
- Technician labor cost tracking (the system doesn't model labor cost; net warranty cost excludes it for v1)
- Replacement-device outcome (not selected during requirements)

## Architectural choice

A new `ReturnClaim` entity, separate from `Job`. A claim represents the customer's complaint, fault attribution, and resolution; it may optionally spawn a rework `Job` for `REWORK_*` outcomes. Refund-only outcomes don't create a Job at all. This separates *what was claimed* from *what work was done*, which is what makes clean analytics possible.

The existing `Job.isWarrantyReturn` and `Job.warrantyForJobId` fields are **kept for back-compat**: when a claim spawns a rework Job, those fields are populated automatically so the existing `warranty_return_created` notification and any other downstream consumers continue to work.

## Data model

### New table: `return_claims`

| Column | Type | Notes |
|---|---|---|
| `id` | String PK | cuid |
| `originalJobId` | String FK → `jobs` | the Job being claimed against |
| `claimedJobRepairId` | String? FK → `job_repairs` | optional — the specific repair line |
| `claimedJobPartId` | String? FK → `job_parts` | optional — the specific part |
| `returnReason` | String | free text — customer's complaint |
| `faultCategory` | `FaultCategory?` | null while OPEN; required to RESOLVE |
| `resolutionOutcome` | `ResolutionOutcome?` | null while OPEN; required to RESOLVE |
| `partialChargeAmount` | Decimal(10,2)? | required iff outcome = `REWORK_PARTIAL_CHARGE` |
| `refundAmount` | Decimal(10,2)? | required iff outcome ∈ {`REFUND_PARTIAL`, `REFUND_FULL`} |
| `reworkJobId` | String? UNIQUE FK → `jobs` | required iff outcome ∈ `REWORK_*`; null otherwise |
| `status` | `ReturnClaimStatus` | default `OPEN` |
| `openedAt` | TimestampTZ | default now |
| `resolvedAt` | TimestampTZ? | required when RESOLVED |
| `openedById` | String FK → `users` | who created the claim |
| `resolvedById` | String? FK → `users` | required when RESOLVED |
| `createdAt` / `updatedAt` | TimestampTZ | standard |

**Enums**
- `FaultCategory`: `WORKMANSHIP | DEFECTIVE_PART | MISDIAGNOSIS`
- `ResolutionOutcome`: `REWORK_FREE | REWORK_PARTIAL_CHARGE | REFUND_PARTIAL | REFUND_FULL`
- `ReturnClaimStatus`: `OPEN | RESOLVED`

**DB-level CHECK constraints**
- `status='RESOLVED'` ⇒ `faultCategory IS NOT NULL AND resolutionOutcome IS NOT NULL AND resolvedAt IS NOT NULL AND resolvedById IS NOT NULL`
- `resolutionOutcome IN ('REWORK_FREE','REWORK_PARTIAL_CHARGE')` ⇒ `reworkJobId IS NOT NULL`
- `resolutionOutcome IN ('REFUND_PARTIAL','REFUND_FULL')` ⇒ `reworkJobId IS NULL`
- `resolutionOutcome='REWORK_PARTIAL_CHARGE'` ⇒ `partialChargeAmount IS NOT NULL`
- `resolutionOutcome IN ('REFUND_PARTIAL','REFUND_FULL')` ⇒ `refundAmount IS NOT NULL`

### Modifications to existing tables

| Table | Change | Notes |
|---|---|---|
| `repair_catalog` | add `warrantyDays Int?` | null = inherit shop default |
| App settings | add `defaultWarrantyDays Int default 30` | exact settings table location confirmed during implementation plan |
| `job_photos` | add `stage PhotoStage?` | null = legacy/general (default for existing rows) |
| `job_photos` | add `returnClaimId String? FK → return_claims` | links return-related photos to the claim |

`PhotoStage` enum: `RETURN_INTAKE | RETURN_RESOLUTION`.

### Back-compat

- `Job.isWarrantyReturn` and `Job.warrantyForJobId` remain as-is. Whenever a claim spawns a rework Job, the new Job has both populated automatically.
- Existing `warranty_return_created` notification keeps firing when the rework Job is created.
- Reports' "Warranty Return Rate" KPI is repointed to source from `return_claims` (more accurate — see Analytics).

## Workflow & state machine

State machine is intentionally simple: `OPEN → RESOLVED`. RESOLVED is terminal. There is no separate "in triage" or "in rework" state — those are derived from related fields (`faultCategory` set, `reworkJobId` set, rework Job status).

### Phases

1. **Initiation** (counter staff)
   - Look up original Job by jobCode or customer phone.
   - System computes per-repair warranty status: `effectiveWarrantyDays = repairCatalog.warrantyDays ?? settings.defaultWarrantyDays`. Reference timestamp = the DELIVERED status transition timestamp (read from AuditLog).
   - Each repair / part line on the original Job displays a badge: "In warranty (12 days remaining)" or "Out of warranty (45 days past)".
   - Out-of-warranty does **not** block claim creation — it warns. Goodwill returns are allowed and flagged in analytics.

2. **Triage decision**
   - Staff captures `returnReason` and optionally selects `claimedJobRepairId` or `claimedJobPartId` (or "different problem, no specific line").
   - Staff decides: **accept as return** → ReturnClaim created with status OPEN (faultCategory may still be null). Or **reject as new paid job** → exits the wizard, opens new-job intake; no claim row created.

3. **Diagnosis** (any time after OPEN)
   - Technician sets `faultCategory` via `PATCH /triage`. Can happen at intake if obvious, or later. Decoupled from resolution so the data point is captured even if resolution drags out.

4. **Resolution path A — Rework**
   - Selecting `REWORK_FREE` or `REWORK_PARTIAL_CHARGE` requires spawning a rework Job (`POST /spawn-rework`). The spawned Job has `isWarrantyReturn=true` and `warrantyForJobId=originalJobId`. Claim's `reworkJobId` is set.
   - The rework Job runs through the normal job lifecycle (NEW → IN_REPAIR → DONE → DELIVERED) with its own permissions, audit trail, parts tracking.
   - Claim cannot RESOLVE until rework Job reaches DELIVERED (service-layer check).
   - For `REWORK_PARTIAL_CHARGE`, `partialChargeAmount` is recorded **on the claim**, not on the rework Job's price. The rework Job stays at $0 to preserve clean revenue analytics; the claim's partial charge surfaces in warranty-cost reports.

5. **Resolution path B — Refund**
   - Selecting `REFUND_PARTIAL` or `REFUND_FULL` requires `refundAmount`. No Job is created.
   - Resolves immediately (subject to `returns:resolveRefund` permission — OWNER-only by default).

6. **Closure**
   - `OPEN → RESOLVED` requires faultCategory + resolutionOutcome + path-specific constraints (rework Job at DELIVERED, or refund amount set).
   - Sets `resolvedAt`, `resolvedById`. Writes AuditLog entry.

### Invariants

- Multiple ReturnClaims can exist per original Job (different lines, or same line failing twice). Each is independent.
- `reworkJobId` is `UNIQUE` — one rework Job belongs to exactly one claim.
- A rework Job can itself spawn a future ReturnClaim (the `originalJobId` of the new claim points to the rework Job). Analytics walks chain via `Job.warrantyForJobId` for root-cause history.
- Out-of-warranty claims are accepted (goodwill) and flagged at query time, not snapshotted.

### Notifications

- Existing `warranty_return_created` continues to fire when the rework Job is created (back-compat).
- New `return_claim_resolved` event → notifies OWNER for refund resolutions, so owners catch refund activity even when delegated.

## API surface

Module structure mirrors the existing `job.service` / `routes/jobs.ts` / `shared/schemas/job.schema` pattern:
- `server/services/return-claim.service.ts`
- `server/routes/return-claims.ts`
- `shared/schemas/return-claim.schema.ts`
- `shared/types/return-claim.ts`

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/return-claims` | Create OPEN claim. Body: `{ originalJobId, claimedJobRepairId?, claimedJobPartId?, returnReason }` |
| GET | `/api/return-claims` | List with filters: `status`, `faultCategory`, `resolutionOutcome`, `from`, `to`, `originalJobId`, `technicianId`; paginated |
| GET | `/api/return-claims/:id` | Full claim + originalJob summary + reworkJob summary (if any) + photos |
| PATCH | `/api/return-claims/:id/triage` | Set `faultCategory`. Only on OPEN claims |
| POST | `/api/return-claims/:id/spawn-rework` | Spawn rework Job, set `reworkJobId` on claim |
| POST | `/api/return-claims/:id/detach-rework` | Reset `reworkJobId` (used when rework Job needs cancellation) |
| PATCH | `/api/return-claims/:id/resolve` | Close claim. Body: `{ resolutionOutcome, partialChargeAmount?, refundAmount? }` |
| POST | `/api/return-claims/:id/photos` | Multipart upload with `stage` (`RETURN_INTAKE` \| `RETURN_RESOLUTION`); sets `returnClaimId` and `jobId=originalJobId` on the photo |
| DELETE | `/api/return-claims/:id/photos/:photoId` | Remove photo (only on OPEN claims) |

### Permissions (new `returns` permission group, integrated with existing RBAC)

| Permission | Default mapping |
|---|---|
| `returns:create` | OWNER, ADMIN, technicians, counter staff |
| `returns:edit` | same as create |
| `returns:triage` | OWNER, ADMIN, technicians |
| `returns:resolveRework` | OWNER, ADMIN, technicians |
| `returns:resolveRefund` | **OWNER only** by default — refund is a cash-out, owner sign-off |
| `returns:viewSelf` | technicians (claims where they were original or rework technician) |
| `returns:viewShop` | OWNER, ADMIN |

These are defaults; the existing custom-role system can override.

### Validation rules

- `originalJobId` must reference a Job with status DELIVERED
- `claimedJobRepairId` / `claimedJobPartId`, if provided, must belong to `originalJob`
- Resolve REWORK_*: `reworkJobId` set AND that rework Job at status DELIVERED
- Resolve REWORK_PARTIAL_CHARGE: `partialChargeAmount > 0`
- Resolve REFUND_*: `refundAmount > 0` and `refundAmount ≤ originalJob` total payment received
- Triage: only on OPEN claims; `faultCategory` ∈ enum

### Error codes

All using existing `AppError` SSOT (project rule — never custom errors):

| Code | Trigger |
|---|---|
| `RETURN_CLAIM_NOT_FOUND` | Lookup miss |
| `RETURN_CLAIM_NOT_OPEN` | Triage / resolve / spawn-rework / photo-mutate on RESOLVED claim |
| `RETURN_CLAIM_FAULT_REQUIRED` | Resolve called without `faultCategory` set |
| `RETURN_CLAIM_REWORK_JOB_NOT_DELIVERED` | Resolve REWORK_* with rework Job not at DELIVERED |
| `INVALID_CLAIMED_LINE` | `claimedJobRepairId` / `claimedJobPartId` doesn't belong to `originalJob` |
| `REFUND_EXCEEDS_ORIGINAL` | `refundAmount` > total received on original Job |
| `ORIGINAL_JOB_NOT_DELIVERED` | Claim creation against a Job not at DELIVERED |
| `REWORK_JOB_HAS_OPEN_CLAIM` | Cancellation attempted on a rework Job whose claim is still OPEN |

All error codes get keys in `src/i18n/locales/en.json`; `bun run sync-locales` propagates ar/fr.

## UI surfaces

### New routes

- `/returns` — claims list with filters (status, fault, outcome, date range, technician)
- `/returns/:id` — claim detail page

### Sidebar / nav

Add "Returns" item under "Jobs" in the existing nav, gated on `returns:viewSelf` or `returns:viewShop`.

### Entry points to file a claim

- Primary: **"File return claim"** button on the **Job detail page**, visible only when Job is `DELIVERED` and user has `returns:create`
- Secondary: **"+ New return"** action on the Returns list page (opens with empty original-job lookup)

### Return claim creation wizard (modal, 2 steps)

**Step 1 — Complaint**
- Original job summary (locked if launched from Job page; lookup field if from Returns list)
- List of original Job's repair lines + parts, each with warranty badge: `In warranty (12 days left)` / `Out of warranty (45d ago)`. Click to select. "Different problem (no specific line)" radio at the bottom.
- `returnReason` textarea (required, customer's words)
- Optional photo capture (`stage=RETURN_INTAKE`, reuses existing `photo-source` picker)

**Step 2 — Triage decision**
- Warranty summary derived from selection
- Two buttons:
  - **Accept as return** → POST `/api/return-claims` → redirect to `/returns/:id`
  - **Not a warranty case → create new paid job** → exits wizard, opens existing new-job intake pre-filled with customer + device. **No claim row recorded** (matches scope decision).

### Return claim detail page (`/returns/:id`)

Layout (desktop two-column; mobile stacks):

- **Header**: status badge (OPEN / RESOLVED), goodwill badge if out-of-warranty, original Job link, customer link, opened-by/at, resolved-by/at
- **Original repair claimed**: shows the JobRepair / JobPart line (or "different problem"), customer's `returnReason`
- **Triage section** (visible while OPEN): radio for `faultCategory` (Workmanship / Defective part / Misdiagnosis), Save action calls `PATCH /triage`
- **Resolution section** (visible while OPEN, after fault set; gated on permissions):
  - **Rework path**: `Spawn rework job` button → creates rework Job, navigates to it. Once that Job reaches DELIVERED, returns the user with "Resolve as REWORK_FREE" and "Resolve as REWORK_PARTIAL_CHARGE (with amount)" actions.
  - **Refund path** (visible only with `returns:resolveRefund`): outcome radio + `refundAmount` input + Resolve button
- **Photos**: gallery split by stage (`RETURN_INTAKE`, `RETURN_RESOLUTION`), with add/delete actions on OPEN claims. Reuses existing photo upload component.
- **Activity** (RESOLVED only): timeline from AuditLog (created, triaged, rework spawned, rework delivered, resolved)

### Returns list page (`/returns`)

- Filter bar: status (default OPEN), fault category, outcome, date range, technician (`viewShop` only)
- Table columns: claim date, original Job code, customer, claimed line summary, fault, outcome, status, age (days open)
- Empty states using project's existing empty-state pattern (recent dashboard work)
- Pagination matches existing list pages

### Job detail page enhancements

- New **"Returns history"** section on DELIVERED jobs: lists any ReturnClaims against this Job. Row: date, claimed line, status, outcome → click to claim detail.
- On a rework Job: banner at top "Rework for claim #XYZ on Job #ABC" with click-throughs.

### Dashboard

- Owner-scope: new **"Open returns"** card (count → click to `/returns?status=OPEN`). Reuses dashboard card pattern from recent dashboard work.
- Inline metric on revenue card: "This month's net warranty cost: $X" (subtle, owner only).

### i18n

- All copy keyed in `src/i18n/locales/en.json`, propagated via `bun run sync-locales` (AR/FR/EN trilingual project rule).
- New key prefix: `returns_*` (e.g., `returns_list_title`, `returns_claim_open`, `returns_fault_workmanship`, `returns_resolve_refund_amount_label`, `returns_warranty_in_label`, `returns_warranty_out_label`).

### RTL

- Layouts respect existing RTL utilities for AR. Warranty badges use the existing badge component.

## Analytics & Reports integration

### Existing "Warranty Return Rate" KPI on Repair Operations tab

Repointed formula:
- From: `count(Job.isWarrantyReturn=true)` / completed jobs
- To: `count(return_claims opened in range) / count(jobs delivered in range) × 100`

More accurate — current implementation undercounts because the rework Job is the only carrier of the flag, missing claims that resolve as refund-only.

### New "Returns" tab on the Reports page

Inserted between Repair Operations and Customer Insights.

#### Summary cards (4 across)

| Card | Value | Detail | Permission |
|---|---|---|---|
| Total returns | claims opened in range | vs. previous period | `viewSelf` |
| Warranty return rate | claims / delivered jobs × 100 | vs. previous period | `viewShop` |
| Net warranty cost | refunds + rework parts cost − partial charges | vs. previous period | `viewShop` |
| Avg time to return | avg(`claim.openedAt − originalJob.delivered_at`) days | vs. previous period | `viewSelf` |

**Net warranty cost formula:** `SUM(refundAmount) + SUM(rework_job_parts.totalCost) − SUM(partialChargeAmount)`. Excludes technician labor cost (not tracked) — shown as a footnote on the card.

#### Breakdowns

1. **Fault category breakdown** — donut chart, counts by `faultCategory`. Click → drill to filtered list.
2. **Returns by repair type** — horizontal bar chart, grouped by claimed `JobRepair.repairName`. Top 10. Stacked bar shows fault distribution.
3. **Returns by part / supplier** — table grouped by `JobPart.partName + supplier`. Columns: claim count, primary fault, % defective-part.
4. **Returns by technician** — table (`viewShop` only). Columns: technician, jobs delivered, claims against, return rate %, dominant fault. Hidden under `viewSelf`.
5. **Time-to-return distribution** — histogram, buckets `0–7d`, `8–30d`, `31–60d`, `61–90d`, `90d+`.

#### Permissions on Returns tab

- `viewShop`: full tab
- `viewSelf`: tab visible, scoped to claims where current user is `originalJob.technicianId` OR rework-Job technician. The "by technician" table is hidden.

#### Out-of-warranty / goodwill flag

Computed at query time: `claim.openedAt − originalJob.delivered_at > effectiveWarrantyDays`. Not snapshotted — policy stays consistent across history. Trade-off: changing default warranty days retroactively reclassifies past claims (acceptable per requirements).

#### Period comparison

All cards compute "vs. previous period" via the same `comparePeriod` pattern used by existing Reports cards.

### Drill-down

Every chart segment / table row links to `/returns?...` with appropriate filter pre-applied. Time range from Reports propagates as URL query.

## Back-compat & migration

### Schema migration (one Prisma manual migration per project rule)

1. Create `return_claims` table with FKs and CHECK constraints
2. Add `warrantyDays Int?` to `repair_catalog`
3. Add `defaultWarrantyDays Int default 30` to existing app/shop settings table (location confirmed during implementation plan)
4. Add `stage PhotoStage?` enum column and `returnClaimId String?` FK to `job_photos`
5. Existing `jobs.isWarrantyReturn` and `jobs.warrantyForJobId` unchanged

### Existing data — `Option A: don't backfill`

Historical warranty-return rows stay as Jobs with the flag; no `ReturnClaim` rows are created for them. The Returns tab shows a brief inline note: "Returns analytics are computed from claims (introduced 2026-05-10). Earlier warranty returns are visible only as flagged Jobs."

Cleanest data; ~30-day visible discontinuity in the Warranty Return Rate KPI as new claims accumulate.

## Edge cases (resolved)

1. **Original Job not at DELIVERED** — claim creation blocked (`ORIGINAL_JOB_NOT_DELIVERED`).
2. **Customer phone changed since original Job** — do **not** enforce phone match. Match on `customerId` (stable).
3. **Rework Job cancellation while claim OPEN** — blocked (`REWORK_JOB_HAS_OPEN_CLAIM`). Owner detaches rework via `POST /detach-rework` first; rework Job is then cancellable.
4. **Multiple claims on same line** — allowed. Each independent.
5. **Concurrent triage / resolve** — last-write-wins via Prisma `@updatedAt`. No optimistic concurrency in v1.
6. **Photo mutate on RESOLVED claim** — blocked.
7. **Out-of-warranty claim** — accepted (goodwill); UI shows badge; flag computed at query time.
8. **Customer soft-delete (GDPR)** — existing customer anonymization cascades through Job → Claim. No new behavior.
9. **Permission downgrade between spawn-rework and resolve** — service checks at execution time. Owner finishes the resolve.
10. **Claim on a rework Job** — allowed. `originalJobId` points to the rework Job. Activity timeline renders the chain.
11. **Photo orphans on detach-rework** — `RETURN_RESOLUTION` photos that were on the rework Job stay there; `RETURN_INTAKE` photos on the claim are unaffected.
12. **Race between rework Job DELIVERED and resolve** — resolve reads rework Job status fresh in the same Prisma `$transaction`. Job DELIVERED is terminal in the existing state machine, so reverts can't happen.

## Testing strategy

### Service tests — `server/services/__tests__/return-claim.service.test.ts`

- Create: validates originalJob is DELIVERED; rejects non-belonging `claimedJobRepairId` / `claimedJobPartId`
- Triage: only modifies OPEN claims; idempotent re-triage; faultCategory enum strictly enforced
- Spawn rework: creates Job with `isWarrantyReturn=true` and `warrantyForJobId=originalJobId`; sets `claim.reworkJobId`; rejects double-spawn
- Resolve REWORK_*: requires rework Job at DELIVERED; partial-charge requires `partialChargeAmount > 0`
- Resolve REFUND_*: requires `refundAmount > 0`; `refundAmount ≤ originalJob` total received
- Detach rework: only on OPEN claims; nulls `reworkJobId`
- Block rework Job cancellation while claim OPEN
- All error paths assert correct `AppError` codes

### Route / integration tests — `server/__tests__/return-claims.test.ts` (Fastify `inject`)

- Full happy paths: rework + refund flows end-to-end
- RBAC: counter staff blocked from `resolveRefund`; technician blocked from `viewShop`
- Pagination + filters on list endpoint
- Photo upload: stage enum enforced; `returnClaimId` set on resulting `job_photos` row
- Notifications: `warranty_return_created` fires when rework Job spawned; `return_claim_resolved` fires for refund resolve

### Dashboard / Reports service tests — extend `server/__tests__/dashboard.service.test.ts`

- Warranty return rate computed from claims (replaces existing test)
- Net warranty cost formula
- Time-to-return histogram bucketing
- `viewSelf` vs `viewShop` scoping

### Component tests — `src/components/modules/returns/__tests__/`

- `return-claim-detail.test.tsx`: renders triage section only when OPEN; resolve buttons gated on permissions; activity timeline correct on RESOLVED
- `return-claim-create-wizard.test.tsx`: warranty badges per repair line at the in/out boundary; "different problem" radio works; "create new paid job" exit doesn't POST a claim
- `returns-list.test.tsx`: filter URL state, empty state, pagination

### Migration test

Verify migration runs cleanly on a snapshot of seed data. Existing `isWarrantyReturn=true` Jobs remain functionally unchanged; no `return_claims` rows created.

### i18n test

`bun run sync-locales` runs after every new key added; existing CI gate enforces propagation to ar/fr.

### Manual QA pass

Per project rule "use Chrome DevTools for QA":
- Login as admin, walk through wizard for both rework and refund paths
- Verify console clean, notifications fire, RTL layout intact for AR
- Verify the Returns tab renders for both `viewShop` and `viewSelf` users

## Open items deferred to implementation plan

- Confirm exact app/shop settings table location for `defaultWarrantyDays`
- Confirm exact AuditLog query for "DELIVERED status transition timestamp" of original Job (or whether `Job.deliveredAt` exists as a column)
- Confirm exact "total payment received on original Job" data source for `REFUND_EXCEEDS_ORIGINAL` validation
- Decide on optimistic concurrency only if conflict reports surface in production
