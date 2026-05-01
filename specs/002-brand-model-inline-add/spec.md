# Feature Specification: Brand & Model Inline Add with Seeded Device Catalog

**Feature Branch**: `002-brand-model-inline-add`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "When user types Brand and Model in the intake modal, those inputs should have quick inline add. For example user types 'Vivo' brand then clicks add in dropdown, the brand is added auto to database and same for Model, but model is related to brand. Seed data should have predefined brands and top models related instead of hardcoded constants."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select Brand from Seeded Catalog (Priority: P1)

A shop employee creating a new job types in the Brand field. As they type, a dropdown shows matching brands from the database (e.g., "Samsung", "Apple", "Vivo"). They select a brand from the list, which populates the field immediately. The model suggestions then filter to only show models for the selected brand.

**Why this priority**: This is the core value — replacing hardcoded constants with a dynamic, searchable brand catalog that already has data. Without this, neither inline-add nor filtered models make sense.

**Independent Test**: Can be fully tested by opening the intake modal, typing in the Brand field, and verifying that seeded brands appear as selectable options. The Model field should then show only models for the chosen brand.

**Acceptance Scenarios**:

1. **Given** the intake modal is open and the Brand field is focused, **When** the user types "Sa", **Then** a dropdown shows brands matching "Sa" (e.g., Samsung) from the database
2. **Given** a brand is selected from the dropdown, **When** the user focuses the Model field, **Then** only models belonging to the selected brand appear as suggestions
3. **Given** no brand is selected, **When** the user types in the Model field, **Then** no brand-filtered suggestions appear (free text entry allowed)

---

### User Story 2 - Inline Add New Brand (Priority: P2)

A shop employee types a brand name that does not exist in the catalog (e.g., "Vivo"). The dropdown shows an "Add 'Vivo'" option. Clicking it creates the brand in the database instantly and selects it, without leaving the intake form.

**Why this priority**: Inline add eliminates the need for a separate brand management screen for the common case of a new brand. It builds on P1 (the dropdown) but the system can function with P1 alone.

**Independent Test**: Can be tested by typing a brand name not in the database, clicking the inline "Add" option, and verifying the brand is persisted and immediately selectable.

**Acceptance Scenarios**:

1. **Given** the Brand field is focused and the typed text matches no existing brand, **When** the dropdown appears, **Then** an "Add '[typed text]'" option is shown
2. **Given** the "Add" option is shown, **When** the user clicks it, **Then** the new brand is saved to the database, selected in the field, and the dropdown closes
3. **Given** a new brand was just added, **When** the user later searches for it, **Then** it appears as a normal brand suggestion

---

### User Story 3 - Inline Add New Model for a Brand (Priority: P2)

After selecting a brand, the employee types a model name that does not exist for that brand (e.g., "X100" under "Vivo"). The Model dropdown shows an "Add 'X100'" option. Clicking it creates the model (linked to the selected brand) in the database and selects it.

**Why this priority**: Same value as P2 but for models — the model is always associated with a brand, so it requires a brand to be selected first.

**Independent Test**: Can be tested by selecting a brand, typing a non-existent model name, clicking "Add", and verifying the model-brand association is persisted.

**Acceptance Scenarios**:

1. **Given** a brand is selected and the Model field is focused, **When** the typed text matches no existing model for that brand, **Then** an "Add '[typed text]'" option is shown in the Model dropdown
2. **Given** the "Add" option is shown for a model, **When** the user clicks it, **Then** the new model is saved to the database linked to the selected brand, selected in the field, and the dropdown closes
3. **Given** no brand is selected, **When** the user types in the Model field, **Then** no inline "Add" option appears (a brand must be selected first for model creation)

---

### User Story 4 - Seeded Device Catalog (Priority: P1)

When the database is first set up, it contains a predefined set of popular phone brands and their top models (e.g., Apple: iPhone 15, iPhone 14; Samsung: Galaxy S24, Galaxy A54; Vivo: V29, X100). These are seeded alongside existing seed data.

**Why this priority**: Without seed data, the dropdown would be empty on a fresh install, making P1 useless. Seed data and brand selection are co-dependent.

**Independent Test**: Can be tested by running the seed script on a fresh database and verifying that brands and models appear in the intake dropdown.

**Acceptance Scenarios**:

1. **Given** a fresh database after seeding, **When** the user opens the Brand dropdown, **Then** predefined brands appear (Apple, Samsung, Huawei, Xiaomi, Oppo, Vivo, OnePlus, Google Pixel, etc.)
2. **Given** "Samsung" is selected, **When** the Model dropdown opens, **Then** predefined Samsung models appear (Galaxy S24, Galaxy A54, Galaxy Z Flip5, etc.)
3. **Given** existing Device records in the database from prior job creation, **When** the seed script runs, **Then** those existing records are preserved (seed is idempotent)

---

### Edge Cases

- What happens if the user types a brand that already exists with different casing (e.g., "samsung" vs "Samsung")? — Matching should be case-insensitive; duplicate brands should not be created.
- What happens if the user clears the brand field after selecting a brand and model? — The model field should be cleared as well since its context depends on the selected brand.
- What happens if the user tries to add a model when no brand is selected? — The "Add" option must not appear; free text is still allowed for the model field.
- What happens if two users simultaneously try to add the same brand? — The brand unique constraint prevents duplicates; the second user simply gets the existing brand.
- What happens if network/API is slow during inline add? — A loading indicator should show, and the field should not accept further input until the operation completes or fails.
- What happens if inline add fails? — An error message appears near the field, and the field reverts to the typed text without selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a searchable dropdown for brands that queries existing Device records from the database grouped by brand
- **FR-002**: System MUST display a searchable dropdown for models that shows only models belonging to the currently selected brand
- **FR-003**: System MUST show an "Add '[typed text]'" option in the Brand dropdown when no existing brand matches the user's input
- **FR-004**: System MUST create a new brand entry in the database when the user clicks the "Add" option in the Brand dropdown, and immediately select it
- **FR-005**: System MUST show an "Add '[typed text]'" option in the Model dropdown when a brand is selected and no existing model for that brand matches the user's input
- **FR-006**: System MUST create a new model entry in the database linked to the selected brand when the user clicks the "Add" option in the Model dropdown, and immediately select it
- **FR-007**: System MUST NOT show the inline "Add" option in the Model dropdown when no brand is selected
- **FR-008**: Brand and model matching MUST be case-insensitive
- **FR-009**: The Model field MUST be cleared when the Brand field is changed (to avoid stale brand-model associations)
- **FR-010**: System MUST seed predefined brands and their top models into the Device table during initial setup
- **FR-011**: Seed script MUST be idempotent — re-running it MUST NOT duplicate existing Device records
- **FR-012**: System MUST replace any hardcoded brand lists with database-driven data across the entire application
- **FR-013**: System MUST support searching brands and models, including brand-filtered model search
- **FR-014**: System MUST support creating new brands and models inline from the intake form

### Key Entities

- **Brand**: Represents a device manufacturer (e.g., Apple, Samsung, Vivo). Stored in a dedicated Brand table, independent of Device records. A brand can exist without any associated models.
- **Model**: Represents a specific device model (e.g., Galaxy S24, iPhone 15). Stored as a Device record with both `brand` (referencing Brand) and `model` fields. Each brand-model combination is unique per the existing `@@unique([brand, model])` constraint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Shop employees can find and select a brand from the dropdown within 3 seconds of typing, for any of the 8+ seeded brands
- **SC-002**: After selecting a brand, relevant models appear in the Model dropdown within 1 second
- **SC-003**: A new brand can be added inline and become immediately available for selection in under 2 seconds
- **SC-004**: A new model can be added inline and become immediately available for selection in under 2 seconds
- **SC-005**: Seeded device catalog contains at least 8 brands with at least 3 models per brand on fresh install
- **SC-006**: Zero duplicate brand entries regardless of casing differences (e.g., "Samsung" vs "samsung")

## Assumptions

- The existing Device model in Prisma (with `brand` + `model` + `@@unique([brand, model])`) is sufficient to store brand-model data without schema changes
- Brand list is derived by querying distinct `brand` values from the Device table — no separate Brand table is needed
- The inline-add operation creates a Device record (brand + model pair) directly, since the Device table already has the unique constraint on `[brand, model]`
- A separate Brand table will be added to the schema so that brands can exist independently of Device records. This allows a new brand to appear in suggestions immediately after inline-add, even before any models are associated. The Device table's `brand` field becomes a foreign key reference to the Brand table, and models continue to be stored as Device records with the existing `@@unique([brand, model])` constraint
- Seed data focuses on brands and models commonly repaired in North Africa / Algeria (the shop's market), including Chinese brands like Vivo, Oppo, Xiaomi
- The user's locale (AR/FR/EN) does not affect brand/model names since they are proper nouns
- Existing `device.upsert` logic in `job.service.ts` continues to work alongside the new inline-add functionality