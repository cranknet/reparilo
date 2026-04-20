# Link Parts Catalog to Job Detail Page

**Date:** 2026-04-20
**Status:** Approved

## Problem

The `job-parts-section.tsx` uses an inline free-form form to add parts to a job — no connection to `PartsCatalog`, no `partId` linkage. Meanwhile, `add-part-dialog.tsx` already implements a catalog+custom modal with full `partId` support but is not wired into the job detail page.

## Solution

Replace the inline form in `job-parts-section.tsx` with the existing `AddPartDialog` component, and refactor the dialog to use `usePartsCatalogStore` instead of raw API calls.

## Files to Change

### 1. `src/components/modules/jobs/add-part-dialog.tsx`

**Replace raw API catalog fetching with `usePartsCatalogStore`:**

- Remove: `catalogItems` state, `catalogSearch` state, `loading` state, the `useEffect` that calls `api.get('/parts-catalog')` directly
- Remove: `import api from "@/lib/api"` (no longer needed)
- Add: `import { usePartsCatalogStore } from "@/stores/parts-catalog"`
- Use: store's `parts`, `isLoading`, `fetchParts` for catalog data
- The dialog's `useEffect` should call `fetchParts({ search: catalogSearch, isActive: true })` on open and when search changes, debounced
- The catalog tab's dropdown list renders `store.parts` instead of local `catalogItems`
- Keep: mode toggle, form state, `pickCatalogItem`, submission logic — all unchanged

**Why:** `usePartsCatalogStore` already handles fetch, search, pagination, and caching. Using it removes duplicate API logic and keeps catalog data shared across the app.

### 2. `src/components/modules/jobs/job-parts-section.tsx`

**Remove inline form, wire in `AddPartDialog`:**

- Remove: `showForm`, `loading`, `formError`, `partName`, `category`, `unitPrice`, `quantity` state variables
- Remove: `handleAddPart` callback
- Remove: the entire inline form JSX block (the `<div className="mb-4 space-y-2">...</div>` conditional)
- Add: `showAddDialog` boolean state
- Add: `import AddPartDialog from "./add-part-dialog"`
- The "Add Part" button toggles `setShowAddDialog(true)`
- Render `<AddPartDialog jobId={job.id} open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdded={() => { fetchJob(); setShowAddDialog(false); }} />`
- Keep: parts list display, remove handler, isTerminal guard, header/title

## Files NOT Changed

- `prisma/schema.prisma` — `JobPart.partId` FK already exists, nullable
- `server/services/job-parts.service.ts` — already handles `partId`
- `shared/schemas/job.schema.ts` — `addJobPartSchema` already has `partId: z.string().optional()`
- `src/stores/jobs.ts` — `addPart` already supports `partId`
- `src/pages/parts/index.tsx` — no changes needed

## Data Flow

```
User clicks "Add Part" in job detail
  → AddPartDialog opens with Catalog/Custom tabs
  → Catalog tab: searches PartsCatalog via usePartsCatalogStore
  → On pick: sets partId, partName, category, unitPrice, supplier from catalog entry
  → On submit: calls useJobsStore.addPart() with partId (or without for custom)
  → Store POSTs to /api/jobs/:id/parts with { partId, partName, category, unitPrice, quantity, supplier }
  → Server creates JobPart with FK to PartsCatalog
  → onAdded callback refreshes job detail
```

## Edge Cases

- **Ad-hoc parts**: Custom tab still works — no `partId`, category manually selected
- **Terminal status**: Dialog submit will fail gracefully if job is in DELIVERED/RETURNED/CANCELLED
- **Empty catalog**: Store returns empty array, catalog tab shows "no parts found"
- **Catalog part deactivated**: User can still use Custom tab; catalog tab only shows `isActive: true` parts