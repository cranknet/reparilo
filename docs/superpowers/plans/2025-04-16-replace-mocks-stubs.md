# Replace Mocks & Stubs with Real Backend APIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all remaining mock data and stub backend routes with real, working API implementations — except AI Analyst which is excluded.

**Architecture:** Each backend stub gets a full service + route implementation (following the `job.service.ts` → `jobs.ts` pattern). Frontend pages get Zustand stores or direct API calls to consume real data. Schemas are added to `shared/schemas/`.

**Tech Stack:** Fastify, Prisma 7 (PostgreSQL), Zod, Zustand, React, TypeScript

---

## Overview of Work

### Backend Stubs → Full APIs
1. **Settings** — GET/PUT AI config, GET/PUT shop info, GET notification templates, POST AI test
2. **Parts Catalog** — CRUD for `PartsCatalog` table
3. **Repair Catalog** — CRUD for `RepairCatalog` table (new route file)
4. **Notifications** — GET templates, PUT template
5. **Customers** — GET/search customers (read-only for now, creation happens via job intake)

### Frontend Mocks → Real Data
6. **Parts Page** — Wire to parts catalog API
7. **Repairs Page** — Wire to repair catalog API (new route)
8. **Settings Page** — Wire AI tab, shop tab, notifications tab, users tab to real APIs
9. **Tracking Page** — Wire to `GET /jobs/:id` via `accessCode` lookup
10. **Profile Page** — Fix broken API calls (`PUT /users/me` → `PATCH /users/:id`, password change → `POST /auth/change-password`)

### Remaining Mock Data (no backend needed — derived from existing jobs metrics)
- Dashboard financial data (revenue/costs) — requires analytics service (future)
- Dashboard overdue jobs — needs job `estimatedDate` comparison logic
- Front-desk alerts / waiting customers — needs notification infrastructure (future)
- Technician schedule / activity / priority actions / parts alerts — needs parts inventory + scheduling (future)

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Create | `server/services/settings.service.ts` | Settings business logic (AI, shop, notification templates) |
| Create | `server/services/parts-catalog.service.ts` | Parts catalog CRUD |
| Create | `server/services/repair-catalog.service.ts` | Repair catalog CRUD |
| Create | `server/services/customers.service.ts` | Customer search/list |
| Create | `server/routes/repairs.ts` | Repair catalog routes (new) |
| Create | `shared/schemas/settings.schema.ts` | Zod schemas for settings |
| Create | `shared/schemas/parts-catalog.schema.ts` | Zod schemas for parts catalog |
| Create | `shared/schemas/repair-catalog.schema.ts` | Zod schemas for repair catalog |
| Modify | `server/routes/settings.ts` | Replace stub with real routes |
| Modify | `server/routes/parts.ts` | Replace stub with real routes |
| Modify | `server/routes/customers.ts` | Replace stub with real routes |
| Modify | `server/routes/notifications.ts` | Replace stub with real routes |
| Modify | `server/index.ts` | Register repair catalog routes |
| Modify | `shared/schemas/index.ts` | Export new schemas |
| Create | `src/stores/settings.ts` | Zustand store for settings |
| Create | `src/stores/parts-catalog.ts` | Zustand store for parts catalog |
| Create | `src/stores/repair-catalog.ts` | Zustand store for repair catalog |
| Modify | `src/pages/settings/index.tsx` | Wire AI/shop/users/notification tabs to real APIs |
| Modify | `src/pages/parts/index.tsx` | Replace MOCK_PARTS with real API data |
| Modify | `src/pages/repairs/index.tsx` | Replace MOCK_REPAIRS with real API data |
| Modify | `src/pages/tracking/index.tsx` | Replace MOCK_DATA with real job lookup |
| Modify | `src/pages/profile/index.tsx` | Fix broken API calls |

---

### Task 1: Settings Backend — Service + Routes + Schemas

**Files:**
- Create: `shared/schemas/settings.schema.ts`
- Create: `server/services/settings.service.ts`
- Modify: `server/routes/settings.ts`

- [ ] **Step 1: Create `shared/schemas/settings.schema.ts`**

```ts
import { z } from "zod";

export const updateAiSettingsSchema = z.object({
  endpointUrl: z.string().min(1, "Endpoint URL is required"),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const updateShopSettingsSchema = z.object({
  shopName: z.string().min(1, "Shop name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  currency: z.string().optional(),
  receiptFooter: z.string().optional(),
});

export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["WHATSAPP", "SMS"]),
  body: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;
export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>;
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;
```

- [ ] **Step 2: Create `server/services/settings.service.ts`**

The service handles single-row upsert for `AiSettings` (fixed id `"default"`) and `ShopSettings` (fixed id `"default"`), plus CRUD for `NotificationTemplate`.

Key functions:
- `getAiSettings(prisma)` — findUnique or return defaults
- `upsertAiSettings(prisma, input)` — upsert with encrypted API key
- `getShopSettings(prisma)` — findUnique or return defaults
- `upsertShopSettings(prisma, input)` — upsert
- `getNotificationTemplates(prisma)` — findMany
- `updateNotificationTemplate(prisma, id, input)` — update
- `testAiConnection(prisma)` — try a simple call to the configured endpoint

- [ ] **Step 3: Rewrite `server/routes/settings.ts`** with these endpoints:
  - `GET /` — return `{ ai: {...}, shop: {...} }` (aggregate)
  - `GET /ai` — get AI settings
  - `PUT /ai` — update AI settings (requires `settings:write`)
  - `POST /ai/test` — test AI connection (requires `settings:write`)
  - `GET /shop` — get shop settings
  - `PUT /shop` — update shop settings (requires `settings:write`)
  - `GET /notifications/templates` — list templates
  - `PUT /notifications/templates/:id` — update template (requires `notifications:manage`)

- [ ] **Step 4: Run `pnpm run check` and verify no errors**

---

### Task 2: Parts Catalog Backend — Service + Routes + Schemas

**Files:**
- Create: `shared/schemas/parts-catalog.schema.ts`
- Create: `server/services/parts-catalog.service.ts`
- Modify: `server/routes/parts.ts`

- [ ] **Step 1: Create `shared/schemas/parts-catalog.schema.ts`**

```ts
import { PartCategory } from "@shared/constants";
import { z } from "zod";

export const createPartSchema = z.object({
  name: z.string().min(1, "Part name is required"),
  category: z.enum([
    PartCategory.SCREEN,
    PartCategory.BATTERY,
    PartCategory.CHARGING_PORT,
    PartCategory.CAMERA,
    PartCategory.SPEAKER,
    PartCategory.MICROPHONE,
    PartCategory.MOTHERBOARD,
    PartCategory.HOUSING,
    PartCategory.BUTTON,
    PartCategory.OTHER,
  ]),
  defaultPrice: z.number().min(0, "Price must be positive"),
  supplier: z.string().optional(),
});

export const updatePartSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum([
    PartCategory.SCREEN,
    PartCategory.BATTERY,
    PartCategory.CHARGING_PORT,
    PartCategory.CAMERA,
    PartCategory.SPEAKER,
    PartCategory.MICROPHONE,
    PartCategory.MOTHERBOARD,
    PartCategory.HOUSING,
    PartCategory.BUTTON,
    PartCategory.OTHER,
  ]).optional(),
  defaultPrice: z.number().min(0).optional(),
  supplier: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const listPartsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreatePartInput = z.infer<typeof createPartSchema>;
export type UpdatePartInput = z.infer<typeof updatePartSchema>;
export type ListPartsQueryInput = z.infer<typeof listPartsQuerySchema>;
```

- [ ] **Step 2: Create `server/services/parts-catalog.service.ts`**

Key functions:
- `list(prisma, query)` — paginated list with search and category filter
- `getById(prisma, id)` — single part
- `create(prisma, input)` — create part
- `update(prisma, id, input)` — update part
- `toggleActive(prisma, id, isActive)` — activate/deactivate

- [ ] **Step 3: Rewrite `server/routes/parts.ts`** with:
  - `GET /` — list parts (cursor, limit, search, category, isActive query params)
  - `GET /:id` — get part by ID
  - `POST /` — create part (requires `parts:write`)
  - `PATCH /:id` — update part (requires `parts:write`)
  - `PATCH /:id/status` — toggle active/inactive (requires `parts:write`)

- [ ] **Step 4: Run `pnpm run check`**

---

### Task 3: Repair Catalog Backend — New Route + Service + Schemas

**Files:**
- Create: `shared/schemas/repair-catalog.schema.ts`
- Create: `server/services/repair-catalog.service.ts`
- Create: `server/routes/repairs.ts`
- Modify: `server/index.ts` (register route)

- [ ] **Step 1: Create `shared/schemas/repair-catalog.schema.ts`**

```ts
import { RepairCategory } from "@shared/constants";
import { z } from "zod";

export const createRepairSchema = z.object({
  name: z.string().min(1, "Repair name is required"),
  category: z.enum([
    RepairCategory.HARDWARE,
    RepairCategory.SOFTWARE,
    RepairCategory.DIAGNOSTIC,
    RepairCategory.OTHER,
  ]),
  defaultPrice: z.number().min(0, "Price must be positive"),
});

export const updateRepairSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum([
    RepairCategory.HARDWARE,
    RepairCategory.SOFTWARE,
    RepairCategory.DIAGNOSTIC,
    RepairCategory.OTHER,
  ]).optional(),
  defaultPrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const listRepairsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type UpdateRepairInput = z.infer<typeof updateRepairSchema>;
export type ListRepairsQueryInput = z.infer<typeof listRepairsQuerySchema>;
```

- [ ] **Step 2: Create `server/services/repair-catalog.service.ts`**

Pattern mirrors `parts-catalog.service.ts`. Key functions:
- `list(prisma, query)`, `getById`, `create`, `update`, `toggleActive`

- [ ] **Step 3: Create `server/routes/repairs.ts`** with:
  - `GET /` — list repairs
  - `GET /:id` — get repair by ID
  - `POST /` — create repair (requires `parts:write` — reuse permission since technicians manage repairs)
  - `PATCH /:id` — update repair
  - `PATCH /:id/status` — toggle active/inactive

- [ ] **Step 4: Register in `server/index.ts`** — add import and `app.register(repairRoutes, { prefix: "/api/repairs" })`

- [ ] **Step 5: Run `pnpm run check`**

---

### Task 4: Customers & Notifications Backend Routes

**Files:**
- Create: `server/services/customers.service.ts`
- Modify: `server/routes/customers.ts`
- Modify: `server/routes/notifications.ts`

- [ ] **Step 1: Create `server/services/customers.service.ts`**

Key functions:
- `list(prisma, query)` — paginated list with search
- `search(prisma, query)` — search by name or phone

- [ ] **Step 2: Rewrite `server/routes/customers.ts`** with:
  - `GET /` — list customers (cursor, limit, search query params)
  - `GET /search` — search customers by name/phone prefix (for intake autocomplete)

- [ ] **Step 3: Rewrite `server/routes/notifications.ts`** with:
  - `GET /templates` — list notification templates
  - `PUT /templates/:id` — update template (requires `notifications:manage`)

  This delegates to the settings service for template management.

- [ ] **Step 4: Run `pnpm run check`**

---

### Task 5: Create Prisma Migration

**Files:**
- Generated: `prisma/migrations/<timestamp>_add_repair_catalog_indexes/migration.sql`

- [ ] **Step 1: Run `pnpm prisma migrate dev --name add_catalog_indexes`** to ensure the Prisma schema matches the database (PartsCatalog, RepairCatalog, ShopSettings, AiSettings, NotificationTemplate models should already exist in schema)

- [ ] **Step 2: Verify with `pnpm prisma generate`**

---

### Task 6: Frontend — Settings Zustand Store + Settings Page Wiring

**Files:**
- Create: `src/stores/settings.ts`
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Create `src/stores/settings.ts`**

```ts
import { create } from "zustand";
import api from "@/lib/api";

interface AiSettings {
  endpointUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

interface ShopSettings {
  shopName: string;
  address: string;
  phone: string;
  currency: string;
  receiptFooter: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  channel: "WHATSAPP" | "SMS";
  body: string;
  isDefault: boolean;
}

interface SettingsState {
  aiSettings: AiSettings | null;
  shopSettings: ShopSettings | null;
  notificationTemplates: NotificationTemplate[];
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  saveAiSettings: (data: AiSettings) => Promise<void>;
  saveShopSettings: (data: ShopSettings) => Promise<void>;
  testAiConnection: () => Promise<boolean>;
  fetchNotificationTemplates: () => Promise<void>;
  updateNotificationTemplate: (id: string, data: Partial<NotificationTemplate>) => Promise<void>;
  clearError: () => void;
}
```

Implement all methods with `api.get`/`api.put`/`api.post`.

- [ ] **Step 2: Wire `src/pages/settings/index.tsx`** — Replace `MOCK_TEMPLATES` with store data. Add `useEffect` to fetch settings on mount. Wire AI form to `saveAiSettings`, shop form to `saveShopSettings`, and test button to `testAiConnection`. Wire notification templates to `fetchNotificationTemplates` and `updateNotificationTemplate`.

- [ ] **Step 3: Fix broken settings API calls** — The page currently calls `api.put("/settings/ai")`, `api.put("/settings/shop")`, `api.post("/settings/ai/test")`. These now have real backend implementations. Verify they match.

- [ ] **Step 4: Run `pnpm run check`**

---

### Task 7: Frontend — Parts Catalog Store + Page Wiring

**Files:**
- Create: `src/stores/parts-catalog.ts`
- Modify: `src/pages/parts/index.tsx`

- [ ] **Step 1: Create `src/stores/parts-catalog.ts`**

Store shape:
```ts
interface PartsCatalogState {
  parts: PartsCatalog[];
  totalCount: number;
  nextCursor: string | null;
  isLoading: boolean;
  error: string | null;
  fetchParts: (params?) => Promise<void>;
  createPart: (data) => Promise<PartsCatalog>;
  updatePart: (id, data) => Promise<PartsCatalog>;
  togglePartActive: (id, isActive) => Promise<void>;
  clearError: () => void;
}
```

- [ ] **Step 2: Wire `src/pages/parts/index.tsx`** — Replace `MOCK_PARTS` with store data. Call `fetchParts()` on mount. Wire `AddPartModal.onSubmit` to `createPart()`. Add loading state.

- [ ] **Step 3: Run `pnpm run check`**

---

### Task 8: Frontend — Repair Catalog Store + Page Wiring

**Files:**
- Create: `src/stores/repair-catalog.ts`
- Modify: `src/pages/repairs/index.tsx`

- [ ] **Step 1: Create `src/stores/repair-catalog.ts`**

Same pattern as parts catalog store.

- [ ] **Step 2: Wire `src/pages/repairs/index.tsx`** — Replace `MOCK_REPAIRS` with store data. Call `fetchRepairs()` on mount. Wire `AddRepairModal.onSubmit` to `createRepair()`.

- [ ] **Step 3: Run `pnpm run check`**

---

### Task 9: Frontend — Tracking Page Wiring

**Files:**
- Modify: `src/pages/tracking/index.tsx`

- [ ] **Step 1: Wire tracking page to `GET /jobs/:id` via access code**

The tracking page currently uses `MOCK_DATA` regardless of the job code in the URL. Replace with:
1. Get `jobCode` from URL params (`useParams`)
2. Call `api.get(\`/jobs/\${jobId}\`)` on mount — but we need a lookup by `jobCode` or `accessCode`. Add a `GET /api/jobs/lookup?code=xxx` endpoint in the jobs route that finds by `jobCode` or `accessCode`.
3. Map the response to the tracking UI shape
4. Show loading/error states
5. Public access (no auth required) — add `jobCode` lookup route that doesn't require auth

- [ ] **Step 2: Add public lookup endpoint to `server/routes/jobs.ts`**

Add a new route `GET /lookup` before `GET /:id`:
```ts
app.get("/lookup", async (req, reply) => {
  const { code } = req.query as { code?: string };
  if (!code) return reply.status(400).send({ error: "MISSING_CODE", message: "code query parameter is required" });
  const job = await prisma.job.findFirst({
    where: { OR: [{ jobCode: code }, { accessCode: code }] },
    include: { customer: true, device: true, repairs: true, partsUsed: true },
  });
  if (!job) return reply.status(404).send({ error: "JOB_NOT_FOUND", message: "Job not found" });
  return reply.send(job);
});
```
This route should NOT require auth (it's a public tracking page). Move the auth hook to only apply to authenticated routes, or use `{ preHandler: [] }` to skip auth.

- [ ] **Step 3: Wire `src/pages/tracking/index.tsx`**

Use `api.get(\`/jobs/lookup?code=\${jobCode}\`)` to fetch job data, map to UI. Add loading/spinner state.

- [ ] **Step 4: Run `pnpm run check`**

---

### Task 10: Frontend — Profile Page API Fix

**Files:**
- Modify: `src/pages/profile/index.tsx`

- [ ] **Step 1: Fix broken API calls**

The profile page calls:
- `api.put("/users/me")` → no backend route. Fix: Change to `api.patch(\`/users/\${userId}\`)` using the user's ID from auth store, adding a `PATCH /api/users/:id` route that allows users to update their own profile (name, email).
- `api.put("/users/me/password")` → wrong path. Fix: Change to `api.post("/auth/change-password")` which already exists and accepts `{ oldPassword, newPassword }`.

- [ ] **Step 2: Add `PATCH /api/users/:id` route for self-profile updates** in `server/routes/users.ts`

Allow users to update their own `name` and `email` only. Add permission check: user can only update their own profile unless they have `users:write`.

- [ ] **Step 3: Replace `MOCK_ACTIVITY`** with real audit log data. Add `GET /api/users/me/activity` endpoint that returns recent audit logs for the current user. Wire the profile activity tab to fetch from this endpoint.

- [ ] **Step 4: Run `pnpm run check`**

---

### Task 11: Update Shared Schemas Exports

**Files:**
- Modify: `shared/schemas/index.ts`

- [ ] **Step 1: Add exports for new schemas**

```ts
export {
  updateAiSettingsSchema,
  updateShopSettingsSchema,
  updateNotificationTemplateSchema,
} from "./settings.schema";
export type {
  UpdateAiSettingsInput,
  UpdateShopSettingsInput,
  UpdateNotificationTemplateInput,
} from "./settings.schema";

export {
  createPartSchema,
  updatePartSchema,
  listPartsQuerySchema,
} from "./parts-catalog.schema";
export type {
  CreatePartInput,
  UpdatePartInput,
  ListPartsQueryInput,
} from "./parts-catalog.schema";

export {
  createRepairSchema,
  updateRepairSchema,
  listRepairsQuerySchema,
} from "./repair-catalog.schema";
export type {
  CreateRepairInput,
  UpdateRepairInput,
  ListRepairsQueryInput,
} from "./repair-catalog.schema";
```

- [ ] **Step 2: Run `pnpm run check`**

---

### Task 12: Final Verification

- [ ] **Step 1: Run `pnpm run check`** — must pass with zero errors

- [ ] **Step 2: Run `pnpm prisma migrate dev`** — ensure schema is in sync

- [ ] **Step 3: Start dev server and verify each endpoint returns expected data**

- [ ] **Step 4: Commit all changes**

```bash
git add -A
git commit -m "feat: replace all mock data & backend stubs with real API implementations

- Implement settings routes (AI config, shop info, notification templates)
- Implement parts catalog CRUD routes and service
- Implement repair catalog CRUD routes and service (new)
- Implement customer search route
- Implement notification templates route
- Add job code lookup endpoint for public tracking
- Add user self-profile update route
- Create Zustand stores for settings, parts catalog, repair catalog
- Wire settings page to real AI/shop/users/notification APIs
- Wire parts catalog page to real parts API
- Wire repairs catalog page to real repairs API
- Wire tracking page to job lookup API
- Fix profile page broken API calls
- Add Zod schemas for settings, parts catalog, repair catalog
- Register repair catalog routes in server entry point"
```