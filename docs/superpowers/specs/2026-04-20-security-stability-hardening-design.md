# Spec 1 — Security & Stability Hardening

**Date:** 2026-04-20
**Status:** Draft — pending user approval
**Owner:** Bechar Gherbi
**Parent program:** MVP Readiness (Specs 1 / 2 / 3)

---

## 1. Overview

Reparilo's core application is functional, but seven concrete defects in auth, public-endpoint exposure, client resilience, and i18n hygiene block putting the system in front of a paying shop. This spec fixes those defects surgically — no new UX, no refactors beyond what the fixes require.

Goal: **"safe to deploy to one real shop"** at the end of this spec. MVP feature completion (customer edit, receipts, QR, Android build) is Spec 2. Test coverage buildout is Spec 3.

---

## 2. Scope

### In scope

1. WebSocket auth: validate the actual Better Auth session, not just cookie presence.
2. Public `/jobs/lookup`: redact technician identity; require `jobCode` + phone-last-4 (not either-code-alone); rate-limit.
3. Client CSRF retry: bound retries and fail cleanly on repeated CSRF-token fetch errors.
4. React error boundary: global fallback so a component crash does not white-screen the app.
5. Localize user-facing error strings currently hardcoded in `src/stores/*.ts`.
6. Remove dead `my_jobs` locale key.

### Out of scope (deferred to Spec 2/3 or future work)

- AI analyst wiring.
- Customer edit (PATCH), parts cost UI, margin UI, notification templates UI, warranty alerts, overdue scheduler, ESC/POS receipts, QR generation, Capacitor Android build.
- Server-side error log ingestion (client-side console logging only for now).
- WebSocket client auto-reconnect UX.
- Full WCAG audit / RTL QA (Spec 3).
- Service-layer test suites (Spec 3).

---

## 3. Architecture

No structural change. All edits live in existing files:

| Area | Files touched |
|---|---|
| WS auth | `server/plugins/websocket.ts` |
| Tracking lookup | `server/services/job.service.ts`, `server/routes/jobs.ts`, `shared/schemas/` (new or amended), `src/pages/tracking/index.tsx` |
| Rate limit | `server/routes/jobs.ts` (route-local `@fastify/rate-limit` config) |
| CSRF retry | `src/lib/api.ts` |
| Error boundary | `src/components/error-boundary.tsx` (new), `src/main.tsx` or `src/App.tsx` |
| Store i18n | `src/stores/*.ts`, `src/i18n/locales/en.json` (+ sync) |
| Dead key | `src/i18n/locales/{en,fr,ar}.json` |

---

## 4. Components

### 4.1 WebSocket session validation

**Current (`server/plugins/websocket.ts:6-10`):** rejects only if the `Cookie` header literally does not contain the substring `"session"`. Any cookie named `session` — even empty, expired, or forged — passes.

**Change:** use the existing `getSessionFromRequest` helper already imported in `server/plugins/auth.ts:6`.

```
on WS upgrade:
  session = await getSessionFromRequest(auth, req)
  if (!session || !session.user) {
    socket.close(4001, "Unauthorized")
    return
  }
  log connection with userId (for ops visibility)
```

Remove the TODO at line 6. Leave the existing `socket.on("message", …)` stub as-is (real-time event routing is out of scope — not regressing it is enough).

### 4.2 Public tracking: redaction + access model

**Current (`server/services/job.service.ts:413-453`):** `lookupByCode` accepts either `jobCode` OR `accessCode` as a single standalone code, and returns customer name, customer phone, **technician name, and technician role**. That leaks staff identity and lets anyone who finds a discarded receipt see full PII.

**Change A — redact technician.** Drop the `technician` field from the returned payload entirely. PRD §9 is explicit. Also drop customer `phone` from the response (the customer entered it — no need to echo it back, and a snooper shouldn't see it).

**Change B — access model: `jobCode` + last-4 of phone.**

- The lookup endpoint now requires two query params: `code` (the `jobCode`) and `phone4` (last 4 digits of the customer's phone on record).
- Server does: find job by `jobCode` → compare `phone4` against last 4 digits of `customer.phone` (normalized: strip non-digits). Mismatch returns `404 JOB_NOT_FOUND` (same response as unknown code — do not distinguish).
- The legacy `accessCode` column remains in the schema (no migration) but is no longer an alternate lookup key. It becomes dead until a future feature uses it.
- The tracking page (`src/pages/tracking/index.tsx`) gets a second input for the last-4, both required to submit.

**Rationale for jobCode + phone4 over accessCode-only:** standard pattern for shop/carrier tracking (UPS, Verizon, Apple). Customers remember the code on the receipt and already know their own phone. No second memorable code needed. Combined with §4.3 rate limiting, brute force is infeasible.

### 4.3 Rate limit `/jobs/lookup`

Apply route-local `@fastify/rate-limit` (already installed, already configured globally at 100/min):

- **Per IP:** 10 attempts / 15 min. Exceed → `429 TOO_MANY_REQUESTS`.
- **Per jobCode:** 5 failed `phone4` attempts against a *valid* jobCode → that specific jobCode is locked for 1 hour (server-side, in-memory Map keyed by jobCode with TTL; no DB change). Locked code returns the same `404 JOB_NOT_FOUND` shape as unknown code so an attacker cannot tell whether they hit a real code. On successful lookup, reset the counter for that code. Unknown-jobCode requests only count against the per-IP limit; there is no key to lock.

Edge case: shared NAT (a family lookup from home). 10/15min is generous for legitimate use. Document in code comment.

### 4.4 CSRF retry safety

**Current (`src/lib/api.ts:48-85`):** the `_csrfRetry` flag prevents double-retry *per request*, but if the `/api/csrf-token` endpoint itself repeatedly fails (`.catch(() => null)`), every new mutation silently goes out without a CSRF token and gets rejected. User sees generic errors indefinitely.

**Change:**

- Add a module-level consecutive-failure counter on `fetchCsrfToken`. After 3 consecutive failures, `fetchCsrfToken` short-circuits to `null` for 30 seconds without hitting the network, then tries again.
- On any successful fetch, reset the counter.
- Keep the per-request `_csrfRetry` flag (don't regress).
- When a mutation fails because CSRF could not be obtained, surface a translated error to the UI (new locale key `errors.csrf_unavailable`).

### 4.5 Global React error boundary

New file `src/components/error-boundary.tsx` — a class component (React 19 still needs class for error boundaries) that:

- Catches render/lifecycle errors from children.
- Logs to `console.error` with full stack.
- Renders a fallback: app logo, translated message `errors.unexpected_title` / `errors.unexpected_body`, a "Reload" button, and in dev mode a `<details>` with the stack.
- Exposes a `reset()` callback the reload button calls (which also clears React Query cache if feasible — best effort).

Mount at the root in `src/main.tsx` so it wraps routing and all providers. Do not nest per-route boundaries for now.

### 4.6 Store error string localization

Scan `src/stores/*.ts` for hardcoded English strings that reach the user (toasts, `notify()` calls, return values rendered in components). For each:

- Add a key under `errors.*` in `src/i18n/locales/en.json`.
- Replace the literal with a key and translate via `t()` at the call site, or (if the store itself can't use hooks) return the key and translate at the component boundary.
- Run `pnpm run sync-locales` to propagate to `fr.json` and `ar.json`.

Inventory step during implementation will produce the exact list; ballpark ~10–15 strings across customers, jobs, parts, and auth stores.

### 4.7 Dead locale key

Remove `my_jobs` from `src/i18n/locales/en.json`, `fr.json`, `ar.json`. Verify with `pnpm run scan-i18n` that no code references it.

---

## 5. API changes

| Endpoint | Before | After |
|---|---|---|
| `GET /api/jobs/lookup?code=XXX` | Accepts code as either jobCode or accessCode. Returns technician + customer phone. | Requires `code` (jobCode) + `phone4`. Returns no technician, no customer phone. Rate-limited per-IP and per-code. |
| `GET /ws` | Accepts any cookie header containing "session". | Validates Better Auth session; 4001 close on invalid. |

No schema migration. No client-facing contract changes beyond `/jobs/lookup`.

---

## 6. Error handling

- `/jobs/lookup` returns a single `404 JOB_NOT_FOUND` for (a) unknown jobCode, (b) wrong phone4, (c) locked code. Do not distinguish — prevents enumeration.
- `429 TOO_MANY_REQUESTS` for per-IP rate limit; standard Fastify response.
- WS auth failure: close code `4001 Unauthorized` (unchanged; client may log).
- Client CSRF unavailable: toast `errors.csrf_unavailable`; keep request rejection; do not auto-logout.
- Error boundary fallback is itself wrapped in `<React.Suspense>`-safe markup — no dependency on i18n being loaded (fallback uses inline English copy *as well as* translated copy; if i18n fails, English still renders).

---

## 7. Testing strategy

Unit:

- `src/lib/api.ts`: CSRF retry stops after N consecutive failures; resets on success; per-request retry flag works.
- `error-boundary.tsx`: renders children normally; renders fallback on thrown error; reload button resets state.

Integration (server):

- `GET /jobs/lookup` without `phone4` → 400.
- `GET /jobs/lookup` with correct code + wrong phone4 → 404 (not 401/403).
- `GET /jobs/lookup` with correct code + correct phone4 → 200, payload has no `technician` and no `customer.phone`.
- `GET /jobs/lookup` brute-force (6 wrong phone4 for same code) → code locked; 7th attempt returns 404 even with correct phone4.
- `GET /jobs/lookup` per-IP rate limit (11 attempts in 15 min) → 429.
- WS: connect without cookie → 4001. Connect with forged `session=foo` cookie → 4001. Connect with real session cookie → stays open.

i18n:

- `pnpm run scan-i18n` reports zero missing keys.
- `my_jobs` no longer present in locale files.
- No hardcoded English strings matched in `src/stores/*.ts` by a grep for common patterns (`"Failed to`, `"Could not`, etc.).

Manual smoke:

- Tracking page happy path in all three languages (incl. RTL arabic).
- Throw inside a page component in dev → error boundary renders.

---

## 8. Open decisions (defaults chosen — reject any before implementation)

| Decision | Default |
|---|---|
| Tracking access model | jobCode + phone last-4 (Option C). |
| Per-IP rate limit for `/jobs/lookup` | 10 attempts / 15 min. |
| Per-code lockout | 5 failed phone4 → 1h lockout. |
| Lockout store | In-memory Map with TTL. OK because single-instance deploy. |
| CSRF consecutive-failure threshold | 3 failures → 30s cooldown. |
| Error boundary scope | Root only; no per-route boundaries. |
| Error boundary logging | `console.error` only; no server ingestion yet. |
| Store i18n scope | Only strings that reach the UI. Dev logs stay English. |

---

## 9. Rollout

Single feature branch, single PR. No flags; all changes are either server-internal, backward-compatible (error boundary), or UX-visible only on the tracking page (which has no users yet).

Validation order:

1. WS auth fix (backend only; verify existing authenticated sessions still connect).
2. Tracking redaction + phone4 requirement + rate limit (backend + tracking page).
3. CSRF retry safety (frontend only).
4. Error boundary mount.
5. Store i18n sweep + sync-locales.
6. Remove dead key.

Each is independently revertable.

---

## 10. Success criteria

- `docs/session-notes.md` issues related to the above are closed.
- Integration tests from §7 all pass.
- Manual tracking-page smoke in en/fr/ar passes, including throttle and wrong-phone cases.
- A forced render error shows the boundary fallback (dev-mode manual test).
- `pnpm run scan-i18n` clean; `pnpm run check` and `pnpm run test` green.
