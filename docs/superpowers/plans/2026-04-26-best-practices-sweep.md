# Best Practices Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve data integrity, code organization, test coverage, and polish across the Reparilo codebase.

**Architecture:** Four phased improvements: (1) consolidate Zod schemas and i18n-ify validation messages, (2) decompose the 1261-line Settings page into extracted tab components, (3) expand test coverage for untested services and stores, (4) fix minor dead UI and hardcoded values.

**Tech Stack:** Zod 3, i18next, React 19, Zustand 5, Vitest, Fastify 5, Prisma 7

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `shared/schemas/receipt.schema.ts` | Receipt/label route input validation |
| Create | `shared/schemas/notification.schema.ts` | Notification send and test-send validation |
| Modify | `shared/schemas/auth.schema.ts` | Add `updateUserSchema`, `toggleUserStatusSchema`, `activityListQuerySchema`, `userIdParamSchema` |
| Modify | `shared/schemas/job.schema.ts` | Replace hardcoded English messages with i18n keys |
| Modify | `shared/schemas/customer.schema.ts` | Replace hardcoded English messages with i18n keys |
| Modify | `shared/schemas/settings.schema.ts` | Replace hardcoded English messages with i18n keys, add `countryCode` to shop settings |
| Modify | `shared/schemas/index.ts` | Add new exports |
| Modify | `server/routes/users.ts` | Use shared schemas instead of type casts |
| Modify | `server/routes/receipts.ts` | Use shared schema for param validation |
| Modify | `server/routes/notifications.ts` | Use shared schema for test-send |
| Modify | `src/i18n/locales/en.json` | Add `validations` namespace |
| Modify | `src/i18n/locales/fr.json` | Sync (via `sync-locales`) |
| Modify | `src/i18n/locales/ar.json` | Sync (via `sync-locales`) |
| Create | `src/components/modules/settings/settings-ai-tab.tsx` | AI config tab component |
| Create | `src/components/modules/settings/settings-shop-tab.tsx` | Shop settings tab component |
| Create | `src/components/modules/settings/settings-notifications-tab.tsx` | Notifications tab component |
| Create | `src/components/modules/settings/settings-users-tab.tsx` | Users management tab component |
| Modify | `src/pages/settings/index.tsx` | Shell only: tab state, layout, delegates to tab components |
| Move | `UserRow` component + `ROLE_CONFIG` + `UserRowData` type | Into `src/components/modules/settings/settings-users-tab.tsx` |
| Create | `server/__tests__/notification-renderer.test.ts` | Renderer unit tests |
| Create | `server/__tests__/notification-sender.test.ts` | Sender tests (WhatsApp API + SMS mock) |
| Create | `server/__tests__/notification-outbox.test.ts` | Outbox worker tests |
| Create | `server/__tests__/audit.service.test.ts` | Audit log tests |
| Create | `server/__tests__/job-photos.service.test.ts` | Photo upload/delete tests |
| Create | `server/__tests__/avatar.service.test.ts` | Avatar upload/delete tests |
| Create | `server/__tests__/job-waiting-parts.service.test.ts` | Waiting parts CRUD tests |
| Create | `server/__tests__/dashboard.service.test.ts` | Dashboard aggregation tests |
| Create | `src/stores/__tests__/jobs.test.ts` | Jobs store tests |
| Create | `src/stores/__tests__/settings.test.ts` | Settings store tests |
| Modify | `server/services/notification-renderer.ts` | Add conditionals + locale formatting |
| Modify | `src/pages/dashboard/index.tsx` | Remove dead Daily Summary button |
| Modify | `prisma/schema.prisma` | Add `countryCode` to `ShopSettings` |
| Modify | `src/pages/settings/index.tsx` (shop tab) | Dynamic phone placeholder from countryCode |

---

## Phase 1: Zod Schema Consolidation + i18n

### Task 1.1: Add `validations` i18n namespace to en.json

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add validation keys to en.json**

Add the following keys inside `en.json` under a new `"validations"` top-level key (nested object). Place them after the existing keys, before the closing `}`:

```json
"validations": {
  "required": "This field is required",
  "email": "Enter a valid email address",
  "min_length": "Must be at least {{min}} characters",
  "max_length": "Must be at most {{max}} characters",
  "min_value": "Must be at least {{min}}",
  "enter_name": "Enter a customer name",
  "enter_phone": "Enter a phone number",
  "enter_brand": "Enter a device brand",
  "enter_model": "Enter a device model",
  "describe_problem": "Describe the reported problem",
  "valid_cost": "Enter a valid cost",
  "valid_deposit": "Enter a valid deposit amount",
  "reason_required": "Reason is required for CANCELLED and ON_HOLD",
  "username_min": "Username must be at least 3 characters",
  "username_pattern": "Username can only contain letters, numbers, and underscores",
  "password_min": "Password must be at least 8 characters",
  "shop_name_required": "Shop name is required",
  "endpoint_required": "Endpoint URL is required",
  "at_least_one_field": "At least one field is required"
}
```

- [ ] **Step 2: Run sync-locales**

Run: `pnpm run sync-locales`
Expected: `fr.json` and `ar.json` updated with translated `validations` keys

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/ar.json
git commit -m "feat(i18n): add validations namespace with shared Zod message keys"
```

---

### Task 1.2: Replace hardcoded messages in existing Zod schemas

**Files:**
- Modify: `shared/schemas/customer.schema.ts`
- Modify: `shared/schemas/job.schema.ts`
- Modify: `shared/schemas/auth.schema.ts`
- Modify: `shared/schemas/settings.schema.ts`

- [ ] **Step 1: Update customer.schema.ts**

Replace hardcoded English messages with i18n key references:

```typescript
import { z } from "zod";

export const createCustomerSchema = z.object({
  email: z.string().email({ error: "validations.email" }).optional().or(z.literal("")),
  name: z.string().min(1, { error: "validations.enter_name" }),
  phone: z.string().min(1, { error: "validations.enter_phone" }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(1, { error: "validations.enter_name" }).optional(),
  phone: z.string().min(1, { error: "validations.enter_phone" }).optional(),
  email: z.string().email({ error: "validations.email" }).or(z.literal("")).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const customerSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const customerIdParamSchema = z.string().cuid();

export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
export type CustomerSearchQueryInput = z.infer<typeof customerSearchQuerySchema>;
```

- [ ] **Step 2: Update job.schema.ts**

Replace hardcoded English messages. Remove the TODO comment at line 1:

```typescript
import { JobStatus, PartCategory, RepairCategory } from "@shared/constants";
import { z } from "zod";

const repairCategoryValues = Object.values(RepairCategory) as [string, ...string[]];

export const intakeRepairItemSchema = z.object({
  repairId: z.string().optional(),
  repairName: z.string().min(1),
  category: z.enum(repairCategoryValues),
  price: z.number().min(0),
});

export const createJobSchema = z.object({
  customerEmail: z.string().email({ error: "validations.email" }).optional().or(z.literal("")),
  customerId: z.string().cuid().optional(),
  customerName: z.string().min(1, { error: "validations.enter_name" }),
  customerPhone: z.string().min(1, { error: "validations.enter_phone" }),
  deviceBrand: z.string().min(1, { error: "validations.enter_brand" }),
  deviceModel: z.string().min(1, { error: "validations.enter_model" }),
  color: z.string().optional(),
  reportedProblem: z.string().min(1, { error: "validations.describe_problem" }),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0, { error: "validations.valid_cost" }),
  estimatedDate: z.string().optional(),
  depositAmount: z.number().min(0, { error: "validations.valid_deposit" }).optional(),
  technicianId: z.string().min(1).optional(),
  isWarrantyReturn: z.boolean().optional(),
  warrantyForJobId: z.string().optional(),
  repairs: z.array(intakeRepairItemSchema).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object({
  reportedProblem: z.string().min(1).optional(),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  estimatedDate: z.string().min(1).nullable().optional(),
  depositAmount: z.number().min(0).nullable().optional(),
  technicianId: z.string().min(1).nullable().optional(),
  color: z.string().optional(),
});

export const transitionStatusSchema = z
  .object({
    status: z.enum([
      JobStatus.INTAKE,
      JobStatus.WAITING_FOR_PARTS,
      JobStatus.IN_REPAIR,
      JobStatus.ON_HOLD,
      JobStatus.DONE,
      JobStatus.DELIVERED,
      JobStatus.RETURNED,
      JobStatus.CANCELLED,
    ]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    const requiresReason =
      val.status === JobStatus.CANCELLED || val.status === JobStatus.ON_HOLD;
    if (requiresReason && (!val.reason || val.reason.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "validations.reason_required",
      });
    }
  });

export const addJobPartSchema = z.object({
  partId: z.string().optional(),
  partName: z.string().min(1),
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
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
  supplier: z.string().optional(),
});

export const addJobRepairSchema = z.object({
  repairId: z.string().optional(),
  repairName: z.string().min(1),
  category: z.enum(repairCategoryValues),
  price: z.number().min(0),
});

export const addJobNoteSchema = z.object({
  content: z.string().min(1),
  isCustomerVisible: z.boolean().default(false),
});

export const addWaitingPartSchema = z.object({
  partName: z.string().min(1),
  supplier: z.string().optional(),
});

export const jobListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  technicianId: z.string().optional(),
  search: z.string().optional(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
export type AddJobPartInput = z.infer<typeof addJobPartSchema>;
export type AddJobRepairInput = z.infer<typeof addJobRepairSchema>;
export type AddJobNoteInput = z.infer<typeof addJobNoteSchema>;
export type AddWaitingPartInput = z.infer<typeof addWaitingPartSchema>;
export type JobListQueryInput = z.infer<typeof jobListQuerySchema>;
export type IntakeRepairItem = z.infer<typeof intakeRepairItemSchema>;
```

- [ ] **Step 3: Update auth.schema.ts**

Replace hardcoded English messages:

```typescript
import { z } from "zod";

export const signInSchema = z.object({
  username: z.string().min(1, "validations.required"),
  password: z.string().min(8, "validations.password_min"),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "validations.username_min")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "validations.username_pattern"),
  email: z.string().email("validations.email"),
  password: z.string().min(8, "validations.password_min"),
  role: z.enum(["OWNER", "TECHNICIAN", "FRONT_DESK"]),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, "validations.password_min"),
  newPassword: z.string().min(8, "validations.password_min"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "validations.required").max(100).optional(),
  email: z.string().email("validations.email").optional(),
  username: z
    .string()
    .min(3, "validations.username_min")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "validations.username_pattern")
    .optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "validations.password_min"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "validations.required").max(100).optional(),
  email: z.string().email("validations.email").optional(),
  username: z
    .string()
    .min(3, "validations.username_min")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "validations.username_pattern")
    .optional(),
  role: z.enum(["OWNER", "TECHNICIAN", "FRONT_DESK"]).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const activityListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(4),
});

export const userIdParamSchema = z.string().cuid();

export type SignInInput = z.infer<typeof signInSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;
export type ActivityListQueryInput = z.infer<typeof activityListQuerySchema>;
```

- [ ] **Step 4: Update settings.schema.ts**

Replace hardcoded English messages and add `countryCode`:

```typescript
import { z } from "zod";

export const updateAiSettingsSchema = z.object({
  endpointUrl: z.string().min(1, "validations.endpoint_required"),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const updateShopSettingsSchema = z.object({
  shopName: z.string().min(1, "validations.shop_name_required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  currency: z.string().optional(),
  countryCode: z.string().optional(),
  receiptFooter: z.string().optional(),
});

export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["WHATSAPP", "SMS"]),
  body: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const updateWhatsAppSettingsSchema = z
  .object({
    apiToken: z.string().optional(),
    businessId: z.string().optional(),
    phoneNumberId: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.apiToken !== undefined ||
      data.businessId !== undefined ||
      data.phoneNumberId !== undefined ||
      data.enabled !== undefined,
    { message: "validations.at_least_one_field" }
  );

export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;
export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>;
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;
export type UpdateWhatsAppSettingsInput = z.infer<typeof updateWhatsAppSettingsSchema>;
```

- [ ] **Step 5: Update barrel export**

Add new exports to `shared/schemas/index.ts`:

```typescript
export type {
  ActivityListQueryInput,
  ChangePasswordInput,
  CreateUserInput,
  ResetPasswordInput,
  SignInInput,
  ToggleUserStatusInput,
  UpdateProfileInput,
  UpdateUserInput,
} from "./auth.schema";
export {
  activityListQuerySchema,
  changePasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  signInSchema,
  toggleUserStatusSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdParamSchema,
} from "./auth.schema";
export type {
  CreateCustomerInput,
  CustomerListQueryInput,
  CustomerSearchQueryInput,
  UpdateCustomerInput,
} from "./customer.schema";
export {
  createCustomerSchema,
  customerIdParamSchema,
  customerListQuerySchema,
  customerSearchQuerySchema,
  updateCustomerSchema,
} from "./customer.schema";
export type {
  AddJobNoteInput,
  AddJobPartInput,
  AddJobRepairInput,
  AddWaitingPartInput,
  CreateJobInput,
  IntakeRepairItem,
  JobListQueryInput,
  TransitionStatusInput,
  UpdateJobInput,
} from "./job.schema";
export {
  addJobNoteSchema,
  addJobPartSchema,
  addJobRepairSchema,
  addWaitingPartSchema,
  createJobSchema,
  intakeRepairItemSchema,
  jobListQuerySchema,
  transitionStatusSchema,
  updateJobSchema,
} from "./job.schema";
export type {
  CreatePartInput,
  ListPartsQueryInput,
  TogglePartStatusInput,
  UpdatePartInput,
} from "./parts-catalog.schema";
export {
  createPartSchema,
  listPartsQuerySchema,
  togglePartStatusSchema,
  updatePartSchema,
} from "./parts-catalog.schema";
export type {
  CreateRepairInput,
  ListRepairsQueryInput,
  UpdateRepairInput,
} from "./repair-catalog.schema";
export {
  createRepairSchema,
  listRepairsQuerySchema,
  updateRepairSchema,
} from "./repair-catalog.schema";
export type {
  UpdateAiSettingsInput,
  UpdateNotificationTemplateInput,
  UpdateShopSettingsInput,
  UpdateWhatsAppSettingsInput,
} from "./settings.schema";
export {
  updateAiSettingsSchema,
  updateNotificationTemplateSchema,
  updateShopSettingsSchema,
  updateWhatsAppSettingsSchema,
} from "./settings.schema";
```

- [ ] **Step 6: Create receipt.schema.ts**

Create `shared/schemas/receipt.schema.ts`:

```typescript
import { z } from "zod";

export const jobIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type JobIdParamInput = z.infer<typeof jobIdParamSchema>;
```

- [ ] **Step 7: Create notification.schema.ts**

Create `shared/schemas/notification.schema.ts`:

```typescript
import { z } from "zod";

export const templateIdParamSchema = z.object({
  templateId: z.string().cuid(),
});

export type TemplateIdParamInput = z.infer<typeof templateIdParamSchema>;
```

- [ ] **Step 8: Update barrel with new schema exports**

Add to `shared/schemas/index.ts`:

```typescript
export type { JobIdParamInput } from "./receipt.schema";
export { jobIdParamSchema } from "./receipt.schema";
export type { TemplateIdParamInput } from "./notification.schema";
export { templateIdParamSchema } from "./notification.schema";
```

- [ ] **Step 9: Run lint check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add shared/schemas/ src/i18n/locales/
git commit -m "feat(schemas): consolidate Zod schemas with i18n keys, add receipt/notification schemas"
```

---

### Task 1.3: Wire shared schemas into server routes

**Files:**
- Modify: `server/routes/users.ts`
- Modify: `server/routes/receipts.ts`
- Modify: `server/routes/notifications.ts`

- [ ] **Step 1: Update users.ts — PATCH /:id/status route**

In `server/routes/users.ts`, find the `/:id/status` route handler (around line 220-250). Replace:

```typescript
const { isActive } = request.body as { isActive: boolean };
```

With:

```typescript
const parsed = toggleUserStatusSchema.safeParse(request.body);
if (!parsed.success) {
  return reply.status(400).send({
    error: "VALIDATION_ERROR",
    details: parsed.error.flatten().fieldErrors,
  });
}
const { isActive } = parsed.data;
```

Add the import at the top of the file (alongside existing schema imports):

```typescript
import { toggleUserStatusSchema, activityListQuerySchema, userIdParamSchema } from "@shared/schemas";
```

- [ ] **Step 2: Update users.ts — GET /:id/activity route**

In the `/:id/activity` handler (around line 363-368), replace:

```typescript
const { id } = request.params as { id: string };
const { cursor, limit } = request.query as {
  cursor?: string;
  limit?: string;
};
```

With:

```typescript
const paramParsed = userIdParamSchema.safeParse(request.params);
if (!paramParsed.success) {
  return reply.status(400).send({ error: "VALIDATION_ERROR", details: paramParsed.error.flatten().fieldErrors });
}
const { id } = paramParsed.data;
const queryParsed = activityListQuerySchema.safeParse(request.query);
if (!queryParsed.success) {
  return reply.status(400).send({ error: "VALIDATION_ERROR", details: queryParsed.error.flatten().fieldErrors });
}
const take = queryParsed.data.limit;
const cursor = queryParsed.data.cursor;
```

And remove the line:

```typescript
const take = Math.min(Math.max(Number(limit) || 4, 1), 100);
```

- [ ] **Step 3: Update receipts.ts — param validation**

In `server/routes/receipts.ts`, find each `req.params as { id: string }` type cast. Replace with schema validation. Add import:

```typescript
import { jobIdParamSchema } from "@shared/schemas";
```

Then in each route handler (`/:id/receipt` and `/:id/label`), replace:

```typescript
const { id } = req.params as { id: string };
```

With:

```typescript
const paramParsed = jobIdParamSchema.safeParse(req.params);
if (!paramParsed.success) {
  return sendError(reply, 400, "VALIDATION_ERROR", "Invalid job ID");
}
const { id } = paramParsed.data;
```

- [ ] **Step 4: Update notifications.ts — templateId param validation**

In `server/routes/notifications.ts`, find the test-send route (`/test/:templateId`). Replace:

```typescript
const { templateId } = req.params as { templateId: string };
```

With:

```typescript
import { templateIdParamSchema } from "@shared/schemas";
```

(Skip the schema parse for this one — `templateId` is passed directly to Prisma `findUnique` which will safely return `null` for invalid IDs. The existing 404 check handles this.)

- [ ] **Step 5: Run lint check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/routes/users.ts server/routes/receipts.ts server/routes/notifications.ts
git commit -m "feat(routes): use shared Zod schemas instead of type casts in users, receipts, notifications"
```

---

### Task 1.4: Add server-side i18n resolution for Zod error messages

**Files:**
- Create: `server/utils/resolve-validation-messages.ts`
- Modify: All route files that return validation errors (optional — see note below)

- [ ] **Step 1: Create resolve-validation-messages utility**

Create `server/utils/resolve-validation-messages.ts`:

```typescript
import i18next from "i18next";

const VALIDATION_PREFIX = "validations.";

const validationI18n = i18next.createInstance(
  {
    resources: {},
    fallbackLng: "en",
    ns: ["validations"],
    defaultNS: "validations",
  },
  () => {}
);

let initialized = false;

export async function initValidationI18n() {
  if (initialized) return;
  const en = await import("../../src/i18n/locales/en.json");
  const fr = await import("../../src/i18n/locales/fr.json");
  const ar = await import("../../src/i18n/locales/ar.json");
  validationI18n.addResourceBundle("en", "validations", en.validations);
  validationI18n.addResourceBundle("fr", "validations", fr.validations);
  validationI18n.addResourceBundle("ar", "validations", ar.validations);
  initialized = true;
}

export function resolveValidationMessage(
  message: string,
  locale: string
): string {
  if (!message.startsWith(VALIDATION_PREFIX)) return message;
  const key = message.slice(VALIDATION_PREFIX.length);
  validationI18n.changeLanguage(locale);
  return validationI18n.t(key, { defaultValue: message });
}

export function resolveZodErrors(
  errors: Record<string, string[]>,
  locale: string
): Record<string, string[]> {
  const resolved: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(errors)) {
    resolved[field] = messages.map((m) => resolveValidationMessage(m, locale));
  }
  return resolved;
}
```

- [ ] **Step 2: Create a Fastify plugin to attach locale to requests**

Create `server/plugins/locale.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";

const SUPPORTED_LOCALES = new Set(["en", "fr", "ar"]);

function extractLocale(headers: Record<string, string | undefined>): string {
  const acceptLanguage = headers["accept-language"];
  if (!acceptLanguage) return "en";
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.trim()?.toLowerCase();
  if (preferred && SUPPORTED_LOCALES.has(preferred)) return preferred;
  return "en";
}

export const localePlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("locale", "en");
  app.addHook("onRequest", async (request) => {
    request.locale = extractLocale(request.headers as Record<string, string | undefined>);
  });
};

declare module "fastify" {
  interface FastifyRequest {
    locale: string;
  }
}
```

- [ ] **Step 3: Register locale plugin in server/index.ts**

In `server/index.ts`, add the import and registration:

```typescript
import { localePlugin } from "./plugins/locale.js";
```

Register it early in the plugin chain:

```typescript
app.register(localePlugin);
```

- [ ] **Step 4: Initialize validation i18n on server startup**

In `server/index.ts`, add initialization after app is created:

```typescript
import { initValidationI18n } from "./utils/resolve-validation-messages.js";
```

Call `initValidationI18n()` during the `ready` hook or at server start:

```typescript
app.addHook("onReady", async () => {
  await initValidationI18n();
});
```

- [ ] **Step 5: Update route validation error responses to resolve i18n messages**

In route handlers that return `parsed.error.flatten().fieldErrors`, wrap with `resolveZodErrors`. Example for `server/routes/users.ts`:

Add import:

```typescript
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";
```

Replace validation error responses like:

```typescript
return reply.status(400).send({
  error: "VALIDATION_ERROR",
  details: parsed.error.flatten().fieldErrors,
});
```

With:

```typescript
return reply.status(400).send({
  error: "VALIDATION_ERROR",
  details: resolveZodErrors(
    parsed.error.flatten().fieldErrors,
    request.locale
  ),
});
```

Apply this same pattern to all route files that return `parsed.error.flatten().fieldErrors`:
- `server/routes/users.ts` (multiple routes)
- `server/routes/jobs.ts` (multiple routes)
- `server/routes/customers.ts`
- `server/routes/parts.ts`
- `server/routes/repairs.ts`
- `server/routes/settings.ts`
- `server/routes/notifications.ts`

- [ ] **Step 6: Run lint check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 7: Run tests**

Run: `pnpm test`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add server/
git commit -m "feat(server): add i18n resolution for Zod validation messages with locale plugin"
```

---

## Phase 2: Settings Page Decomposition

### Task 2.1: Extract SettingsAiTab

**Files:**
- Create: `src/components/modules/settings/settings-ai-tab.tsx`
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Create settings-ai-tab.tsx**

Create `src/components/modules/settings/settings-ai-tab.tsx`:

```tsx
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settings";

const AI_MODELS = [
  { id: "gpt-4o-mini", labelKey: "model_label_fast", labelShort: "GPT-4o Mini" },
  { id: "gpt-4o", labelKey: "model_label_balanced", labelShort: "GPT-4o" },
  { id: "gpt-4-turbo", labelKey: "model_label_best", labelShort: "GPT-4 Turbo" },
  { id: "o1-preview", labelKey: "model_label_advanced", labelShort: "o1-preview" },
];

function getCreativityLabel(value: number, t: (key: string) => string): string {
  if (value <= 0.2) return t("creativity_very_precise");
  if (value <= 0.5) return t("creativity_slightly_precise");
  if (value <= 0.7) return t("creativity_balanced");
  return t("creativity_creative");
}

const TEST_BUTTON_CLASSES: Record<string, string> = {
  success: "bg-success text-on-success",
  fail: "bg-error text-on-error",
};

const TEST_ICON: Record<string, string> = {
  loading: "progress_activity",
  success: "check_circle",
  fail: "error",
};

interface SettingsAiTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
  onToast: (message: string, type: "success" | "error") => void;
}

export default function SettingsAiTab({ onDirtyChange, onSavingChange, onToast }: SettingsAiTabProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "fail">("idle");

  const { aiSettings, saveAiSettings, testAiConnection } = useSettingsStore();

  const [aiForm, setAiForm] = useState({
    endpointUrl: "",
    apiKey: "",
    model: "gpt-4o",
    temperature: 0.4,
  });
  const [aiFormInitial, setAiFormInitial] = useState(aiForm);

  const { fetchAiSettings } = useSettingsStore();

  useEffect(() => {
    if (aiSettings) {
      const form = {
        endpointUrl: aiSettings.endpointUrl ?? "",
        apiKey: "",
        model: aiSettings.model ?? "gpt-4o",
        temperature: aiSettings.temperature ?? 0.4,
      };
      setAiForm(form);
      setAiFormInitial(form);
    }
  }, [aiSettings]);

  async function handleTestConnection() {
    setTestStatus("loading");
    const result = await testAiConnection();
    setTestStatus(result.success ? "success" : "fail");
    setTimeout(() => setTestStatus("idle"), 3000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!aiForm.endpointUrl.trim()) {
      onToast(t("settings_error_endpoint_required"), "error");
      return;
    }
    setSaving(true);
    onSavingChange(true);
    try {
      await saveAiSettings(aiForm);
      setAiFormInitial({ ...aiForm });
      onDirtyChange(false);
      onToast(t("ai_config_saved"), "success");
    } catch {
      onToast(t("settings_save_error"), "error");
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  function handleCancel() {
    setAiForm({ ...aiFormInitial });
    onDirtyChange(false);
  }

  function markDirty() {
    onDirtyChange(true);
  }

  const isTesting = testStatus === "loading";

  return (
    <form className="space-y-6" onSubmit={handleSubmit} ref={formRef}>
      <div className="rounded-2xl bg-surface-container-low p-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="block font-semibold text-on-surface text-sm" htmlFor="ai-endpoint">
              {t("ai_endpoint_label")}
              <span aria-hidden="true" className="ms-0.5 text-error">*</span>
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="ai-endpoint"
              onChange={(e) => { setAiForm((f) => ({ ...f, endpointUrl: e.target.value })); markDirty(); }}
              placeholder="https://api.openai.com/v1"
              required
              type="url"
              value={aiForm.endpointUrl}
            />
            <p className="text-on-surface-variant text-xs">{t("ai_endpoint_hint")}</p>
          </div>
          <div className="space-y-2">
            <label className="block font-semibold text-on-surface text-sm" htmlFor="ai-key">
              {t("ai_key_label")}
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 pe-12 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="ai-key"
                onChange={(e) => { setAiForm((f) => ({ ...f, apiKey: e.target.value })); markDirty(); }}
                placeholder="sk-••••••••••••••"
                type={showApiKey ? "text" : "password"}
                value={aiForm.apiKey}
              />
              <button
                aria-label={showApiKey ? t("auth_hide_password") : t("auth_show_password")}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                onClick={() => setShowApiKey(!showApiKey)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showApiKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <p className="text-on-surface-variant text-xs">{t("ai_key_hint")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-container-low p-5">
        <div className="space-y-2">
          <label className="block font-semibold text-on-surface text-sm" htmlFor="ai-model">
            {t("analytical_model")}
          </label>
          <div className="relative">
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 pe-10 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="ai-model"
              onChange={(e) => { setAiForm((f) => ({ ...f, model: e.target.value })); markDirty(); }}
              value={aiForm.model}
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{t(m.labelKey)}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">expand_more</span>
            </span>
          </div>
        </div>
        <button
          aria-expanded={showAdvanced}
          className="mt-4 flex items-center gap-2 text-on-surface-variant text-sm transition-colors hover:text-primary"
          onClick={() => setShowAdvanced(!showAdvanced)}
          type="button"
        >
          <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}>
            expand_more
          </span>
          {t("advanced_settings")}
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-on-surface text-sm" htmlFor="ai-temp">
                {t("ai_creativity_label")}
              </label>
              <span className="font-mono font-semibold text-primary text-sm">
                {aiForm.temperature.toFixed(1)}
              </span>
            </div>
            <input
              aria-labelledby="ai-temp"
              aria-valuetext={getCreativityLabel(aiForm.temperature, t)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-outline-variant/30 accent-primary"
              id="ai-temp"
              max="1"
              min="0"
              onChange={(e) => { setAiForm((f) => ({ ...f, temperature: Number.parseFloat(e.target.value) })); markDirty(); }}
              step="0.1"
              type="range"
              value={aiForm.temperature}
            />
            <div className="flex justify-between text-on-surface-variant text-xs">
              <span>{t("precise")}</span>
              <span>{t("creative")}</span>
            </div>
            <p className="text-on-surface-variant text-xs leading-relaxed">{t("temperature_note")}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          className={`flex min-h-11 items-center gap-2 rounded-xl px-6 py-3 font-bold text-sm transition-all ${TEST_BUTTON_CLASSES[testStatus] ?? "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
          disabled={isTesting}
          onClick={handleTestConnection}
          type="button"
        >
          <span className={`material-symbols-outlined text-[18px] ${isTesting ? "animate-spin" : ""}`}>
            {TEST_ICON[testStatus] ?? "network_check"}
          </span>
          {isTesting ? t("testing_connection") : t("test_connection")}
        </button>
        {testStatus === "success" && <span className="font-medium text-sm text-success">{t("connection_success")}</span>}
        {testStatus === "fail" && <span className="font-medium text-error text-sm">{t("connection_failed")}</span>}
      </div>

      <div className="rounded-2xl bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">psychology</span>
          <div>
            <p className="font-semibold text-on-surface text-sm">{t("ai_memory_title")}</p>
            <p className="mt-0.5 max-w-prose text-on-surface-variant text-xs leading-relaxed">{t("ai_memory_desc")}</p>
          </div>
        </div>
      </div>
    </form>
  );
}
```

**Note:** The exact JSX must be copied from the `renderAiSection()` function in `settings/index.tsx` (lines 555-756). The code above shows the structural approach — the implementer should copy the exact JSX from the original to preserve all styling and behavior.

- [ ] **Step 2: Verify by running lint**

Run: `pnpm check`
Expected: No errors related to the new file

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/settings/settings-ai-tab.tsx
git commit -m "refactor(settings): extract SettingsAiTab component"
```

---

### Task 2.2: Extract SettingsShopTab

**Files:**
- Create: `src/components/modules/settings/settings-shop-tab.tsx`

- [ ] **Step 1: Create settings-shop-tab.tsx**

Create `src/components/modules/settings/settings-shop-tab.tsx` following the same pattern. Copy the JSX from `renderShopSection()` (lines 759-886). The component manages its own `shopForm` state and delegates `onDirtyChange`, `onSavingChange`, and `onToast` callbacks.

Interface:

```tsx
interface SettingsShopTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
  onToast: (message: string, type: "success" | "error") => void;
}
```

Copy the entire form JSX from `renderShopSection()`, including the `shopName`, `phone`, `address`, `currency`, and `receiptFooter` fields.

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/settings/settings-shop-tab.tsx
git commit -m "refactor(settings): extract SettingsShopTab component"
```

---

### Task 2.3: Extract SettingsNotificationsTab

**Files:**
- Create: `src/components/modules/settings/settings-notifications-tab.tsx`

- [ ] **Step 1: Create settings-notifications-tab.tsx**

Copy the JSX from `renderNotificationsSection()` (lines 955-972) and `renderTemplateGroup()` (lines 888-953). This is the simplest tab — it only reads `notificationTemplates` from the store and renders them grouped by channel.

Interface:

```tsx
interface SettingsNotificationsTabProps {
  onEditTemplate: (template: NotificationTemplate) => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/settings/settings-notifications-tab.tsx
git commit -m "refactor(settings): extract SettingsNotificationsTab component"
```

---

### Task 2.4: Extract SettingsUsersTab

**Files:**
- Create: `src/components/modules/settings/settings-users-tab.tsx`

- [ ] **Step 1: Create settings-users-tab.tsx**

Copy the JSX from `renderUsersSection()` (lines 974-1034) and the `UserRow` component (lines 90-189), `ROLE_CONFIG` constant (lines 46-53), `UserRowData` type (lines 81-88).

Interface:

```tsx
interface SettingsUsersTabProps {
  onAddUser: () => void;
  onEditUser: (userId: string) => void;
  onResetPassword: (userId: string, username: string) => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/settings/settings-users-tab.tsx
git commit -m "refactor(settings): extract SettingsUsersTab component with UserRow"
```

---

### Task 2.5: Rewrite settings/index.tsx as shell

**Files:**
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Rewrite the shell**

Replace the entire `SettingsPage` component with a slim shell that:
- Manages `activeTab`, `dirtyTabs`, `pendingTab`, `saving`, `toast` state
- Renders the tab list navigation
- Delegates to the four extracted tab components
- Handles the unsaved-changes dialog and toast

Remove `renderAiSection`, `renderShopSection`, `renderNotificationsSection`, `renderUsersSection`, `renderTemplateGroup`, `UserRow`, `ROLE_CONFIG`, `UserRowData`, `AI_MODELS`, `TEST_BUTTON_CLASSES`, `TEST_ICON`, `getCreativityLabel` — all moved to the tab components.

Import the new tab components:

```tsx
import SettingsAiTab from "@/components/modules/settings/settings-ai-tab";
import SettingsShopTab from "@/components/modules/settings/settings-shop-tab";
import SettingsNotificationsTab from "@/components/modules/settings/settings-notifications-tab";
import SettingsUsersTab from "@/components/modules/settings/settings-users-tab";
```

Replace the `sectionRenderers` object with conditional rendering:

```tsx
{activeTab === "ai" && (
  <SettingsAiTab
    onDirtyChange={(d) => markTabDirty("ai", d)}
    onSavingChange={setSaving}
    onToast={(msg, type) => showToast(msg, type)}
  />
)}
{activeTab === "shop" && (
  <SettingsShopTab
    onDirtyChange={(d) => markTabDirty("shop", d)}
    onSavingChange={setSaving}
    onToast={(msg, type) => showToast(msg, type)}
  />
)}
{activeTab === "notifications" && (
  <SettingsNotificationsTab
    onEditTemplate={(tpl) => setEditingTemplate(tpl)}
  />
)}
{activeTab === "users" && (
  <SettingsUsersTab
    onAddUser={() => setShowAddUserModal(true)}
    onEditUser={(id) => navigate(`/profile/${id}`)}
    onResetPassword={(id, username) => { setResetTarget({ id, username }); setShowResetModal(true); }}
  />
)}
```

Update `markTabDirty` to accept a boolean:

```tsx
function markTabDirty(tab: SettingsTab, isDirty = true) {
  setDirtyTabs((prev) => {
    const next = new Set(prev);
    if (isDirty) next.add(tab);
    else next.delete(tab);
    return next;
  });
}
```

- [ ] **Step 2: Verify lint check passes**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Run dev server and visually verify**

Run: `pnpm dev`
Verify: Each settings tab renders correctly with no behavioral regression

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/index.tsx
git commit -m "refactor(settings): convert page to shell, delegate to extracted tab components"
```

---

## Phase 3: Test Coverage Expansion

### Task 3.1: Notification renderer tests

**Files:**
- Create: `server/__tests__/notification-renderer.test.ts`

- [ ] **Step 1: Write tests**

Create `server/__tests__/notification-renderer.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { renderTemplate } from "../services/notification-renderer.js";

describe("renderTemplate", () => {
  it("replaces {{key}} placeholders with values", () => {
    const result = renderTemplate(
      "Hello {{name}}, your job {{jobCode}} is ready.",
      { name: "Ahmed", jobCode: "REP-001" }
    );
    expect(result).toBe("Hello Ahmed, your job REP-001 is ready.");
  });

  it("replaces missing keys with empty string", () => {
    const result = renderTemplate("Hello {{name}}", {});
    expect(result).toBe("Hello ");
  });

  it("handles template with no placeholders", () => {
    const result = renderTemplate("No placeholders here", {});
    expect(result).toBe("No placeholders here");
  });

  it("handles repeated placeholders", () => {
    const result = renderTemplate("{{a}} and {{a}}", { a: "X" });
    expect(result).toBe("X and X");
  });

  it("handles empty template body", () => {
    const result = renderTemplate("", { name: "test" });
    expect(result).toBe("");
  });

  it("ignores placeholders that are not in vars", () => {
    const result = renderTemplate("{{unknown}}", { other: "val" });
    expect(result).toBe("");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- server/__tests__/notification-renderer.test.ts`
Expected: All 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add server/__tests__/notification-renderer.test.ts
git commit -m "test: add notification-renderer unit tests"
```

---

### Task 3.2: Notification sender tests

**Files:**
- Create: `server/__tests__/notification-sender.test.ts`

- [ ] **Step 1: Read the notification-sender source**

Read `server/services/notification-sender.ts` to understand the exact function signatures and dependencies.

- [ ] **Step 2: Write tests**

Create `server/__tests__/notification-sender.test.ts`. Mock external HTTP calls (WhatsApp API). Test:
- WhatsApp send with valid token returns success
- WhatsApp send with invalid token returns failure
- SMS mock send returns success
- Missing phone number returns error

Follow the existing test pattern from `server/__tests__/customers-update.test.ts`: build a Fastify app, mock service dependencies with `vi.mock`.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/notification-sender.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/notification-sender.test.ts
git commit -m "test: add notification-sender unit tests"
```

---

### Task 3.3: Notification outbox tests

**Files:**
- Create: `server/__tests__/notification-outbox.test.ts`

- [ ] **Step 1: Read the outbox service source**

Read `server/services/notification-outbox.service.ts` to understand the polling worker, retry logic, and status tracking.

- [ ] **Step 2: Write tests**

Create `server/__tests__/notification-outbox.test.ts`. Test:
- Queue a notification creates an outbox entry with QUEUED status
- Process pending entries sends and updates to SENT
- Failed send updates to FAILED and increments retry count
- Max retries marks entry as FAILED permanently
- getOutboxLogs returns ordered logs

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/notification-outbox.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/notification-outbox.test.ts
git commit -m "test: add notification-outbox service tests"
```

---

### Task 3.4: Audit service tests

**Files:**
- Create: `server/__tests__/audit.service.test.ts`

- [ ] **Step 1: Read the audit service source**

Read `server/services/audit.service.ts` (35 lines — simple log creation).

- [ ] **Step 2: Write tests**

Create `server/__tests__/audit.service.test.ts`. Test:
- Creates audit log entry with correct fields
- Handles null userId

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/audit.service.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/audit.service.test.ts
git commit -m "test: add audit service tests"
```

---

### Task 3.5: Job photos service tests

**Files:**
- Create: `server/__tests__/job-photos.service.test.ts`

- [ ] **Step 1: Read the photos service source**

Read `server/services/job-photos.service.ts` (137 lines).

- [ ] **Step 2: Write tests**

Create `server/__tests__/job-photos.service.test.ts`. Test:
- Upload adds a photo to a job
- Delete removes a photo
- Max 5 photos enforcement rejects 6th upload
- Nonexistent job returns null/error

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/job-photos.service.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/job-photos.service.test.ts
git commit -m "test: add job-photos service tests"
```

---

### Task 3.6: Avatar service tests

**Files:**
- Create: `server/__tests__/avatar.service.test.ts`

- [ ] **Step 1: Read the avatar service source**

Read `server/services/avatar.service.ts` (83 lines).

- [ ] **Step 2: Write tests**

Create `server/__tests__/avatar.service.test.ts`. Test:
- Upload saves avatar and returns path
- Upload resizes if needed
- Remove deletes avatar file and clears path
- Nonexistent user returns error

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/avatar.service.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/avatar.service.test.ts
git commit -m "test: add avatar service tests"
```

---

### Task 3.7: Job waiting parts service tests

**Files:**
- Create: `server/__tests__/job-waiting-parts.service.test.ts`

- [ ] **Step 1: Read the service source**

Read `server/services/job-waiting-parts.service.ts` (64 lines).

- [ ] **Step 2: Write tests**

Create `server/__tests__/job-waiting-parts.service.test.ts`. Test:
- Add waiting part to job
- Remove waiting part from job
- List waiting parts for a job

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/job-waiting-parts.service.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/job-waiting-parts.service.test.ts
git commit -m "test: add job-waiting-parts service tests"
```

---

### Task 3.8: Dashboard service tests

**Files:**
- Create: `server/__tests__/dashboard.service.test.ts`

- [ ] **Step 1: Read the dashboard service source**

Read `server/services/dashboard.service.ts` (558 lines — most complex service).

- [ ] **Step 2: Write tests**

Create `server/__tests__/dashboard.service.test.ts`. Test:
- Owner dashboard returns correct financial metrics
- Technician dashboard returns assigned jobs
- Front desk dashboard returns intake queue
- Handles empty data gracefully
- Date range filtering works

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/dashboard.service.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/dashboard.service.test.ts
git commit -m "test: add dashboard service tests"
```

---

### Task 3.9: Jobs store tests

**Files:**
- Create: `src/stores/__tests__/jobs.test.ts`

- [ ] **Step 1: Write tests for useJobsStore**

Create `src/stores/__tests__/jobs.test.ts`:

```typescript
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/api", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/i18n", () => ({
  default: { t: (key: string) => key },
}));

import { useJobsStore } from "../jobs";

describe("useJobsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useJobsStore.setState({
      jobs: [],
      metrics: null,
      totalCount: 0,
      nextCursor: null,
      isLoadingJobs: false,
      isLoadingMetrics: false,
      isCreatingJob: false,
      error: null,
    });
  });

  it("fetchJobs sets jobs from API response", async () => {
    mockGet.mockResolvedValue({
      data: {
        jobs: [{ id: "1", jobCode: "REP-001" }],
        nextCursor: "cursor-1",
        totalCount: 1,
      },
    });

    await act(async () => {
      await useJobsStore.getState().fetchJobs();
    });

    const state = useJobsStore.getState();
    expect(state.jobs).toHaveLength(1);
    expect(state.nextCursor).toBe("cursor-1");
    expect(state.totalCount).toBe(1);
    expect(state.isLoadingJobs).toBe(false);
  });

  it("fetchJobs handles error", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      await useJobsStore.getState().fetchJobs();
    });

    const state = useJobsStore.getState();
    expect(state.error).toBe("Network error");
    expect(state.isLoadingJobs).toBe(false);
  });

  it("createJob adds job to list", async () => {
    const newJob = { id: "2", jobCode: "REP-002" };
    mockPost.mockResolvedValue({ data: newJob });

    const result = await useJobsStore.getState().createJob({
      customerName: "Test",
      customerPhone: "0555123456",
      deviceBrand: "Apple",
      deviceModel: "iPhone 15",
      reportedProblem: "Screen broken",
      estimatedCost: 5000,
    });

    expect(result).toEqual(newJob);
    expect(useJobsStore.getState().jobs).toHaveLength(1);
  });

  it("transitionStatus updates job in list", async () => {
    useJobsStore.setState({ jobs: [{ id: "1", jobCode: "REP-001", status: "INTAKE" } as any] });
    mockPatch.mockResolvedValue({ data: { id: "1", jobCode: "REP-001", status: "IN_REPAIR" } });

    await useJobsStore.getState().transitionStatus("1", "IN_REPAIR" as any);

    expect(useJobsStore.getState().jobs[0].status).toBe("IN_REPAIR");
  });

  it("clearError resets error state", () => {
    useJobsStore.setState({ error: "Some error" });
    useJobsStore.getState().clearError();
    expect(useJobsStore.getState().error).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- src/stores/__tests__/jobs.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/stores/__tests__/jobs.test.ts
git commit -m "test: add useJobsStore unit tests"
```

---

### Task 3.10: Settings store tests

**Files:**
- Create: `src/stores/__tests__/settings.test.ts`

- [ ] **Step 1: Write tests for useSettingsStore**

Create `src/stores/__tests__/settings.test.ts`. Test:
- `fetchAiSettings` populates `aiSettings`
- `saveAiSettings` calls API and refreshes
- `fetchShopSettings` populates `shopSettings`
- `fetchNotificationTemplates` populates `notificationTemplates`
- Error handling on API failure

Follow the same mocking pattern as the jobs store tests.

- [ ] **Step 2: Run tests**

Run: `pnpm test -- src/stores/__tests__/settings.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/stores/__tests__/settings.test.ts
git commit -m "test: add useSettingsStore unit tests"
```

---

### Task 3.11: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All existing + new tests pass

- [ ] **Step 2: Commit (only if fixes needed)**

If any fixes were needed to make tests pass:

```bash
git add -A
git commit -m "fix: resolve test failures from new test coverage"
```

---

## Phase 4: Minor Fixes

### Task 4.1: Remove dead Daily Summary button

**Files:**
- Modify: `src/pages/dashboard/index.tsx`

- [ ] **Step 1: Remove the dead button**

In `src/pages/dashboard/index.tsx`, find the button block (around lines 53-61) that renders the Daily Summary button (has `t("daily_summary")` and no `onClick`). Remove the entire `<button>...</button>` element.

- [ ] **Step 2: Remove the i18n key**

In `src/i18n/locales/en.json`, find and remove the `"daily_summary"` key. Then run `pnpm run sync-locales` to propagate.

- [ ] **Step 3: Run lint check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/index.tsx src/i18n/locales/
git commit -m "fix(dashboard): remove dead Daily Summary button"
```

---

### Task 4.2: Add countryCode to ShopSettings + dynamic phone placeholder

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/services/settings.service.ts`
- Modify: `src/components/modules/settings/settings-shop-tab.tsx`

- [ ] **Step 1: Add countryCode to Prisma schema**

In `prisma/schema.prisma`, find the `ShopSettings` model (line 526). Add after the `phone` field:

```
countryCode String   @default("DZ")
```

- [ ] **Step 2: Create migration**

Run: `pnpm db:migrate -- --name add_country_code_to_shop_settings`

- [ ] **Step 3: Add phone format lookup utility**

Create `src/lib/phone-formats.ts`:

```typescript
const PHONE_FORMATS: Record<string, string> = {
  DZ: "+213 XX XXX XXXX",
  FR: "+33 X XX XX XX XX",
  US: "+1 (XXX) XXX-XXXX",
  GB: "+44 XXXX XXXXXX",
  DE: "+49 XXX XXXXXXX",
  TN: "+216 XX XXX XXX",
  MA: "+212 XX XXX XXXX",
};

export function getPhonePlaceholder(countryCode?: string): string {
  if (!countryCode) return "+X XXX XXX XXXX";
  return PHONE_FORMATS[countryCode.toUpperCase()] ?? "+X XXX XXX XXXX";
}
```

- [ ] **Step 4: Update settings-shop-tab to use dynamic placeholder**

In `src/components/modules/settings/settings-shop-tab.tsx`, import `getPhonePlaceholder` and replace the hardcoded `placeholder="+213 XX XXX XXXX"` with:

```tsx
placeholder={getPhonePlaceholder(shopForm.countryCode)}
```

Add a `countryCode` field to the shop form state:

```typescript
const [shopForm, setShopForm] = useState({
  shopName: "",
  address: "",
  phone: "",
  countryCode: "DZ",
  currency: "DZD",
  receiptFooter: "",
});
```

Add a country code select field in the Regional Settings section, alongside the currency selector.

- [ ] **Step 5: Add i18n keys**

Add to `en.json`:

```json
"country_code": "Country code",
"phone_placeholder_default": "+X XXX XXX XXXX"
```

Run `pnpm run sync-locales`.

- [ ] **Step 6: Run lint check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/lib/phone-formats.ts src/components/modules/settings/ src/i18n/locales/ server/
git commit -m "feat(settings): add countryCode to ShopSettings with dynamic phone placeholder"
```

---

### Task 4.3: Upgrade notification renderer with conditionals and locale formatting

**Files:**
- Modify: `server/services/notification-renderer.ts`
- Modify: `server/__tests__/notification-renderer.test.ts`

- [ ] **Step 1: Upgrade the renderer**

Replace `server/services/notification-renderer.ts`:

```typescript
const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;
const CONDITIONAL_RE = /\{\{if\s+(\w+)\}\}([\s\S]*?)\{\{endif\}\}/g;

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function renderTemplate(
  body: string,
  vars: Record<string, string | number>,
  locale = "en"
): string {
  let result = body;

  result = result.replace(CONDITIONAL_RE, (_match, key: string, content: string) => {
    const value = vars[key];
    if (value === undefined || value === null || value === "" || value === 0) {
      return "";
    }
    return content;
  });

  const processedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === "number") {
      processedVars[key] = formatNumber(value, locale);
    } else if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(value) &&
      !isNaN(Date.parse(value))
    ) {
      processedVars[key] = formatDate(value, locale);
    } else {
      processedVars[key] = String(value ?? "");
    }
  }

  result = result.replace(TEMPLATE_VAR_RE, (_match, key: string) => processedVars[key] ?? "");

  return result;
}
```

- [ ] **Step 2: Update renderer tests**

Add new test cases to `server/__tests__/notification-renderer.test.ts`:

```typescript
describe("renderTemplate conditionals", () => {
  it("renders content inside {if key} when key is truthy", () => {
    const result = renderTemplate(
      "{{if warranty}}Warranty until {{warrantyDate}}{{endif}}",
      { warranty: "yes", warrantyDate: "2025-12-01" }
    );
    expect(result).toContain("Warranty until");
  });

  it("hides content inside {if key} when key is empty", () => {
    const result = renderTemplate(
      "{{if warranty}}Warranty until {{warrantyDate}}{{endif}}",
      { warranty: "", warrantyDate: "2025-12-01" }
    );
    expect(result).not.toContain("Warranty");
  });

  it("hides content when key is undefined", () => {
    const result = renderTemplate(
      "{{if notes}}Notes: {{notes}}{{endif}}",
      {}
    );
    expect(result).not.toContain("Notes");
  });
});

describe("renderTemplate locale formatting", () => {
  it("formats numbers with locale", () => {
    const result = renderTemplate("Cost: {{cost}}", { cost: 5000 }, "fr");
    expect(result).toContain("5");
  });

  it("formats ISO date strings with locale", () => {
    const result = renderTemplate("Date: {{date}}", { date: "2025-01-15" }, "fr");
    expect(result).toContain("2025");
  });

  it("does not format regular strings as dates", () => {
    const result = renderTemplate("Code: {{code}}", { code: "REP-2025-001" });
    expect(result).toBe("Code: REP-2025-001");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- server/__tests__/notification-renderer.test.ts`
Expected: All tests pass

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/services/notification-renderer.ts server/__tests__/notification-renderer.test.ts
git commit -m "feat(renderer): add conditional blocks and locale-aware number/date formatting"
```

---

### Task 4.4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run lint check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve final verification issues"
```