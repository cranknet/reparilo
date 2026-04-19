# Job Row Actions Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contextual dropdown action menu to job rows in the desktop table and mobile card list, enabling quick status changes, note adding, customer calling, and job cancellation without navigating to the detail page.

**Architecture:** Single shared `JobActionsMenu` component renders a native dropdown (no library) with click-outside-to-close behavior. Two dialog components handle note adding and cancellation confirmation. The menu items are contextual based on `JOB_STATUS_FLOW` and the job's current state.

**Tech Stack:** React, Zustand (existing store), Tailwind CSS, Material Symbols icons, react-i18next, Vitest + Testing Library

---

## File Structure

| Action | Path | Responsibility |
|:---|:---|:---|
| Create | `src/components/modules/jobs/job-actions-menu.tsx` | Dropdown menu with contextual items |
| Create | `src/components/modules/jobs/job-note-dialog.tsx` | Modal dialog for adding a quick note |
| Create | `src/components/modules/jobs/job-cancel-dialog.tsx` | Modal dialog for cancel confirmation with reason |
| Modify | `src/components/modules/jobs/jobs-table.tsx` | Replace static more_vert button with JobActionsMenu |
| Modify | `src/components/modules/jobs/mobile-card.tsx` | Add JobActionsMenu to card footer |
| Modify | `src/i18n/locales/en.json` | Add new i18n keys |
| Create | `src/components/modules/jobs/__tests__/job-actions-menu.test.tsx` | Tests for JobActionsMenu |

**Reference files (read-only):**
- `shared/constants/job-statuses.ts` — `JOB_STATUS_FLOW` for valid transitions
- `src/stores/jobs.ts` — `transitionStatus()`, `addNote()` methods
- `src/components/modules/jobs/status-change-reason-dialog.tsx` — existing dialog pattern to follow
- `src/components/modules/jobs/jobs-shared.ts` — `JobRow` type definition
- `.stitch/designs/job-actions-menu.html` — Stitch reference design

---

### Task 1: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add i18n keys to en.json**

Add the following keys inside the existing `"intake"` section or at the top level where appropriate. Place them near the existing `jobs_status_change_*` keys:

```json
"job_actions_change_status": "Change Status",
"job_actions_add_note": "Add Note",
"job_actions_call_customer": "Call Customer",
"job_actions_print_receipt": "Print Receipt",
"job_actions_cancel_job": "Cancel Job",
"job_note_dialog_title": "Add Note",
"job_note_dialog_placeholder": "Enter your note...",
"job_note_dialog_submit": "Add Note",
"job_note_dialog_cancel": "Go Back",
"job_cancel_dialog_title": "Cancel Job",
"job_cancel_dialog_reason_label": "Reason for cancellation",
"job_cancel_dialog_reason_placeholder": "Enter reason...",
"job_cancel_dialog_submit": "Cancel Job",
"job_cancel_dialog_go_back": "Go Back",
"job_actions_note_success": "Note added successfully",
"job_actions_note_error": "Failed to add note",
"job_actions_status_error": "Failed to update status"
```

- [ ] **Step 2: Run sync-locales to auto-translate ar.json and fr.json**

Run: `pnpm run sync-locales`

Expected: ar.json and fr.json updated with translations for the new keys.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/ar.json src/i18n/locales/fr.json
git commit -m "feat(i18n): add job actions menu translation keys"
```

---

### Task 2: Create JobActionsMenu component

**Files:**
- Create: `src/components/modules/jobs/job-actions-menu.tsx`

- [ ] **Step 1: Write the JobActionsMenu component**

This component renders a 3-dot button that toggles a dropdown menu. The menu items are contextual based on job status and available data. It uses `useRef` + `useEffect` for click-outside-to-close.

```tsx
import type { JobStatusType } from "@shared/constants";
import { INACTIVE_STATUSES, JOB_STATUS_FLOW } from "@shared/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";
import type { JobRow } from "./jobs-shared";
import JobCancelDialog from "./job-cancel-dialog";
import JobNoteDialog from "./job-note-dialog";

interface JobActionsMenuProps {
  job: JobRow;
}

export default function JobActionsMenu({ job }: JobActionsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const transitionStatus = useJobsStore((s) => s.transitionStatus);

  const isTerminal = INACTIVE_STATUSES.includes(job.status);
  const validTransitions: JobStatusType[] = isTerminal
    ? []
    : (JOB_STATUS_FLOW[job.status] ?? []);
  const statusTransitions = validTransitions.filter((s) => s !== "CANCELLED");
  const canCancel = validTransitions.includes("CANCELLED");
  const hasPhone = Boolean(
    job.rawJob?.customer?.phone
  );

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const handleStatusChange = useCallback(
    async (status: JobStatusType) => {
      setLoading(true);
      setError(null);
      try {
        await transitionStatus(
          job.rawJob?.id ?? job.id,
          status
        );
        close();
      } catch {
        setError(t("job_actions_status_error"));
      } finally {
        setLoading(false);
      }
    },
    [job.rawJob?.id, job.id, transitionStatus, close, t]
  );

  const handleCallCustomer = useCallback(() => {
    const phone = job.rawJob?.customer?.phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
    close();
  }, [job.rawJob?.customer?.phone, close]);

  const handleNoteOpen = useCallback(() => {
    setOpen(false);
    setNoteDialogOpen(true);
  }, []);

  const handleNoteClose = useCallback(() => {
    setNoteDialogOpen(false);
  }, []);

  const handleCancelOpen = useCallback(() => {
    setOpen(false);
    setCancelDialogOpen(true);
  }, []);

  const handleCancelClose = useCallback(() => {
    setCancelDialogOpen(false);
  }, []);

  if (isTerminal && !job.rawJob?.customer?.phone) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={t("job_actions")}
          className={`min-h-[44px] min-w-[44px] rounded-lg p-2 transition-colors hover:bg-surface-container-high hover:text-primary ${open ? "bg-primary-container text-on-primary" : "text-on-surface-variant"}`}
          onClick={() => setOpen((prev) => !prev)}
          title={t("job_actions")}
          type="button"
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-outline-variant/20 bg-surface-container-lowest/95 py-2 shadow-2xl backdrop-blur-xl">
            {statusTransitions.length > 0 && (
              <>
                <div className="px-3 py-2 font-bold font-label text-[10px] uppercase tracking-wider text-outline">
                  {t("job_actions_change_status")}
                </div>
                {statusTransitions.map((status) => (
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
                    disabled={loading}
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg text-primary">
                      arrow_forward
                    </span>
                    <span>{t(`status.${status}`)}</span>
                  </button>
                ))}
                <div className="my-2 border-t border-outline-variant/30" />
              </>
            )}

            {!isTerminal && (
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                onClick={handleNoteOpen}
                type="button"
              >
                <span className="material-symbols-outlined text-lg">sticky_note_2</span>
                <span>{t("job_actions_add_note")}</span>
              </button>
            )}

            <a
              aria-disabled={!hasPhone}
              className={`flex w-full items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${hasPhone ? "cursor-pointer text-on-surface hover:bg-surface-container-low" : "cursor-not-allowed opacity-30 text-on-surface"}`}
              href={hasPhone ? `tel:${job.rawJob?.customer?.phone}` : undefined}
              onClick={hasPhone ? () => close() : (e) => e.preventDefault()}
            >
              <span className="material-symbols-outlined text-lg">call</span>
              <span>{t("job_actions_call_customer")}</span>
            </a>

            <button
              className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-sm font-medium text-on-surface opacity-30"
              disabled
              title="TODO: implement print receipt"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">print</span>
              <span>{t("job_actions_print_receipt")}</span>
            </button>

            {canCancel && (
              <>
                <div className="my-2 border-t border-outline-variant/30" />
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm font-bold text-error transition-colors hover:bg-error-container hover:text-on-error-container"
                  onClick={handleCancelOpen}
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                  <span>{t("job_actions_cancel_job")}</span>
                </button>
              </>
            )}

            {error && (
              <div className="border-t border-outline-variant/30 px-4 py-2">
                <p className="font-body text-xs text-error">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {noteDialogOpen && job.rawJob?.id && (
        <JobNoteDialog
          jobId={job.rawJob.id}
          onClose={handleNoteClose}
          open={noteDialogOpen}
        />
      )}

      {cancelDialogOpen && job.rawJob?.id && (
        <JobCancelDialog
          jobId={job.rawJob.id}
          onClose={handleCancelClose}
          open={cancelDialogOpen}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`

Expected: No errors related to job-actions-menu.tsx (pre-existing errors in other files are acceptable).

---

### Task 3: Create JobNoteDialog component

**Files:**
- Create: `src/components/modules/jobs/job-note-dialog.tsx`

- [ ] **Step 1: Write the JobNoteDialog component**

Follow the existing `StatusChangeReasonDialog` pattern — fixed overlay, centered modal, Escape key handling, body scroll lock.

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";

interface JobNoteDialogProps {
  jobId: string;
  onClose: () => void;
  open: boolean;
}

export default function JobNoteDialog({
  open,
  jobId,
  onClose,
}: JobNoteDialogProps) {
  const { t } = useTranslation();
  const addNote = useJobsStore((s) => s.addNote);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = note.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await addNote(jobId, note.trim());
      onClose();
    } catch {
      setError(t("job_actions_note_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
    >
      <button
        aria-label={t("close_modal")}
        className="absolute inset-0 bg-on-surface/40"
        onClick={onClose}
        type="button"
      />
      <div className="modal-surface relative z-10 w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-bold font-headline text-lg text-on-surface">
          {t("job_note_dialog_title")}
        </h2>
        <textarea
          className="w-full resize-none rounded-xl bg-surface-container-highest p-4 text-on-surface text-sm placeholder:text-outline focus:ring-2 focus:ring-primary"
          disabled={submitting}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("job_note_dialog_placeholder")}
          rows={3}
          value={note}
        />
        <div className="mt-1 text-end font-label text-on-surface-variant text-xs">
          {note.length}/500
        </div>
        {error && (
          <p className="mt-2 font-body text-error text-xs">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <button
            className="px-4 py-2 font-bold font-headline text-on-surface-variant text-sm hover:text-on-surface"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            {t("job_note_dialog_cancel")}
          </button>
          <button
            className="rounded-xl bg-primary px-6 py-2 font-bold font-headline text-on-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting && (
              <span className="material-symbols-outlined mr-1 inline-block animate-spin text-sm align-middle">
                progress_activity
              </span>
            )}
            {t("job_note_dialog_submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`

Expected: No errors related to job-note-dialog.tsx.

---

### Task 4: Create JobCancelDialog component

**Files:**
- Create: `src/components/modules/jobs/job-cancel-dialog.tsx`

- [ ] **Step 1: Write the JobCancelDialog component**

Same pattern as `StatusChangeReasonDialog` but with destructive (red) confirm button styling.

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";

interface JobCancelDialogProps {
  jobId: string;
  onClose: () => void;
  open: boolean;
}

export default function JobCancelDialog({
  open,
  jobId,
  onClose,
}: JobCancelDialogProps) {
  const { t } = useTranslation();
  const transitionStatus = useJobsStore((s) => s.transitionStatus);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = reason.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await transitionStatus(jobId, "CANCELLED", reason.trim());
      onClose();
    } catch {
      setError(t("job_actions_status_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
    >
      <button
        aria-label={t("close_modal")}
        className="absolute inset-0 bg-on-surface/40"
        onClick={onClose}
        type="button"
      />
      <div className="modal-surface relative z-10 w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-bold font-headline text-lg text-error">
          {t("job_cancel_dialog_title")}
        </h2>
        <label className="mb-1 block font-label text-on-surface-variant text-xs uppercase">
          {t("job_cancel_dialog_reason_label")}
        </label>
        <textarea
          className="w-full resize-none rounded-xl bg-surface-container-highest p-4 text-on-surface text-sm placeholder:text-outline focus:ring-2 focus:ring-error"
          disabled={submitting}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("job_cancel_dialog_reason_placeholder")}
          rows={3}
          value={reason}
        />
        <div className="mt-1 text-end font-label text-on-surface-variant text-xs">
          {reason.length}/500
        </div>
        {error && (
          <p className="mt-2 font-body text-error text-xs">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <button
            className="px-4 py-2 font-bold font-headline text-on-surface-variant text-sm hover:text-on-surface"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            {t("job_cancel_dialog_go_back")}
          </button>
          <button
            className="rounded-xl bg-error px-6 py-2 font-bold font-headline text-on-error text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting && (
              <span className="material-symbols-outlined mr-1 inline-block animate-spin text-sm align-middle">
                progress_activity
              </span>
            )}
            {t("job_cancel_dialog_submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`

Expected: No errors related to job-cancel-dialog.tsx.

- [ ] **Step 3: Commit the three new components**

```bash
git add src/components/modules/jobs/job-actions-menu.tsx src/components/modules/jobs/job-note-dialog.tsx src/components/modules/jobs/job-cancel-dialog.tsx
git commit -m "feat: add job actions menu, note dialog, and cancel dialog components"
```

---

### Task 5: Integrate JobActionsMenu into JobsTable

**Files:**
- Modify: `src/components/modules/jobs/jobs-table.tsx`

- [ ] **Step 1: Replace the static more_vert button with JobActionsMenu**

In `jobs-table.tsx`:

1. Add import at the top (after existing imports):
```tsx
import JobActionsMenu from "./job-actions-menu";
```

2. Replace the entire `<td className="p-4 text-right">` block (lines 121-131) with:
```tsx
<td className="p-4 text-right">
  <span
    className="inline-block"
    onClick={(e) => e.stopPropagation()}
  >
    <JobActionsMenu job={job} />
  </span>
</td>
```

3. Remove the unused `useNavigate` import since row click navigation is now handled separately.

Actually — `useNavigate` IS still used for the row click. Keep it. Only the button inside the last `<td>` changes.

- [ ] **Step 2: Verify the table renders without errors**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/jobs/jobs-table.tsx
git commit -m "feat: integrate JobActionsMenu into jobs table"
```

---

### Task 6: Integrate JobActionsMenu into MobileCard

**Files:**
- Modify: `src/components/modules/jobs/mobile-card.tsx`

- [ ] **Step 1: Add JobActionsMenu to the mobile card footer**

In `mobile-card.tsx`:

1. Add import:
```tsx
import JobActionsMenu from "./job-actions-menu";
```

2. In the card footer area (the `<div>` with `bg-surface-container-low` near the bottom, around line 57), replace the "Details" link section with a flex layout that includes both the menu and the details link:

Replace the entire footer `<div>` (from `bg-surface-container-low` to its closing `</div>`) with:

```tsx
<div className="-mx-4 mt-3 flex items-center justify-between bg-surface-container-low px-4 py-3">
  <div className="flex items-center gap-2">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-highest">
      <span className="material-symbols-outlined text-on-surface-variant text-sm">
        person
      </span>
    </div>
    {rawJob ? (
      <TechnicianSelect
        currentTechnicianId={rawJob.technician?.id}
        currentTechnicianName={rawJob.technician?.name}
        jobId={rawJob.id}
        size="sm"
      />
    ) : (
      <span className="font-body font-medium text-on-surface-variant text-xs">
        {t("unassigned")}
      </span>
    )}
  </div>
  <div className="flex items-center gap-2">
    <JobActionsMenu job={job} />
    <Link
      className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg px-2 py-2 font-bold font-label text-primary text-xs uppercase tracking-wider transition-colors hover:bg-surface-container-high"
      to={`/jobs/${rawJob?.id ?? id}`}
    >
      {t("details")}
      <span className="material-symbols-outlined text-sm">
        chevron_right
      </span>
    </Link>
  </div>
</div>
```

3. The `job` prop passed to `JobActionsMenu` needs the full `JobRow` shape. Currently `MobileCard` destructures its props individually. We need to reconstruct the `JobRow` object. Update the component to accept the full `job` prop:

Add `job` as a prop passed from the parent. The parent (`src/pages/jobs/index.tsx`) passes props individually — we need to pass the full `job` row object instead. Check how the parent calls `MobileCard` and update accordingly.

Actually, the simplest approach: pass a reconstructed object. In the `JobActionsMenu` call, pass a reconstructed `JobRow`:

```tsx
<JobActionsMenu job={{ ...jobProps }} />
```

Wait — we need to be careful. Let me check how the parent passes data. The parent does:

```tsx
<JobMobileCard
  customer={row.customer}
  device={row.device}
  ...
/>
```

The cleanest fix: add a `jobRow` prop to `MobileCard` that passes through to `JobActionsMenu`. But that duplicates data. Better: just reconstruct inline:

```tsx
<JobActionsMenu job={{
  id,
  device,
  deviceIcon,
  status,
  customer,
  rawJob,
}} />
```

This works because `JobActionsMenu` only needs `id`, `status`, and `rawJob` from the `JobRow` type (the other fields like `customer`, `device` are not used by the menu).

- [ ] **Step 2: Verify no type errors**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/jobs/mobile-card.tsx
git commit -m "feat: integrate JobActionsMenu into mobile card"
```

---

### Task 7: Write tests for JobActionsMenu

**Files:**
- Create: `src/components/modules/jobs/__tests__/job-actions-menu.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JobRow } from "../jobs-shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/jobs", () => ({
  useJobsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      transitionStatus: vi.fn().mockResolvedValue({}),
      addNote: vi.fn().mockResolvedValue({}),
    }),
}));

vi.mock("./job-note-dialog", () => ({
  default: () => <div data-testid="note-dialog" />,
  __esModule: true,
}));

vi.mock("./job-cancel-dialog", () => ({
  default: () => <div data-testid="cancel-dialog" />,
  __esModule: true,
}));

import JobActionsMenu from "../job-actions-menu";

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "test-id",
    customer: "John",
    device: "iPhone 15",
    deviceIcon: "smartphone",
    status: "IN_REPAIR",
    rawJob: {
      id: "raw-id",
      customer: { phone: "+1234567890" } as never,
    } as never,
    ...overrides,
  };
}

describe("JobActionsMenu", () => {
  it("renders the more_vert button", () => {
    render(<JobActionsMenu job={makeJob()} />);
    expect(
      screen.getByRole("button", { name: "job_actions" })
    ).toBeInTheDocument();
  });

  it("opens dropdown on button click", () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    expect(screen.getByText("job_actions_change_status")).toBeInTheDocument();
    expect(screen.getByText("job_actions_add_note")).toBeInTheDocument();
    expect(screen.getByText("job_actions_call_customer")).toBeInTheDocument();
    expect(screen.getByText("job_actions_print_receipt")).toBeInTheDocument();
    expect(screen.getByText("job_actions_cancel_job")).toBeInTheDocument();
  });

  it("shows valid status transitions for IN_REPAIR", () => {
    render(<JobActionsMenu job={makeJob({ status: "IN_REPAIR" })} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    expect(screen.getByText("status.ON_HOLD")).toBeInTheDocument();
    expect(screen.getByText("status.DONE")).toBeInTheDocument();
  });

  it("hides cancel option when CANCELLED not in valid transitions", () => {
    render(<JobActionsMenu job={makeJob({ status: "DONE" })} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    expect(screen.queryByText("job_actions_cancel_job")).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape key", () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    expect(screen.getByText("job_actions_change_status")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByText("job_actions_change_status")
    ).not.toBeInTheDocument();
  });

  it("disables print receipt button", () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    const printBtn = screen.getByText("job_actions_print_receipt")
      .closest("button")!;
    expect(printBtn).toBeDisabled();
  });

  it("renders nothing for terminal status without customer phone", () => {
    const { container } = render(
      <JobActionsMenu
        job={makeJob({ status: "DELIVERED", rawJob: undefined })}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("opens note dialog when Add Note is clicked", async () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    fireEvent.click(screen.getByText("job_actions_add_note"));
    await waitFor(() => {
      expect(screen.getByTestId("note-dialog")).toBeInTheDocument();
    });
  });

  it("opens cancel dialog when Cancel Job is clicked", async () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    fireEvent.click(screen.getByText("job_actions_cancel_job"));
    await waitFor(() => {
      expect(screen.getByTestId("cancel-dialog")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm exec vitest run src/components/modules/jobs/__tests__/job-actions-menu.test.tsx`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/jobs/__tests__/job-actions-menu.test.tsx
git commit -m "test: add JobActionsMenu component tests"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: All 118+ tests pass (including new ones).

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: No new warnings or errors.

- [ ] **Step 3: Run typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: No new errors (pre-existing dashboard-layout.tsx error is acceptable).

- [ ] **Step 4: Run format**

Run: `pnpm format`

Expected: Files formatted.

- [ ] **Step 5: Final commit if formatting changed anything**

```bash
git add -A
git commit -m "chore: format after job actions implementation" || echo "nothing to commit"
```
