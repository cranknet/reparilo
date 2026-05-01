# Research: Brand & Model Inline Add

## Decision 1: Brand Table vs. Distinct Query

**Decision**: Add a standalone `Brand` table to Prisma schema.

**Rationale**: The spec's clarification (user chose Option A) requires brands to exist independently of Device records. This enables:
- Inline-add of a brand before any models exist
- Clean brand catalog with name normalization (case-insensitive unique)
- Foreign key from Device.brand → Brand.id for referential integrity

**Alternatives considered**:
- **Distinct query on Device.brand**: Cannot represent a brand with zero models. Would require placeholder Device records — hacky and violates @@unique([brand, model]).
- **Placeholder model ("_") on Device**: Pollutes model lists. Requires filtering logic everywhere. Unnatural.
- **In-memory brand cache on frontend**: Still needs persistence; adds complexity without benefit for a single-location shop.

## Decision 2: Device.brand Migration Strategy

**Decision**: Change `Device.brand` from `String` to `brandId: String` (FK to Brand.id), keeping the `@@unique` constraint as `@@unique([brandId, model])`.

**Rationale**: The existing Device model has `brand: String` and `@@unique([brand, model])`. Changing `brand` to `brandId` as a FK to Brand is the cleanest approach:
- Existing Device records need a migration to create Brand rows from distinct brands, then alter the column
- The `@@unique([brand, model])` becomes `@@unique([brandId, model])` — same semantic, different column name
- Job.service.ts upsert logic needs updating to look up Brand first

**Alternatives considered**:
- **Keep Device.brand as String, add Brand.name**: Would lose referential integrity; no FK constraint.
- **Dual-write (both Brand table + Device.brand string)**: Redundant, drift risk.

## Decision 3: Frontend Dropdown Pattern

**Decision**: Replace HTML `<datalist>` with custom React dropdown components (`BrandSearchDropdown`, `ModelSearchDropdown`) matching the existing `CustomerSearchDropdown` pattern.

**Rationale**: The `<datalist>` element cannot support:
- Custom rendering (inline "Add" option, icons, loading states)
- Click-outside-to-close behavior
- Keyboard navigation with custom items
- Error/success visual feedback

The `CustomerSearchDropdown` component already implements all needed UX patterns (dropdown positioning, click-outside, loading, "create new" option). We follow this exact pattern.

**Alternatives considered**:
- **Keep datalist + add separate "Add" button**: Datalist doesn't support "Add X" items natively. UX is inconsistent with customer search.
- **Use a third-party combobox (headless UI, radix)**: Adds a dependency for one field. Overkill given the existing pattern.

## Decision 4: API Endpoint Design

**Decision**: Create a `brands.ts` route file with two route groups:
- `GET /api/brands/search?q=&limit=` — search brands
- `POST /api/brands` — create brand inline
- `GET /api/brands/:brandId/models/search?q=&limit=` — search models for a brand
- `POST /api/brands/:brandId/models` — create model for a brand inline

**Rationale**: Follows existing route patterns exactly. Brands are a first-class entity now, so they get their own CRUD. Models are still stored as Device records but the API abstracts this — from the frontend perspective, a model belongs to a brand.

**Alternatives considered**:
- **Single /api/devices endpoint for everything**: Would require complex query params for brand vs. model. Less RESTful.
- **Add brand/model routes to /api/jobs**: Jobs and device catalog are separate concerns. Violates single responsibility.

## Decision 5: Seed Data Scope

**Decision**: Seed 8 brands with 3-5 models each, focused on the North African / Algerian market.

**Rationale**: The shop's market is Algeria. Seed data should match what they commonly repair. Include:
- Apple (iPhone 14, 15, 16, SE, Pro Max)
- Samsung (Galaxy S24, A54, A34, Z Flip5, M14)
- Huawei (P40, Nova 11, Y9 Prime, Mate 40)
- Xiaomi (Redmi 13, Note 13 Pro, Poco X6, 14)
- Oppo (Reno 10, A78, Find X5, A58)
- Vivo (V29, X100, Y36, V30)
- OnePlus (Nord CE 3, 12, 11, Nord 3)
- Google (Pixel 8, 7a, 8 Pro)

**Alternatives considered**:
- **More brands (10-12)**: Diminishing returns for a single-location shop. 8 covers 95%+ of repairs.
- **Generic global brands**: Would include brands uncommon in Algeria (Sony, Motorola). Less useful.

## Decision 6: Form State — brandId

**Decision**: Add `brandId: string` to `IntakeFormData`. When user selects a brand from dropdown, both `brand` (display name) and `brandId` are set. When brand changes, model and modelId are cleared.

**Rationale**: The Model search endpoint needs a `brandId` to filter. Storing it in form state means the child components (dropdowns) can use it directly. The `brand` string field is retained for display and for the job.service.ts upsert logic which currently expects `deviceBrand: string`.

**Alternatives considered**:
- **Derive brandId from brand name on blur**: Requires an extra API call. Race conditions possible.
- **Store brandId outside form state**: Breaks the existing form management pattern.