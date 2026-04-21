# 40×20mm Job Label Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 40×20 mm printable label for repair jobs showing shop name, device brand/model, price, issue, job code, and a QR tracking code — auto-triggered after a new job is created and available on-demand from the job detail page and job actions menu.

**Architecture:** Extend the existing `server/services/receipt.service.ts` with a `renderLabelHtml()` function that reuses `generateTrackingQr()`. Add a sibling endpoint `GET /api/receipts/:id/label` next to the existing receipt route, guarded by the same `jobs:view` RBAC and cost-hiding rules. The response is a self-contained HTML page that sizes the viewport via `@page { size: 40mm 20mm; margin: 0 }` and auto-fires `window.print()` then `window.close()` on load. The frontend opens the URL with `window.open()` from three places: the intake-success callback in `dashboard-layout.tsx`, a new "Print label" button on `jobs/detail.tsx`, and the currently-disabled menu item in `job-actions-menu.tsx`.

**Tech Stack:** Fastify 5, Prisma 7, `qrcode` (already installed), React 19, browser native print via CSS `@page`.

**Design constraints (40×20 mm layout):**
- At 203 DPI thermal / 300 DPI laser both produce a readable sticker.
- Left column ~18 mm wide: QR code 17×17 mm + job code underneath.
- Right column ~22 mm wide: shop name / device / problem (one line, truncated) / price.
- Font sizes 6–8 pt, monospace for code, sans-serif for text.
- Problem text is single-line `text-overflow: ellipsis` — the full description is on the customer-visible tracking page behind the QR.

---

## File Structure

**Modify:**
- `server/services/receipt.service.ts` — add `renderLabelHtml()` function alongside existing `renderReceiptHtml()`.
- `server/routes/receipts.ts` — add `GET /:id/label` route mirroring the existing `GET /:id/receipt` shape.
- `src/pages/jobs/detail.tsx` — add "Print label" button next to existing "Print" button (lines 244-253).
- `src/components/modules/jobs/job-actions-menu.tsx` — replace the disabled placeholder at lines 186-194 with a working link that opens the label URL.
- `src/components/modules/dashboard-layout.tsx` — after `createJob()` resolves in `handleIntakeSubmit` (line 49), open the label URL in a new tab.
- `src/i18n/locales/en.json` — add `job_label_print`, `job_label_title` keys. (Then run `pnpm run sync-locales` to sync `ar.json` and `fr.json`.)

**Create:**
- `server/services/__tests__/receipt.service.test.ts` — unit tests for `renderLabelHtml()` output (HTML contents, QR data URL, cost hiding, escaping).

**No new dependencies.** `qrcode` is already in `package.json`.

---

### Task 1: Add `renderLabelHtml()` to receipt.service.ts

**Files:**
- Modify: `server/services/receipt.service.ts` (append new function after existing `renderReceiptHtml`)
- Create: `server/services/__tests__/receipt.service.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `server/services/__tests__/receipt.service.test.ts` with this content:

```typescript
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { renderLabelHtml } from "../receipt.service.js";

function makePrisma(shopName = "Reparilo Test Shop"): PrismaClient {
  return {
    shopSettings: {
      findUnique: vi.fn().mockResolvedValue({ id: "default", shopName }),
    },
  } as unknown as PrismaClient;
}

const baseJob = {
  jobCode: "JOB-0042",
  customer: { name: "John Doe", phone: "+213555000000" },
  device: { brand: "iPhone", model: "13 Pro" },
  reportedProblem: "Cracked screen",
  estimatedCost: 8500,
  createdAt: new Date("2026-04-21T10:00:00Z"),
  partsUsed: [],
  repairs: [],
};

describe("renderLabelHtml", () => {
  it("includes shop name, device, problem, price and job code", async () => {
    const html = await renderLabelHtml(
      makePrisma("Acme Repairs"),
      baseJob,
      "https://example.com"
    );
    expect(html).toContain("Acme Repairs");
    expect(html).toContain("iPhone");
    expect(html).toContain("13 Pro");
    expect(html).toContain("Cracked screen");
    expect(html).toContain("8,500");
    expect(html).toContain("JOB-0042");
  });

  it("embeds a base64 QR code pointing to the tracking URL", async () => {
    const html = await renderLabelHtml(
      makePrisma(),
      baseJob,
      "https://example.com"
    );
    expect(html).toMatch(/<img[^>]+src="data:image\/png;base64,[A-Za-z0-9+/=]+"/);
  });

  it("sets @page size to 40mm 20mm and triggers print on load", async () => {
    const html = await renderLabelHtml(makePrisma(), baseJob, "https://x.y");
    expect(html).toContain("size: 40mm 20mm");
    expect(html).toContain("window.print()");
  });

  it("hides price when hideCosts is true", async () => {
    const html = await renderLabelHtml(
      makePrisma(),
      baseJob,
      "https://x.y",
      { hideCosts: true }
    );
    expect(html).not.toContain("8,500");
    expect(html).not.toContain("DZD");
  });

  it("escapes HTML in user-supplied fields", async () => {
    const malicious = {
      ...baseJob,
      reportedProblem: "<script>alert(1)</script>",
      device: { brand: "Acme\"", model: "<b>X</b>" },
    };
    const html = await renderLabelHtml(makePrisma(), malicious, "https://x.y");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;");
  });

  it("falls back to 'Reparilo' when shopName is empty", async () => {
    const prisma = {
      shopSettings: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;
    const html = await renderLabelHtml(prisma, baseJob, "https://x.y");
    expect(html).toContain("Reparilo");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run server/services/__tests__/receipt.service.test.ts`
Expected: FAIL — `renderLabelHtml is not a function` (or import error).

- [ ] **Step 3: Implement `renderLabelHtml()` in receipt.service.ts**

Append to `server/services/receipt.service.ts` (after the existing `renderReceiptHtml` function):

```typescript
export async function renderLabelHtml(
  prisma: PrismaClient,
  job: {
    jobCode: string;
    customer: { name: string; phone: string };
    device: { brand: string; model: string };
    reportedProblem: string;
    estimatedCost: number | { toNumber: () => number };
    createdAt: Date;
    partsUsed: Array<{
      partName: string;
      quantity: number;
      totalCost: number | { toNumber: () => number };
    }>;
    repairs: Array<{
      repairName: string;
      price: number | { toNumber: () => number };
    }>;
  },
  baseUrl: string,
  options?: { hideCosts?: boolean }
): Promise<string> {
  const settings = await prisma.shopSettings.findUnique({
    where: { id: "default" },
  });
  const shopName = esc(settings?.shopName || "Reparilo");

  const qrBuf = await generateTrackingQr(job.jobCode, baseUrl);
  const qrB64 = qrBuf.toString("base64");

  const fmt = (v: number | { toNumber: () => number }) =>
    typeof v === "number" ? v.toLocaleString() : v.toNumber().toLocaleString();

  const hideCosts = options?.hideCosts ?? false;
  const device = `${esc(job.device.brand)} ${esc(job.device.model)}`.trim();
  const problem = esc(job.reportedProblem);
  const price = hideCosts ? "" : `${fmt(job.estimatedCost)} DZD`;
  const jobCode = esc(job.jobCode);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Label ${jobCode}</title>
<style>
  @page { size: 40mm 20mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 40mm; height: 20mm;
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 7pt; line-height: 1.15;
    color: #000; background: #fff;
    display: flex; align-items: stretch;
    padding: 1mm;
  }
  .qr {
    width: 18mm; height: 18mm;
    display: flex; flex-direction: column; align-items: center;
    flex: 0 0 auto;
  }
  .qr img { width: 15mm; height: 15mm; display: block; }
  .qr .code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 6pt; font-weight: 700;
    margin-top: 0.5mm; letter-spacing: -0.2pt;
  }
  .info {
    flex: 1 1 auto; min-width: 0;
    padding-left: 1mm;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .info .shop { font-weight: 700; font-size: 7pt; }
  .info .dev, .info .pb {
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: 6.5pt;
  }
  .info .pb { color: #333; }
  .info .price { font-weight: 700; font-size: 8pt; }
  @media screen { body { border: 1px dashed #999; } }
</style>
</head>
<body onload="window.print(); setTimeout(function(){ window.close(); }, 300);">
  <div class="qr">
    <img src="data:image/png;base64,${qrB64}" alt="QR" />
    <div class="code">${jobCode}</div>
  </div>
  <div class="info">
    <div class="shop">${shopName}</div>
    <div class="dev">${device}</div>
    <div class="pb">${problem}</div>
    ${price ? `<div class="price">${price}</div>` : ""}
  </div>
</body></html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/services/__tests__/receipt.service.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/receipt.service.ts server/services/__tests__/receipt.service.test.ts
git commit -m "feat(receipt): add 40x20mm label HTML renderer

Adds renderLabelHtml() that reuses existing QR generation and shop
settings lookup. The HTML uses @page { size: 40mm 20mm } and
auto-fires window.print() + window.close() so the browser handles
driver selection. Covered by unit tests for content, escaping,
cost-hiding, and QR embedding."
```

---

### Task 2: Add `GET /:id/label` route

**Files:**
- Modify: `server/routes/receipts.ts`

- [ ] **Step 1: Write the failing integration test**

Append to `server/services/__tests__/receipt.service.test.ts` (integration-style via direct function call is already covered in Task 1; this task adds a route-level smoke via manual curl in Step 4). No new test file needed — route mirrors existing receipt route which has the same RBAC plumbing. If route-level tests exist in the repo pattern, add one; otherwise rely on Task 1's unit tests plus Task 7 manual QA.

*(Skip to Step 2 — no test code to write for this task.)*

- [ ] **Step 2: Add the route handler**

Modify `server/routes/receipts.ts`. After the existing `app.get("/:id/receipt", …)` block and before the closing `};`, insert:

```typescript
  app.get(
    "/:id/label",
    { preHandler: [requirePermission({ jobs: ["view"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const job = await getJobById(app.prisma, id);
      if (!job) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }

      let baseUrl = process.env.SHOP_PUBLIC_URL;
      if (!baseUrl) {
        app.log.warn(
          "SHOP_PUBLIC_URL is not set — label QR and tracking link will not work in production"
        );
        baseUrl = `http://localhost:${process.env.PORT ?? 4000}`;
      }

      const costPerm = await req.server.auth.api.userHasPermission({
        body: {
          role: req.user?.role as import("@shared/constants/roles").RoleType,
          permissions: { parts: ["viewCost"] },
        },
      });
      const html = await renderLabelHtml(app.prisma, job, baseUrl, {
        hideCosts: !costPerm.success,
      });

      return reply
        .header("Content-Type", "text/html; charset=utf-8")
        .send(html);
    }
  );
```

Also update the import at the top of the file:

```typescript
import { renderLabelHtml, renderReceiptHtml } from "../services/receipt.service.js";
```

- [ ] **Step 3: Start the dev server and hit the route**

Run: `pnpm dev` (leave running), then in another shell:
```bash
curl -s -c /tmp/c.txt -b /tmp/c.txt -X POST http://localhost:4000/api/auth/sign-in/username \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$SEED_ADMIN_PASSWORD\"}"
# Pick any existing job id from the DB (visit /jobs in the browser or query prisma studio)
curl -s -b /tmp/c.txt http://localhost:4000/api/receipts/<JOB_ID>/label | head -40
```

Expected: HTML response starting with `<!doctype html>` containing `size: 40mm 20mm` and a `data:image/png;base64,` block.

- [ ] **Step 4: Verify RBAC by hitting the route unauthenticated**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/receipts/<JOB_ID>/label
```
Expected: `401` (or whatever the existing receipt route returns — must match).

- [ ] **Step 5: Commit**

```bash
git add server/routes/receipts.ts
git commit -m "feat(receipt): expose GET /api/receipts/:id/label endpoint

Mirrors the existing receipt route with the same jobs:view RBAC
and parts:viewCost gating. Returns self-contained HTML that
auto-prints on load."
```

---

### Task 3: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/en.json`
- Run: `pnpm run sync-locales` (auto-translates `ar.json` and `fr.json`)

- [ ] **Step 1: Add keys to en.json**

Edit `src/i18n/locales/en.json`. Add these two keys (alphabetically adjacent to other `jobs_detail_*` / `job_actions_*` keys — typically near lines 692 and 709):

```json
  "job_actions_print_label": "Print Label",
  "jobs_detail_print_label": "Print label",
```

Keep the existing `job_actions_print_receipt` and `jobs_detail_print` keys — we want both actions available (full receipt AND the small label).

- [ ] **Step 2: Sync locales**

Run: `pnpm run sync-locales`
Expected: `ar.json` and `fr.json` updated with translated values. No errors.

- [ ] **Step 3: Verify the generated translations look reasonable**

Visually check the new keys in `src/i18n/locales/ar.json` and `src/i18n/locales/fr.json`. Arabic should read right-to-left cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/ar.json src/i18n/locales/fr.json
git commit -m "i18n: add job label print keys across en/ar/fr"
```

---

### Task 4: Wire "Print label" button on job detail page

**Files:**
- Modify: `src/pages/jobs/detail.tsx` (lines 244-253)

- [ ] **Step 1: Add the button next to the existing Print button**

In `src/pages/jobs/detail.tsx`, locate the existing print button block (around line 244):

```tsx
<button
  className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1.5 font-label text-on-surface-variant text-xs transition-colors hover:bg-surface-container-highest hover:text-on-surface"
  onClick={() =>
    window.open(`/api/receipts/${job.id}/receipt`, "_blank")
  }
  type="button"
>
  <span className="material-symbols-outlined text-sm">print</span>
  {t("jobs_detail_print")}
</button>
```

Immediately after it (still inside the same `<div className="mt-4 flex flex-wrap …">`), insert:

```tsx
<button
  className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1.5 font-label text-on-surface-variant text-xs transition-colors hover:bg-surface-container-highest hover:text-on-surface"
  onClick={() =>
    window.open(`/api/receipts/${job.id}/label`, "_blank")
  }
  type="button"
>
  <span className="material-symbols-outlined text-sm">label</span>
  {t("jobs_detail_print_label")}
</button>
```

- [ ] **Step 2: Manually verify in browser**

With `pnpm dev` running, log in, open any job detail page. Click "Print label" — a new tab opens, shows a 40×20 mm preview with a dashed screen border, and the browser's print dialog appears automatically. Close the print dialog; the tab auto-closes after ~300 ms.

- [ ] **Step 3: Commit**

```bash
git add src/pages/jobs/detail.tsx
git commit -m "feat(jobs): add Print label button to job detail page"
```

---

### Task 5: Wire actions-menu "Print label" (replace disabled placeholder)

**Files:**
- Modify: `src/components/modules/jobs/job-actions-menu.tsx` (lines 186-194)

- [ ] **Step 1: Replace the disabled placeholder with a working button**

In `src/components/modules/jobs/job-actions-menu.tsx`, locate lines 186-194:

```tsx
<button
  className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 font-medium text-on-surface text-sm opacity-30"
  disabled
  title="TODO: implement print receipt"
  type="button"
>
  <span className="material-symbols-outlined text-lg">print</span>
  <span>{t("job_actions_print_receipt")}</span>
</button>
```

Replace with two buttons — full receipt + label:

```tsx
<button
  className="flex w-full items-center gap-3 px-4 py-2 font-medium text-on-surface text-sm transition-colors hover:bg-surface-container-low"
  onClick={() => {
    window.open(`/api/receipts/${job.rawJob?.id ?? job.id}/receipt`, "_blank");
    close();
  }}
  type="button"
>
  <span className="material-symbols-outlined text-lg">print</span>
  <span>{t("job_actions_print_receipt")}</span>
</button>
<button
  className="flex w-full items-center gap-3 px-4 py-2 font-medium text-on-surface text-sm transition-colors hover:bg-surface-container-low"
  onClick={() => {
    window.open(`/api/receipts/${job.rawJob?.id ?? job.id}/label`, "_blank");
    close();
  }}
  type="button"
>
  <span className="material-symbols-outlined text-lg">label</span>
  <span>{t("job_actions_print_label")}</span>
</button>
```

- [ ] **Step 2: Manually verify**

From the jobs list, click the `more_vert` menu on any row. Confirm both "Print Receipt" and "Print Label" entries are now enabled, each opens the correct endpoint in a new tab, and the menu closes after click.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/jobs/job-actions-menu.tsx
git commit -m "feat(jobs): enable Print Receipt and add Print Label in actions menu

Replaces the disabled 'TODO: implement print receipt' placeholder
with working menu items for both the full receipt and the 40x20mm
label."
```

---

### Task 6: Auto-open label print after intake

**Files:**
- Modify: `src/components/modules/dashboard-layout.tsx` (lines 21-69)

- [ ] **Step 1: Open the label URL after createJob resolves**

In `src/components/modules/dashboard-layout.tsx`, locate `handleIntakeSubmit`. After the `fetchMetrics()` call (line 62) and before `closeIntakeModal()` (line 63), insert:

```tsx
        window.open(`/api/receipts/${job.id}/label`, "_blank");
```

The block should read:

```tsx
        await fetchJobs();
        await fetchMetrics();
        window.open(`/api/receipts/${job.id}/label`, "_blank");
        closeIntakeModal();
```

**Note:** `window.open()` must be called in the same event-loop tick as a user gesture for popup-blockers to allow it. The call happens inside the submit-button click handler chain, so this works. If you move it after an `await` that the browser considers "too late", Chrome will block it.

Since `fetchJobs()` / `fetchMetrics()` are awaited before the open, some browsers may block. If QA confirms blocking, move the `window.open` to fire immediately after `createJob` resolves (before the photo upload / fetch calls):

```tsx
        const job = await createJob({ …existing fields… });
        window.open(`/api/receipts/${job.id}/label`, "_blank");
        if (data.photos.length > 0) {
          …existing photo upload…
        }
        await fetchJobs();
        await fetchMetrics();
        closeIntakeModal();
```

Apply the second form if Step 2 reveals the popup is blocked.

- [ ] **Step 2: Manually verify**

With `pnpm dev` running, open the intake modal, fill in a minimum-viable job (customer name/phone, device model, problem, estimated cost), click Submit. Expected:
1. Modal closes.
2. A new tab opens at `/api/receipts/<new-job-id>/label`.
3. Print dialog appears automatically.
4. Canceling the print closes the tab after ~300 ms.
5. The jobs list now contains the new job.

If the browser blocks the popup, apply the fallback from Step 1 and retest.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/dashboard-layout.tsx
git commit -m "feat(intake): auto-open label print tab after job creation"
```

---

### Task 7: Full-stack QA sweep

**Files:** none — manual verification only.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run`
Expected: All tests green, including the new `receipt.service.test.ts`.

- [ ] **Step 2: Lint**

Run: `pnpm exec ultracite check`
Expected: No new warnings.

- [ ] **Step 3: End-to-end smoke with Chrome DevTools**

Log in as `admin` / `$SEED_ADMIN_PASSWORD`. Verify all three entry points:
1. Intake → auto-print works.
2. Job detail → "Print label" button works.
3. Jobs list → `more_vert` → "Print Label" works.

Collect any console errors and flag them.

- [ ] **Step 4: Verify RBAC cost hiding**

Using a non-admin account that lacks `parts:viewCost` (e.g., a front-desk role if seeded), open the label endpoint for a job. Confirm the price line is absent from the printed label.

- [ ] **Step 5: Visually verify the label at actual size**

In the print preview, confirm:
- Paper size reads "40 × 20 mm" (or equivalent in inches).
- QR is left, text is right.
- All four text lines are visible and non-overlapping.
- Job code is legible under the QR.
- Scanning the QR with a phone opens the customer tracking page at the correct URL.

- [ ] **Step 6: Final commit if anything changed**

If QA surfaced any fixes, commit them with a descriptive message. Otherwise skip.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Company name → shop name from `ShopSettings.shopName`, rendered in `.shop` div.
- ✅ Device brand + model → `${brand} ${model}` in `.dev` div.
- ✅ Repair price → `estimatedCost` formatted as DZD in `.price` div (hidden when RBAC says so).
- ✅ Issue → `reportedProblem` truncated to one line in `.pb` div.
- ✅ QR tracking code → `generateTrackingQr()` embedded as base64 PNG pointing to `${baseUrl}/tracking/${jobCode}`.
- ✅ Print after new job created → Task 6 hooks `dashboard-layout.tsx`.
- ✅ Print from detail page → Task 4 adds button.
- ✅ Reuse existing code → extends `receipt.service.ts` + `routes/receipts.ts`; reuses `generateTrackingQr`, `esc`, `requirePermission`, RBAC cost gating; no new deps.

**Best practices baked in:**
- Single endpoint, browser-native print (no PDF/PNG rasterization).
- `@page` CSS governs paper size — driver picks the right stock.
- Auto-close after print avoids tab clutter.
- `text-overflow: ellipsis` prevents overflow on long device/problem strings.
- User-supplied text escaped via existing `esc()` — XSS-safe.
- `SHOP_PUBLIC_URL` fallback with a log warning — same pattern as existing receipt route.
- i18n via `sync-locales` — never hand-editing ar/fr files.

**Known trade-offs:**
- No E2E test for the print flow (browser print dialog is hard to automate). Covered by manual QA in Task 7.
- The label deliberately omits customer name/phone to save space — they're behind the QR on the tracking page. If the shop wants them on the sticker, it's a 2-line change in `renderLabelHtml`.
