# Session Notes

## 2026-04-17/18 — Unified RBAC Implementation (feat/unified-rbac)

### Follow-up items (non-blockers, flagged by final review)

1. **`bottom-nav.tsx` — role-array pattern not migrated**: Uses `item.roles.includes(role)` instead of `can(role, perm)`. All 3 current items are visible to all roles so there's no current divergence, but the architecture is inconsistent with sidebar/top-bar. Migrate in a follow-up.

2. **`customers: ["edit"]` — no server PATCH endpoint**: The permission is defined and granted to OWNER/FRONT_DESK but no `PATCH /api/customers/:id` route exists. Intentional deferral (same as `parts.viewCost`, `parts.setCost`, `reports.viewMargin`). Add the route when the customer edit feature is built.

3. **`my_jobs` locale key — now dead string**: The TECHNICIAN-specific sidebar label ("My Jobs") was consolidated to "Jobs" in Task 10. The `my_jobs` key in `src/i18n/locales/en.json` (and synced ar/fr) is now unreferenced. Remove it in a locale cleanup pass (`pnpm run sync-locales` after removing from en.json).

4. **`COMPLETED_STATUSES` has no unit test**: Pre-existing gap in `shared/__tests__/constants.test.ts`. Not introduced by this session.

5. **`VALID_TECH_ROLES` uses raw strings** in `server/services/job.service.ts:18`: `new Set(["OWNER", "TECHNICIAN"])` — should use `Role.OWNER` / `Role.TECHNICIAN` from `@shared/constants/roles` for consistency. Low priority.

---

## 2026-04-20 — Spec 2: MVP Feature Completion

### Shipped

1. **Customer edit (PATCH)**: `PATCH /api/customers/:id` route, edit dialog on job detail page
2. **Parts cost visibility**: Cost columns gated behind `parts.viewCost` permission in job parts section, catalog page, and cost summary
3. **Repair margin**: `computeMargin()` helper, margin shown on job detail only for users with `reports.viewMargin`
4. **Notification template management UI**: Edit dialog for existing templates with variable insertion buttons
5. **Warranty-return owner alerts**: WS broadcast to OWNER role on warranty-return job creation; alerts store + top-bar dropdown UI
6. **Overdue job scheduler**: 15-min tick, in-memory dedupe, broadcasts `JOB_OVERDUE` to OWNER
7. **ESC/POS receipt + QR**: `GET /api/receipts/:id/receipt` returns HTML receipt with embedded QR; print button on job detail
8. **Capacitor Android build**: `android/` scaffold via `npx cap add android`; `docs/android-build.md` for future builds

### Known follow-ups (post-MVP)

- **Raw ESC/POS printing**: Current implementation is HTML receipt + `window.print()`. Real thermal printer (ESC/POS raw) is deferred.
- **Overdue alert DB column**: `overdueAlertSentAt` on Job model for persistence across restarts (currently in-memory set, cleared on restart).
- **Keystore signing**: Release signing is a pre-store task, not MVP.
- **Android debug APK**: Needs Java + Android Studio to build. Scaffold is ready.
