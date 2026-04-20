# MVP Feature Completion — Implementation Plan (Spec 2, non-AI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the eight MVP feature gaps identified in the readiness audit (excluding AI analyst) so Reparilo offers the full feature set promised in `docs/PRD.md`: customer edit, parts cost visibility, repair margin, notification template management, warranty-return alerts, overdue scheduler, ESC/POS receipt printing, QR-on-intake, and Android build.

**Architecture:** Eight largely independent feature slices. Each touches either existing backend routes, existing schemas, or introduces a small new subsystem (scheduler, printer adapter, QR generator). One feature branch per slice is acceptable; a single PR is also fine since features don't interact. Follow existing patterns (`requirePermission` on routes, Zod schemas in `shared/schemas/`, Zustand stores, react-i18next).

**Tech Stack:** same as Spec 1 + `qrcode` (already installed), `escpos` (already installed), `@capacitor/cli`, `@capacitor/android`. No new deps expected.

**Spec basis:** MVP readiness audit findings; no standalone spec.md. Open product decisions are flagged per feature — resolve with user before implementing that feature if the default is not acceptable.

**Decomposition note:** if execution lags, split into **2a: data/CRUD features** (Tasks 1–5) and **2b: physical world** (Tasks 6–8). Each sub-split produces a working release on its own.

**Prerequisite:** Spec 1 (`docs/superpowers/plans/2026-04-20-security-stability-hardening.md`) complete and merged first.

---

## Feature Inventory

| # | Feature | PRD ref | Backend status | Frontend status | Open decisions |
|---|---|---|---|---|---|
| 1 | Customer edit (PATCH) | §4 | Permission `customers.edit` defined; no route | Edit form not wired | Which fields are editable? default: name, phone, email, notes. |
| 2 | Parts cost visibility | §5 | Permission `parts.viewCost` / `setCost` defined; cost field on `JobPart` exists | No UI | Show cost column only when `can("parts.viewCost")`; hidden for techs. |
| 3 | Repair margin dashboard | §10 | `reports.viewMargin` defined; no service | No UI | default: per-job margin card on job detail page (Owner only). |
| 4 | Notification templates UI | §7 | Routes + service exist (`server/routes/notifications.ts`) | Settings form stubbed | Which variables are injectable? default: `{customerName}`, `{jobCode}`, `{status}`, `{estimatedDate}`. |
| 5 | Warranty-return owner alerts | §6.4 | No event emitter | No listener | WS push via existing `/ws` channel (Spec 1 hardened). |
| 6 | Overdue job scheduler | §6.3 | No scheduler | No alerts UI | Interval: every 15 min. Threshold: `estimatedDate < now` AND status not terminal. |
| 7 | ESC/POS receipt + QR | §8 | `escpos` + `qrcode` installed; no route | No print button | Thermal 80mm; QR encodes the tracking URL with jobCode + phone4 hint. Default layout per PRD §8. |
| 8 | Capacitor Android build | §11 | `capacitor.config.ts` exists; no `android/` scaffold | n/a | Package name `com.reparilo.app`; unsigned debug build first, signing deferred to pre-store task. |

---

## Task 1 — Customer edit (PATCH)

**Files:**
- Modify: `shared/schemas/customer.schema.ts` (add `updateCustomerSchema`)
- Modify: `server/services/customers.service.ts` (add `update`)
- Modify: `server/routes/customers.ts` (add `PATCH /:id`)
- Create: `server/__tests__/customers-update.test.ts`
- Modify: `src/stores/customers.ts` (add `updateCustomer`; create store if absent)
- Modify: `src/pages/customers/*` (wire an edit dialog; follow the existing "add part" dialog pattern)

- [ ] **Step 1.1: Add `updateCustomerSchema`**

Mirror `createCustomerSchema` with all fields `.optional()`. Include `name`, `phone`, `email`, `notes`. Keep validation rules (non-empty if provided).

- [ ] **Step 1.2: Write failing integration test**

Test: PATCH `/api/customers/:id` with `{ name: "new" }` as a user with `customers.edit` → 200 + updated record. As a user without the permission → 403. With invalid body → 400. Nonexistent id → 404.

Pattern: copy a PATCH test from `server/__tests__/jobs-status-transition.test.ts` or similar.

Run: `pnpm vitest run server/__tests__/customers-update.test.ts` → expect FAIL (route missing).

- [ ] **Step 1.3: Implement service `update(prisma, id, data)`**

Read `create` in `server/services/customers.service.ts` to match style. Use `prisma.customer.update({ where: { id }, data })`. Catch P2025 → return `null`. Wrap an audit-log entry like `create` does if that service writes audit logs (check).

- [ ] **Step 1.4: Implement route**

```ts
app.patch(
  "/:id",
  { preHandler: [requirePermission({ customers: ["edit"] })] },
  async (req, reply) => {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid customer data", {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { id } = req.params as { id: string };
    const updated = await updateCustomer(app.prisma, id, parsed.data);
    if (!updated) {
      return sendError(reply, 404, "CUSTOMER_NOT_FOUND", "Customer not found");
    }
    return reply.send(updated);
  }
);
```

- [ ] **Step 1.5: Tests green**

Run: `pnpm run test`. If a customers store exists, add a `updateCustomer` action that PATCHes and updates the local map; otherwise create `src/stores/customers.ts` following `src/stores/jobs.ts` shape.

- [ ] **Step 1.6: Edit UI**

Find the customer list/detail page under `src/pages/customers/`. Add an "Edit" button visible only when `can("customers.edit")` (use the `use-can` hook that already exists). Dialog with the editable fields, submit → store action. Translate all new copy; run `pnpm run sync-locales`.

- [ ] **Step 1.7: Commit**

```bash
git commit -m "feat(customers): PATCH /:id and edit dialog"
```

---

## Task 2 — Parts cost visibility

Show the `cost` column on the parts catalog and on a job's parts-used list — but only to users with `parts.viewCost`. Permission already exists (see `shared/constants/roles.ts` or wherever permissions live); `JobPart.totalCost` already selected in queries.

**Files:**
- Modify: `src/pages/parts/*` (catalog page, list + cost column)
- Modify: `src/components/modules/jobs/job-parts-section.tsx` (cost column)
- Modify: `server/services/parts-catalog.service.ts` if cost field is currently stripped from API responses
- Locale keys: `parts_cost_label`, `parts_unit_price`, `parts_total_cost`

- [ ] **Step 2.1: Verify backend exposes cost**

Read `server/services/parts-catalog.service.ts` — confirm cost is in the returned shape. If not, surface it. If it's always present but the frontend filters it out, skip.

- [ ] **Step 2.2: Frontend guard with `can()`**

Wrap the cost `<td>` / `<span>` in the parts-used list with:
```tsx
{can("parts.viewCost") && <td>{formatMoney(part.totalCost)}</td>}
```
Same for the catalog page. Match header colspan logic — toggle the `<th>` too.

- [ ] **Step 2.3: Unit test**

In `src/pages/parts/__tests__/` (create if missing), render with a mock `can` returning `false` for `parts.viewCost` → cost column absent; returning `true` → cost column present.

- [ ] **Step 2.4: Manual smoke**

Sign in as Tech role → no cost column. Sign in as Owner → cost column visible.

- [ ] **Step 2.5: Commit**

```bash
git commit -m "feat(parts): gate cost column behind parts.viewCost"
```

---

## Task 3 — Repair margin (per-job card)

Margin = `finalCost - sum(partsUsed.totalCost) - operatingCost(flat? per-repair?)`. PRD §10 likely specifies; **read it before implementing**. Default formula: `margin = finalCost - sum(partsUsed.totalCost)`. Keep simple for MVP.

**Files:**
- Modify: `server/services/job.service.ts` (add `computeMargin(job)` helper; export)
- Modify: `server/routes/jobs.ts` (include `margin` in job detail response *only* when `reports.viewMargin`)
- Modify: `src/components/modules/jobs/*` (margin card on job detail, hidden when permission absent)
- Extend: `server/__tests__/jobs-parts-cost.test.ts` with margin assertions

- [ ] **Step 3.1: Read PRD §10 for margin formula**

If the PRD is ambiguous, use the default above and add an `docs/session-notes.md` entry documenting the decision.

- [ ] **Step 3.2: Add `computeMargin` helper**

```ts
export function computeMargin(job: { finalCost: number; partsUsed: Array<{ totalCost: number }> }): number {
  const partsCost = job.partsUsed.reduce((s, p) => s + Number(p.totalCost), 0);
  return Number(job.finalCost) - partsCost;
}
```

- [ ] **Step 3.3: Wire into job detail route**

In the `GET /jobs/:id` handler, after computing the response, add `margin: computeMargin(job)` *only* if `req.user.role` passes `can("reports.viewMargin")`. Server-side gate is the authoritative one.

- [ ] **Step 3.4: Test: margin excluded for users without permission**

Extend `jobs-parts-cost.test.ts` — sign in as Tech, GET job detail, expect `margin` undefined. Sign in as Owner, expect `margin: <number>`.

- [ ] **Step 3.5: Frontend margin card**

Add a card on the job detail page showing margin. Render only when `margin` is present in the API response (server-side gate means it's only present for permitted users).

- [ ] **Step 3.6: Commit**

```bash
git commit -m "feat(reports): per-job margin card for users with reports.viewMargin"
```

---

## Task 4 — Notification template management UI

Backend is already wired (`server/routes/notifications.ts`, `server/services/settings.service.ts`). Settings page has a stub. Finish the CRUD form.

**Files:**
- Read: `server/routes/notifications.ts` + `server/services/settings.service.ts` end-to-end
- Read: `src/pages/settings/*` for the stub
- Modify: `src/stores/settings.ts` (already has `fetchNotificationTemplates`, `updateNotificationTemplate` per audit — add `createNotificationTemplate`, `deleteNotificationTemplate` if missing)
- Modify: the settings page to render a list of templates + an editor per template
- Locale keys for all new labels

- [ ] **Step 4.1: Understand the template shape**

Read `prisma/schema.prisma:441+` (`NotificationTemplate` model) and the backend routes. List fields: `name`, `channel`, `subject`, `body`, enabled flag, etc.

- [ ] **Step 4.2: Build the editor component**

Form with: name, channel (enum select), subject, body (textarea), variable-insertion helper buttons ({customerName}, {jobCode}, {status}, {estimatedDate}). Submit → store action.

- [ ] **Step 4.3: Validate variable placeholders**

On save, reject bodies that contain `{unknown_var}` not in the allowlist. Do this client-side (UX) AND server-side (authority — update the existing Zod schema for the update route).

- [ ] **Step 4.4: Tests**

Component test: renders list, opens editor, saves valid body, rejects body with unknown variable. Use `@testing-library/react` following existing component test patterns.

- [ ] **Step 4.5: Commit**

```bash
git commit -m "feat(settings): notification template CRUD UI"
```

---

## Task 5 — Warranty-return owner alerts

PRD §6.4: when a technician creates a warranty-return job (`isWarrantyReturn: true` + `warrantyForJobId` set), owners get an in-app alert.

**Files:**
- Modify: `server/services/job.service.ts` (in `create`, emit WS event when warranty return)
- Modify: `server/plugins/websocket.ts` (add `broadcastToRole(role, event)` utility — keep a per-connection `role` field; Spec 1 hardened the upgrade path, extend here)
- Modify: `src/hooks/` (add `use-ws.ts` hook if none exists — subscribe on mount, unsub on unmount)
- Modify: a top-bar or toast component to display incoming alerts
- Add: `server/__tests__/warranty-alert.test.ts`

- [ ] **Step 5.1: Extend WS plugin with broadcast**

Keep a `Set<{socket, userId, role}>` at module scope. On connection: add. On close: remove. Expose `app.decorate("wsBroadcast", (predicate, payload) => { for (const c of connections) if (predicate(c)) c.socket.send(JSON.stringify(payload)); })`.

- [ ] **Step 5.2: Emit on warranty-return creation**

At the end of `create()` in `job.service.ts`, if `input.isWarrantyReturn`, call `app.wsBroadcast(c => c.role === "OWNER", { type: "WARRANTY_RETURN_CREATED", job: { jobCode: created.jobCode, id: created.id } })`.

Note: service functions don't receive `app`. Pass `app.wsBroadcast` as a dependency or move the emit to the route handler after `create()` returns.

- [ ] **Step 5.3: Integration test**

Connect two WS clients (one Owner, one Tech). Have Tech create a warranty-return job. Assert: Owner socket received a `WARRANTY_RETURN_CREATED` message; Tech socket did not.

- [ ] **Step 5.4: Frontend hook + UI**

`src/hooks/use-ws.ts` — opens a connection on mount (after auth), parses messages, dispatches to a Zustand `alerts` store. Top-bar bell icon shows unread count; click → dropdown list.

- [ ] **Step 5.5: Commit**

```bash
git commit -m "feat(alerts): WS owner alert on warranty-return creation"
```

---

## Task 6 — Overdue job scheduler

Every 15 minutes: find jobs with `estimatedDate < now` AND status not in terminal set; emit an alert for each (to owner only; or to assigned technician + owner — confirm with PRD §6.3).

**Files:**
- Create: `server/jobs/overdue-scheduler.ts`
- Modify: `server/index.ts` (start the scheduler after Fastify is ready)
- Reuse: `app.wsBroadcast` from Task 5
- Create: `server/__tests__/overdue-scheduler.test.ts` (uses fake timers)

- [ ] **Step 6.1: Decide on persistence vs. idempotency**

Running every 15 min naively re-alerts the same overdue job. Options:
- **A.** Track `overdueAlertSentAt` column on `Job` — migration + update. Most robust.
- **B.** Keep an in-memory `Set<jobId>` of already-alerted jobs, cleared on process restart. Simpler; may re-alert once on deploy.
- **Default: B** for MVP. Flag in session-notes for later.

- [ ] **Step 6.2: Write the scheduler**

```ts
import type { FastifyInstance } from "fastify";
import { INACTIVE_STATUSES } from "@shared/constants";

const alerted = new Set<string>();
const INTERVAL_MS = 15 * 60 * 1000;

export function startOverdueScheduler(app: FastifyInstance): () => void {
  const tick = async (): Promise<void> => {
    const overdue = await app.prisma.job.findMany({
      where: {
        estimatedDate: { lt: new Date() },
        status: { notIn: INACTIVE_STATUSES },
      },
      select: { id: true, jobCode: true },
    });
    for (const job of overdue) {
      if (alerted.has(job.id)) continue;
      alerted.add(job.id);
      app.wsBroadcast?.(
        (c) => c.role === "OWNER",
        { type: "JOB_OVERDUE", jobId: job.id, jobCode: job.jobCode }
      );
    }
  };
  const handle = setInterval(tick, INTERVAL_MS);
  tick().catch((err) => app.log.error(err, "overdue tick failed"));
  return () => clearInterval(handle);
}
```

- [ ] **Step 6.3: Wire in `server/index.ts`**

After `await app.ready()`, call `const stopOverdue = startOverdueScheduler(app);` and ensure `app.addHook("onClose", async () => stopOverdue())`.

- [ ] **Step 6.4: Test with fake timers**

Seed 2 overdue jobs. Call `tick()` once directly → 2 events broadcast. Call again → 0 events (deduped).

- [ ] **Step 6.5: Commit**

```bash
git commit -m "feat(alerts): overdue job scheduler (15min tick, in-memory dedupe)"
```

---

## Task 7 — ESC/POS receipt + QR code

Thermal 80mm receipt printed on intake. Includes shop info, job code, date, device, reported problem, estimated cost, customer name, AND a QR code that encodes the tracking URL. PRD §8 has the layout — read before implementing.

**Files:**
- Create: `server/services/receipt.service.ts`
- Create: `server/routes/receipts.ts` + register in `server/index.ts`
- Modify: `src/pages/jobs/*` (print button on the job detail page / intake completion screen)
- Add locale keys for receipt button

### 7A — QR code generation

- [ ] **Step 7A.1: Pick the tracking URL shape**

The URL the QR encodes. Default: `${SHOP_PUBLIC_URL}/tracking?code=${jobCode}` — the user still has to enter phone4. Alternative: include `phone4` in URL → defeats the point of phone4. Keep code-only; customer enters phone4 from memory.

- [ ] **Step 7A.2: Generate QR server-side**

In `server/services/receipt.service.ts`:
```ts
import QRCode from "qrcode";
export async function generateTrackingQr(jobCode: string, baseUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(`${baseUrl}/tracking?code=${jobCode}`, { type: "png", width: 200 });
}
```

Unit-test: `const buf = await generateTrackingQr("ABC", "https://shop.example"); expect(buf.length).toBeGreaterThan(0);`

### 7B — ESC/POS printing

The `escpos` package in `package.json` is `3.0.0-alpha.6`. It's alpha; API is likely rough. Read its README before writing code. Printers are usually USB, Bluetooth, or network.

- [ ] **Step 7B.1: Decide the printing model**

Printing from the server requires the printer to be attached to the server machine (USB or network). In a shop the printer is typically attached to the counter — likely the same machine running the web client (Capacitor app on a tablet, or a shop laptop). So **print from the client**.

Revised plan:
- Server generates the *receipt HTML* (simpler + testable) OR a *raw ESC/POS buffer* returned as `application/octet-stream`.
- Client (web / Capacitor) sends it to a locally-configured printer.

**Default for MVP:** server generates an HTML receipt with a QR `<img>` inlined as base64; client opens it in `window.print()`. The `escpos` package is deferred to post-MVP when we know the actual printer model.

- [ ] **Step 7B.2: Receipt HTML generator**

```ts
export async function renderReceiptHtml(job: FullJob, baseUrl: string): Promise<string> {
  const qrBuf = await generateTrackingQr(job.jobCode, baseUrl);
  const qrB64 = qrBuf.toString("base64");
  return `<!doctype html><html>...see PRD §8 layout...<img src="data:image/png;base64,${qrB64}" /></html>`;
}
```

- [ ] **Step 7B.3: Route**

`GET /api/jobs/:id/receipt` → returns HTML. Auth-required; any role that can view the job.

- [ ] **Step 7B.4: Print button on frontend**

On job detail page, a Print button that opens the receipt in a new window and calls `window.print()` after load.

- [ ] **Step 7B.5: Commit**

```bash
git commit -m "feat(jobs): HTML receipt with embedded tracking QR + print action"
```

**Note:** proper ESC/POS raw printing is post-MVP — add to `docs/session-notes.md` as a known follow-up.

---

## Task 8 — Capacitor Android build

No `android/` directory exists. `capacitor.config.ts` is configured. Goal: produce a debug APK that loads the production build.

**Files:**
- Create: `android/` (via `pnpm cap add android`)
- Modify: `capacitor.config.ts` if needed (review during step 1)
- Modify: `package.json` scripts if a convenience script helps
- Document: `docs/android-build.md` for future releases

- [ ] **Step 8.1: Scaffold android**

```bash
pnpm build      # produces dist/
pnpm cap add android
pnpm cap sync
```

This creates `android/` with a gradle project pointing at `dist/`.

- [ ] **Step 8.2: Open and build**

```bash
pnpm android
```

Opens Android Studio. Let Gradle sync. Build → Debug APK.

- [ ] **Step 8.3: Verify dev server flow works on an emulator**

With `pnpm dev` running, launch the APK on an Android emulator. The app should load against `http://10.0.2.2:5173` (or the configured dev URL). Sign in, create a job, verify API calls succeed (Capacitor config has `cleartext: true` + the dev server URL).

- [ ] **Step 8.4: Document signing (deferred)**

In `docs/android-build.md`, stub a "Release signing" section: keystore generation, `gradle.properties` config, `build.gradle` signing block — but do not actually generate the keystore yet. Signing is a pre-store-submission task, not MVP.

- [ ] **Step 8.5: Commit**

```bash
git add android/ capacitor.config.ts docs/android-build.md
git commit -m "build(android): scaffold native project; debug build verified"
```

Note: the `android/` folder is large (~200 files from gradle). Review `.gitignore` — `android/build/`, `android/.gradle/`, `android/app/build/`, `android/local.properties` must be ignored. Add these if missing.

---

## Final verification (Spec 2 complete)

- [ ] **Step F.1: Full pipeline**

```bash
pnpm run check && pnpm run test && pnpm run scan-i18n
```

- [ ] **Step F.2: Manual smoke per feature**

Checklist:
- Edit customer → change propagates to job listings.
- Parts cost column visible to Owner, hidden for Tech.
- Margin card visible to Owner on job detail.
- Notification templates list/edit/save cycle.
- Warranty-return job creation → owner's browser receives WS alert.
- Overdue scheduler tick (override interval to 10s for smoke) → alert fires.
- Job detail → Print → receipt page shows QR + layout.
- Android debug APK installs and loads dev server.

- [ ] **Step F.3: Session-notes update**

Append to `docs/session-notes.md`: what shipped, known follow-ups (real ESC/POS raw printing, keystore signing, overdue-alert DB column).

- [ ] **Step F.4: Commit doc update**

```bash
git add docs/session-notes.md
git commit -m "docs: Spec 2 rollout notes"
```

---

## Self-review

**Coverage vs. audit:** customer edit ✓ parts cost ✓ margin ✓ notification templates ✓ warranty alert ✓ overdue scheduler ✓ receipts + QR ✓ Android build ✓. AI analyst excluded per scope.

**Placeholder scan:** each task has executable code or explicit "read X first" steps. Open product decisions are flagged in the feature inventory table, not left as inline TBDs.

**Type consistency:** `wsBroadcast` introduced in Task 5 is consumed in Task 6. `computeMargin` exported in Task 3 is not re-defined elsewhere. Receipt `jobCode` path used consistently.

**Known risks to flag when executing:**
- Task 5: emitting WS from a service function requires dependency injection (plan notes route-level emit as alternative).
- Task 6: in-memory dedupe loses state on restart — accepted trade-off for MVP.
- Task 7: ESC/POS raw printing explicitly deferred; what ships is HTML-via-browser-print.
- Task 8: the 200-file Android scaffold commit is large; reviewers should skim but trust it.
