# Link Parts Catalog to Job Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline free-form part form in job detail with the existing AddPartDialog that links to PartsCatalog via `partId`.

**Architecture:** The existing `AddPartDialog` component already has catalog+custom tabs and `partId` support. We refactor it to use `usePartsCatalogStore` instead of raw API calls, then wire it into `job-parts-section.tsx` by removing the inline form and adding a modal toggle. No schema or server changes needed.

**Tech Stack:** React, Zustand stores (`usePartsCatalogStore`, `useJobsStore`), i18next, Vitest + Testing Library

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/components/modules/jobs/add-part-dialog.tsx` | Replace raw `api.get('/parts-catalog')` with `usePartsCatalogStore` |
| Modify | `src/components/modules/jobs/job-parts-section.tsx` | Remove inline form, wire in AddPartDialog modal |
| Create | `src/components/modules/jobs/__tests__/add-part-dialog.test.tsx` | Test catalog tab loads store data, custom tab works, submission |
| Create | `src/components/modules/jobs/__tests__/job-parts-section.test.tsx` | Test AddPartDialog integration, part list display, remove |

---

### Task 1: Refactor `add-part-dialog.tsx` to use `usePartsCatalogStore`

**Files:**
- Modify: `src/components/modules/jobs/add-part-dialog.tsx`

- [ ] **Step 1: Remove raw API import and local catalog state**

In `add-part-dialog.tsx`, remove these lines:

```typescript
import api from "@/lib/api";
```

And remove these state variables from inside the component:

```typescript
const [catalogItems, setCatalogItems] = useState<PartsCatalog[]>([]);
const [catalogSearch, setCatalogSearch] = useState("");
const [loading, setLoading] = useState(false);
```

Replace `loading` state with the store's `isLoading`.

- [ ] **Step 2: Add usePartsCatalogStore import and usage**

Add this import:

```typescript
import { usePartsCatalogStore } from "@/stores/parts-catalog";
```

Inside the component, after the existing state declarations, add:

```typescript
const { parts: catalogItems, isLoading: loading, fetchParts: fetchCatalogParts } = usePartsCatalogStore();
const [catalogSearch, setCatalogSearch] = useState("");
```

Note: `catalogSearch` stays as local state since it's UI-interaction state (debounced input).

- [ ] **Step 3: Replace the catalog-fetching useEffect**

Replace the existing `useEffect` that calls `api.get('/parts-catalog')`:

```typescript
// REMOVE this entire useEffect:
useEffect(() => {
    if (!open || mode !== "catalog") {
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (catalogSearch) {
      params.set("search", catalogSearch);
    }
    params.set("isActive", "true");
    api
      .get(`/parts-catalog?${params.toString()}`)
      .then((res) => setCatalogItems(res.data.parts ?? res.data ?? []))
      .catch(() => setCatalogItems([]))
      .finally(() => setLoading(false));
  }, [open, mode, catalogSearch]);
```

Replace with:

```typescript
useEffect(() => {
  if (!open) return;
  fetchCatalogParts({ isActive: true, search: catalogSearch || undefined });
}, [open, catalogSearch, fetchCatalogParts]);
```

- [ ] **Step 4: Ensure the catalog tab search input still works**

The catalog tab already has an `<input>` for search. Verify the `onChange` handler calls `setCatalogSearch(e.target.value)` — this stays the same since `catalogSearch` is still local state. The `useEffect` from Step 3 will react to `catalogSearch` changes and call `fetchCatalogParts`.

- [ ] **Step 4b: Reset catalogSearch when opening or switching modes**

Add a useEffect that resets search when the dialog opens or switches modes:

```typescript
useEffect(() => {
  if (open) {
    setCatalogSearch("");
  }
}, [open]);
```

- [ ] **Step 5: Update the empty/loading state rendering**

Verify that the catalog list JSX already uses `loading` and `catalogItems` variables. Since we aliased `parts` to `catalogItems` and `isLoading` to `loading` in Step 2, the existing JSX should work as-is:

- `{isLoading && (...)}` → `{loading && (...)}`  — already uses `loading`
- `{catalogItems.map(...)}`  — already uses `catalogItems`

No JSX changes needed here.

- [ ] **Step 6: Verify dialog submission still works**

The `handleSubmit` callback calls `useJobsStore.getState().addPart(jobId, {...})`. This is unchanged — it already sends `partId` when it's set. No modifications needed.

- [ ] **Step 7: Run the existing linting/typecheck**

Run: `pnpm exec tsc --noEmit 2>&1 | head -30`
Expected: No type errors in `add-part-dialog.tsx`

- [ ] **Step 8: Commit**

```bash
git add src/components/modules/jobs/add-part-dialog.tsx
git commit -m "refactor: usePartsCatalogStore in AddPartDialog instead of raw API"
```

---

### Task 2: Wire AddPartDialog into job-parts-section, remove inline form

**Files:**
- Modify: `src/components/modules/jobs/job-parts-section.tsx`

- [ ] **Step 1: Add AddPartDialog import and state**

Add this import at the top of `job-parts-section.tsx`:

```typescript
import AddPartDialog from "./add-part-dialog";
```

Replace the existing state declarations. Remove all these lines:

```typescript
const [showForm, setShowForm] = useState(false);
const [loading, setLoading] = useState(false);
const [formError, setFormError] = useState<string | null>(null);
const [partName, setPartName] = useState("");
const [category, setCategory] = useState("OTHER");
const [unitPrice, setUnitPrice] = useState("");
const [quantity, setQuantity] = useState("1");
```

And replace with just:

```typescript
const [showAddDialog, setShowAddDialog] = useState(false);
```

- [ ] **Step 2: Remove handleAddPart callback**

Delete the entire `handleAddPart` callback (approximately lines 35-62):

```typescript
const handleAddPart = useCallback(async () => {
  if (!(partName.trim() && unitPrice)) {
    return;
  }
  setLoading(true);
  setFormError(null);
  try {
    await addPart(job.id, {
      partName: partName.trim(),
      category,
      unitPrice: Number(unitPrice),
      quantity: Number(quantity) || 1,
    });
    setPartName("");
    setUnitPrice("");
    setQuantity("1");
    setShowForm(false);
    onChanged?.();
  } catch (err: unknown) {
    setFormError(
      err instanceof Error
        ? err.message
        : t("jobs_status_change_error_unknown")
    );
  } finally {
    setLoading(false);
  }
}, [addPart, job.id, partName, category, unitPrice, quantity, onChanged, t]);
```

- [ ] **Step 3: Remove addPart from store destructuring**

The current store usage is:

```typescript
const addPart = useJobsStore((s) => s.addPart);
const removePart = useJobsStore((s) => s.removePart);
```

Remove `addPart` since the dialog will call it directly:

```typescript
const removePart = useJobsStore((s) => s.removePart);
```

- [ ] **Step 4: Remove the inline form JSX**

Delete the entire `{showForm && (...)}` block — the `<div className="mb-4 space-y-2 rounded-xl bg-surface-container-low p-4">` section that contains the part name input, category dropdown, unit price, quantity, cancel/add buttons, and form error. This is approximately lines 96-169 of the current file.

- [ ] **Step 5: Update the "Add Part" button**

The existing button is:

```tsx
<button
  className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold font-label text-primary text-xs uppercase tracking-wider transition-colors hover:bg-surface-container-high"
  onClick={() => setShowForm(!showForm)}
  type="button"
>
```

Change `onClick` to open the dialog and remove the toggle behavior:

```tsx
<button
  className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold font-label text-primary text-xs uppercase tracking-wider transition-colors hover:bg-surface-container-high"
  onClick={() => setShowAddDialog(true)}
  type="button"
>
```

- [ ] **Step 6: Add the AddPartDialog component**

After the closing `</div>` of the main container, add the dialog:

```tsx
<AddPartDialog
  jobId={job.id}
  open={showAddDialog}
  onClose={() => setShowAddDialog(false)}
  onAdded={() => {
    setShowAddDialog(false);
    onChanged?.();
  }}
/>
```

This goes after the parts list section, before the final closing tag of the component's return.

- [ ] **Step 7: Clean up unused imports**

Remove these unused imports:

- `useCallback` (if `handleRemovePart` no longer needs it after refactoring — check if it's still used)
- Verify `useTranslation` is still needed (yes, for part list display)
- Verify `formatDzd` is still needed (yes, for `fmt` helper in parts display)

`handleRemovePart` uses `useCallback`, so `useCallback` stays.

Remove `addPart` from the store import if it was the only reason for that import line. Since we removed `addPart` from destructuring, but `removePart` is still used, the import stays.

- [ ] **Step 8: Run typecheck**

Run: `pnpm exec tsc --noEmit 2>&1 | head -30`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/components/modules/jobs/job-parts-section.tsx
git commit -m "feat: wire AddPartDialog into job parts section, remove inline form"
```

---

### Task 3: Test AddPartDialog catalog integration

**Files:**
- Create: `src/components/modules/jobs/__tests__/add-part-dialog.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { PartCategory } from "@shared/constants";
import type { PartsCatalog } from "@shared/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddPartDialog from "../add-part-dialog";

const mockAddPart = vi.fn();
const mockFetchParts = vi.fn();

vi.mock("@/stores/jobs", () => ({
  useJobsStore: {
    getState: () => ({
      addPart: mockAddPart,
    }),
  },
}));

vi.mock("@/stores/parts-catalog", () => ({
  usePartsCatalogStore: () => ({
    parts: mockCatalogItems,
    isLoading: false,
    fetchParts: mockFetchParts,
  }),
}));

const mockCatalogItems: PartsCatalog[] = [
  {
    id: "part-1",
    name: "iPhone 14 Screen",
    category: PartCategory.SCREEN,
    defaultPrice: 8000,
    supplier: "iFixit",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "part-2",
    name: "Samsung Battery",
    category: PartCategory.BATTERY,
    defaultPrice: 3000,
    supplier: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("AddPartDialog", () => {
  it("renders with catalog tab and calls fetchParts on open", () => {
    render(
      <AddPartDialog
        jobId="job-1"
        open={true}
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />
    );

    expect(screen.getByText(/from catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/custom part/i)).toBeInTheDocument();
    expect(mockFetchParts).toHaveBeenCalledWith({
      isActive: true,
      search: undefined,
    });
  });

  it("shows catalog items in the list", async () => {
    render(
      <AddPartDialog
        jobId="job-1"
        open={true}
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />
    );

    expect(screen.getByText("iPhone 14 Screen")).toBeInTheDocument();
    expect(screen.getByText("Samsung Battery")).toBeInTheDocument();
  });

  it("picks a catalog item and populates form fields", async () => {
    render(
      <AddPartDialog
        jobId="job-1"
        open={true}
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("iPhone 14 Screen"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("iPhone 14 Screen")).toBeInTheDocument();
    });

    const priceInput = screen.getByDisplayValue("8000");
    expect(priceInput).toBeInTheDocument();
  });

  it("switches to custom tab and shows category dropdown", async () => {
    render(
      <AddPartDialog
        jobId="job-1"
        open={true}
        onClose={vi.fn()}
        onAdded={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/custom part/i));

    await waitFor(() => {
      expect(screen.getByLabelText(/part name/i)).toBeInTheDocument();
    });
  });

  it("calls onAdded and onClose on successful submit", async () => {
    mockAddPart.mockResolvedValueOnce({ id: "jp-1" });
    const onAdded = vi.fn();
    const onClose = vi.fn();

    render(
      <AddPartDialog
        jobId="job-1"
        open={true}
        onClose={onClose}
        onAdded={onAdded}
      />
    );

    fireEvent.click(screen.getByText("iPhone 14 Screen"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("iPhone 14 Screen")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /add part/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAddPart).toHaveBeenCalledWith("job-1", expect.objectContaining({
        partId: "part-1",
        partName: "iPhone 14 Screen",
      }));
      expect(onAdded).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/components/modules/jobs/__tests__/add-part-dialog.test.tsx`
Expected: All tests pass

- [ ] **Step 3: Fix any test failures**

If any mocks need adjustment (e.g., Zustand store mocking pattern), update the mock setup to match the project's existing test patterns. Check `job-actions-menu.test.tsx` for the established mock pattern.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/jobs/__tests__/add-part-dialog.test.tsx
git commit -m "test: add AddPartDialog catalog integration tests"
```

---

### Task 4: Test job-parts-section AddPartDialog integration

**Files:**
- Create: `src/components/modules/jobs/__tests__/job-parts-section.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import type { Job } from "@shared/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JobPartsSection from "../job-parts-section";

const mockRemovePart = vi.fn();
const mockFetchParts = vi.fn();

vi.mock("@/stores/jobs", () => ({
  useJobsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ removePart: mockRemovePart }),
}));

vi.mock("@/stores/parts-catalog", () => ({
  usePartsCatalogStore: () => ({
    parts: [],
    isLoading: false,
    fetchParts: mockFetchParts,
  }),
}));

vi.mock("./add-part-dialog", () => ({
  default: ({
    open,
    onClose,
    onAdded,
    jobId,
  }: {
    open: boolean;
    onClose: () => void;
    onAdded: () => void;
    jobId: string;
  }) =>
    open ? (
      <div data-testid="add-part-dialog" data-job-id={jobId}>
        <button onClick={onAdded} type="button">
          Mock Added
        </button>
        <button onClick={onClose} type="button">
          Mock Close
        </button>
      </div>
    ) : null,
}));

const createMockJob = (overrides: Partial<Job> = {}): Job =>
  ({
    id: "job-1",
    jobCode: "J-2026-001",
    accessCode: "abc123",
    customerId: "cust-1",
    customer: { id: "cust-1", name: "Test Customer", phone: "0555123456", email: null, createdAt: "", updatedAt: "" },
    deviceId: "dev-1",
    device: { id: "dev-1", brand: "Apple", model: "iPhone 14", createdAt: "", updatedAt: "" },
    reportedProblem: "Broken screen",
    status: "INTAKE",
    estimatedCost: 5000,
    depositAmount: null,
    estimatedDate: null,
    createdAt: "",
    updatedAt: "",
    isWarrantyReturn: false,
    createdById: "user-1",
    createdBy: { id: "user-1", name: "Admin", username: "admin", email: "admin@test.com", role: "OWNER", isActive: true, mustChangePassword: false, banned: false, banReason: null, banExpires: null, image: null, password: null, emailVerified: false, displayUsername: null, createdAt: "", updatedAt: "", sessions: [], accounts: [], verifications: [], assignedJobs: [], createdJobs: [], updatedJobs: [], notes: [], jobParts: [], jobRepairs: [], auditLogs: [], chatHistory: [] },
    updatedById: null,
    updatedBy: null,
    technicianId: null,
    technician: null,
    photos: [],
    notes: [],
    partsUsed: [],
    repairs: [],
    auditLogs: [],
    warrantyForJobId: null,
    warrantyForJob: null,
    warrantyReturns: [],
    color: null,
    conditionNotes: null,
    ...overrides,
  }) as Job;

describe("JobPartsSection", () => {
  it("renders parts title and add button for active job", () => {
    const job = createMockJob({ status: "INTAKE" });
    render(<JobPartsSection job={job} onChanged={vi.fn()} />);

    expect(screen.getByText("jobs_parts_title")).toBeInTheDocument();
  });

  it("shows add part button for non-terminal status", () => {
    const job = createMockJob({ status: "IN_REPAIR" });
    render(<JobPartsSection job={job} onChanged={vi.fn()} />);

    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("hides add part button for terminal status", () => {
    const job = createMockJob({ status: "DELIVERED" });
    render(<JobPartsSection job={job} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("opens AddPartDialog when add button is clicked", () => {
    const job = createMockJob({ status: "INTAKE" });
    render(<JobPartsSection job={job} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByTestId("add-part-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("add-part-dialog")).toHaveAttribute("data-job-id", "job-1");
  });

  it("shows empty state when no parts", () => {
    const job = createMockJob();
    render(<JobPartsSection job={job} onChanged={vi.fn()} />);

    expect(screen.getByText("jobs_parts_empty")).toBeInTheDocument();
  });

  it("shows parts list when parts exist", () => {
    const job = createMockJob({
      partsUsed: [
        {
          id: "jp-1",
          jobId: "job-1",
          partId: "part-1",
          partName: "iPhone 14 Screen",
          category: "SCREEN",
          unitPrice: 8000,
          quantity: 1,
          supplier: "iFixit",
          totalCost: 8000,
          createdById: "user-1",
          createdAt: "",
        },
      ] as Job["partsUsed"],
    });
    render(<JobPartsSection job={job} onChanged={vi.fn()} />);

    expect(screen.getByText("iPhone 14 Screen")).toBeInTheDocument();
  });

  it("calls onChanged when AddPartDialog reports onAdded", () => {
    const onChanged = vi.fn();
    const job = createMockJob({ status: "INTAKE" });
    render(<JobPartsSection job={job} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByText("Mock Added"));

    expect(onChanged).toHaveBeenCalled();
  });
});
```

Note: The `getByText` calls use translation keys because `useTranslation` will return the key when no mock is configured. Adjust if the test setup mocks `i18next`.

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/components/modules/jobs/__tests__/job-parts-section.test.tsx`
Expected: All tests pass

- [ ] **Step 3: Fix any test failures**

Verify that the Zustand store mock pattern matches what's used in `job-actions-menu.test.tsx`. Adjust mock structure if needed.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/jobs/__tests__/job-parts-section.test.tsx
git commit -m "test: add job-parts-section AddPartDialog integration tests"
```

---

### Task 5: Verify and clean up

- [ ] **Step 1: Run full typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `pnpm exec ultracite lint` or `pnpm lint`
Expected: No new warnings or errors

- [ ] **Step 4: Manual QA — open job detail in browser**

1. Log in as admin
2. Navigate to a job detail page
3. Click "Add Part" — verify the dialog opens with two tabs
4. Catalog tab: verify search works, picking a part fills the form, `partId` is in the submitted payload
5. Custom tab: verify free-form entry still works (no `partId`)
6. Verify the part appears in the list after adding
7. Verify the line total calculation works
8. Verify removing a part still works
9. Verify terminal status jobs don't show the add button

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address QA findings from parts catalog integration"
```