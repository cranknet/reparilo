# Test Coverage & RTL/a11y Validation — Implementation Plan (Spec 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Raise confidence that Reparilo behaves correctly across roles, languages, and assistive tech before production rollout. Four independent workstreams: service-layer unit tests, RBAC enforcement integration tests, RTL/Arabic layout QA pass, WCAG 2.2 audit on core flows.

**Architecture:** No product code changes except (a) fixes surfaced by the new tests/audits and (b) accessibility fixes. This plan adds ~30+ test cases and produces two audit reports (RTL + a11y).

**Tech Stack:** Vitest + @testing-library/react + Fastify's `inject()` for integration tests + Chrome DevTools MCP for manual a11y audits. No new deps.

**Spec basis:** MVP readiness audit findings; no standalone spec.md.

**Prerequisite:** Spec 1 complete; Spec 2 complete or in progress — RBAC tests (Workstream 2) should cover *whatever routes exist at the time of writing*, including Spec 2's new ones.

---

## Workstream Map

| # | Focus | Deliverable | Blocks production? |
|---|---|---|---|
| 1 | Service-layer unit tests | `server/services/__tests__/*.test.ts` | No — safety net |
| 2 | RBAC integration tests | `server/__tests__/rbac-*.test.ts` | Yes — security |
| 3 | RTL/Arabic layout pass | Report + bug fixes | Yes — Arabic market launch |
| 4 | WCAG 2.2 audit | Report + fixes for Level A/AA issues | Yes — legal/professional baseline |

Work the workstreams in parallel if multiple contributors; sequentially 1 → 2 → 3 → 4 if solo (each roughly 1–2 days).

---

## Workstream 1 — Service-layer unit tests

The five service files in `server/services/` have zero direct unit tests — everything is currently exercised only through integration tests, if at all.

**Target files:**
- `server/services/job.service.ts` — has the most complex logic
- `server/services/job-parts.service.ts`
- `server/services/job-repairs.service.ts`
- `server/services/job-notes.service.ts`
- `server/services/parts-catalog.service.ts`
- `server/services/repair-catalog.service.ts`
- `server/services/customers.service.ts`
- `server/services/settings.service.ts`

Focus on pure-ish helpers and branch logic. Don't re-test Prisma — mock it and test *our* logic.

### Task 1.1 — `job.service.ts`

**Files:**
- Create: `server/services/__tests__/job.service.test.ts`

Priority functions to cover:

| Function | Branches to cover |
|---|---|
| `computeFinalCost` | with/without deposit, with/without parts, with/without repairs |
| `computeMargin` (if added in Spec 2) | zero parts; negative margin; missing finalCost |
| `lookupByCode` | unknown code; wrong phone4; correct lookup; non-digit phone normalization |
| `validateTechnician` | valid, invalid, null |
| `update` (status transition guards) | terminal status rejection; technician change validation |

- [ ] **Step 1.1.1: Write failing test file**

Pattern — mock Prisma per test with `vi.fn()`:

```ts
import { describe, expect, it, vi } from "vitest";
import * as service from "../job.service";

function mockPrisma(overrides: Partial<any> = {}) {
  return {
    job: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), ...overrides.job },
    customer: { findUnique: vi.fn(), ...overrides.customer },
    // ...
  } as any;
}

describe("computeFinalCost", () => {
  it("subtracts deposit from estimatedCost + parts + repairs", () => {
    const result = service.computeFinalCost({
      estimatedCost: 100,
      depositAmount: 20,
      partsUsed: [{ totalCost: 30 }],
      repairs: [{ price: 10 }],
    } as any);
    expect(result).toBe(120); // 100 + 30 + 10 - 20; confirm the actual formula
  });
});
```

Read the actual implementation to confirm the formula before writing assertions — do not guess.

- [ ] **Step 1.1.2: Run + iterate**

Run: `pnpm vitest run server/services/__tests__/job.service.test.ts`. Make each assertion pass by matching the real behavior.

- [ ] **Step 1.1.3: Commit**

```bash
git commit -m "test(job.service): unit tests for cost, margin, lookup, validation"
```

### Task 1.2 — Remaining services

Repeat the same pattern for each service. One file per service test. Target: 4–8 tests per service covering the happy path and the interesting branches.

- [ ] **Step 1.2.1–1.2.7: One commit per service file**

Each commit: `test(<service-name>): unit tests for <what-covered>`.

### Task 1.3 — Coverage check

- [ ] **Step 1.3.1: Run coverage report**

```bash
pnpm vitest run --coverage
```

- [ ] **Step 1.3.2: Inspect coverage for `server/services/**`**

Open the HTML report. Target: every service file at ≥ 70% statement coverage. Add tests for uncovered branches until met. Do not chase 100% — diminishing returns.

- [ ] **Step 1.3.3: Commit the coverage gate (optional)**

If the project agrees: add a coverage threshold to `vitest.config.ts` under `test.coverage.thresholds`. Otherwise skip — just document the current baseline in `docs/session-notes.md`.

---

## Workstream 2 — RBAC integration tests

`server/__tests__/rbac.test.ts` covers permission matching but not every route. Goal: assert that every mutating endpoint rejects requests from roles lacking the required permission.

### Task 2.1 — Inventory routes and required permissions

- [ ] **Step 2.1.1: List every route**

```bash
grep -nE '\bapp\.(get|post|patch|put|delete)\(' server/routes/*.ts
```

Capture: method, path, required permission (from the `preHandler: requirePermission(...)` metadata or the plugin-level `addHook`).

Paste the inventory into `docs/session-notes.md` under a `## RBAC inventory` section for reference; keep it fresh when Spec 2 adds routes.

### Task 2.2 — Matrix test

**Files:**
- Create: `server/__tests__/rbac-matrix.test.ts`

- [ ] **Step 2.2.1: Enumerate roles × routes**

For each role (`OWNER`, `MANAGER`, `TECHNICIAN`, `RECEPTIONIST` — adjust to actual enum) and each mutating route, assert:
- If the role has the permission → 2xx or 4xx for domain reasons (not 403).
- If the role lacks the permission → 403.

Pattern:

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildTestApp, signInAs, resetDb } from "./helpers/test-app";

describe("RBAC matrix", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app.prisma); });

  const cases: Array<{ role: string; method: string; path: string; expectStatus: number }> = [
    { role: "TECHNICIAN", method: "PATCH", path: "/api/customers/abc", expectStatus: 403 },
    { role: "OWNER",      method: "PATCH", path: "/api/customers/abc", expectStatus: 404 /* no such customer */ },
    // ... one line per (role, route) pair
  ];

  for (const c of cases) {
    it(`${c.role} ${c.method} ${c.path} → ${c.expectStatus}`, async () => {
      const cookie = await signInAs(app, c.role);
      const res = await app.inject({
        method: c.method as any,
        url: c.path,
        headers: { Cookie: cookie },
        payload: {}, // per-route minimum valid payload
      });
      expect(res.statusCode).toBe(c.expectStatus);
    });
  }
});
```

- [ ] **Step 2.2.2: Seed test users for each role**

In the `resetDb` or `buildTestApp` helper, seed one user per role so `signInAs("TECHNICIAN")` etc. returns a cookie quickly. Use `SEED_ADMIN_PASSWORD` or a fixed test password.

- [ ] **Step 2.2.3: Run + fix**

Run: `pnpm run test`. Expect failures for any route that's currently under-guarded. Each failure is a real security bug — file + fix before moving on.

- [ ] **Step 2.2.4: Commit**

```bash
git commit -m "test(rbac): exhaustive role × route matrix"
```

### Task 2.3 — Public endpoint tests

Specifically that unauthenticated requests to authenticated routes return 401:

- [ ] **Step 2.3.1: Assert 401 without cookie**

One test per non-public route: `inject` without `Cookie` header, expect `401`. Public exceptions: `/health`, `/api/csrf-token`, `/api/auth/*`, `/api/jobs/lookup`, `/ws`.

- [ ] **Step 2.3.2: Commit**

```bash
git commit -m "test(rbac): enforce 401 on unauthenticated access"
```

---

## Workstream 3 — RTL/Arabic layout pass

Verify every authenticated page and the public tracking page render correctly in Arabic (RTL).

**Deliverable:** an `docs/rtl-audit-2026-04-20.md` report + inline fixes for Level 1 issues.

### Task 3.1 — Set up the audit

- [ ] **Step 3.1.1: Run the dev server, switch to Arabic**

```bash
pnpm dev
```

In the browser: language switcher → Arabic. Verify `<html dir="rtl" lang="ar">` is set (check `src/i18n/` for the RTL toggle logic).

- [ ] **Step 3.1.2: Prepare a screenshot checklist**

Page inventory — every route under `src/pages/` that renders UI. For each: capture a screenshot in Arabic and English at desktop and mobile widths. Use Chrome DevTools MCP `take_screenshot` if available.

### Task 3.2 — Page-by-page visual check

For each page:

- [ ] **Step 3.2.1: Layout check**

Look for: icons on the wrong side, directional arrows flipped incorrectly, fixed `margin-left` / `padding-right` (should be `margin-inline-start` / `padding-inline-end` in Tailwind via `ms-*` / `pe-*` utilities).

- [ ] **Step 3.2.2: Text flow check**

Mixed-direction sentences (Arabic + Latin numbers/codes): verify numbers don't get reversed visually. Use `<bdi>` where neutral inline text mixes directions if needed.

- [ ] **Step 3.2.3: Form field alignment**

Inputs should be right-aligned in RTL; labels on the correct side; error messages beneath the correct input.

- [ ] **Step 3.2.4: Record findings**

In `docs/rtl-audit-2026-04-20.md`, one entry per issue: page path, screenshot, what's wrong, severity (Level 1 = broken, Level 2 = cosmetic).

### Task 3.3 — Fix Level 1 issues

- [ ] **Step 3.3.1: Swap hardcoded directional utilities**

Replace any `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right` found during the audit with logical equivalents (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`).

- [ ] **Step 3.3.2: Commit one fix at a time**

```bash
git commit -m "fix(rtl): swap directional utilities on <page>"
```

- [ ] **Step 3.3.3: Re-screenshot after fixes**

Link before/after shots in the audit doc.

### Task 3.4 — Document Level 2 issues

Level 2 (cosmetic) issues go in `docs/session-notes.md` as follow-up work, not blockers.

- [ ] **Step 3.4.1: Commit the audit doc**

```bash
git add docs/rtl-audit-2026-04-20.md
git commit -m "docs: RTL/Arabic layout audit (pre-MVP)"
```

---

## Workstream 4 — WCAG 2.2 audit

Audit the five most-used flows for Level A and Level AA conformance. Fix blockers; document the rest.

**In-scope flows:**
1. Sign in + password change
2. Job intake (customer + device + reported problem + submit)
3. Job detail (view + transition status + add note)
4. Customer list + edit
5. Public tracking lookup

**Deliverable:** `docs/a11y-audit-2026-04-20.md` + inline fixes.

### Task 4.1 — Tooling

- [ ] **Step 4.1.1: Use the `accessibility` skill**

This project has the `accessibility` skill available. Invoke it at the start to get the WCAG 2.2 checklist. Use Chrome DevTools MCP `lighthouse_audit` for an automated first pass per flow.

- [ ] **Step 4.1.2: Manual axe-core check**

Install axe DevTools browser extension OR use `@axe-core/react` temporarily in dev to surface violations in the console. Remove after the audit — don't ship as a dep.

### Task 4.2 — Run the audit per flow

For each flow:

- [ ] **Step 4.2.1: Automated scan**

Run Lighthouse a11y audit; capture score + violations.

- [ ] **Step 4.2.2: Keyboard-only pass**

Unplug the mouse metaphorically. Tab through every interactive element. Can you complete the flow? Any focus traps, missing focus indicators, unreachable buttons?

- [ ] **Step 4.2.3: Screen reader smoke**

macOS VoiceOver (`Cmd+F5`) or NVDA on Windows. Read through each page. Are headings announced in order? Do buttons have accessible names? Are form errors associated with their inputs (`aria-describedby`)?

- [ ] **Step 4.2.4: Color contrast**

All text ≥ 4.5:1 (normal) or 3:1 (large). Use the Chrome DevTools contrast picker on every color combination.

- [ ] **Step 4.2.5: Record findings**

One row per issue in the audit doc: location, WCAG criterion number + level, description, severity (A = blocker, AA = should-fix, AAA = nice).

### Task 4.3 — Fix Level A issues

Common fixes:
- Add `aria-label` to icon-only buttons.
- Associate form errors with inputs via `aria-describedby` + `id` on the error element.
- Add `aria-live="polite"` to toast containers.
- Ensure every route has a `<h1>`.
- Add a skip-to-content link on the shell layout.
- Give all images `alt` text; decorative images `alt=""`.

- [ ] **Step 4.3.1: One commit per flow**

```bash
git commit -m "fix(a11y): <flow> WCAG A blockers"
```

### Task 4.4 — Fix Level AA issues

- [ ] **Step 4.4.1: Same process, one commit per flow**

```bash
git commit -m "fix(a11y): <flow> WCAG AA issues"
```

### Task 4.5 — Re-run Lighthouse

- [ ] **Step 4.5.1: Target: a11y score ≥ 90 on each flow**

If under 90 after fixes, document why in the audit doc (e.g., a third-party library dragging the score).

- [ ] **Step 4.5.2: Commit audit doc**

```bash
git add docs/a11y-audit-2026-04-20.md
git commit -m "docs: WCAG 2.2 audit (pre-MVP)"
```

---

## Final verification (Spec 3 complete)

- [ ] **Step F.1: Full pipeline + coverage**

```bash
pnpm run check && pnpm vitest run --coverage && pnpm run scan-i18n
```

- [ ] **Step F.2: Review the two audit docs**

`docs/rtl-audit-2026-04-20.md` and `docs/a11y-audit-2026-04-20.md` — each has a clear "Fixed" and "Deferred" section.

- [ ] **Step F.3: Session-notes update**

Summarize in `docs/session-notes.md`:
- Service coverage % achieved per file.
- RBAC gaps found + fixed.
- RTL Level 1 issues fixed; Level 2 deferred.
- WCAG Level A issues fixed; AA issues fixed; AAA deferred.

- [ ] **Step F.4: Commit**

```bash
git add docs/session-notes.md
git commit -m "docs: Spec 3 rollout summary"
```

---

## Self-review

**Coverage vs. audit findings:**
- Service-layer 0% → target ≥ 70% per file ✓
- RBAC route matrix not exercised → full matrix test ✓
- RTL never validated → audit + fixes ✓
- No WCAG audit ever run → audit + Level A/AA fixes ✓

**Placeholder scan:** All tasks contain either concrete code, concrete commands, or explicit "read X first" steps. Audit deliverables are named files with dated filenames.

**Out of scope (flagged, not hidden):**
- 100% coverage — explicitly not a goal.
- WCAG AAA — audited but AAA fixes deferred.
- RTL Level 2 cosmetic — deferred to post-MVP.
- End-to-end tests (Playwright / Cypress) — not in this spec; would be a Spec 4 later.
