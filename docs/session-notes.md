# Session Notes

## 2026-04-17/18 — Unified RBAC Implementation (feat/unified-rbac)

### Follow-up items (non-blockers, flagged by final review)

1. **`bottom-nav.tsx` — role-array pattern not migrated**: Uses `item.roles.includes(role)` instead of `can(role, perm)`. All 3 current items are visible to all roles so there's no current divergence, but the architecture is inconsistent with sidebar/top-bar. Migrate in a follow-up.

2. **`customers: ["edit"]` — no server PATCH endpoint**: The permission is defined and granted to OWNER/FRONT_DESK but no `PATCH /api/customers/:id` route exists. Intentional deferral (same as `parts.viewCost`, `parts.setCost`, `reports.viewMargin`). Add the route when the customer edit feature is built.

3. **`my_jobs` locale key — now dead string**: The TECHNICIAN-specific sidebar label ("My Jobs") was consolidated to "Jobs" in Task 10. The `my_jobs` key in `src/i18n/locales/en.json` (and synced ar/fr) is now unreferenced. Remove it in a locale cleanup pass (`pnpm run sync-locales` after removing from en.json).

4. **`COMPLETED_STATUSES` has no unit test**: Pre-existing gap in `shared/__tests__/constants.test.ts`. Not introduced by this session.

5. **`VALID_TECH_ROLES` uses raw strings** in `server/services/job.service.ts:18`: `new Set(["OWNER", "TECHNICIAN"])` — should use `Role.OWNER` / `Role.TECHNICIAN` from `@shared/constants/roles` for consistency. Low priority.
