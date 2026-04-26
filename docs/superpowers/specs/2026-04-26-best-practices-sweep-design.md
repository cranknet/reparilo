# Best Practices Sweep — Design Spec

Date: 2026-04-26
Status: Draft

## Context

Reparilo has reached feature completeness for its core workflows (jobs, parts, repairs, customers, notifications, settings, tracking). However, several best-practice gaps have accumulated during rapid feature development:

1. Validation logic is fragmented between shared Zod schemas and inline route handlers
2. Schema error messages are hardcoded English in a trilingual app
3. The Settings page is 1261 lines in a single file
4. Test coverage is thin across services and stores
5. Minor dead UI and hardcoded values exist

This spec addresses all five areas in impact order: data integrity first, then developer experience, then safety net, then polish.

---

## Phase 1: Zod Schema Consolidation + i18n

### Problem

- `shared/schemas/` covers auth, customer, job, parts-catalog, repair-catalog, and settings — but user management, receipt, and notification input validation live inline in route handlers
- All Zod schema error messages are hardcoded English strings (noted by TODO in `shared/schemas/job.schema.ts:1`)
- The app supports three languages (AR/FR/EN) but validation messages ignore this

### Scope

#### New shared schemas

Create three new schema files:

1. **`shared/schemas/user.schema.ts`** — Extract validation from `server/routes/users.ts`:
   - `CreateUserInput` (name, email, password, role, phone?)
   - `UpdateUserInput` (name?, email?, phone?, role?, isActive?)
   - `ChangePasswordInput` (currentPassword, newPassword, confirmPassword)
   - `ResetPasswordInput` (token, newPassword, confirmPassword)
   - `UserIdParam` (id as cuid)

2. **`shared/schemas/receipt.schema.ts`** — Extract validation from `server/routes/receipts.ts`:
   - `GenerateReceiptInput` (jobId, type: 'deposit' | 'pickup')

3. **`shared/schemas/notification.schema.ts`** — Extract validation from `server/routes/notifications.ts`:
   - `SendNotificationInput` (jobId, templateName, channel?)
   - `UpdateTemplateInput` (covers existing settings schema overlap — evaluate if template validation should move here from settings.schema.ts)

#### i18n for validation messages

- Add a `validations` namespace to `src/i18n/locales/en.json` with keys for all Zod error messages (e.g., `validations.required`, `validations.email`, `validations.minLength`, `validations.jobStatusTransition`)
- Use Zod's `message` parameter referencing i18n keys (e.g., `z.string({ message: 'validations.required' })`) rather than baking in English text
- On the server side, resolve i18n keys to locale strings using the request's `Accept-Language` header or a query parameter — fall back to English
- On the client side, React Hook Form + Zod resolver already has access to i18next, so client-side validation messages resolve naturally
- Run `pnpm run sync-locales` after adding English keys to propagate to FR and AR

#### Refactor inline validation

For each new schema:
- Identify all inline validation in the corresponding route handler
- Replace with shared schema `.parse()` or `.safeParse()` call
- Remove redundant try/catch validation blocks
- Keep route-specific business logic checks (e.g., "user exists") separate from input validation

#### Barrel export

Update `shared/schemas/index.ts` to re-export new schemas.

### Out of scope

- No changes to existing schema structures that are working (customer, job, parts-catalog, repair-catalog, settings)
- No frontend form changes — only the validation error presentation improves by consuming i18n keys

---

## Phase 2: Settings Page Decomposition

### Problem

`src/pages/settings/index.tsx` is 1261 lines containing four distinct tab panels:
- AI configuration (LLM endpoint, API key, model selection)
- Shop settings (name, address, phone, logo, currency)
- Notifications (WhatsApp provider, SMS config, message templates)
- Users management (create, edit, toggle active, role assignment)

This makes the file hard to navigate, hard to test, and prone to merge conflicts when multiple features touch different tabs.

### Scope

Extract each tab panel into its own component under `src/components/modules/settings/`:

| Component | Source section | Approx lines |
|---|---|---|
| `SettingsAiTab.tsx` | AI config panel | ~200 |
| `SettingsShopTab.tsx` | Shop settings panel | ~250 |
| `SettingsNotificationsTab.tsx` | WhatsApp/SMS/templates panel | ~400 |
| `SettingsUsersTab.tsx` | User management panel | ~350 |

The parent `src/pages/settings/index.tsx` becomes a shell (~100-150 lines) that:
- Manages active tab state
- Renders the `Tabs` / `TabsList` / `TabsTrigger` layout
- Delegates to the extracted tab components

### Patterns to follow

- Jobs page extraction placed intake components in `src/components/modules/job-intake/`
- Profile page extracted sections into `src/components/modules/profile/`
- Follow the same pattern: `src/components/modules/settings/`
- Each tab component receives only the props it needs (no prop drilling of the entire settings store)
- Each tab component manages its own form state via the existing `useSettingsStore`

### Constraints

- Pure structural refactor — no behavior changes
- All existing functionality must work identically after extraction
- The Settings page route, permissions, and tab order remain the same
- Run `pnpm check` after completion to verify no regressions

### Out of scope

- No new settings features
- No changes to the settings store or API

---

## Phase 3: Test Coverage Expansion

### Problem

Existing tests cover 9 services and 16 UI components, but 8 services, all 11 Zustand stores, and all page components lack tests. No E2E tests exist.

### Scope

#### Server service tests (priority)

Add Vitest tests under `server/__tests__/`:

| Service | Test file | Priority | Reason |
|---|---|---|---|
| `dashboard.service.ts` | `dashboard.service.test.ts` | High | Complex aggregations, three role-specific queries, most business-critical |
| `notification-outbox.service.ts` | `notification-outbox.service.test.ts` | High | Polling worker, retry logic, status tracking — async edge cases |
| `notification-sender.ts` | `notification-sender.test.ts` | Medium | WhatsApp API integration, mock SMS fallback |
| `notification-renderer.ts` | `notification-renderer.test.ts` | Medium | Template interpolation, will expand in Phase 4 |
| `avatar.service.ts` | `avatar.service.test.ts` | Medium | File upload/delete, resize |
| `job-photos.service.ts` | `job-photos.service.test.ts` | Medium | Upload, delete, max-5 enforcement |
| `audit.service.ts` | `audit.service.test.ts` | Low | Simple log creation, but compliance-critical |
| `job-waiting-parts.service.ts` | `job-waiting-parts.service.test.ts` | Low | Parts workflow, straightforward CRUD |

Follow existing test patterns in `server/__tests__/`:
- Use the Prisma test helper for database mocking/re seeding
- Test both success and error paths
- Test boundary conditions (e.g., max photos, retry exhaustion)

#### Zustand store tests (secondary)

Add Vitest tests under `src/stores/__tests__/`:

| Store | Test file | Priority | Reason |
|---|---|---|---|
| `useJobsStore` (307 lines) | `jobs.test.ts` | High | Most complex store, filter state, pagination, mutations |
| `useSettingsStore` (264 lines) | `settings.test.ts` | High | AI + shop + notification state, multiple fetch paths |
| Remaining 9 stores | Batch in groups | Low | Simpler stores, lower risk |

For store tests:
- Mock the API client (`src/lib/api-client.ts`)
- Test state transitions, action side effects, and error handling
- Verify optimistic updates are correctly rolled back on failure

### Out of scope

- Page-level component tests (lower leverage than service/store tests)
- E2E tests (requires Playwright/Cypress setup — separate spec)
- Adding tests for existing tested services (no need to double-cover)

---

## Phase 4: Minor Fixes

### 4a: Dead Daily Summary button

The owner dashboard (`src/pages/dashboard/index.tsx`) has a "Daily Summary" button with no onClick handler. Options:

- **Remove the button** — clean dead UI. Re-add when AI Analyst provides the summary content.
- **Wire to a placeholder** — show a toast "Coming soon" on click.

**Recommendation:** Remove the button. Dead UI is worse than no UI — it trains users to ignore buttons. When the AI Analyst is built, a proper summary feature can be designed from scratch with the right UX.

Update the i18n key `dashboard.dailySummary` (remove or mark unused) and sync locales.

### 4b: Hardcoded phone prefix

The settings shop form uses a `+213 XX XXX XXXX` placeholder. This is Algerian-specific but not derived from the configured `ShopSettings`.

**Fix:**
- `ShopSettings` has no `countryCode` field — add one (Prisma migration required): `countryCode String @default("DZ")` (ISO 3166-1 alpha-2, defaulting to Algeria)
- Add a `countryCode` field to the Shop Settings tab form
- Derive the phone placeholder from `countryCode` via a small lookup map (e.g., DZ → `+213 XX XXX XXXX`, FR → `+33 X XX XX XX XX`, default → `+X XXX XXX XXXX`)
- Remove hardcoded `+213 XX XXX XXXX` placeholder from the form
- Run `pnpm run sync-locales` to update locale files

### 4c: Notification renderer upgrade

`server/services/notification-renderer.ts` is 11 lines — basic `{{key}}` Mustache-style replacement. It lacks:
- Conditional blocks (e.g., include warranty info only when applicable)
- Locale-aware number/date formatting

**Fix:**
- Support `{if key}...{endif}` conditional blocks — simple string parsing, no template engine dependency
- Apply `Intl.NumberFormat` and `Intl.DateTimeFormat` using the job/customer locale before interpolation
- Keep it lightweight — no Handlebars/Mustache dependency needed for this scope
- Add tests (covered in Phase 3: `notification-renderer.test.ts`)

### Out of scope

- No new notification features
- No changes to the WhatsApp/SMS sending pipeline

---

## Execution Order

| Phase | Depends on | Estimated scope |
|---|---|---|
| 1. Zod schemas + i18n | None | ~3-4 new files, ~6 modified files |
| 2. Settings decomposition | None | ~4 new files, ~1 modified file |
| 3. Test expansion | Phase 1 (schemas must be stable before testing them) | ~12-16 new test files |
| 4. Minor fixes | Phase 3 (renderer tests written before renderer changes) | ~4-5 modified files |

Phases 1 and 2 are independent and could run in parallel. Phase 3 depends on Phase 1 schemas being final. Phase 4's renderer fix depends on Phase 3's renderer tests existing first.

---

## Success Criteria

- **Phase 1:** All API inputs validated through shared Zod schemas. Zero hardcoded English validation messages. All three locale files contain a `validations` namespace. `pnpm check` passes.
- **Phase 2:** Settings page index.tsx under 200 lines. Four extracted components in `src/components/modules/settings/`. No behavioral regressions. `pnpm check` passes.
- **Phase 3:** 8 new service test files passing. 2+ store test files passing. `pnpm test` passes.
- **Phase 4:** No dead buttons in dashboard. Phone placeholder is dynamic. Renderer supports conditionals. `pnpm test` and `pnpm check` pass.