# Implementation Plan: Brand & Model Inline Add with Seeded Device Catalog

**Branch**: `002-brand-model-inline-add` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-brand-model-inline-add/spec.md`

## Summary

Replace the hardcoded `BRANDS` constant in the intake modal with a dynamic, database-driven brand/model catalog. Add a new `Brand` table to Prisma so brands can exist independently of Device records. Create API endpoints for searching brands, searching models (filtered by brand), and creating brands/models inline. Add seeded data with 8+ brands and 3+ models each. The intake modal Brand field becomes an autocomplete dropdown with inline-add; the Model field becomes a brand-filtered autocomplete dropdown with inline-add.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js ≥ 20.19.0
**Primary Dependencies**: React 19, Vite 8, Fastify 5, Prisma 7, Zod, Tailwind 4, i18next
**Storage**: PostgreSQL 17 (via Prisma 7 adapter)
**Testing**: Vitest
**Target Platform**: Web (mobile-responsive) + Capacitor Android
**Project Type**: Web application (single package.json monolith)
**Performance Goals**: Brand/model search < 300ms p95; inline-add < 2s
**Constraints**: No TanStack Query (project uses raw Axios hooks); Vite proxy `/api` → `:4000`; no barrel files
**Scale/Scope**: Single-location shop; ~100 brands, ~500 models expected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Adding a Brand table is the minimum needed for inline brand-add without a placeholder model. One new table, two new endpoints, one new dropdown component. |
| II. Surgical Changes | PASS | Only modifies: intake modal step-1, types.ts (removes BRANDS), seed.ts, schema.prisma. New files follow existing patterns. |
| III. Think Before Coding | PASS | Clarification resolved (Brand table chosen). Assumptions stated in spec. |
| IV. Goal-Driven Execution | PASS | Success criteria defined in spec (SC-001 through SC-006). Each user story independently testable. |
| V. Shared Source of Truth | PASS | New schemas go to `shared/schemas/`. Device type already shared. No duplication. |
| VI. Trilingual by Default | PASS | New UI strings ("Add 'X'") need i18n keys in en.json → sync-locales. |
| VII. Quality Gates | PASS | pnpm check, manual migration, no suppressions. |

**Result**: All gates PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-brand-model-inline-add/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── brands.md
│   └── models.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma              # Add Brand model, update Device.brand to FK

shared/
├── schemas/
│   └── device.schema.ts       # NEW: brand search, model search, create brand, create model schemas
└── types/
    └── index.ts               # Export Brand type (existing file, add type)

server/
├── routes/
│   └── devices.ts             # NEW: /api/brands, /api/brands/:brandId/models endpoints
├── services/
│   └── device.service.ts      # NEW: searchBrands, searchModels, createBrand, createModel
└── index.ts                   # Register devicesRoutes

src/
├── hooks/
│   ├── use-brand-search.ts    # NEW: debounced brand search (same pattern as use-customer-search)
│   └── use-model-search.ts   # NEW: debounced model search by brandId
├── components/modules/jobs/intake-modal/
│   ├── types.ts               # MODIFY: remove BRANDS constant
│   ├── step-1-content.tsx     # MODIFY: replace datalist with BrandSearchDropdown + ModelSearchDropdown
│   ├── use-intake-modal.ts    # MODIFY: add brandId to form state, clear model on brand change
│   ├── brand-search-dropdown.tsx  # NEW: autocomplete with inline-add
│   └── model-search-dropdown.tsx  # NEW: brand-filtered autocomplete with inline-add
└── i18n/
    └── locales/
        └── en.json            # MODIFY: add new keys, then sync-locales

prisma/seed.ts                 # MODIFY: add seedDevices() function
```

**Structure Decision**: Follows existing project patterns — single-package monolith, routes/services separation, shared schemas/types, custom Axios-based hooks.

## Complexity Tracking

No constitution violations to justify.