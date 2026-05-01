# Quickstart: Brand & Model Inline Add

## Overview

This feature replaces the hardcoded `BRANDS` constant in the intake modal with a dynamic, database-driven brand and model catalog. Users can search and select brands/models from a dropdown, and inline-add new ones without leaving the form.

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Brand table | `prisma/schema.prisma` | New entity for brand catalog |
| Device.brandId FK | `prisma/schema.prisma` | Device now references Brand |
| Device routes | `server/routes/devices.ts` | Brand/model search + create API |
| Device service | `server/services/device.service.ts` | Business logic for brands/models |
| Device schemas | `shared/schemas/device.schema.ts` | Zod validation for create/search |
| Brand search dropdown | `src/.../intake-modal/brand-search-dropdown.tsx` | Autocomplete with inline-add |
| Model search dropdown | `src/.../intake-modal/model-search-dropdown.tsx` | Brand-filtered autocomplete with inline-add |
| use-brand-search | `src/hooks/use-brand-search.ts` | Debounced brand search hook |
| use-model-search | `src/hooks/use-model-search.ts` | Debounced model search hook |

## Data Flow

```text
User types in Brand field
  → useBrandSearch debounces query
    → GET /api/brands/search?q=Sams&limit=20
      → device.service.searchBrands()
        → prisma.brand.findMany({ where: { name: { startsWith: q, mode: 'insensitive' } } })
  → Dropdown shows matching brands + "Add 'Sams...'" if no exact match
  → User selects brand or clicks Add
    → If Add: POST /api/brands { name: "Sams..." }
    → Brand stored, selected in field, brandId set

User types in Model field (brand must be selected)
  → useModelSearch debounces query with brandId
    → GET /api/brands/:brandId/models/search?q=Gal&limit=20
      → device.service.searchModels()
        → prisma.device.findMany({ where: { brandId, model: { startsWith: q, mode: 'insensitive' } } })
  → Dropdown shows matching models + "Add 'Gal...'" if no exact match
  → User selects model or clicks Add
    → If Add: POST /api/brands/:brandId/models { model: "Gal..." }
    → Device record created (brandId + model), selected in field
```

## Form State Changes

`IntakeFormData` gains two new fields:
- `brandId: string` — FK to Brand table (used for model search)
- `modelId: string` — optional, Device.id of selected model (used for job creation later)

When brand changes: `brandId` is set, `model` and `modelId` are cleared.

## Seed Data

Run `pnpm run db:seed` after migration. The seed script creates:
- 8 brands (Apple, Samsung, Huawei, Xiaomi, Oppo, Vivo, OnePlus, Google)
- 3-5 models per brand (32 total Device records)

## Migration Order

1. Add Brand model to schema
2. Create manual migration (per AGENTS.md rule)
3. Run `pnpm run db:seed` to populate brands and device models
4. Subsequent migration: alter Device to use brandId FK

## Testing Checklist

- [ ] Fresh seed creates all 8 brands and ~32 models
- [ ] Re-running seed is idempotent (no duplicates)
- [ ] Brand dropdown shows seeded brands on search
- [ ] Model dropdown filters by selected brand
- [ ] Inline-add creates brand and selects it
- [ ] Inline-add creates model for brand and selects it
- [ ] Changing brand clears model
- [ ] No brand selected = no model "Add" option
- [ ] Case-insensitive search (samsung matches Samsung)
- [ ] Duplicate add returns existing brand/model (409 → fallback to search)