# Security & Stability Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the seven Spec 1 fixes so Reparilo is safe to deploy to one real shop: validated WS auth, redacted + phone-gated + rate-limited public tracking, bounded CSRF retries, global error boundary, localized store errors, no dead locale keys.

**Architecture:** Seven surgical edits across existing files + three new files (error boundary, lookup throttle, a couple of test files). No schema migration, no new dependencies, no new patterns. TDD throughout — failing test → minimal impl → green → commit.

**Tech Stack:** Fastify 5 + Better Auth + Prisma 7 + @fastify/rate-limit + @fastify/websocket + React 19 + Zustand + react-i18next + Zod + Vitest.

**Spec:** `docs/superpowers/specs/2026-04-20-security-stability-hardening-design.md`

---

## File Map

| File | Change | Owning task |
|---|---|---|
| `src/i18n/locales/en.json` | remove `my_jobs`; add `errors.*` keys | 1, 2, 3, 7 |
| `src/i18n/locales/fr.json` | remove `my_jobs`; sync via script | 1, 2, 3, 7 |
| `src/i18n/locales/ar.json` | remove `my_jobs`; sync via script | 1, 2, 3, 7 |
| `src/components/error-boundary.tsx` | **new** — class component | 2 |
| `src/components/__tests__/error-boundary.test.tsx` | **new** | 2 |
| `src/main.tsx` | wrap `<App />` in `<ErrorBoundary>` | 2 |
| `src/lib/api.ts` | bounded CSRF retry + translated error | 3 |
| `src/lib/__tests__/api.test.ts` | **new** | 3 |
| `shared/schemas/job.schema.ts` | add `lookupQuerySchema` | 4 |
| `shared/schemas/index.ts` | re-export the new schema | 4 |
| `server/services/job.service.ts:413` | redact `lookupByCode` result; require phone4 | 4 |
| `server/routes/jobs.ts:69` | validate query via Zod; wire throttle | 4, 5 |
| `src/pages/tracking/index.tsx` | add phone4 input, send both params | 4 |
| `server/utils/lookup-throttle.ts` | **new** — in-memory TTL counter | 5 |
| `server/utils/__tests__/lookup-throttle.test.ts` | **new** | 5 |
| `server/__tests__/jobs-lookup.test.ts` | **new** — integration | 4, 5 |
| `server/plugins/websocket.ts` | validate real session | 6 |
| `server/__tests__/websocket-auth.test.ts` | **new** — integration | 6 |
| `src/stores/auth.ts` | translate hardcoded fallbacks | 7 |
| `src/stores/jobs.ts` | translate hardcoded fallbacks | 7 |
| `src/stores/users.ts` | translate hardcoded fallbacks | 7 |
| `src/stores/parts-catalog.ts` | translate hardcoded fallbacks | 7 |
| `src/stores/repair-catalog.ts` | translate hardcoded fallbacks | 7 |
| `src/stores/settings.ts` | translate hardcoded fallbacks | 7 |

---

### Task 1: Remove dead `my_jobs` locale key

Smallest change first to warm up the plan and verify tooling.

**Files:**
- Modify: `src/i18n/locales/en.json:155`
- Modify: `src/i18n/locales/fr.json:155`
- Modify: `src/i18n/locales/ar.json:155`

- [ ] **Step 1: Confirm the key is dead**

Run: `grep -rn "my_jobs" src/ --include='*.ts' --include='*.tsx'`
Expected: no matches (only `docs/` and the locale files themselves). If code references it, stop and open a discussion.

- [ ] **Step 2: Remove from `en.json`**

Open `src/i18n/locales/en.json` and delete the `"my_jobs": "My Jobs",` line (line 155 at time of writing — grep for it). Be careful with trailing commas: if the key is the last entry in its object, remove the preceding comma instead.

- [ ] **Step 3: Sync locales**

Run: `pnpm run sync-locales`
Expected: `fr.json` and `ar.json` lose their `my_jobs` entries. If the script does not remove keys that no longer exist in `en.json`, delete them manually from both files.

- [ ] **Step 4: Verify with scan-i18n**

Run: `pnpm run scan-i18n`
Expected: zero missing/orphan keys reported.

- [ ] **Step 5: Verify build still passes**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/
git commit -m "chore(i18n): remove dead my_jobs locale key"
```

---

### Task 2: Global React Error Boundary

A class component that catches child render errors and shows a translated fallback with a Reload button. Mounted at the root so every route is covered.

**Files:**
- Create: `src/components/error-boundary.tsx`
- Create: `src/components/__tests__/error-boundary.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/i18n/locales/en.json` (+ sync)

#### 2A — Add locale keys first

- [ ] **Step 1: Add three keys to `en.json`**

Add to `src/i18n/locales/en.json` (keep existing alphabetical grouping; do NOT add a nested `errors` object if the file is flat — check the file's style first and match it):

```json
"errors_unexpected_title": "Something went wrong",
"errors_unexpected_body": "The app hit an unexpected error. Reloading usually fixes it.",
"errors_reload": "Reload"
```

(If the file uses a nested `errors: { ... }` object, nest instead. Match the file's existing convention exactly.)

- [ ] **Step 2: Sync to fr and ar**

Run: `pnpm run sync-locales`
Expected: `fr.json` and `ar.json` gain translated entries.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add error-boundary fallback keys"
```

#### 2B — Write the failing boundary test

- [ ] **Step 1: Create the test file**

Create `src/components/__tests__/error-boundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { ErrorBoundary } from "../error-boundary";

function Bomb(): JSX.Element {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress the expected console.error noise from React
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <div>ok</div>
        </ErrorBoundary>
      </I18nextProvider>
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("renders translated fallback when a child throws", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </I18nextProvider>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("falls back to English if i18n is unavailable", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    // Component still renders a recognizable fallback even without i18n provider
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `pnpm vitest run src/components/__tests__/error-boundary.test.tsx`
Expected: FAIL with `Cannot find module '../error-boundary'`.

#### 2C — Implement the boundary

- [ ] **Step 1: Create `src/components/error-boundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";

interface Props extends Partial<WithTranslation> {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundaryBase extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console -- intentional: surface crash to devtools
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const t = this.props.t;
    const title = t?.("errors_unexpected_title") ?? "Something went wrong";
    const body =
      t?.("errors_unexpected_body") ??
      "The app hit an unexpected error. Reloading usually fixes it.";
    const reload = t?.("errors_reload") ?? "Reload";

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center"
      >
        <h1 className="font-headline text-2xl text-on-surface">{title}</h1>
        <p className="max-w-md text-on-surface-variant">{body}</p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-full bg-primary px-6 py-2 text-on-primary"
        >
          {reload}
        </button>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase);
```

Note on the type signature: `withTranslation()` returns a HOC that injects `t`, `i18n`, `tReady` props. Declaring `Props extends Partial<WithTranslation>` keeps both uses valid (inside an `<I18nextProvider>` and standalone without one — the third test case).

- [ ] **Step 2: Run the test — expect pass**

Run: `pnpm vitest run src/components/__tests__/error-boundary.test.tsx`
Expected: 3 passing.

#### 2D — Mount at the root

- [ ] **Step 1: Edit `src/main.tsx`**

Add the import:

```tsx
import { ErrorBoundary } from "./components/error-boundary";
```

Wrap `<App />` so the final render block becomes:

```tsx
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Full test + check pass**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/components/error-boundary.tsx src/components/__tests__/error-boundary.test.tsx src/main.tsx
git commit -m "feat(ui): global error boundary with translated fallback"
```

---

### Task 3: CSRF retry safety

Add a consecutive-failure counter + cooldown so the `/csrf-token` endpoint failing repeatedly does not cause every mutation to re-hit it.

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/lib/__tests__/api.test.ts`
- Modify: `src/i18n/locales/en.json` (+ sync)

#### 3A — Add locale key

- [ ] **Step 1: Add key**

Add to `src/i18n/locales/en.json` (match file's flat-vs-nested style):

```json
"errors_csrf_unavailable": "Security token unavailable. Please refresh the page."
```

- [ ] **Step 2: Sync locales**

Run: `pnpm run sync-locales`

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add csrf-unavailable error key"
```

#### 3B — Failing test for CSRF retry

- [ ] **Step 1: Create `src/lib/__tests__/api.test.ts`**

```ts
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => {
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: {},
  };
  return {
    default: {
      create: vi.fn(() => instance),
      get: vi.fn(),
    },
  };
});

describe("api client CSRF fetch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("stops hitting /csrf-token after 3 consecutive failures and retries after cooldown", async () => {
    const getMock = vi.mocked(axios.get);
    getMock.mockRejectedValue(new Error("network"));

    const mod = await import("../api");
    const fetchCsrfToken = mod.__test_fetchCsrfToken;

    expect(await fetchCsrfToken()).toBeNull();
    expect(await fetchCsrfToken()).toBeNull();
    expect(await fetchCsrfToken()).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(3);

    // 4th call within cooldown — no network hit
    expect(await fetchCsrfToken()).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(3);

    // Advance past 30s cooldown
    vi.advanceTimersByTime(30_001);

    // Counter should reset; network called again
    getMock.mockResolvedValueOnce({ data: { token: "ok" } });
    expect(await fetchCsrfToken()).toBe("ok");
    expect(getMock).toHaveBeenCalledTimes(4);
  });

  it("resets failure counter on successful fetch", async () => {
    const getMock = vi.mocked(axios.get);
    getMock.mockRejectedValueOnce(new Error("x"));
    getMock.mockRejectedValueOnce(new Error("x"));
    getMock.mockResolvedValueOnce({ data: { token: "tok" } });

    const mod = await import("../api");
    const fetchCsrfToken = mod.__test_fetchCsrfToken;
    mod.__test_resetCsrf();

    await fetchCsrfToken();
    await fetchCsrfToken();
    expect(await fetchCsrfToken()).toBe("tok");

    // Next fails, but counter was reset, so still hits network
    getMock.mockRejectedValueOnce(new Error("x"));
    mod.__test_resetCsrf();
    getMock.mockRejectedValueOnce(new Error("x"));
    getMock.mockRejectedValueOnce(new Error("x"));
    getMock.mockRejectedValueOnce(new Error("x"));
    await fetchCsrfToken();
    await fetchCsrfToken();
    await fetchCsrfToken();
    expect(await fetchCsrfToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `pnpm vitest run src/lib/__tests__/api.test.ts`
Expected: FAIL — `__test_fetchCsrfToken` not exported.

#### 3C — Implement bounded retry

- [ ] **Step 1: Rewrite `src/lib/api.ts`**

Replace the whole file with:

```ts
import axios from "axios";
import i18n from "@/i18n";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

const MAX_CONSECUTIVE_FAILURES = 3;
const COOLDOWN_MS = 30_000;

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;
let consecutiveFailures = 0;
let cooldownUntil = 0;

function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) {
    return Promise.resolve(csrfToken);
  }
  if (csrfPromise) {
    return csrfPromise;
  }
  if (Date.now() < cooldownUntil) {
    return Promise.resolve(null);
  }

  csrfPromise = axios
    .get(`${baseURL}/api/csrf-token`, { withCredentials: true })
    .then((res) => {
      csrfToken = res.data.token ?? null;
      consecutiveFailures = 0;
      cooldownUntil = 0;
      return csrfToken;
    })
    .catch(() => {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
        consecutiveFailures = 0;
      }
      return null;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

api.interceptors.request.use(async (config) => {
  if (MUTATION_METHODS.has(config.method?.toLowerCase() ?? "")) {
    const token = await fetchCsrfToken();
    if (token) {
      config.headers["X-CSRF-Token"] = token;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403) {
      const message: string = error.response?.data?.message ?? "";
      if (message.toLowerCase().includes("csrf")) {
        csrfToken = null;
        const originalRequest = error.config;
        if (!originalRequest._csrfRetry) {
          originalRequest._csrfRetry = true;
          const token = await fetchCsrfToken();
          if (token) {
            originalRequest.headers["X-CSRF-Token"] = token;
            return api(originalRequest);
          }
          // Surface a translated, user-visible error instead of the raw 403.
          error.userMessage = i18n.t("errors_csrf_unavailable");
        }
      }
    }

    if (error.response?.status === 401) {
      const url = error.config?.url ?? "";
      const authEndpoints = [
        "/auth/sign-in",
        "/auth/sign-out",
        "/auth/get-session",
        "/auth/change-password",
        "/auth/must-change-password",
        "/auth/request-password-reset",
        "/auth/reset-password",
      ];
      const isAuthEndpoint = authEndpoints.some((ep) => url.includes(ep));
      if (!isAuthEndpoint) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Test hooks — not used by production code.
export const __test_fetchCsrfToken = fetchCsrfToken;
export function __test_resetCsrf(): void {
  csrfToken = null;
  csrfPromise = null;
  consecutiveFailures = 0;
  cooldownUntil = 0;
}
```

- [ ] **Step 2: Run tests — expect pass**

Run: `pnpm vitest run src/lib/__tests__/api.test.ts`
Expected: 2 passing.

- [ ] **Step 3: Full suite**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/lib/__tests__/api.test.ts
git commit -m "fix(api): bound CSRF token retries with cooldown"
```

---

### Task 4: Public tracking lookup — redact + require phone4

Change `lookupByCode` to require `jobCode` + `phone4`, drop technician + customer phone from response. Update tracking page to submit both fields.

**Files:**
- Modify: `shared/schemas/job.schema.ts`
- Modify: `shared/schemas/index.ts` (re-export, if applicable)
- Modify: `server/services/job.service.ts:413-453`
- Modify: `server/routes/jobs.ts:69-84`
- Modify: `src/pages/tracking/index.tsx`
- Create: `server/__tests__/jobs-lookup.test.ts`

#### 4A — Schema + shared types

- [ ] **Step 1: Add `lookupQuerySchema` to `shared/schemas/job.schema.ts`**

Append at the bottom of the file:

```ts
export const lookupQuerySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: "Enter your job code" }),
  phone4: z
    .string()
    .trim()
    .regex(/^\d{4}$/u, { error: "Enter the last 4 digits of your phone" }),
});

export type LookupQueryInput = z.infer<typeof lookupQuerySchema>;
```

- [ ] **Step 2: Re-export from `shared/schemas/index.ts` if that file re-exports sibling schemas**

Check the existing `shared/schemas/index.ts` — if it currently does `export * from "./job.schema"`, nothing to do. If it re-exports named symbols, add `lookupQuerySchema` and `LookupQueryInput` to that list.

- [ ] **Step 3: Typecheck**

Run: `pnpm run check`
Expected: green (new schema exported, nothing uses it yet).

- [ ] **Step 4: Commit**

```bash
git add shared/schemas/
git commit -m "feat(schemas): add tracking lookup query schema"
```

#### 4B — Failing integration test for the new endpoint contract

- [ ] **Step 1: Read the existing integration test harness**

Read `server/__tests__/rbac.test.ts` or `server/__tests__/jobs-status-transition.test.ts` — whichever spins up a Fastify app with a seeded Prisma. Reuse the same bootstrap; do not invent a new one. Note which helper builds the app (e.g., `createApp()` / `buildApp()`).

- [ ] **Step 2: Create `server/__tests__/jobs-lookup.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
// Use the same bootstrap helper the other integration tests use.
// Replace `buildTestApp` and `seedJob` with whatever the codebase already exposes.
import { buildTestApp, seedJob, resetDb } from "./helpers/test-app";

describe("GET /api/jobs/lookup", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(app.prisma);
  });

  it("returns 400 when phone4 is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/jobs/lookup?code=ABC123",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when phone4 is not 4 digits", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/jobs/lookup?code=ABC123&phone4=12",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the code is unknown", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/jobs/lookup?code=DOESNOTEXIST&phone4=1234",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when phone4 does not match (same shape as unknown code)", async () => {
    const { jobCode } = await seedJob(app.prisma, {
      customerPhone: "+213555123456", // last 4 = 3456
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/jobs/lookup?code=${jobCode}&phone4=0000`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("JOB_NOT_FOUND");
  });

  it("returns 200 with redacted payload on correct code + phone4", async () => {
    const { jobCode } = await seedJob(app.prisma, {
      customerPhone: "+213 555 123 456",
      technicianName: "Hidden Tech",
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/jobs/lookup?code=${jobCode}&phone4=3456`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jobCode).toBe(jobCode);
    expect(body.technician).toBeUndefined();
    expect(body.customer?.phone).toBeUndefined();
    // Non-PII fields still present:
    expect(body.device).toBeDefined();
    expect(body.status).toBeDefined();
  });

  it("strips non-digit characters from stored phone when comparing", async () => {
    const { jobCode } = await seedJob(app.prisma, {
      customerPhone: "(555) 123-4567", // last 4 digits = 4567
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/jobs/lookup?code=${jobCode}&phone4=4567`,
    });
    expect(res.statusCode).toBe(200);
  });
});
```

If `server/__tests__/helpers/test-app.ts` does not exist, create it in this task using the same bootstrap pattern as the other integration tests (look at `rbac.test.ts`). If the other tests inline their bootstrap, inline yours too and skip the helper file.

- [ ] **Step 3: Run test — expect failure**

Run: `pnpm vitest run server/__tests__/jobs-lookup.test.ts`
Expected: FAIL (either 400 for "missing phone4" not enforced, or payload still contains technician).

#### 4C — Update service + route

- [ ] **Step 1: Rewrite `lookupByCode` in `server/services/job.service.ts`**

Replace lines 413–453 with:

```ts
export async function lookupByCode(
  prisma: PrismaClient,
  jobCode: string,
  phone4: string
) {
  const job = await prisma.job.findFirst({
    where: { jobCode },
    include: {
      customer: { select: { name: true, phone: true } },
      device: { select: { brand: true, model: true } },
      repairs: { select: { name: true, price: true } },
      partsUsed: { select: { partName: true, totalCost: true } },
      notes: {
        where: { isCustomerVisible: true },
        select: { content: true, createdAt: true },
        orderBy: { createdAt: "desc" as const },
      },
    },
  });
  if (!job) {
    return null;
  }

  const storedDigits = job.customer.phone.replace(/\D/gu, "");
  const last4 = storedDigits.slice(-4);
  if (last4 !== phone4) {
    return null;
  }

  return {
    jobCode: job.jobCode,
    status: job.status,
    device: `${job.device.brand} ${job.device.model}`,
    reportedProblem: job.reportedProblem,
    estimatedDate: job.estimatedDate,
    createdAt: job.createdAt,
    customer: { name: job.customer.name },
    notes: job.notes.map((n) => ({
      content: n.content,
      createdAt: n.createdAt,
    })),
    repairs: job.repairs.map((r) => ({
      name: r.name,
      price: r.price.toNumber(),
    })),
  };
}
```

Key differences from the previous version:
- Signature now takes `(prisma, jobCode, phone4)` — two string args.
- Lookup is **only** by `jobCode`; `accessCode` OR clause is removed.
- Phone mismatch returns `null` (indistinguishable from unknown code).
- Response has no `technician` and no `customer.phone`.

- [ ] **Step 2: Update `/lookup` route in `server/routes/jobs.ts`**

Replace the handler on lines 69–84 with:

```ts
app.get("/lookup", { preHandler: [] }, async (req, reply) => {
  const parsed = lookupQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
  }
  const { code, phone4 } = parsed.data;
  const job = await lookupByCode(app.prisma, code, phone4);
  if (!job) {
    return reply
      .status(404)
      .send({ error: "JOB_NOT_FOUND", message: "Job not found" });
  }
  return reply.send(job);
});
```

Add `lookupQuerySchema` to the imports at the top:

```ts
import {
  addJobNoteSchema,
  addJobPartSchema,
  addJobRepairSchema,
  addWaitingPartSchema,
  createJobSchema,
  jobListQuerySchema,
  lookupQuerySchema,
  transitionStatusSchema,
  updateJobSchema,
} from "@shared/schemas";
```

- [ ] **Step 3: Run integration tests — expect pass**

Run: `pnpm vitest run server/__tests__/jobs-lookup.test.ts`
Expected: all 6 passing.

- [ ] **Step 4: Run full server tests**

Run: `pnpm run test`
Expected: green. If any other test calls `lookupByCode` with the old signature, update it to pass a valid `phone4`.

- [ ] **Step 5: Commit**

```bash
git add server/services/job.service.ts server/routes/jobs.ts server/__tests__/jobs-lookup.test.ts
git commit -m "feat(tracking): require phone4; redact technician and phone from lookup"
```

#### 4D — Update the tracking page

- [ ] **Step 1: Read the current `LookupForm`**

Read `src/pages/tracking/index.tsx` end-to-end (it's ~260 lines). The form currently has one `code` input. Find where it submits.

- [ ] **Step 2: Add a second input + submit both fields**

Inside `LookupForm`, add state for `phone4`, render a second input with `inputMode="numeric"` + `maxLength={4}` + `pattern="\d{4}"`, and change the submit to call `onSearch(code, phone4)`.

Update the parent component that owns `onSearch` to call the API as:

```ts
const res = await api.get("/jobs/lookup", {
  params: { code: code.trim(), phone4: phone4.trim() },
});
```

Add two locale keys in `en.json` and sync:

```json
"tracking_phone4_label": "Last 4 digits of your phone",
"tracking_phone4_placeholder": "e.g. 3456"
```

- [ ] **Step 3: Manually smoke test**

Run: `pnpm dev` (or `pnpm dev:front` + `pnpm run server` separately). Navigate to `/tracking`. Enter a known jobCode + correct last-4 → should load. Wrong last-4 → should show the same "not found" message as unknown code (do not distinguish in UI copy).

- [ ] **Step 4: Full test + check**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/tracking/index.tsx src/i18n/locales/
git commit -m "feat(tracking): add phone4 input; send both params to /lookup"
```

---

### Task 5: Rate-limit `/jobs/lookup` with per-code lockout

Per-IP via `@fastify/rate-limit` (already installed). Per-code via an in-memory TTL map.

**Files:**
- Create: `server/utils/lookup-throttle.ts`
- Create: `server/utils/__tests__/lookup-throttle.test.ts`
- Modify: `server/routes/jobs.ts` (extend `/lookup` handler)
- Extend: `server/__tests__/jobs-lookup.test.ts`

#### 5A — Unit tests for the throttle

- [ ] **Step 1: Create `server/utils/__tests__/lookup-throttle.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLocked,
  recordFailure,
  recordSuccess,
  __resetThrottleForTests,
  MAX_FAILURES,
  LOCKOUT_MS,
} from "../lookup-throttle";

describe("lookup-throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetThrottleForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is unlocked initially", () => {
    expect(isLocked("ABC")).toBe(false);
  });

  it("locks after MAX_FAILURES consecutive failures", () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      recordFailure("ABC");
    }
    expect(isLocked("ABC")).toBe(true);
  });

  it("does not cross-contaminate between codes", () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      recordFailure("ABC");
    }
    expect(isLocked("ABC")).toBe(true);
    expect(isLocked("DEF")).toBe(false);
  });

  it("unlocks after LOCKOUT_MS elapses", () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      recordFailure("ABC");
    }
    expect(isLocked("ABC")).toBe(true);
    vi.advanceTimersByTime(LOCKOUT_MS + 1);
    expect(isLocked("ABC")).toBe(false);
  });

  it("recordSuccess clears the counter", () => {
    recordFailure("ABC");
    recordFailure("ABC");
    recordSuccess("ABC");
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
      recordFailure("ABC");
    }
    expect(isLocked("ABC")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run server/utils/__tests__/lookup-throttle.test.ts`
Expected: FAIL — module not found.

#### 5B — Implement the throttle

- [ ] **Step 1: Create `server/utils/lookup-throttle.ts`**

```ts
// In-memory per-jobCode lockout. Correct for single-instance deploys.
// If we later run >1 server instance, replace the Map with a Redis-backed store
// — the exported API does not change.

export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

interface Entry {
  count: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

const store = new Map<string, Entry>();

function now(): number {
  return Date.now();
}

function prune(key: string, entry: Entry): Entry | null {
  if (entry.lockedUntil !== 0 && now() >= entry.lockedUntil) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function isLocked(key: string): boolean {
  const entry = store.get(key);
  if (!entry) {
    return false;
  }
  const live = prune(key, entry);
  if (!live) {
    return false;
  }
  return live.lockedUntil !== 0 && now() < live.lockedUntil;
}

export function recordFailure(key: string): void {
  const existing = store.get(key);
  const entry: Entry = existing
    ? (prune(key, existing) ?? { count: 0, lockedUntil: 0 })
    : { count: 0, lockedUntil: 0 };

  entry.count += 1;
  if (entry.count >= MAX_FAILURES) {
    entry.lockedUntil = now() + LOCKOUT_MS;
  }
  store.set(key, entry);
}

export function recordSuccess(key: string): void {
  store.delete(key);
}

export function __resetThrottleForTests(): void {
  store.clear();
}
```

- [ ] **Step 2: Run throttle tests — expect pass**

Run: `pnpm vitest run server/utils/__tests__/lookup-throttle.test.ts`
Expected: 5 passing.

#### 5C — Wire throttle into `/lookup` + per-IP rate limit

- [ ] **Step 1: Update `/lookup` handler in `server/routes/jobs.ts`**

Import the throttle at top:

```ts
import {
  isLocked,
  recordFailure,
  recordSuccess,
} from "../utils/lookup-throttle.js";
```

Replace the `/lookup` handler body with:

```ts
app.get(
  "/lookup",
  {
    preHandler: [],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "15 minutes",
      },
    },
  },
  async (req, reply) => {
    const parsed = lookupQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Invalid query parameters",
        details: parsed.error.flatten(),
      });
    }
    const { code, phone4 } = parsed.data;

    // Return the same 404 shape whether the code is unknown, locked, or wrong-phone
    // — prevents enumeration.
    if (isLocked(code)) {
      return reply
        .status(404)
        .send({ error: "JOB_NOT_FOUND", message: "Job not found" });
    }

    const job = await lookupByCode(app.prisma, code, phone4);
    if (!job) {
      // Count this failure against the code only if the code exists in the DB.
      // A naive implementation over-counts failures for unknown codes (which is
      // harmless — unknown codes can never unlock anything). So: always record,
      // cheap, safe, no DB round-trip.
      recordFailure(code);
      return reply
        .status(404)
        .send({ error: "JOB_NOT_FOUND", message: "Job not found" });
    }

    recordSuccess(code);
    return reply.send(job);
  }
);
```

Note the route-local `rateLimit` config. `@fastify/rate-limit` honors per-route overrides when registered globally first — the global registration already exists in `server/index.ts`. If the global plugin is not registered, Fastify will silently ignore the config; check `server/index.ts` for `app.register(rateLimit, ...)` before relying on per-route overrides. If it's missing, register it at the top of this task and document in `docs/session-notes.md`.

- [ ] **Step 2: Extend the integration test**

Append to `server/__tests__/jobs-lookup.test.ts`:

```ts
  it("locks a jobCode after 5 wrong phone4 attempts", async () => {
    const { jobCode } = await seedJob(app.prisma, {
      customerPhone: "+213555123456",
    });

    for (let i = 0; i < 5; i += 1) {
      const r = await app.inject({
        method: "GET",
        url: `/api/jobs/lookup?code=${jobCode}&phone4=0000`,
      });
      expect(r.statusCode).toBe(404);
    }

    // 6th attempt with CORRECT phone4 should still return 404 due to lockout
    const locked = await app.inject({
      method: "GET",
      url: `/api/jobs/lookup?code=${jobCode}&phone4=3456`,
    });
    expect(locked.statusCode).toBe(404);
  });
```

Note: the lockout store is module-level in-memory state. If other tests in the same file leak counters, call `__resetThrottleForTests()` from the throttle module in a `beforeEach`. Add this to the top of the file:

```ts
import { __resetThrottleForTests } from "../utils/lookup-throttle";

beforeEach(async () => {
  await resetDb(app.prisma);
  __resetThrottleForTests();
});
```

- [ ] **Step 3: Run full tests**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add server/utils/ server/routes/jobs.ts server/__tests__/jobs-lookup.test.ts
git commit -m "feat(tracking): rate-limit /jobs/lookup; lock code after 5 wrong phone4"
```

---

### Task 6: WebSocket session validation

Replace the substring-in-cookie check with a real Better Auth session validation via `getSessionFromRequest`.

**Files:**
- Modify: `server/plugins/websocket.ts`
- Create: `server/__tests__/websocket-auth.test.ts`

#### 6A — Inspect the auth decoration

- [ ] **Step 1: Find how the `auth` instance is exposed**

Read `server/plugins/auth.ts` end-to-end. Identify where the Better Auth `auth` object is constructed and whether it's decorated onto `app` (look for `app.decorate("auth", auth)` or similar). If it is, the WS plugin can reach it via `app.auth`. If not, it must construct/import its own reference — check `server/lib/auth.ts`.

Document what you find in `docs/session-notes.md` if non-obvious.

#### 6B — Failing integration test

- [ ] **Step 1: Create `server/__tests__/websocket-auth.test.ts`**

WebSocket testing with Fastify can be done via `fastify.inject()` for HTTP upgrade handshakes, but the cleanest approach is starting the server on an ephemeral port and connecting a real `ws` client. Pick whichever pattern the codebase already uses — if none, use the `ws` client approach:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildTestApp, signIn } from "./helpers/test-app";

describe("WebSocket /ws auth", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let port: number;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("no port");
    }
    port = address.port;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects with 4001 when no cookie is sent", async () => {
    const close = await new Promise<{ code: number }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      ws.on("close", (code) => resolve({ code }));
    });
    expect(close.code).toBe(4001);
  });

  it("rejects with 4001 when cookie is a forged session value", async () => {
    const close = await new Promise<{ code: number }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: { Cookie: "session=not-a-real-session" },
      });
      ws.on("close", (code) => resolve({ code }));
    });
    expect(close.code).toBe(4001);
  });

  it("accepts a real Better Auth session cookie", async () => {
    const cookie = await signIn(app, { username: "admin", password: process.env.SEED_ADMIN_PASSWORD ?? "admin" });
    const result = await new Promise<{ opened: boolean }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: { Cookie: cookie },
      });
      const timer = setTimeout(() => {
        ws.close();
        resolve({ opened: false });
      }, 2000);
      ws.on("open", () => {
        clearTimeout(timer);
        ws.close();
        resolve({ opened: true });
      });
    });
    expect(result.opened).toBe(true);
  });
});
```

If `signIn` helper doesn't exist, write it as part of this task — it should POST to `/api/auth/sign-in` via `app.inject()` and return the Set-Cookie header value. Reuse the pattern from `rbac.test.ts` if that file does the same thing.

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run server/__tests__/websocket-auth.test.ts`
Expected: the "forged cookie" test FAILS (current code accepts any cookie containing "session") and/or the real-session test FAILS (connection may be accepted regardless).

#### 6C — Implement real session validation

- [ ] **Step 1: Rewrite `server/plugins/websocket.ts`**

```ts
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { getSessionFromRequest } from "../lib/auth.js";

export const websocketPlugin: FastifyPluginAsync = async (app) => {
  app.get("/ws", { websocket: true }, async (socket, req: FastifyRequest) => {
    const session = await getSessionFromRequest(app.auth, req);
    if (!session || !session.user) {
      app.log.warn("WS connection rejected — invalid session");
      socket.close(4001, "Unauthorized");
      return;
    }
    app.log.info({ userId: session.user.id }, "WS client connected");

    socket.on("message", (msg: Buffer) => {
      app.log.debug(`WS message: ${msg.toString()}`);
    });
    socket.on("close", () => {
      app.log.info({ userId: session.user.id }, "WS client disconnected");
    });
  });
};
```

If `app.auth` is not how the auth instance is exposed (confirmed in 6A), replace with whatever the correct accessor is. If auth is not decorated, import and construct the reference directly the same way `server/plugins/auth.ts` does.

TypeScript note: the Fastify type augmentation for `app.auth` must exist. Check `server/plugins/auth.ts` for a `declare module "fastify"` block. If missing, add `auth: Auth` to it.

- [ ] **Step 2: Handler must be async now**

`@fastify/websocket` handlers can be async. Remove the old `biome-ignore` comment for `useAwait` — it's no longer a stub.

- [ ] **Step 3: Run WS tests — expect pass**

Run: `pnpm vitest run server/__tests__/websocket-auth.test.ts`
Expected: 3 passing.

- [ ] **Step 4: Full suite**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add server/plugins/websocket.ts server/__tests__/websocket-auth.test.ts
git commit -m "fix(ws): validate Better Auth session on /ws upgrade"
```

---

### Task 7: Localize store error fallbacks

Every Zustand store has hardcoded English fallback strings in catch blocks. Replace with `i18n.t(key)` so the UI shows translated text when the backend sends no message.

**Files:**
- Modify: `src/stores/auth.ts`, `jobs.ts`, `users.ts`, `parts-catalog.ts`, `repair-catalog.ts`, `settings.ts`
- Modify: `src/i18n/locales/en.json` (+ sync)

#### 7A — Add locale keys

- [ ] **Step 1: Add keys to `en.json`**

Grouped under `errors_store_*` prefix (match file's flat-vs-nested style):

```json
"errors_store_fetch_jobs": "Could not load jobs.",
"errors_store_fetch_metrics": "Could not load metrics.",
"errors_store_create_job": "Could not create the job.",
"errors_store_update_job": "Could not update the job.",
"errors_store_transition_status": "Could not change job status.",
"errors_store_add_note": "Could not add the note.",
"errors_store_add_part": "Could not add the part.",
"errors_store_remove_part": "Could not remove the part.",
"errors_store_add_repair": "Could not add the repair.",
"errors_store_remove_repair": "Could not remove the repair.",
"errors_store_fetch_job": "Could not load the job.",
"errors_store_fetch_parts": "Could not load parts.",
"errors_store_create_part": "Could not create the part.",
"errors_store_update_part": "Could not update the part.",
"errors_store_toggle_part_status": "Could not change part status.",
"errors_store_fetch_repairs": "Could not load repairs.",
"errors_store_create_repair": "Could not create the repair.",
"errors_store_update_repair": "Could not update the repair.",
"errors_store_toggle_repair_status": "Could not change repair status.",
"errors_store_fetch_users": "Could not load users.",
"errors_store_create_user": "Could not create the user.",
"errors_store_toggle_user_status": "Could not change user status.",
"errors_store_reset_password": "Could not reset the password.",
"errors_store_fetch_settings": "Could not load settings.",
"errors_store_fetch_ai_settings": "Could not load AI settings.",
"errors_store_save_ai_settings": "Could not save AI settings.",
"errors_store_test_ai_connection": "Could not test the AI connection.",
"errors_store_fetch_shop_settings": "Could not load shop settings.",
"errors_store_save_shop_settings": "Could not save shop settings.",
"errors_store_fetch_notification_templates": "Could not load notification templates.",
"errors_store_update_notification_template": "Could not update the notification template.",
"errors_store_session_missing": "Could not load your session."
```

- [ ] **Step 2: Sync**

Run: `pnpm run sync-locales`

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add store error fallback keys"
```

#### 7B — Replace fallbacks in each store

For each of the six store files, do the following pattern. Use `jobs.ts` as the template — apply the same recipe to the others.

- [ ] **Step 1: Edit `src/stores/jobs.ts`**

Add the import at the top:

```ts
import i18n from "@/i18n";
```

Replace every `err instanceof Error ? err.message : "Failed to X"` fallback with an `i18n.t(...)` call. Example:

Before:
```ts
const message = err instanceof Error ? err.message : "Failed to fetch jobs";
```

After:
```ts
const message =
  err instanceof Error ? err.message : i18n.t("errors_store_fetch_jobs");
```

Full mapping for `jobs.ts`:

| Line (approx) | Old literal | New key |
|---|---|---|
| 110 | `Failed to fetch jobs` | `errors_store_fetch_jobs` |
| 122 | `Failed to fetch metrics` | `errors_store_fetch_metrics` |
| 140 | `Failed to create job` | `errors_store_create_job` |
| 157 | `Failed to update job` | `errors_store_update_job` |
| 174 | `Failed to transition status` | `errors_store_transition_status` |
| 194 | `Failed to add note` | `errors_store_add_note` |
| 213 | `Failed to add part` | `errors_store_add_part` |
| 235 | `Failed to remove part` | `errors_store_remove_part` |
| 254 | `Failed to add repair` | `errors_store_add_repair` |
| 276 | `Failed to remove repair` | `errors_store_remove_repair` |
| 299 | `Failed to fetch job` | `errors_store_fetch_job` |

- [ ] **Step 2: Repeat for `auth.ts`**

In `src/stores/auth.ts:50` and `:81`, the literal is `"No user in session response"` — map to `errors_store_session_missing`.

- [ ] **Step 3: Repeat for `parts-catalog.ts`**

Lines 51, 68, 85, 101 → `errors_store_fetch_parts`, `_create_part`, `_update_part`, `_toggle_part_status`.

- [ ] **Step 4: Repeat for `repair-catalog.ts`**

Lines 50, 67, 84, 100 → `errors_store_fetch_repairs`, `_create_repair`, `_update_repair`, `_toggle_repair_status`.

- [ ] **Step 5: Repeat for `users.ts`**

Lines 46, 60, 76, 87 → `errors_store_fetch_users`, `_create_user`, `_toggle_user_status`, `_reset_password`.

- [ ] **Step 6: Repeat for `settings.ts`**

Lines 63, 75, 89, 102, 115, 129, 144, 167 → map to the 8 `errors_store_*settings*` / `*notification*` keys from 7A.

- [ ] **Step 7: Verify no hardcoded fallback strings remain**

Run:
```bash
grep -n '"Failed to\|"Could not\|"No user in' src/stores/
```
Expected: zero matches.

- [ ] **Step 8: Typecheck + tests**

Run: `pnpm run check && pnpm run test`
Expected: green.

- [ ] **Step 9: Manual smoke**

Run: `pnpm dev`. Open devtools network tab, block a request (e.g., offline mode), trigger the corresponding store action, verify the translated fallback shows in the UI (toast or error state) in the current language.

- [ ] **Step 10: Commit**

```bash
git add src/stores/
git commit -m "feat(i18n): localize store error fallbacks"
```

---

## Final verification

- [ ] **Step 1: Run the full pipeline**

```bash
pnpm run check && pnpm run test && pnpm run scan-i18n
```

All three: green.

- [ ] **Step 2: Manual smoke — all three languages**

Run `pnpm dev`. Switch between en/fr/ar on:
- `/tracking` (phone4 input + error messages render correctly, RTL layout intact for ar)
- any authenticated page; force a store error (block a request); verify translated fallback.

- [ ] **Step 3: Manual smoke — error boundary**

In dev mode, temporarily throw an error from inside any page component. Verify the translated fallback renders with a working Reload button. Remove the test throw — do not commit it.

- [ ] **Step 4: Manual smoke — WebSocket**

Open devtools network → WS tab. Authenticated page should show an open `/ws` connection. Log out, reload: connection should close with code 4001 and not re-open.

- [ ] **Step 5: Append entry to `docs/session-notes.md`**

Briefly note the 7 items shipped, referencing the spec path. No code changes.

- [ ] **Step 6: Final commit** (if the session-notes edit stands alone)

```bash
git add docs/session-notes.md
git commit -m "docs: record security & stability hardening rollout"
```

---

## Self-review (author-run, pre-handoff)

**Spec coverage:**

| Spec §4.x | Task |
|---|---|
| 4.1 WS auth | Task 6 |
| 4.2 Tracking redaction + phone4 | Task 4 |
| 4.3 Rate limit + per-code lockout | Task 5 |
| 4.4 CSRF retry safety | Task 3 |
| 4.5 Error boundary | Task 2 |
| 4.6 Store i18n | Task 7 |
| 4.7 Dead key | Task 1 |

All seven covered.

**Placeholder scan:** no `TBD`, no `TODO`, no "add appropriate error handling", no "similar to Task N". All test code provided inline. All commands exact.

**Known ambiguities the implementer must resolve at runtime (flagged inline in the relevant task, not hidden):**
- 6A: whether `auth` is decorated onto `app` or imported directly — read `server/plugins/auth.ts`.
- 4B: whether the test harness already exposes a `buildTestApp` helper — match the existing pattern in `rbac.test.ts`.
- 5C: whether `@fastify/rate-limit` is registered globally (required for per-route config to work).

Each of these is a 5-minute read, not a design decision.

**Type consistency:** `lookupByCode(prisma, code, phone4)` signature used consistently across §4C service rewrite, §4C route call site, and Task 5 route call site. `__resetThrottleForTests`, `recordFailure`, `recordSuccess`, `isLocked`, `MAX_FAILURES`, `LOCKOUT_MS` names used consistently between throttle module, throttle tests, and lookup tests.
