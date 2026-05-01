# Tasks: Brand & Model Inline Add with Seeded Device Catalog

**Input**: Design documents from `/specs/002-brand-model-inline-add/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks are excluded per template guidance.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema changes and shared code that all user stories depend on

- [ ] T001 Add Brand model to `prisma/schema.prisma` with id, name (@unique), createdAt, updatedAt, devices relation
- [ ] T002 Modify Device model in `prisma/schema.prisma`: replace `brand: String` with `brandId: String` FK to Brand, update @@unique to [brandId, model], update @@index to [brandId]
- [ ] T003 [P] Add Brand type export to `shared/types/index.ts` using Prisma.BrandGetPayload
- [ ] T004 [P] Create Zod schemas in `shared/schemas/device.schema.ts`: brandSearchQuery, createBrandSchema, modelSearchQuery, createModelSchema with inferred types
- [ ] T005 [P] Export new schemas from `shared/schemas/index.ts`
- [ ] T006 Create manual Prisma migration for Brand table + Device.brandId FK change per data-model.md migration plan
- [ ] T007 [P] Add i18n keys to `src/i18n/locales/en.json` for brand/model dropdowns (search placeholder, add option, loading, error messages) then run `pnpm run sync-locales`
- [ ] T008 Remove `BRANDS` constant from `src/components/modules/jobs/intake-modal/types.ts`

**Checkpoint**: Schema migrated, shared types/schemas available, i18n ready, BRANDS constant removed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend API and seed data that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create `server/services/device.service.ts` with searchBrands, searchModels, createBrand, createModel functions following existing service patterns (pure functions receiving prisma as first arg)
- [ ] T010 Create `server/routes/devices.ts` with four endpoints: GET /api/brands/search, POST /api/brands, GET /api/brands/:brandId/models/search, POST /api/brands/:brandId/models — following customers.ts pattern (Zod safeParse, requirePermission, AppError)
- [ ] T011 Register devicesRoutes in `server/index.ts` with prefix `/api/brands`
- [ ] T012 Update `server/services/job.service.ts` device.upsert logic: look up Brand by name first, then create Device with brandId instead of brand string
- [ ] T013 Add `seedDevices()` function to `prisma/seed.ts` — upsert Brand records and Device records for the 8 brands and ~32 models from data-model.md, call it in main()

**Checkpoint**: Backend ready — brand/model search and create endpoints functional, seed data populated, job creation still works

---

## Phase 3: User Story 4 + User Story 1 — Seeded Catalog & Brand/Model Search (Priority: P1) 🎯 MVP

**Goal**: Shop employee can search and select brands from seeded data, and see brand-filtered model suggestions

**Independent Test**: Open intake modal, type in Brand field → seeded brands appear in dropdown. Select a brand → Model field shows only that brand's models.

### Implementation for User Stories 4 & 1

- [ ] T014 Create `src/hooks/use-brand-search.ts` following use-customer-search.ts pattern (debounced API call to GET /api/brands/search, AbortController, returns { query, setQuery, results, isSearching, searchError })
- [ ] T015 [P] Create `src/hooks/use-model-search.ts` following use-brand-search pattern (debounced API call to GET /api/brands/:brandId/models/search, accepts brandId param, skips if no brandId)
- [ ] T016 [P] Create `src/components/modules/jobs/intake-modal/brand-search-dropdown.tsx` following CustomerSearchDropdown pattern (dropdown with search results, click-outside, loading state, visible prop)
- [ ] T017 [P] Create `src/components/modules/jobs/intake-modal/model-search-dropdown.tsx` following BrandSearchDropdown pattern (brand-filtered model results, click-outside, loading state, visible prop, disabled when no brandId)
- [ ] T018 Add `brandId: string` and `modelId: string` fields to IntakeFormData in `src/components/modules/jobs/intake-modal/types.ts`, add to INITIAL_FORM defaults, update REQUIRED_FIELDS if needed
- [ ] T019 Modify `src/components/modules/jobs/intake-modal/use-intake-modal.ts`: wire up useBrandSearch and useModelSearch hooks, add brand select handler (sets brand + brandId, clears model + modelId), add model select handler (sets model + modelId)
- [ ] T020 Modify `src/components/modules/jobs/intake-modal/step-1-content.tsx`: replace Brand datalist input with text input + BrandSearchDropdown, replace Model plain input with text input + ModelSearchDropdown, pass brandId and handlers from props

**Checkpoint**: Brand and model search dropdowns work with seeded data. MVP complete — user can select brands and see filtered models.

---

## Phase 4: User Story 2 — Inline Add Brand (Priority: P2)

**Goal**: User can add a new brand inline from the brand dropdown when no match is found

**Independent Test**: Type a non-existent brand name → "Add 'X'" option appears → click it → brand is created and selected

### Implementation for User Story 2

- [ ] T021 [US2] Add "Add '[typed text]'" option to BrandSearchDropdown in `src/components/modules/jobs/intake-modal/brand-search-dropdown.tsx` — show when query has no exact match among results, clicking calls POST /api/brands with optimistic selection
- [ ] T022 [US2] Add inline-create logic to `src/hooks/use-brand-search.ts` — createBrand function that calls POST /api/brands, on 409 fallback to re-search, on success add to results and return created brand
- [ ] T023 [US2] Wire brand inline-add in `src/components/modules/jobs/intake-modal/use-intake-modal.ts` — call createBrand on "Add" click, set brand + brandId on success, handle error with form field error message

**Checkpoint**: Inline brand add works. Non-existent brands can be created without leaving the form.

---

## Phase 5: User Story 3 — Inline Add Model for a Brand (Priority: P2)

**Goal**: User can add a new model inline from the model dropdown when no match is found for the selected brand

**Independent Test**: Select a brand, type a non-existent model name → "Add 'X'" option appears → click it → model is created and selected

### Implementation for User Story 3

- [ ] T024 [US3] Add "Add '[typed text]'" option to ModelSearchDropdown in `src/components/modules/jobs/intake-modal/model-search-dropdown.tsx` — show only when brandId is set and query has no exact match, clicking calls POST /api/brands/:brandId/models with optimistic selection
- [ ] T025 [US3] Add inline-create logic to `src/hooks/use-model-search.ts` — createModel function that calls POST /api/brands/:brandId/models, on 409 fallback to re-search, on success add to results and return created device
- [ ] T026 [US3] Wire model inline-add in `src/components/modules/jobs/intake-modal/use-intake-modal.ts` — call createModel on "Add" click, set model + modelId on success, handle error with form field error message

**Checkpoint**: Inline model add works. Non-existent models can be created for a brand without leaving the form.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, validation, and cleanup across all user stories

- [ ] T027 Handle case-insensitive brand duplicate in `server/services/device.service.ts` createBrand — on unique violation, fetch existing brand by case-insensitive name and return it instead of throwing 409
- [ ] T028 [P] Clear model field when brand changes in `src/components/modules/jobs/intake-modal/use-intake-modal.ts` — ensure FR-009 (clear model on brand change) works for all brand change scenarios (select, clear, inline-add)
- [ ] T029 [P] Add loading and error states to brand/model dropdown UI — spinner on create, error message near field on failure, field reverts to typed text on failure (per edge cases in spec)
- [ ] T030 Update `src/components/modules/jobs/jobs-shared.ts` inferDeviceType if it references Device.brand string directly — adapt to Device.brand.name via Brand relation
- [ ] T031 Run `pnpm check` and fix any lint/typecheck warnings across all changed files
- [ ] T032 Run `pnpm run db:seed` on a clean database and verify all 8 brands + ~32 models are created idempotently

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US4+US1 (Phase 3)**: Depends on Phase 2 — no dependencies on other user stories
- **US2 (Phase 4)**: Depends on Phase 3 (brand dropdown must exist to add "Add" option)
- **US3 (Phase 5)**: Depends on Phase 3 (model dropdown must exist to add "Add" option). Can run in parallel with Phase 4.
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US4+US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US2 (P2)**: Depends on US1 brand dropdown being complete (Phase 3)
- **US3 (P2)**: Depends on US1 model dropdown being complete (Phase 3). Independent of US2.

### Within Each User Story

- Hooks before dropdown components (hooks provide data, components consume it)
- Dropdown components before intake-modal integration
- Form state changes before wiring in use-intake-modal

### Parallel Opportunities

- T003, T004, T005, T007, T008 can all run in parallel (different files)
- T014 and T015 can run in parallel (different hooks)
- T016 and T017 can run in parallel (different components)
- Phase 4 (US2) and Phase 5 (US3) can run in parallel
- T028 and T029 can run in parallel (different concerns)

---

## Parallel Example: Phase 1

```bash
# Launch all parallel tasks in Phase 1 together:
Task: "Add Brand type export to shared/types/index.ts"
Task: "Create Zod schemas in shared/schemas/device.schema.ts"
Task: "Export new schemas from shared/schemas/index.ts"
Task: "Add i18n keys to src/i18n/locales/en.json"
Task: "Remove BRANDS constant from types.ts"
```

## Parallel Example: Phase 3 (US1)

```bash
# Launch parallel hooks and dropdown components:
Task: "Create use-brand-search.ts"
Task: "Create use-model-search.ts"
Task: "Create brand-search-dropdown.tsx"
Task: "Create model-search-dropdown.tsx"
```

## Parallel Example: Phases 4+5 (US2 + US3)

```bash
# These two phases can run in parallel:
# Phase 4 (US2): Brand inline-add
Task: "Add 'Add' option to BrandSearchDropdown"
Task: "Add createBrand to use-brand-search.ts"
Task: "Wire brand inline-add in use-intake-modal.ts"

# Phase 5 (US3): Model inline-add
Task: "Add 'Add' option to ModelSearchDropdown"
Task: "Add createModel to use-model-search.ts"
Task: "Wire model inline-add in use-intake-modal.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 4 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Stories 4 + 1
4. **STOP and VALIDATE**: Test brand/model search with seeded data independently
5. Deploy/demo if ready — users can search brands and see filtered models

### Incremental Delivery

1. Complete Setup + Foundational → Backend and seed data ready
2. Add US4+US1 → Brand/model search works (MVP!)
3. Add US2 → Inline brand add works
4. Add US3 → Inline model add works
5. Polish → Edge cases, loading states, cleanup
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US4 (seed data) and US1 (brand/model search) are combined in Phase 3 since they are co-dependent
- US2 and US3 can be implemented in parallel after US1 is complete
- Prisma migration is manual per AGENTS.md rule — T006 handles the SQL
- job.service.ts device.upsert must continue working throughout (T012)
- No barrel files — use explicit imports per project convention