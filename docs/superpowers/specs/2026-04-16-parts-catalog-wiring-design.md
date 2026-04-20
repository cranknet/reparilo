# Parts Catalog Frontend-Backend Wiring

## Goal

Replace mock data in `src/pages/parts/index.tsx` with real API calls via the existing Zustand store and backend, removing stock tracking UI that has no backend support.

## Current State

- **Backend**: Fully implemented — `server/routes/parts.ts` (GET list, GET by id, POST create, PATCH update, PATCH toggle status), `server/services/parts-catalog.service.ts`, `shared/schemas/parts-catalog.schema.ts`
- **Store**: `src/stores/parts-catalog.ts` — `usePartsCatalogStore` with `fetchParts`, `createPart`, `updatePart`, `togglePartActive`
- **Page**: `src/pages/parts/index.tsx` — uses `MOCK_PARTS` array with `stockLevel`/`stockMax` fields that don't exist in the Prisma model
- **Modal**: `src/components/modules/parts/add-part-modal.tsx` — form UI exists but calls a local callback, not the store

## Changes

### 1. Refactor `src/pages/parts/index.tsx`

- **Remove**: `MOCK_PARTS`, `MockPart` type, `StockBar` component, `SkeletonRow` component
- **Remove**: Low-stock alert banner (relies on `stockLevel`/`stockMax`)
- **Remove**: Stock column from desktop table, stock row from mobile cards
- **Remove**: Stock-related metrics (low stock count, total value calc)
- **Add**: `usePartsCatalogStore()` import and destructuring (`parts`, `isLoading`, `error`, `fetchParts`, `createPart`, `togglePartActive`)
- **Add**: `useEffect` to call `fetchParts()` on mount
- **Add**: `useEffect` to call `fetchParts()` with `search` and `category` params when filters change (debounced search)
- **Replace**: `MockPart` type with `PartsCatalog` shared type
- **Replace**: Local sort/filter state with server-side query params passed to `fetchParts()`
- **Add**: `isActive` toggle in the manage column (show active/inactive status, toggle button)
- **Add**: Error state display (banner or toast when `store.error` is set)
- **Update**: Metrics row — show total parts count, active/inactive count, unique suppliers from fetched data
- **Keep**: Category filter pills, search input, sort functionality (client-side sort on fetched data is fine since paginated)

### 2. Wire `AddPartModal`

- **Change**: `onSubmit` callback calls `createPart()` from store, then `fetchParts()` to refresh list
- **Add**: Error handling — catch errors from `createPart` and show toast
- **Add**: Loading state on submit button while `createPart` is in flight

### 3. No Backend Changes

The existing backend endpoints, schemas, service, and Prisma model are sufficient. No migrations needed.

## Data Flow

```
Page mount → fetchParts() → GET /api/parts → store.parts → render
Search/filter change → fetchParts({search, category}) → GET /api/parts?search=...&category=... → store.parts → render
Add part → createPart(data) → POST /api/parts → prepend to store.parts → fetchParts() → render
Toggle active → togglePartActive(id, isActive) → PATCH /api/parts/:id/status → update store.parts → render
Edit part → (future: edit modal) → updatePart(id, data) → PATCH /api/parts/:id → update store.parts → render
```

## Files Modified

1. `src/pages/parts/index.tsx` — major refactor
2. `src/components/modules/parts/add-part-modal.tsx` — wire to store (minor change, likely handled in page)

## Not in Scope

- Edit part modal (separate feature)
- Restock functionality
- Stock tracking fields
- Pagination UI (backend supports cursor but page can load all for now)
- Bulk actions