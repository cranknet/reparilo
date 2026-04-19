# Job Row Actions Menu

## Summary

Add a contextual dropdown action menu to each job row in the desktop table and mobile card list. The menu is triggered by the existing `more_vert` (3-dot) button and provides quick access to common job operations without navigating to the detail page.

## Scope

### Included

- **Quick status change** — valid next statuses shown directly in the dropdown, derived from `JOB_STATUS_FLOW`
- **Add quick note** — opens a small dialog with a text input to add a note inline
- **Call customer** — `tel:` link to call the job's customer phone number
- **Cancel job** — destructive action styled in error red, triggers the CANCELLED status transition with a reason prompt
- **Print receipt** — placeholder item (disabled, muted). Implementation deferred to a future task

### Out of Scope

- Print receipt implementation (TODO placeholder only)
- Copy job code (not selected by user)
- WhatsApp integration (not selected — phone call only)
- Any backend changes (all endpoints already exist)

## Design

### Component: `JobActionsMenu`

A single shared component used in both `JobsTable` and `JobMobileCard`.

**Props:**

```ts
interface JobActionsMenuProps {
  job: JobRow;
}
```

### Dropdown Structure

The menu items are **contextual** — they change based on the job's current status:

```
┌─────────────────────────────────┐
│ CHANGE STATUS (section header)  │
│ → {next status 1}               │  ← from JOB_STATUS_FLOW[job.status]
│ → {next status 2}               │     excludes CANCELLED
│ → ...                           │
│ ──────────────── (divider)      │
│ 📝 Add Note                     │
│ 📞 Call Customer                │
│ 🖨️  Print Receipt    (disabled) │  ← TODO placeholder
│ ──────────────── (divider)      │
│ ✕ Cancel Job         (red)      │  ← only if CANCELLED in flow
└─────────────────────────────────┘
```

**Visibility rules:**

| Condition | Menu items shown |
|:---|:---|
| Job in terminal status (DELIVERED, RETURNED, CANCELLED) | Only "Print Receipt" (disabled). No status transitions, no cancel, no note. |
| Job has customer phone | "Call Customer" shown and active |
| Job has no customer phone | "Call Customer" shown but disabled |
| CANCELLED in valid transitions | "Cancel Job" shown at bottom in error red |
| CANCELLED not in valid transitions | "Cancel Job" hidden |
| No valid next statuses | "Change Status" section header hidden |

### Sub-dialogs

**Add Note dialog:** When clicked, a small modal/popover appears with:
- A textarea for the note text
- "Cancel" and "Add Note" buttons
- On submit: calls `POST /jobs/:id/notes` via the jobs store
- On success: closes dialog, shows brief success feedback

**Cancel Job dialog:** When clicked, a confirmation dialog appears with:
- A required textarea for the cancellation reason
- "Go Back" and "Cancel Job" (destructive red) buttons
- On submit: calls `PATCH /jobs/:id/status` with `{ status: "CANCELLED", reason }` via the jobs store
- On success: closes dialog, the row/card updates to show CANCELLED status

### Styling (from Stitch design)

- Dropdown: `bg-surface-container-lowest`, rounded-xl, shadow-2xl, ghost border at `outline-variant/20`, backdrop-blur
- Active row highlight when menu open: `ring-2 ring-primary-container/20`
- Status transition items: `arrow_forward` icon in primary color
- Section header: `text-[10px] font-bold text-outline uppercase tracking-wider`
- Destructive (Cancel Job): `text-error`, hover state `bg-error-container text-on-error-container`
- Disabled (Print Receipt): `opacity-30 cursor-not-allowed`
- All items: `px-4 py-2 hover:bg-surface-container-low transition-colors`

### Data Flow

1. User clicks `more_vert` → dropdown opens
2. For status changes: calls `useJobsStore.getState().transitionStatus(jobId, newStatus)` → `PATCH /jobs/:id/status`
3. For add note: calls `useJobsStore.getState().addNote(jobId, { text })` → `POST /jobs/:id/notes`
4. For call customer: `window.location.href = tel:{phone}` (native phone dialer)
5. For cancel: calls `useJobsStore.getState().transitionStatus(jobId, "CANCELLED", { reason })` → `PATCH /jobs/:id/status`
6. After any mutation: the jobs list refreshes to reflect the change

### Files to Create

- `src/components/modules/jobs/job-actions-menu.tsx` — main dropdown menu component
- `src/components/modules/jobs/job-note-dialog.tsx` — add note dialog
- `src/components/modules/jobs/job-cancel-dialog.tsx` — cancel job confirmation dialog

### Files to Modify

- `src/components/modules/jobs/jobs-table.tsx` — replace the static `more_vert` button with `JobActionsMenu`
- `src/components/modules/jobs/mobile-card.tsx` — add `JobActionsMenu` to the card footer area
- `src/i18n/locales/en.json` — add new i18n keys, then `pnpm run sync-locales`

### i18n Keys Needed

- `job_actions_change_status` — "Change Status" section header
- `job_actions_add_note` — "Add Note"
- `job_actions_call_customer` — "Call Customer"
- `job_actions_print_receipt` — "Print Receipt"
- `job_actions_cancel_job` — "Cancel Job"
- `job_note_dialog_title` — "Add Note"
- `job_note_dialog_placeholder` — "Enter your note..."
- `job_note_dialog_submit` — "Add Note"
- `job_note_dialog_cancel` — "Go Back"
- `job_cancel_dialog_title` — "Cancel Job"
- `job_cancel_dialog_reason_label` — "Reason for cancellation"
- `job_cancel_dialog_reason_placeholder` — "Enter reason..."
- `job_cancel_dialog_submit` — "Cancel Job"
- `job_cancel_dialog_go_back` — "Go Back"
- `job_actions_note_success` — "Note added successfully"
- `job_actions_note_error` — "Failed to add note"
- `job_actions_status_success` — "Status updated successfully"
- `job_actions_status_error` — "Failed to update status"

### Backend Dependencies

All endpoints already exist — no backend changes needed:

- `PATCH /jobs/:id/status` — status transitions (including cancel with reason)
- `POST /jobs/:id/notes` — add notes
- `JOB_STATUS_FLOW` in `shared/constants/job-statuses.ts` — determines valid transitions

### TODO (Future Task)

- Implement print receipt functionality when the "Print Receipt" menu item is enabled
