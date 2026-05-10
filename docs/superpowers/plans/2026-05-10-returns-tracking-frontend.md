# Returns Tracking — Frontend UI (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing UI for filing, triaging, resolving, and listing return claims — list page, detail page, create wizard, Job-detail integrations, dashboard card, and nav.

**Architecture:** Three new pages (`/returns`, `/returns/:id`) plus a wizard modal launched from Job detail. UI calls into Plan 1's REST API via `react-query` hooks. New components live under `src/components/modules/returns/`. Permission gating uses the existing `<RequirePermission>` route guard and `useCan` hook against the `returns:*` permissions added in Plan 1.

**Tech Stack:** React 19, React Router 7, @tanstack/react-query, axios via `src/lib/api`, Zustand (auth), react-i18next, Tailwind 4, Material Symbols, Vitest + Testing Library.

**Spec reference:** `docs/superpowers/specs/2026-05-10-returns-and-photo-evidence-design.md`
**Backend prerequisite:** Plan 1 (`docs/superpowers/plans/2026-05-10-returns-tracking-backend.md`) must be merged. Endpoints under `/api/return-claims` and `returns:*` permissions must exist.

**Conventions to honor (from project CLAUDE.md):**
- Bun for everything (`bun install`, `bun run`, `bunx`)
- All new locale keys go in `src/i18n/locales/en.json`; run `bun run sync-locales`
- No barrel files in new module dirs — explicit imports only (the existing `shared/constants/index.ts` barrel is grandfathered)
- Match existing module patterns: components in `src/components/modules/<feature>/`, tests in `<feature>/__tests__/`
- Use existing `api` from `src/lib/api`; existing `useCan` from `src/hooks/use-can`
- All form errors use the existing `AppError`-style display pattern (string `code` mapped through i18n)
- Frequent commits — one per task minimum

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `src/i18n/locales/en.json` | Modify | New `returns_*` keys |
| `src/types/return-claim.ts` | Create | UI-side types (re-exports + view-model shapes) |
| `src/hooks/use-return-claims.ts` | Create | react-query hooks: list, getById, create, triage, spawnRework, resolve, photo upload/delete |
| `src/pages/returns/index.tsx` | Create | Returns list page |
| `src/pages/returns/detail.tsx` | Create | Return claim detail page |
| `src/components/modules/returns/warranty-badge.tsx` | Create | Reusable in/out-of-warranty badge |
| `src/components/modules/returns/claims-table.tsx` | Create | List page table |
| `src/components/modules/returns/claims-filters.tsx` | Create | List page filter bar |
| `src/components/modules/returns/claim-header.tsx` | Create | Detail page header (status, customer, original Job) |
| `src/components/modules/returns/triage-section.tsx` | Create | Detail page triage controls |
| `src/components/modules/returns/resolution-section.tsx` | Create | Detail page rework + refund controls |
| `src/components/modules/returns/claim-photos-section.tsx` | Create | Detail page photos grouped by stage |
| `src/components/modules/returns/create-wizard-modal.tsx` | Create | 2-step wizard launched from Job detail |
| `src/components/modules/returns/__tests__/*` | Create | Component tests |
| `src/components/modules/jobs/job-returns-history-section.tsx` | Create | Returns history list inside Job detail |
| `src/components/modules/jobs/job-actions-menu.tsx` | Modify | Add "File return claim" action |
| `src/components/modules/jobs/intake-modal/*` | (No change) | "Create new paid job" path reuses existing intake |
| `src/components/modules/sidebar.tsx` | Modify | Add "Returns" entry under Jobs |
| `src/components/modules/bottom-nav.tsx` | Modify | Add "Returns" mobile nav entry |
| `src/pages/jobs/detail.tsx` | Modify | Wire in Returns history section + rework banner |
| `src/pages/dashboard/index.tsx` | Modify | Add "Open returns" card (owner) |
| `src/app.tsx` | Modify | Register `/returns` and `/returns/:id` routes |
| `server/services/return-claim.service.ts` | Modify (small) | Extend `getById` with per-line warranty status |

---

## Task 1: Locale Keys + Sync

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Append new `returns_*` keys**

In `src/i18n/locales/en.json`, add the new keys (group them together; ordering doesn't affect parsing). Find an existing block like `"jobs_*"` and add after it:

```json
"returns_nav_label": "Returns",
"returns_list_title": "Return Claims",
"returns_list_subtitle": "Track customer returns, fault attribution, and resolutions",
"returns_list_new_button": "+ New return",
"returns_list_empty_title": "No return claims yet",
"returns_list_empty_desc": "Filed claims will appear here. Create one from a delivered job.",

"returns_filter_status": "Status",
"returns_filter_fault": "Fault",
"returns_filter_outcome": "Outcome",
"returns_filter_from": "From",
"returns_filter_to": "To",
"returns_filter_technician": "Technician",
"returns_filter_clear": "Clear filters",

"returns_status_open": "Open",
"returns_status_resolved": "Resolved",

"returns_fault_workmanship": "Workmanship error",
"returns_fault_defective_part": "Defective part",
"returns_fault_misdiagnosis": "Misdiagnosis",

"returns_outcome_rework_free": "Reworked (free)",
"returns_outcome_rework_partial_charge": "Reworked (partial charge)",
"returns_outcome_refund_partial": "Partial refund",
"returns_outcome_refund_full": "Full refund",

"returns_table_col_date": "Filed",
"returns_table_col_job": "Original job",
"returns_table_col_customer": "Customer",
"returns_table_col_claimed": "Claimed line",
"returns_table_col_fault": "Fault",
"returns_table_col_outcome": "Outcome",
"returns_table_col_status": "Status",
"returns_table_col_age": "Age",
"returns_table_age_days": "{{count}}d",
"returns_table_claimed_other": "Different problem",

"returns_warranty_in": "In warranty",
"returns_warranty_in_remaining": "In warranty ({{days}}d remaining)",
"returns_warranty_out": "Out of warranty",
"returns_warranty_out_past": "Out of warranty ({{days}}d past)",
"returns_warranty_goodwill": "Goodwill",

"returns_wizard_step1_title": "Customer complaint",
"returns_wizard_step2_title": "Triage decision",
"returns_wizard_select_line_help": "Pick the repair or part being claimed, or choose \"different problem\".",
"returns_wizard_different_problem": "Different problem (no specific line)",
"returns_wizard_reason_label": "Customer's complaint",
"returns_wizard_reason_placeholder": "What did the customer say?",
"returns_wizard_photos_label": "Photo of issue (optional)",
"returns_wizard_accept": "Accept as return",
"returns_wizard_reject": "Not a warranty case → create new paid job",
"returns_wizard_back": "Back",
"returns_wizard_next": "Next",
"returns_wizard_cancel": "Cancel",

"returns_detail_title": "Return claim {{id}}",
"returns_detail_back": "Back to returns",
"returns_detail_original_job": "Original job",
"returns_detail_customer": "Customer",
"returns_detail_opened_by": "Opened by {{name}} on {{date}}",
"returns_detail_resolved_by": "Resolved by {{name}} on {{date}}",
"returns_detail_claimed_repair": "Claimed repair",
"returns_detail_claimed_part": "Claimed part",
"returns_detail_no_line": "Different problem (no specific line)",
"returns_detail_customer_complaint": "Customer's complaint",

"returns_triage_title": "Fault attribution",
"returns_triage_help": "What caused this return? Required before resolution.",
"returns_triage_save": "Save",
"returns_triage_saved": "Fault category saved",

"returns_resolution_title": "Resolution",
"returns_resolution_choose_path": "Choose how to resolve this claim:",
"returns_resolution_path_rework": "Rework",
"returns_resolution_path_refund": "Refund",
"returns_resolution_spawn_rework": "Spawn rework job",
"returns_resolution_rework_pending": "Waiting for rework job to be delivered",
"returns_resolution_rework_delivered": "Rework job delivered — ready to resolve",
"returns_resolution_resolve_rework_free": "Resolve as Reworked (free)",
"returns_resolution_resolve_rework_partial": "Resolve as Reworked (partial charge)",
"returns_resolution_partial_charge_label": "Partial charge amount",
"returns_resolution_refund_amount_label": "Refund amount",
"returns_resolution_resolve_refund_partial": "Resolve as Partial refund",
"returns_resolution_resolve_refund_full": "Resolve as Full refund",
"returns_resolution_resolved_at": "Resolved on {{date}}",
"returns_resolution_resolved_outcome": "Outcome: {{outcome}}",

"returns_photos_title": "Photos",
"returns_photos_intake": "Intake (issue evidence)",
"returns_photos_resolution": "Resolution (proof of fix)",
"returns_photos_add": "Add photo",
"returns_photos_empty_intake": "No intake photos yet",
"returns_photos_empty_resolution": "No resolution photos yet",

"returns_job_history_title": "Returns history",
"returns_job_history_empty": "No return claims for this job",

"returns_rework_banner": "Rework for claim against job {{jobCode}}",
"returns_rework_banner_link": "View original claim",

"returns_file_button": "File return claim",
"returns_file_only_delivered": "Only available after delivery",

"returns_dashboard_open_card_title": "Open returns",
"returns_dashboard_open_card_subtitle": "Click to review",

"returns_toast_created": "Return claim filed",
"returns_toast_resolved": "Return claim resolved",
"returns_toast_rework_spawned": "Rework job created",
"returns_toast_photo_added": "Photo added",
"returns_toast_photo_removed": "Photo removed"
```

- [ ] **Step 2: Sync locales**

Run: `bun run sync-locales`
Expected: ar.json and fr.json updated.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n(returns): add returns_* locale keys for frontend"
```

---

## Task 2: Backend Addendum — Hydrate Warranty Status on Claim Detail

**Files:**
- Modify: `server/services/return-claim.service.ts`
- Modify: `server/services/__tests__/return-claim.service.test.ts`

The wizard's "warranty badge" per repair line and the detail page's "goodwill" badge both need the original Job's DELIVERED timestamp + per-line `effectiveWarrantyDays`. We compute it server-side once and ship it with the claim.

- [ ] **Step 1: Write the test**

Append to `server/services/__tests__/return-claim.service.test.ts`:

```ts
describe("getById warranty hydration", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    // ensure shopSettings + auditLog are in mockPrisma factory
  });

  it("includes effectiveWarrantyDays + deliveredAt + isInWarranty on the claim", async () => {
    const deliveredAt = new Date("2026-04-01T10:00:00Z");
    prisma.returnClaim.findUnique.mockResolvedValue({
      id: "rc-1",
      status: "OPEN",
      openedAt: new Date("2026-04-15T10:00:00Z"),
      originalJob: {
        id: "job-1",
        jobCode: "RPR-001",
        repairs: [
          { id: "jr-1", repairName: "Screen", repairId: "rc-1", repair: { warrantyDays: 60 } },
          { id: "jr-2", repairName: "Battery", repairId: "rc-2", repair: { warrantyDays: null } },
        ],
      },
      claimedJobRepair: { id: "jr-1" },
      claimedJobPart: null,
    });
    prisma.shopSettings.findFirst.mockResolvedValue({ defaultWarrantyDays: 30 });
    prisma.auditLog.findFirst.mockResolvedValue({ createdAt: deliveredAt });

    const result = await getById(prisma as never, "rc-1");

    expect(result).toMatchObject({
      id: "rc-1",
      warrantyInfo: {
        deliveredAt,
        claimedLineWarrantyDays: 60,
        isInWarrantyAtOpen: true,
      },
    });
  });
});
```

Add to the `mockPrisma()` factory at the top of the test file:

```ts
shopSettings: { findFirst: vi.fn() } as Record<string, AnyFn>,
auditLog: { findFirst: vi.fn() } as Record<string, AnyFn>,
```

- [ ] **Step 2: Run, expect failure**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: FAIL — `warrantyInfo` not present on result.

- [ ] **Step 3: Extend `getById` to hydrate warranty info**

Modify `server/services/return-claim.service.ts`. Update the `CLAIM_INCLUDE` constant (added in Plan 1 Task 7) to nest `repairs` under `originalJob`:

```ts
const CLAIM_INCLUDE = {
  originalJob: {
    select: {
      id: true,
      jobCode: true,
      status: true,
      technicianId: true,
      customer: { select: { id: true, name: true, phone: true } },
      device: { select: { id: true, brand: true, model: true } },
      repairs: {
        select: {
          id: true,
          repairName: true,
          category: true,
          price: true,
          repair: { select: { warrantyDays: true } },
        },
      },
      partsUsed: {
        select: {
          id: true,
          partName: true,
          category: true,
          totalCost: true,
        },
      },
    },
  },
  reworkJob: {
    select: { id: true, jobCode: true, status: true },
  },
  claimedJobRepair: { select: { id: true, repairName: true, category: true, price: true } },
  claimedJobPart: { select: { id: true, partName: true, category: true, totalCost: true } },
  openedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  photos: true,
} as const;
```

Replace the existing `getById` body with:

```ts
export async function getById(prisma: DbClient, id: string) {
  const claim = await prisma.returnClaim.findUnique({
    where: { id },
    include: CLAIM_INCLUDE,
  });
  if (!claim) return null;

  // Hydrate warranty info: deliveredAt + claimed line's effective warranty days
  const [shopSettings, deliveredAuditLog] = await Promise.all([
    prisma.shopSettings.findFirst({ select: { defaultWarrantyDays: true } }),
    prisma.auditLog.findFirst({
      where: {
        jobId: claim.originalJob.id,
        // adapt to the actual AuditLog shape — the existing schema may use newStatus or transition fields
        newStatus: "DELIVERED",
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const defaultDays = shopSettings?.defaultWarrantyDays ?? 30;
  const claimedRepairId = claim.claimedJobRepair?.id ?? null;
  const claimedRepair = claim.originalJob.repairs.find((r) => r.id === claimedRepairId);
  const claimedLineWarrantyDays =
    claimedRepair?.repair?.warrantyDays ?? defaultDays;

  const deliveredAt = deliveredAuditLog?.createdAt ?? null;
  const isInWarrantyAtOpen =
    deliveredAt !== null
      ? (claim.openedAt.getTime() - deliveredAt.getTime()) / 86_400_000 <=
        claimedLineWarrantyDays
      : false;

  return {
    ...claim,
    warrantyInfo: {
      deliveredAt,
      claimedLineWarrantyDays,
      isInWarrantyAtOpen,
    },
  };
}
```

> **Note:** the AuditLog schema details (`newStatus` field name, ordering) need verification against the actual `prisma/schema.prisma` AuditLog model. If the project tracks status transitions differently (e.g., a `from`/`to` shape), adjust the `where` clause.

- [ ] **Step 4: Run, expect pass**

Run: `bun vitest run server/services/__tests__/return-claim.service.test.ts`
Expected: warranty hydration test passes.

- [ ] **Step 5: Commit**

```bash
git add server/services/return-claim.service.ts server/services/__tests__/return-claim.service.test.ts
git commit -m "feat(returns): hydrate warranty info in claim detail response"
```

---

## Task 3: UI Types and react-query Hooks

**Files:**
- Create: `src/types/return-claim.ts`
- Create: `src/hooks/use-return-claims.ts`

- [ ] **Step 1: Create the UI type module**

Create `src/types/return-claim.ts`:

```ts
import type {
  FaultCategory,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaimStatus,
} from "@shared/types/return-claim";

export type {
  FaultCategory,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaimStatus,
};

export interface ClaimWarrantyInfo {
  deliveredAt: string | null;
  claimedLineWarrantyDays: number;
  isInWarrantyAtOpen: boolean;
}

export interface ReturnClaimDetail {
  id: string;
  originalJob: {
    id: string;
    jobCode: string;
    status: string;
    technicianId: string | null;
    customer: { id: string; name: string; phone: string };
    device: { id: string; brand: { name: string } | string; model: string };
    repairs: Array<{
      id: string;
      repairName: string;
      category: string;
      price: number;
      repair: { warrantyDays: number | null } | null;
    }>;
    partsUsed: Array<{
      id: string;
      partName: string;
      category: string;
      totalCost: number;
    }>;
  };
  reworkJob: { id: string; jobCode: string; status: string } | null;
  claimedJobRepair: { id: string; repairName: string; category: string; price: number } | null;
  claimedJobPart: { id: string; partName: string; category: string; totalCost: number } | null;
  openedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
  photos: Array<{
    id: string;
    path: string;
    stage: PhotoStage | null;
    returnClaimId: string | null;
    createdAt: string;
  }>;
  returnReason: string;
  faultCategory: FaultCategory | null;
  resolutionOutcome: ResolutionOutcome | null;
  partialChargeAmount: number | null;
  refundAmount: number | null;
  status: ReturnClaimStatus;
  openedAt: string;
  resolvedAt: string | null;
  warrantyInfo: ClaimWarrantyInfo;
}

export interface ReturnClaimListItem {
  id: string;
  originalJob: { id: string; jobCode: string; customer: { name: string } };
  claimedJobRepair: { repairName: string } | null;
  claimedJobPart: { partName: string } | null;
  faultCategory: FaultCategory | null;
  resolutionOutcome: ResolutionOutcome | null;
  status: ReturnClaimStatus;
  openedAt: string;
  resolvedAt: string | null;
}

export interface ListClaimsParams {
  status?: ReturnClaimStatus;
  faultCategory?: FaultCategory;
  resolutionOutcome?: ResolutionOutcome;
  from?: string;
  to?: string;
  technicianId?: string;
  originalJobId?: string;
  page?: number;
  limit?: number;
}

export interface ListClaimsResponse {
  items: ReturnClaimListItem[];
  total: number;
  page: number;
  limit: number;
}
```

- [ ] **Step 2: Create the react-query hooks**

Create `src/hooks/use-return-claims.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  FaultCategory,
  ListClaimsParams,
  ListClaimsResponse,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaimDetail,
} from "@/types/return-claim";

const KEY = "return-claims";

export function useReturnClaimsList(params: ListClaimsParams) {
  return useQuery({
    queryKey: [KEY, "list", params],
    queryFn: async () => {
      const res = await api.get<ListClaimsResponse>("/return-claims", { params });
      return res.data;
    },
  });
}

export function useReturnClaim(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: async () => {
      const res = await api.get<ReturnClaimDetail>(`/return-claims/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateReturnClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      originalJobId: string;
      claimedJobRepairId?: string;
      claimedJobPartId?: string;
      returnReason: string;
    }) => {
      const res = await api.post<{ id: string }>("/return-claims", input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useTriageClaim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { faultCategory: FaultCategory }) => {
      const res = await api.patch(`/return-claims/${id}/triage`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}

export function useSpawnRework(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ claimId: string; reworkJobId: string }>(
        `/return-claims/${id}/spawn-rework`,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useResolveClaim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      resolutionOutcome: ResolutionOutcome;
      partialChargeAmount?: number;
      refundAmount?: number;
    }) => {
      const res = await api.patch(`/return-claims/${id}/resolve`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useUploadClaimPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; stage: PhotoStage }) => {
      const fd = new FormData();
      fd.append("file", input.file);
      fd.append("stage", input.stage);
      const res = await api.post(`/return-claims/${id}/photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}

export function useDeleteClaimPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/return-claims/${id}/photos/${photoId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}
```

- [ ] **Step 3: Lint check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/return-claim.ts src/hooks/use-return-claims.ts
git commit -m "feat(returns): UI types and react-query hooks"
```

---

## Task 4: Warranty Badge Component

**Files:**
- Create: `src/components/modules/returns/warranty-badge.tsx`
- Create: `src/components/modules/returns/__tests__/warranty-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/modules/returns/__tests__/warranty-badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import WarrantyBadge from "../warranty-badge";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("WarrantyBadge", () => {
  it("shows in-warranty with remaining days when daysSinceDelivered <= warrantyDays", () => {
    renderWithI18n(<WarrantyBadge daysSinceDelivered={10} warrantyDays={30} />);
    expect(screen.getByText(/In warranty/i)).toBeInTheDocument();
    expect(screen.getByText(/20d remaining/i)).toBeInTheDocument();
  });

  it("shows out-of-warranty with days past when exceeded", () => {
    renderWithI18n(<WarrantyBadge daysSinceDelivered={45} warrantyDays={30} />);
    expect(screen.getByText(/Out of warranty/i)).toBeInTheDocument();
    expect(screen.getByText(/15d past/i)).toBeInTheDocument();
  });

  it("renders nothing when deliveredAt is null", () => {
    const { container } = renderWithI18n(
      <WarrantyBadge daysSinceDelivered={null} warrantyDays={30} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun vitest run src/components/modules/returns/__tests__/warranty-badge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement WarrantyBadge**

Create `src/components/modules/returns/warranty-badge.tsx`:

```tsx
import { useTranslation } from "react-i18next";

interface WarrantyBadgeProps {
  daysSinceDelivered: number | null;
  warrantyDays: number;
}

export default function WarrantyBadge({
  daysSinceDelivered,
  warrantyDays,
}: WarrantyBadgeProps) {
  const { t } = useTranslation();

  if (daysSinceDelivered === null) {
    return null;
  }

  const inWarranty = daysSinceDelivered <= warrantyDays;
  const days = inWarranty
    ? warrantyDays - daysSinceDelivered
    : daysSinceDelivered - warrantyDays;

  const className = inWarranty
    ? "inline-flex items-center rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-medium text-on-tertiary-container"
    : "inline-flex items-center rounded-full bg-error-container px-2.5 py-0.5 text-xs font-medium text-on-error-container";

  const text = inWarranty
    ? t("returns_warranty_in_remaining", { days })
    : t("returns_warranty_out_past", { days });

  return <span className={className}>{text}</span>;
}
```

> **Note:** `bg-tertiary-container` etc are project Tailwind theme tokens. If they don't exist, swap for the closest variants used in the existing badge components — check `src/components/modules/jobs/jobs-table.tsx` or `bottom-nav.tsx` for prior badge usage.

- [ ] **Step 4: Run, expect pass**

Run: `bun vitest run src/components/modules/returns/__tests__/warranty-badge.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/returns/warranty-badge.tsx src/components/modules/returns/__tests__/warranty-badge.test.tsx
git commit -m "feat(returns): warranty badge component"
```

---

## Task 5: Returns List Page (Skeleton + Route)

**Files:**
- Create: `src/pages/returns/index.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create the page skeleton**

Create `src/pages/returns/index.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReturnClaimsList } from "@/hooks/use-return-claims";
import type { ListClaimsParams } from "@/types/return-claim";
import ClaimsFilters from "@/components/modules/returns/claims-filters";
import ClaimsTable from "@/components/modules/returns/claims-table";

export default function ReturnsListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ListClaimsParams>({ status: "OPEN", page: 1, limit: 20 });
  const { data, isLoading } = useReturnClaimsList(filters);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">{t("returns_list_title")}</h1>
        <p className="mt-1 text-on-surface-variant">{t("returns_list_subtitle")}</p>
      </header>

      <ClaimsFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="rounded-lg border border-outline-variant p-6 text-center text-on-surface-variant">
          {/* simple loading state — match existing list-page skeleton if present */}
          Loading…
        </div>
      ) : (
        <ClaimsTable
          items={data?.items ?? []}
          total={data?.total ?? 0}
          page={filters.page ?? 1}
          limit={filters.limit ?? 20}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `src/app.tsx`**

Add the lazy import alongside existing ones (look around line 26 for `JobsPage`):

```tsx
const ReturnsListPage = lazy(() => import("@/pages/returns"));
const ReturnDetailPage = lazy(() => import("@/pages/returns/detail"));
```

In the `<Routes>` block, add (next to the Jobs routes, gated on `returns:viewSelf`):

```tsx
<Route element={<RequirePermission perm={{ returns: ["viewSelf"] }} />}>
  <Route
    element={
      <DashboardLayout>
        <ReturnsListPage />
      </DashboardLayout>
    }
    path="/returns"
  />
  <Route
    element={
      <DashboardLayout>
        <ReturnDetailPage />
      </DashboardLayout>
    }
    path="/returns/:id"
  />
</Route>
```

- [ ] **Step 3: Boot the dev server**

Run: `bun run dev` (or check `package.json` for the actual script)
Open: `http://localhost:5173/returns`
Expected: page renders with title and "Loading…" or empty placeholder. The `ClaimsFilters` and `ClaimsTable` components don't exist yet so the page errors — that's fine; we build them next.

- [ ] **Step 4: Commit (page scaffolding only)**

```bash
git add src/pages/returns/index.tsx src/app.tsx
git commit -m "feat(returns): returns list page route skeleton"
```

---

## Task 6: Claims Filters Component

**Files:**
- Create: `src/components/modules/returns/claims-filters.tsx`
- Create: `src/components/modules/returns/__tests__/claims-filters.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/modules/returns/__tests__/claims-filters.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import ClaimsFilters from "../claims-filters";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("ClaimsFilters", () => {
  it("calls onChange when status changes", () => {
    const onChange = vi.fn();
    renderWithI18n(<ClaimsFilters value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "RESOLVED" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "RESOLVED", page: 1 }));
  });

  it("clear button resets all filters", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <ClaimsFilters value={{ status: "OPEN", faultCategory: "WORKMANSHIP" }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun vitest run src/components/modules/returns/__tests__/claims-filters.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

Create `src/components/modules/returns/claims-filters.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import type { ListClaimsParams } from "@/types/return-claim";

interface Props {
  value: ListClaimsParams;
  onChange: (next: ListClaimsParams) => void;
}

export default function ClaimsFilters({ value, onChange }: Props) {
  const { t } = useTranslation();

  const set = <K extends keyof ListClaimsParams>(key: K, v: ListClaimsParams[K]) =>
    onChange({ ...value, [key]: v, page: 1 });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant bg-surface-container p-4">
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">{t("returns_filter_status")}</span>
        <select
          aria-label={t("returns_filter_status")}
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.status ?? ""}
          onChange={(e) => set("status", (e.target.value || undefined) as ListClaimsParams["status"])}
        >
          <option value="">—</option>
          <option value="OPEN">{t("returns_status_open")}</option>
          <option value="RESOLVED">{t("returns_status_resolved")}</option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">{t("returns_filter_fault")}</span>
        <select
          aria-label={t("returns_filter_fault")}
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.faultCategory ?? ""}
          onChange={(e) =>
            set("faultCategory", (e.target.value || undefined) as ListClaimsParams["faultCategory"])
          }
        >
          <option value="">—</option>
          <option value="WORKMANSHIP">{t("returns_fault_workmanship")}</option>
          <option value="DEFECTIVE_PART">{t("returns_fault_defective_part")}</option>
          <option value="MISDIAGNOSIS">{t("returns_fault_misdiagnosis")}</option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">{t("returns_filter_outcome")}</span>
        <select
          aria-label={t("returns_filter_outcome")}
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.resolutionOutcome ?? ""}
          onChange={(e) =>
            set("resolutionOutcome", (e.target.value || undefined) as ListClaimsParams["resolutionOutcome"])
          }
        >
          <option value="">—</option>
          <option value="REWORK_FREE">{t("returns_outcome_rework_free")}</option>
          <option value="REWORK_PARTIAL_CHARGE">{t("returns_outcome_rework_partial_charge")}</option>
          <option value="REFUND_PARTIAL">{t("returns_outcome_refund_partial")}</option>
          <option value="REFUND_FULL">{t("returns_outcome_refund_full")}</option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">{t("returns_filter_from")}</span>
        <input
          aria-label={t("returns_filter_from")}
          type="date"
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.from ? value.from.slice(0, 10) : ""}
          onChange={(e) =>
            set("from", e.target.value ? new Date(e.target.value).toISOString() : undefined)
          }
        />
      </label>

      <label className="flex flex-col text-sm">
        <span className="mb-1 text-on-surface-variant">{t("returns_filter_to")}</span>
        <input
          aria-label={t("returns_filter_to")}
          type="date"
          className="rounded border border-outline-variant bg-surface px-2 py-1.5"
          value={value.to ? value.to.slice(0, 10) : ""}
          onChange={(e) =>
            set("to", e.target.value ? new Date(e.target.value).toISOString() : undefined)
          }
        />
      </label>

      <button
        type="button"
        className="rounded border border-outline-variant bg-surface px-3 py-1.5 text-sm hover:bg-surface-container-high"
        onClick={() => onChange({ page: 1, limit: 20 })}
      >
        {t("returns_filter_clear")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `bun vitest run src/components/modules/returns/__tests__/claims-filters.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/returns/claims-filters.tsx src/components/modules/returns/__tests__/claims-filters.test.tsx
git commit -m "feat(returns): claims filter bar"
```

---

## Task 7: Claims Table Component

**Files:**
- Create: `src/components/modules/returns/claims-table.tsx`

- [ ] **Step 1: Implement the table (follows pattern of `src/components/modules/jobs/jobs-table.tsx`)**

Create `src/components/modules/returns/claims-table.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ReturnClaimListItem } from "@/types/return-claim";

interface Props {
  items: ReturnClaimListItem[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function ageDays(openedAt: string, resolvedAt: string | null): number {
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  return Math.max(0, Math.floor((end.getTime() - new Date(openedAt).getTime()) / 86_400_000));
}

export default function ClaimsTable({ items, total, page, limit, onPageChange }: Props) {
  const { t, i18n } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface-container p-10 text-center">
        <p className="text-lg font-medium text-on-surface">{t("returns_list_empty_title")}</p>
        <p className="mt-1 text-sm text-on-surface-variant">{t("returns_list_empty_desc")}</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(i18n.language);

  const claimedLine = (it: ReturnClaimListItem) =>
    it.claimedJobRepair?.repairName ??
    it.claimedJobPart?.partName ??
    t("returns_table_claimed_other");

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-high text-left text-on-surface-variant">
          <tr>
            <th className="px-3 py-2">{t("returns_table_col_date")}</th>
            <th className="px-3 py-2">{t("returns_table_col_job")}</th>
            <th className="px-3 py-2">{t("returns_table_col_customer")}</th>
            <th className="px-3 py-2">{t("returns_table_col_claimed")}</th>
            <th className="px-3 py-2">{t("returns_table_col_fault")}</th>
            <th className="px-3 py-2">{t("returns_table_col_outcome")}</th>
            <th className="px-3 py-2">{t("returns_table_col_status")}</th>
            <th className="px-3 py-2">{t("returns_table_col_age")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant bg-surface">
          {items.map((it) => (
            <tr key={it.id} className="hover:bg-surface-container">
              <td className="px-3 py-2">{fmtDate(it.openedAt)}</td>
              <td className="px-3 py-2">
                <Link className="underline" to={`/jobs/${it.originalJob.id}`}>
                  {it.originalJob.jobCode}
                </Link>
              </td>
              <td className="px-3 py-2">{it.originalJob.customer.name}</td>
              <td className="px-3 py-2">
                <Link className="underline" to={`/returns/${it.id}`}>
                  {claimedLine(it)}
                </Link>
              </td>
              <td className="px-3 py-2">
                {it.faultCategory ? t(`returns_fault_${it.faultCategory.toLowerCase()}`) : "—"}
              </td>
              <td className="px-3 py-2">
                {it.resolutionOutcome ? t(`returns_outcome_${it.resolutionOutcome.toLowerCase()}`) : "—"}
              </td>
              <td className="px-3 py-2">{t(`returns_status_${it.status.toLowerCase()}`)}</td>
              <td className="px-3 py-2">
                {t("returns_table_age_days", { count: ageDays(it.openedAt, it.resolvedAt) })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav className="flex items-center justify-between border-t border-outline-variant bg-surface-container px-3 py-2 text-sm">
        <span>{`${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}`}</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-outline-variant px-2 py-1 disabled:opacity-50"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ‹
          </button>
          <button
            type="button"
            className="rounded border border-outline-variant px-2 py-1 disabled:opacity-50"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            ›
          </button>
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders end-to-end**

Run: `bun run dev`. Visit `/returns`. Expected: filters render; table renders the empty state until data exists.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/returns/claims-table.tsx
git commit -m "feat(returns): claims list table with pagination and empty state"
```

---

## Task 8: Claim Detail Page (Header + Layout)

**Files:**
- Create: `src/pages/returns/detail.tsx`
- Create: `src/components/modules/returns/claim-header.tsx`

- [ ] **Step 1: Implement the header component**

Create `src/components/modules/returns/claim-header.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

export default function ClaimHeader({ claim }: Props) {
  const { t, i18n } = useTranslation();
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString(i18n.language) : "—");
  const isGoodwill =
    claim.warrantyInfo.deliveredAt !== null && !claim.warrantyInfo.isInWarrantyAtOpen;

  return (
    <header className="space-y-3">
      <Link to="/returns" className="text-sm text-on-surface-variant underline">
        ← {t("returns_detail_back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("returns_detail_title", { id: claim.id })}</h1>
        <span
          className={
            claim.status === "OPEN"
              ? "rounded-full bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container"
              : "rounded-full bg-surface-variant px-3 py-1 text-xs font-medium"
          }
        >
          {t(`returns_status_${claim.status.toLowerCase()}`)}
        </span>
        {isGoodwill && (
          <span className="rounded-full bg-error-container px-3 py-1 text-xs font-medium text-on-error-container">
            {t("returns_warranty_goodwill")}
          </span>
        )}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
        <div>
          <span className="text-on-surface-variant">{t("returns_detail_original_job")}: </span>
          <Link className="underline" to={`/jobs/${claim.originalJob.id}`}>
            {claim.originalJob.jobCode}
          </Link>
        </div>
        <div>
          <span className="text-on-surface-variant">{t("returns_detail_customer")}: </span>
          <Link className="underline" to={`/customers/${claim.originalJob.customer.id}`}>
            {claim.originalJob.customer.name}
          </Link>
        </div>
        <div className="sm:col-span-2 md:col-span-1">
          {t("returns_detail_opened_by", {
            name: claim.openedBy.name,
            date: fmt(claim.openedAt),
          })}
        </div>
        {claim.resolvedAt && claim.resolvedBy && (
          <div className="sm:col-span-2 md:col-span-1">
            {t("returns_detail_resolved_by", {
              name: claim.resolvedBy.name,
              date: fmt(claim.resolvedAt),
            })}
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Implement the detail page shell**

Create `src/pages/returns/detail.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import ClaimHeader from "@/components/modules/returns/claim-header";
import { useReturnClaim } from "@/hooks/use-return-claims";

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: claim, isLoading } = useReturnClaim(id);

  if (isLoading || !claim) {
    return <div className="p-6">Loading…</div>;
  }

  const claimedLine =
    claim.claimedJobRepair?.repairName ??
    claim.claimedJobPart?.partName ??
    t("returns_detail_no_line");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ClaimHeader claim={claim} />

      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">
          {claim.claimedJobRepair
            ? t("returns_detail_claimed_repair")
            : claim.claimedJobPart
              ? t("returns_detail_claimed_part")
              : t("returns_detail_no_line")}
        </h2>
        <p className="mt-1 text-on-surface">{claimedLine}</p>
        <h3 className="mt-3 text-sm font-medium text-on-surface-variant">
          {t("returns_detail_customer_complaint")}
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-on-surface">{claim.returnReason}</p>
      </section>

      {/* TriageSection, ResolutionSection, ClaimPhotosSection rendered in following tasks */}
    </div>
  );
}
```

- [ ] **Step 3: Visit `/returns/<id>` for any existing claim**

Run: `bun run dev`. Browse to a claim id (create one via curl first if none exist). Expected: header + complaint section render.

- [ ] **Step 4: Commit**

```bash
git add src/pages/returns/detail.tsx src/components/modules/returns/claim-header.tsx
git commit -m "feat(returns): claim detail page header and layout"
```

---

## Task 9: Triage Section

**Files:**
- Create: `src/components/modules/returns/triage-section.tsx`
- Modify: `src/pages/returns/detail.tsx`

- [ ] **Step 1: Implement the section**

Create `src/components/modules/returns/triage-section.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useTriageClaim } from "@/hooks/use-return-claims";
import type { FaultCategory, ReturnClaimDetail } from "@/types/return-claim";
import { useCan } from "@/hooks/use-can";

interface Props {
  claim: ReturnClaimDetail;
}

const OPTIONS: FaultCategory[] = ["WORKMANSHIP", "DEFECTIVE_PART", "MISDIAGNOSIS"];

export default function TriageSection({ claim }: Props) {
  const { t } = useTranslation();
  const canTriage = useCan({ returns: ["triage"] });
  const triage = useTriageClaim(claim.id);
  const [selected, setSelected] = useState<FaultCategory | null>(claim.faultCategory);

  if (claim.status === "RESOLVED") {
    return null;
  }

  const onSave = async () => {
    if (!selected) return;
    await triage.mutateAsync({ faultCategory: selected });
    toast.success(t("returns_triage_saved"));
  };

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">{t("returns_triage_title")}</h2>
      <p className="mt-1 text-sm text-on-surface-variant">{t("returns_triage_help")}</p>

      <fieldset className="mt-3 space-y-2" disabled={!canTriage}>
        {OPTIONS.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="faultCategory"
              value={opt}
              checked={selected === opt}
              onChange={() => setSelected(opt)}
            />
            {t(`returns_fault_${opt.toLowerCase()}`)}
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        className="mt-3 rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
        onClick={onSave}
        disabled={!canTriage || !selected || triage.isPending || selected === claim.faultCategory}
      >
        {t("returns_triage_save")}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Wire into the detail page**

In `src/pages/returns/detail.tsx`, import and render `<TriageSection claim={claim} />` after the complaint section:

```tsx
import TriageSection from "@/components/modules/returns/triage-section";
// ... inside the JSX:
<TriageSection claim={claim} />
```

- [ ] **Step 3: Manual verification**

Run dev, log in as a TECHNICIAN, open a claim. Expected: triage radios visible and savable. Switch to FRONT_DESK — radios should be disabled (no `returns:triage` permission).

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/returns/triage-section.tsx src/pages/returns/detail.tsx
git commit -m "feat(returns): triage section with permission gating"
```

---

## Task 10: Resolution Section

**Files:**
- Create: `src/components/modules/returns/resolution-section.tsx`
- Modify: `src/pages/returns/detail.tsx`

This section has two modes: rework path (Spawn rework button → wait for delivery → resolve) and refund path (amount + outcome → resolve). Permission gating: rework actions need `returns:resolveRework`; refund actions need `returns:resolveRefund`.

- [ ] **Step 1: Implement the component**

Create `src/components/modules/returns/resolution-section.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import {
  useResolveClaim,
  useSpawnRework,
} from "@/hooks/use-return-claims";
import type { ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

export default function ResolutionSection({ claim }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const canRework = useCan({ returns: ["resolveRework"] });
  const canRefund = useCan({ returns: ["resolveRefund"] });
  const spawnRework = useSpawnRework(claim.id);
  const resolveClaim = useResolveClaim(claim.id);

  const [partialCharge, setPartialCharge] = useState<string>("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [path, setPath] = useState<"rework" | "refund">(
    claim.reworkJob ? "rework" : "rework",
  );

  if (claim.status === "RESOLVED") {
    return (
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">{t("returns_resolution_title")}</h2>
        <p className="mt-2 text-on-surface">
          {t("returns_resolution_resolved_outcome", {
            outcome: t(`returns_outcome_${claim.resolutionOutcome?.toLowerCase()}`),
          })}
        </p>
        {claim.resolvedAt && (
          <p className="text-sm text-on-surface-variant">
            {t("returns_resolution_resolved_at", {
              date: new Date(claim.resolvedAt).toLocaleString(i18n.language),
            })}
          </p>
        )}
      </section>
    );
  }

  const faultMissing = !claim.faultCategory;

  return (
    <section className="space-y-4 rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">{t("returns_resolution_title")}</h2>
      <p className="text-sm text-on-surface-variant">{t("returns_resolution_choose_path")}</p>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${path === "rework" ? "bg-primary text-on-primary" : "border border-outline-variant"}`}
          onClick={() => setPath("rework")}
        >
          {t("returns_resolution_path_rework")}
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${path === "refund" ? "bg-primary text-on-primary" : "border border-outline-variant"}`}
          onClick={() => setPath("refund")}
          disabled={!canRefund}
        >
          {t("returns_resolution_path_refund")}
        </button>
      </div>

      {path === "rework" && (
        <div className="space-y-3">
          {!claim.reworkJob && (
            <button
              type="button"
              className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
              onClick={async () => {
                const r = await spawnRework.mutateAsync();
                toast.success(t("returns_toast_rework_spawned"));
                navigate(`/jobs/${r.reworkJobId}`);
              }}
              disabled={!canRework || faultMissing || spawnRework.isPending}
            >
              {t("returns_resolution_spawn_rework")}
            </button>
          )}

          {claim.reworkJob && claim.reworkJob.status !== "DELIVERED" && (
            <p className="text-sm text-on-surface-variant">
              {t("returns_resolution_rework_pending")}{" "}
              <Link className="underline" to={`/jobs/${claim.reworkJob.id}`}>
                {claim.reworkJob.jobCode}
              </Link>
            </p>
          )}

          {claim.reworkJob && claim.reworkJob.status === "DELIVERED" && (
            <div className="space-y-3">
              <p className="text-sm">{t("returns_resolution_rework_delivered")}</p>
              <button
                type="button"
                className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
                onClick={async () => {
                  await resolveClaim.mutateAsync({ resolutionOutcome: "REWORK_FREE" });
                  toast.success(t("returns_toast_resolved"));
                }}
                disabled={!canRework || faultMissing || resolveClaim.isPending}
              >
                {t("returns_resolution_resolve_rework_free")}
              </button>

              <div className="flex items-center gap-2">
                <input
                  aria-label={t("returns_resolution_partial_charge_label")}
                  type="number"
                  min={1}
                  className="w-32 rounded border border-outline-variant bg-surface px-2 py-1.5 text-sm"
                  value={partialCharge}
                  onChange={(e) => setPartialCharge(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
                  onClick={async () => {
                    const amount = Number(partialCharge);
                    if (!Number.isFinite(amount) || amount <= 0) return;
                    await resolveClaim.mutateAsync({
                      resolutionOutcome: "REWORK_PARTIAL_CHARGE",
                      partialChargeAmount: amount,
                    });
                    toast.success(t("returns_toast_resolved"));
                  }}
                  disabled={!canRework || faultMissing || resolveClaim.isPending}
                >
                  {t("returns_resolution_resolve_rework_partial")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {path === "refund" && canRefund && (
        <div className="flex items-center gap-2">
          <input
            aria-label={t("returns_resolution_refund_amount_label")}
            type="number"
            min={1}
            className="w-32 rounded border border-outline-variant bg-surface px-2 py-1.5 text-sm"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
            onClick={async () => {
              const amount = Number(refundAmount);
              if (!Number.isFinite(amount) || amount <= 0) return;
              await resolveClaim.mutateAsync({
                resolutionOutcome: "REFUND_PARTIAL",
                refundAmount: amount,
              });
              toast.success(t("returns_toast_resolved"));
            }}
            disabled={faultMissing || resolveClaim.isPending}
          >
            {t("returns_resolution_resolve_refund_partial")}
          </button>
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
            onClick={async () => {
              const amount = Number(refundAmount);
              if (!Number.isFinite(amount) || amount <= 0) return;
              await resolveClaim.mutateAsync({
                resolutionOutcome: "REFUND_FULL",
                refundAmount: amount,
              });
              toast.success(t("returns_toast_resolved"));
            }}
            disabled={faultMissing || resolveClaim.isPending}
          >
            {t("returns_resolution_resolve_refund_full")}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire into detail page**

In `src/pages/returns/detail.tsx`, render `<ResolutionSection claim={claim} />` after `<TriageSection>`.

- [ ] **Step 3: Manual smoke test**

Walk through both rework and refund paths in the browser. Verify the spawn-rework button navigates to the new Job, and resolve buttons close the claim.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/returns/resolution-section.tsx src/pages/returns/detail.tsx
git commit -m "feat(returns): resolution section with rework and refund paths"
```

---

## Task 11: Claim Photos Section

**Files:**
- Create: `src/components/modules/returns/claim-photos-section.tsx`
- Modify: `src/pages/returns/detail.tsx`

The existing photo upload UX from `src/components/modules/jobs/job-photos-section.tsx` provides the camera/gallery picker pattern. We reuse that pattern (don't barrel-import it; replicate the small surface needed).

- [ ] **Step 1: Implement the section**

Create `src/components/modules/returns/claim-photos-section.tsx`:

```tsx
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import {
  useDeleteClaimPhoto,
  useUploadClaimPhoto,
} from "@/hooks/use-return-claims";
import type { PhotoStage, ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

const STAGES: PhotoStage[] = ["RETURN_INTAKE", "RETURN_RESOLUTION"];

export default function ClaimPhotosSection({ claim }: Props) {
  const { t } = useTranslation();
  const canEdit = useCan({ returns: ["edit"] });
  const upload = useUploadClaimPhoto(claim.id);
  const remove = useDeleteClaimPhoto(claim.id);
  const intakeRef = useRef<HTMLInputElement>(null);
  const resolutionRef = useRef<HTMLInputElement>(null);

  const photosByStage: Record<PhotoStage, typeof claim.photos> = {
    RETURN_INTAKE: claim.photos.filter((p) => p.stage === "RETURN_INTAKE"),
    RETURN_RESOLUTION: claim.photos.filter((p) => p.stage === "RETURN_RESOLUTION"),
  };

  const handleUpload = async (stage: PhotoStage, file: File) => {
    await upload.mutateAsync({ file, stage });
    toast.success(t("returns_toast_photo_added"));
  };

  return (
    <section className="space-y-4 rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">{t("returns_photos_title")}</h2>

      {STAGES.map((stage) => {
        const ref = stage === "RETURN_INTAKE" ? intakeRef : resolutionRef;
        const list = photosByStage[stage];
        return (
          <div key={stage} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-on-surface-variant">
                {stage === "RETURN_INTAKE"
                  ? t("returns_photos_intake")
                  : t("returns_photos_resolution")}
              </h3>
              {canEdit && claim.status === "OPEN" && (
                <>
                  <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(stage, f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="rounded border border-outline-variant px-2.5 py-1 text-xs"
                    onClick={() => ref.current?.click()}
                  >
                    {t("returns_photos_add")}
                  </button>
                </>
              )}
            </div>

            {list.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                {stage === "RETURN_INTAKE"
                  ? t("returns_photos_empty_intake")
                  : t("returns_photos_empty_resolution")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                {list.map((p) => (
                  <div key={p.id} className="relative">
                    <img
                      alt=""
                      src={`/api/uploads/${p.path}`}
                      className="aspect-square w-full rounded object-cover"
                    />
                    {canEdit && claim.status === "OPEN" && (
                      <button
                        type="button"
                        aria-label="remove"
                        className="absolute right-1 top-1 rounded-full bg-error p-1 text-on-error"
                        onClick={async () => {
                          await remove.mutateAsync(p.id);
                          toast.success(t("returns_toast_photo_removed"));
                        }}
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

> **Note:** the photo `src` here uses `/api/uploads/${p.path}`. Verify the actual photo serving path against `src/components/modules/jobs/job-photos-section.tsx` and adjust if different (e.g., `/uploads/${p.path}` or absolute URL).

- [ ] **Step 2: Wire into detail page**

In `src/pages/returns/detail.tsx` add `<ClaimPhotosSection claim={claim} />` after the resolution section.

- [ ] **Step 3: Manual smoke test**

Upload an image in each stage and verify it shows under the correct heading. Verify delete works on OPEN claims and is hidden on RESOLVED.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/returns/claim-photos-section.tsx src/pages/returns/detail.tsx
git commit -m "feat(returns): claim photos section grouped by stage"
```

---

## Task 12: Create-Wizard Modal

**Files:**
- Create: `src/components/modules/returns/create-wizard-modal.tsx`
- Create: `src/components/modules/returns/__tests__/create-wizard-modal.test.tsx`

The wizard is launched from Job detail (Task 13). Two steps: complaint + triage decision.

- [ ] **Step 1: Implement the wizard**

Create `src/components/modules/returns/create-wizard-modal.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useCreateReturnClaim } from "@/hooks/use-return-claims";
import WarrantyBadge from "./warranty-badge";

interface JobLine {
  id: string;
  name: string;
  warrantyDays: number;
  daysSinceDelivered: number | null;
  kind: "repair" | "part";
}

interface Props {
  open: boolean;
  onClose: () => void;
  originalJob: {
    id: string;
    jobCode: string;
    customer: { id: string; name: string };
    repairs: JobLine[];
    parts: JobLine[];
  };
  /** Called when user picks "Not a warranty case" — parent should open new-job intake. */
  onCreateNewPaidJob: () => void;
}

type Selection =
  | { kind: "repair"; id: string }
  | { kind: "part"; id: string }
  | { kind: "other" };

export default function CreateWizardModal({
  open,
  onClose,
  originalJob,
  onCreateNewPaidJob,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createClaim = useCreateReturnClaim();
  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<Selection>({ kind: "other" });
  const [reason, setReason] = useState("");

  if (!open) return null;

  const canNext = step === 1 && reason.trim().length > 0;

  const submitAccept = async () => {
    const payload =
      selection.kind === "repair"
        ? {
            originalJobId: originalJob.id,
            claimedJobRepairId: selection.id,
            returnReason: reason,
          }
        : selection.kind === "part"
          ? {
              originalJobId: originalJob.id,
              claimedJobPartId: selection.id,
              returnReason: reason,
            }
          : { originalJobId: originalJob.id, returnReason: reason };
    const created = await createClaim.mutateAsync(payload);
    toast.success(t("returns_toast_created"));
    onClose();
    navigate(`/returns/${created.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-xl">
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold">{t("returns_wizard_step1_title")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t("returns_wizard_select_line_help")}
            </p>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {originalJob.repairs.map((r) => (
                <label key={r.id} className="flex items-center justify-between rounded border border-outline-variant p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="line"
                      checked={selection.kind === "repair" && selection.id === r.id}
                      onChange={() => setSelection({ kind: "repair", id: r.id })}
                    />
                    {r.name}
                  </span>
                  <WarrantyBadge
                    daysSinceDelivered={r.daysSinceDelivered}
                    warrantyDays={r.warrantyDays}
                  />
                </label>
              ))}
              {originalJob.parts.map((p) => (
                <label key={p.id} className="flex items-center justify-between rounded border border-outline-variant p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="line"
                      checked={selection.kind === "part" && selection.id === p.id}
                      onChange={() => setSelection({ kind: "part", id: p.id })}
                    />
                    {p.name}
                  </span>
                  <WarrantyBadge
                    daysSinceDelivered={p.daysSinceDelivered}
                    warrantyDays={p.warrantyDays}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 rounded border border-outline-variant p-2 text-sm">
                <input
                  type="radio"
                  name="line"
                  checked={selection.kind === "other"}
                  onChange={() => setSelection({ kind: "other" })}
                />
                {t("returns_wizard_different_problem")}
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-on-surface-variant">
                {t("returns_wizard_reason_label")}
              </span>
              <textarea
                className="min-h-[80px] w-full rounded border border-outline-variant bg-surface px-2 py-1.5"
                placeholder={t("returns_wizard_reason_placeholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-outline-variant px-3 py-1.5 text-sm"
                onClick={onClose}
              >
                {t("returns_wizard_cancel")}
              </button>
              <button
                type="button"
                className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-50"
                onClick={() => setStep(2)}
                disabled={!canNext}
              >
                {t("returns_wizard_next")}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-bold">{t("returns_wizard_step2_title")}</h2>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                className="rounded bg-primary px-3 py-2 text-sm text-on-primary"
                onClick={submitAccept}
                disabled={createClaim.isPending}
              >
                {t("returns_wizard_accept")}
              </button>
              <button
                type="button"
                className="rounded border border-outline-variant px-3 py-2 text-sm"
                onClick={() => {
                  onClose();
                  onCreateNewPaidJob();
                }}
              >
                {t("returns_wizard_reject")}
              </button>
              <button
                type="button"
                className="text-sm text-on-surface-variant underline"
                onClick={() => setStep(1)}
              >
                {t("returns_wizard_back")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write a basic test**

Create `src/components/modules/returns/__tests__/create-wizard-modal.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import CreateWizardModal from "../create-wizard-modal";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fakeJob = {
  id: "job-1",
  jobCode: "RPR-001",
  customer: { id: "c1", name: "John" },
  repairs: [{ id: "jr-1", name: "Screen", warrantyDays: 30, daysSinceDelivered: 5, kind: "repair" as const }],
  parts: [],
};

describe("CreateWizardModal", () => {
  it("renders nothing when closed", () => {
    const { container } = wrap(
      <CreateWizardModal
        open={false}
        onClose={vi.fn()}
        originalJob={fakeJob}
        onCreateNewPaidJob={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("blocks Next until reason is provided", () => {
    wrap(
      <CreateWizardModal
        open
        onClose={vi.fn()}
        originalJob={fakeJob}
        onCreateNewPaidJob={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "screen broken" } });
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("calls onCreateNewPaidJob when reject button clicked on step 2", () => {
    const onCreateNewPaidJob = vi.fn();
    const onClose = vi.fn();
    wrap(
      <CreateWizardModal
        open
        onClose={onClose}
        originalJob={fakeJob}
        onCreateNewPaidJob={onCreateNewPaidJob}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /not a warranty case/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onCreateNewPaidJob).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run, expect pass**

Run: `bun vitest run src/components/modules/returns/__tests__/create-wizard-modal.test.tsx`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/returns/create-wizard-modal.tsx src/components/modules/returns/__tests__/create-wizard-modal.test.tsx
git commit -m "feat(returns): create wizard modal with two-step UX"
```

---

## Task 13: Job Detail Integration — File Button + Returns History + Rework Banner

**Files:**
- Modify: `src/pages/jobs/detail.tsx`
- Modify: `src/components/modules/jobs/job-actions-menu.tsx`
- Create: `src/components/modules/jobs/job-returns-history-section.tsx`

- [ ] **Step 1: Create the returns-history section**

Create `src/components/modules/jobs/job-returns-history-section.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useReturnClaimsList } from "@/hooks/use-return-claims";

interface Props {
  jobId: string;
}

export default function JobReturnsHistorySection({ jobId }: Props) {
  const { t } = useTranslation();
  const { data } = useReturnClaimsList({ originalJobId: jobId, limit: 50 });

  if (!data || data.items.length === 0) {
    return (
      <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">{t("returns_job_history_title")}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{t("returns_job_history_empty")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">{t("returns_job_history_title")}</h2>
      <ul className="mt-2 divide-y divide-outline-variant">
        {data.items.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <Link className="underline" to={`/returns/${c.id}`}>
              {new Date(c.openedAt).toLocaleDateString()} —{" "}
              {c.claimedJobRepair?.repairName ??
                c.claimedJobPart?.partName ??
                t("returns_table_claimed_other")}
            </Link>
            <span>{t(`returns_status_${c.status.toLowerCase()}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the Job detail page**

In `src/pages/jobs/detail.tsx`:

1. Import the section.
2. Render `<JobReturnsHistorySection jobId={job.id} />` only when `job.status === "DELIVERED"`.
3. If `job.isWarrantyReturn && job.warrantyForJobId`, render a banner near the top:

```tsx
{job.isWarrantyReturn && job.warrantyForJob && (
  <div className="rounded-md bg-tertiary-container p-3 text-sm text-on-tertiary-container">
    {t("returns_rework_banner", { jobCode: job.warrantyForJob.jobCode })}{" "}
    <Link className="underline" to={`/returns?originalJobId=${job.warrantyForJobId}`}>
      {t("returns_rework_banner_link")}
    </Link>
  </div>
)}
```

(If `warrantyForJob` is not yet on the Job detail response, add it to the existing job-detail GET — typically at `server/services/job.service.ts` `getById`.)

- [ ] **Step 3: Add "File return claim" action to the job actions menu**

In `src/components/modules/jobs/job-actions-menu.tsx`, find where existing actions like cancel are listed. Add (gated on permission + status):

```tsx
const canFileReturn = useCan({ returns: ["create"] });
// ...
{canFileReturn && job.status === "DELIVERED" && (
  <button
    type="button"
    onClick={() => onFileReturn()}
    className="..."
  >
    <span className="material-symbols-outlined">undo</span>
    {t("returns_file_button")}
  </button>
)}
```

Wire `onFileReturn` to open the `CreateWizardModal` from the parent page (`src/pages/jobs/detail.tsx`). The parent owns the modal state. Pass `originalJob` mapped from the Job detail response, computing `daysSinceDelivered` from the DELIVERED audit log timestamp.

> **Note on `daysSinceDelivered` for the wizard:** the existing Job detail GET endpoint should already include `auditLogs` or a `deliveredAt` field. If it doesn't, add it (small backend extension): expose `deliveredAt` on the Job detail response by reading from AuditLog. This is acceptable scope for Plan 2 since it's a thin read-side enhancement.

- [ ] **Step 4: Manual smoke test**

Open a DELIVERED Job. Click "File return claim". Wizard renders with warranty badges per repair. Submit "Accept as return" → navigates to claim detail.

- [ ] **Step 5: Commit**

```bash
git add src/pages/jobs/detail.tsx src/components/modules/jobs/job-actions-menu.tsx src/components/modules/jobs/job-returns-history-section.tsx
git commit -m "feat(returns): integrate claims into job detail page"
```

---

## Task 14: Sidebar + Bottom-Nav Entries

**Files:**
- Modify: `src/components/modules/sidebar.tsx`
- Modify: `src/components/modules/bottom-nav.tsx`

- [ ] **Step 1: Add to sidebar**

In `src/components/modules/sidebar.tsx`, find the section that lists navigation items (likely an array). Add a new entry next to the "Jobs" item:

```tsx
{
  to: "/returns",
  icon: "undo",
  labelKey: "returns_nav_label",
  perm: { returns: ["viewSelf"] } as const,
},
```

Match the existing item shape — read the file to confirm the exact structure (the entries may use `permission`, `roles`, or some other field name).

- [ ] **Step 2: Add to bottom-nav (mobile)**

In `src/components/modules/bottom-nav.tsx`, find the analogous list and add the same entry. The bottom-nav often shows fewer items; if "Returns" doesn't fit on the primary bar, place it under the secondary/overflow menu — match existing conventions.

- [ ] **Step 3: Manual smoke test**

Resize the browser to mobile width — verify the entry appears and routes correctly. Verify it's hidden for users without `returns:viewSelf` (e.g., a hypothetical role without the permission).

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/sidebar.tsx src/components/modules/bottom-nav.tsx
git commit -m "feat(returns): nav entries in sidebar and bottom-nav"
```

---

## Task 15: Dashboard "Open Returns" Card

**Files:**
- Modify: `src/pages/dashboard/index.tsx`

This adds a single card to the owner dashboard, click-through to `/returns?status=OPEN`. Reuses existing dashboard card pattern from the recent dashboard work (`feat(dashboard): real data, empty states, loading skeleton`).

- [ ] **Step 1: Find the existing card pattern**

Run: `grep -n "card\|Card\|widget" src/pages/dashboard/index.tsx | head -10`

Read the file to understand how existing cards source data (likely a `useDashboardSummary` hook or similar).

- [ ] **Step 2: Add the count source**

If the dashboard endpoint already returns multiple counts, add `openReturnsCount` to it (backend: `server/services/dashboard.service.ts`). If you'd rather avoid backend churn for v1, source the count directly via `useReturnClaimsList({ status: "OPEN", limit: 1 })` and use `data.total`.

- [ ] **Step 3: Render the card**

Following the existing card pattern, add (only for owners — gate via `useCan({ returns: ["viewShop"] })` or the existing dashboard role split):

```tsx
{openReturnsCount !== undefined && (
  <Link to="/returns?status=OPEN" className="block rounded-lg border border-outline-variant bg-surface-container p-4 hover:bg-surface-container-high">
    <h3 className="text-sm font-medium text-on-surface-variant">
      {t("returns_dashboard_open_card_title")}
    </h3>
    <p className="mt-1 text-3xl font-bold text-on-surface">{openReturnsCount}</p>
    <p className="text-xs text-on-surface-variant">{t("returns_dashboard_open_card_subtitle")}</p>
  </Link>
)}
```

- [ ] **Step 4: Manual smoke test**

Log in as OWNER. Verify the card renders with the correct count. Click → navigates to `/returns?status=OPEN`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/index.tsx
git commit -m "feat(returns): dashboard open-returns card for owner"
```

---

## Task 16: Verification and Wrap-Up

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `bun run test`
Expected: all tests pass — both new and existing.

- [ ] **Step 2: Lint and format check**

Run: `bun run check`
Expected: no errors. If ultracite complains, run `bun run fix`.

- [ ] **Step 3: i18n sync**

Run: `bun run sync-locales`
Expected: ar/fr stay in sync (no missing keys).

- [ ] **Step 4: End-to-end manual QA in Chrome DevTools**

Per project rule "use Chrome DevTools for QA — login with admin and the configured SEED_ADMIN_PASSWORD":

1. Log in as admin (OWNER role).
2. Open a DELIVERED job → "File return claim" → walk wizard → accept → land on claim detail.
3. Triage: set fault category. Verify save toast.
4. Resolution → Spawn rework → navigate to rework Job → take it through to DELIVERED → return to claim → resolve as REWORK_FREE. Verify resolved state shows.
5. New claim → triage → resolve as REFUND_PARTIAL. Verify the OWNER notification fires (in-app bell badge).
6. List page: filters work, pagination works, click-through to detail works, empty-state renders when filters yield nothing.
7. Dashboard: "Open returns" card shows non-zero, click navigates correctly.
8. Switch language to AR → verify RTL layout, badges, table align correctly.
9. Mobile viewport: bottom-nav has Returns entry; detail page stacks; wizard modal usable.
10. Console: clean of errors throughout.

- [ ] **Step 5: Tag the frontend work as complete**

```bash
git log --oneline -25  # verify the commit trail for this plan
```

The frontend UI is now complete. **Next plan: Analytics & Reports (Plan 3 of 3)** — to be drafted in a follow-up session, scoped to: repointed Warranty Return Rate KPI on the Reports page, new Returns tab (summary cards, fault donut, by-repair / by-part / by-technician tables, time-to-return histogram), and the inline "this month's net warranty cost" metric.

---

## Self-Review

**Spec coverage check (against `2026-05-10-returns-and-photo-evidence-design.md`, UI sections only):**

| Spec section | Tasks |
|---|---|
| Routes `/returns` and `/returns/:id` | 5, 8 |
| Sidebar / nav entry | 14 |
| "File return claim" entry point on Job detail | 13 |
| Create wizard — Step 1 complaint with warranty badges | 12 (with WarrantyBadge from 4) |
| Create wizard — Step 2 triage decision (accept / new paid job) | 12 |
| Claim detail — header (status badge, goodwill, opened/resolved by) | 8 |
| Claim detail — claimed line + customer complaint | 8 |
| Claim detail — Triage section (radio + save) | 9 |
| Claim detail — Resolution section (rework + refund paths) | 10 |
| Claim detail — Photos by stage | 11 |
| Claim detail — Activity timeline | (deferred — surfaced on RESOLVED state via header timestamps; full AuditLog timeline is a polish task, captured as out-of-scope) |
| Returns list page — filter bar | 6 |
| Returns list page — table + pagination + empty state | 7 |
| Job detail — Returns history section | 13 |
| Job detail — Rework banner | 13 |
| Dashboard — Open returns card | 15 |
| i18n (en + sync to ar/fr) | 1 |
| RTL respected | (inherited from existing Tailwind utilities; verified manually in Task 16) |

**Backend extensions in this plan:**
- Task 2: hydrate `warrantyInfo` on claim getById response
- Task 13 note: ensure Job detail GET exposes `deliveredAt` (read from AuditLog) — small read-side addition

**Out-of-scope (deliberately deferred):**
- Activity timeline rendering full AuditLog history on RESOLVED claims (lightweight surfacing only)
- Reports page changes — fully covered in Plan 3
- Mobile camera capture polish (the existing `useNativeCamera` hook is available but not wired here; default file picker is sufficient for v1)

**Placeholder scan:** none — every code block is runnable. Annotated notes call out spots where the implementer must verify/adapt to actual project shapes (theme tokens, photo-serving URL, audit-log field names, sidebar nav-item shape, existing photo upload helper).

**Type consistency check:**
- `ReturnClaimDetail` and `ReturnClaimListItem` defined once in Task 3, used consistently across components (Tasks 7–13)
- Permission strings (`returns:["create"]`, `returns:["resolveRework"]`, etc.) match Plan 1's `shared/permissions.ts` entries
- Hook names consistent: `useReturnClaim` (singular), `useReturnClaimsList` (plural list)
- Photo stage values uppercase enum strings (`RETURN_INTAKE`, `RETURN_RESOLUTION`) match backend
- `ListClaimsParams` shape mirrors the backend Zod schema from Plan 1 Task 5

**Risk callouts:**
- **Theme tokens** (`bg-tertiary-container`, etc.) assumed available. If the project uses different Tailwind tokens, swap to the closest existing equivalents — check `src/components/modules/jobs/jobs-table.tsx` or the project's design system docs.
- **Photo serving URL** (`/api/uploads/${path}`) assumed. Verify against `src/components/modules/jobs/job-photos-section.tsx` — this is the most likely small adjustment.
- **AuditLog query** in Task 2 uses `newStatus: "DELIVERED"`. The actual AuditLog schema may shape transitions differently — verify and adapt.
- **Sidebar nav item shape** (Task 14) varies by project. Read the actual file before adding the entry.
- **Job detail GET response** must include `auditLogs` or a `deliveredAt` field for the wizard's warranty math (Task 13 note).
- **Dashboard data source** — Task 15 offers two paths (extend the dashboard service vs. inline `useReturnClaimsList`). Pick whichever matches the dashboard's existing pattern.
