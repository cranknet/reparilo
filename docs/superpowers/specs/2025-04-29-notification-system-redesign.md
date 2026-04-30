# Notification System Redesign — Event-Driven Registry

**Date:** 2025-04-29
**Status:** Draft

## Problem

The current notification system has:
1. **Duplicate code** — `PUT /templates/:id` handler exists in both `notifications.ts` and `settings.ts`
2. **Template syntax mismatch** — editor inserts `{customerName}` but renderer expects `{{customerName}}`
3. **Tight coupling** — `job.service.ts` has a `triggerNotification()` function with dynamic import, making it hard to trace notification logic
4. **Mixed concerns** — 673-line notifications page mixing in-app alerts with WhatsApp settings and outbox
5. **Ephemeral alerts** — lost on page refresh, no per-user read state
6. **Dead SMS channel** — enum + UI references exist but always fails with "SMS not yet implemented"
7. **Scattered WS broadcasts** — `wsBroadcast` called directly from `overdue-scheduler.ts` and `jobs.ts` routes, bypassing any notification abstraction
8. **Duplicate ACTION_ICONS** — `NOTIFICATION_SENT` icon mapping duplicated in two timeline components
9. **Unused `dashboard:invalidate` event** — broadcast but never consumed on frontend
10. **Generic error fallbacks** — notification API errors show "Failed to load settings" instead of specific messages

## Design

### Architecture

A single `notify()` function is the only entry point for triggering any notification. Business code emits a typed event; the registry routes it to the correct channel handlers.

```
Business code calls:  notify("job.created", { jobId, customer })
                             |
                     ┌───────┴───────┐
                     │  REGISTRY map  │   ← single source of truth
                     └───────┬───────┘
                 ┌───────────┼───────────┐
                 │           │           │
          WhatsAppHandler  AlertHandler  DashboardHandler
                 │           │           │
            Outbox DB    Alert DB    WebSocket
```

### File Structure

**New files:**
```
server/notifications/
  index.ts              ← re-exports: notify(), startNotificationWorker(), stopNotificationWorker()
  types.ts              ← NotificationEvent union, NotificationHandler, HandlerConfig
  registry.ts           ← REGISTRY map + notify() function + STATUS_TEMPLATE_MAP
  channels/
    whatsapp.ts         ← WhatsApp outbox channel handler
    in-app.ts           ← Persisted alert channel handler
    dashboard.ts        ← WebSocket dashboard invalidate channel handler
  renderer.ts           ← Template renderer (moved from services/)
```

**Deleted files:**
- `server/services/notification-outbox.service.ts`
- `server/services/notification-sender.ts`
- `server/services/notification-renderer.ts`
- `server/lib/dashboard-events.ts`

**Modified files:**
- `server/services/job.service.ts` — remove `triggerNotification()`, `STATUS_TEMPLATE_MAP`, use `notify()`
- `server/routes/notifications.ts` — remove duplicate PUT, add alert API endpoints
- `server/routes/settings.ts` — remove `/notifications/templates` routes
- `server/jobs/overdue-scheduler.ts` — use `notify()` instead of direct `wsBroadcast`
- `server/routes/jobs.ts` — replace `wsBroadcast` warranty return with `notify()`
- `server/index.ts` — update worker startup import path
- `prisma/schema.prisma` — add `Alert` model, remove `SMS` from `NotifyChannel`
- `shared/types/index.ts` — add `Alert` type
- `shared/schemas/notification.schema.ts` — add alert schemas
- `src/stores/alerts.ts` — rewrite: fetch from API + real-time WS, persist read state server-side
- `src/components/modules/top-bar.tsx` — use new persisted alerts store
- `src/components/modules/settings/template-editor.tsx` — fix `{{}}` syntax, remove SMS option
- `src/components/modules/settings/settings-notifications-tab.tsx` — remove SMS filter group
- `src/pages/notifications/index.tsx` — use persisted alerts from API, split concerns

### Event Types

```ts
type NotificationEvent =
  | { type: "job.created"; jobId: string; jobCode: string; customerPhone: string; customerName: string }
  | { type: "job.status_changed"; jobId: string; jobCode: string; customerPhone: string; customerName: string; newStatus: string }
  | { type: "job.overdue"; jobId: string; jobCode: string }
  | { type: "warranty.return"; jobId: string; jobCode: string }
```

### Registry

```ts
const REGISTRY: Record<NotificationEvent["type"], HandlerConfig[]> = {
  "job.created": [
    { channel: "whatsapp", getTemplate: () => "job_created" },
  ],
  "job.status_changed": [
    { channel: "whatsapp", getTemplate: (e) => STATUS_TEMPLATE_MAP[e.newStatus] },
  ],
  "job.overdue": [
    { channel: "in-app", alertType: "JOB_OVERDUE", targets: ["OWNER"] },
    { channel: "dashboard", targets: ["OWNER", "FRONT_DESK"] },
  ],
  "warranty.return": [
    { channel: "in-app", alertType: "WARRANTY_RETURN_CREATED", targets: ["OWNER"] },
    { channel: "dashboard", targets: ["OWNER", "FRONT_DESK"] },
  ],
};
```

### `notify()` Function

```ts
async function notify(prisma: PrismaClient, app: FastifyInstance, event: NotificationEvent): Promise<void> {
  const configs = REGISTRY[event.type] ?? [];
  for (const config of configs) {
    switch (config.channel) {
      case "whatsapp": await handleWhatsApp(prisma, event, config); break;
      case "in-app":   await handleInApp(prisma, app, event, config); break;
      case "dashboard": handleDashboard(app, event, config); break;
    }
  }
}
```

This is the **single entry point**. All notification triggering flows through here.

### Channel Handlers

#### WhatsApp (`channels/whatsapp.ts`)
- Finds template by name + WHATSAPP channel
- If template name resolves to `undefined` (e.g., unmapped status), **skips silently** — no notification sent
- If customer phone is missing, **skips silently**
- Renders template body using `renderTemplate()`
- Creates `NotificationOutbox` entry (status: QUEUED)
- Outbox worker polls and sends via WhatsApp Business API (same logic as current, extracted cleanly)
- Includes `formatPhone()` and `sendWhatsApp()` (moved from deleted `notification-sender.ts`)

#### In-App (`channels/in-app.ts`)
- **New** — creates `Alert` rows in the database
- For each target role, creates an alert row (or a single broadcast row with `role` set and `userId` null)
- Broadcasts a `{ type: "ALERT_CREATED", alert }` WS message to matching role clients for real-time delivery
- Also broadcasts to the specific alert's target role

#### Dashboard (`channels/dashboard.ts`)
- Extracted from `dashboard-events.ts`
- Calls `wsBroadcast()` with role/technician targeting
- Same `dashboard:invalidate` payload

### Database Changes

#### New `Alert` model

```prisma
model Alert {
  id        String   @id @default(cuid())
  type      String
  message   String
  jobId     String?
  jobCode   String?
  userId    String?
  role      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now()) @db.Timestamptz

  job      Job?     @relation(fields: [jobId], references: [id], onDelete: Cascade)
  user     User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, read])
  @@index([role, createdAt])
  @@map("alerts")
}
```

#### `NotifyChannel` enum

Remove `SMS`, keep only `WHATSAPP`.

```prisma
enum NotifyChannel {
  WHATSAPP
}
```

### API Endpoints

**Alerts (new):**
- `GET /api/notifications/alerts` — fetch current user's alerts (ordered by createdAt desc), requires `notifications:read`
- `PATCH /api/notifications/alerts/:id/read` — mark single alert as read, requires `notifications:read`
- `PATCH /api/notifications/alerts/read-all` — mark all user's alerts as read, requires `notifications:read`

**Templates (consolidated, duplicate removed):**
- `GET /api/notifications/templates` — list templates (kept from `notifications.ts`)
- `PUT /api/notifications/templates/:id` — update template (kept from `notifications.ts`, duplicate in `settings.ts` removed)
- `POST /api/notifications/test/:templateId` — test send (kept from `notifications.ts`)

**Outbox (kept as-is):**
- `GET /api/notifications/outbox` — outbox logs (kept from `notifications.ts`)

**Removed from settings.ts:**
- `GET /api/settings/notifications/templates` — removed (duplicate)
- `PUT /api/settings/notifications/templates/:id` — removed (duplicate)

### Frontend Changes

#### `src/stores/alerts.ts` (rewrite)
- Fetches alerts from `GET /api/notifications/alerts` on init
- `addAlert()` still handles real-time WS pushes (`ALERT_CREATED` events)
- `markRead()` calls `PATCH /api/notifications/alerts/:id/read`
- `markAllRead()` calls `PATCH /api/notifications/alerts/read-all`
- `dismissAlert()` marks alert as read on server (same as markRead), removes from local view
- Alerts persist across page refreshes since they're in the DB

#### `src/components/modules/top-bar.tsx`
- Replace `WARRANTY_RETURN_CREATED` / `JOB_OVERDUE` handlers with `ALERT_CREATED` handler
- On `ALERT_CREATED` WS message, add to alerts store via `addAlert()`

#### `src/components/modules/settings/template-editor.tsx`
- Fix `TEMPLATE_VARIABLES` to use `{{customerName}}`, `{{jobCode}}`, `{{status}}`, `{{estimatedDate}}`
- Remove SMS channel option from the channel dropdown (only WHATSAPP)

#### `src/components/modules/settings/settings-notifications-tab.tsx`
- Remove the SMS template group filter entirely
- Remove channel grouping since only WhatsApp exists — render all templates as a flat list

#### `src/pages/notifications/index.tsx`
- Alerts section fetches from persisted store (via API)
- No longer mixes ephemeral WS state with persisted state
- WhatsApp settings + outbox log sections remain

### Message Template Variables

The template editor inserts `{{variable}}` (double-brace) to match the server renderer in `notification-renderer.ts`. Available variables per template are defined centrally in the registry's `TEMPLATE_VARIABLES` map:

```ts
const TEMPLATE_VARIABLES: Record<string, string[]> = {
  job_created:        ["{{customerName}}", "{{jobCode}}", "{{shopName}}"],
  job_done:           ["{{customerName}}", "{{jobCode}}"],
  job_in_repair:      ["{{customerName}}", "{{jobCode}}"],
  job_waiting_parts:  ["{{customerName}}", "{{jobCode}}"],
  job_delivered:      ["{{customerName}}", "{{jobCode}}"],
};
```

This map is also the SSOT for what variables the backend passes to each template, making it easy to add new variables.

### What Gets Deleted

| File | Reason |
|---|---|
| `server/services/notification-outbox.service.ts` | Logic split into `notifications/channels/whatsapp.ts` and `notifications/registry.ts` |
| `server/services/notification-sender.ts` | Absorbed into `notifications/channels/whatsapp.ts` |
| `server/services/notification-renderer.ts` | Moved to `notifications/renderer.ts` |
| `server/lib/dashboard-events.ts` | Absorbed into `notifications/channels/dashboard.ts` |

### What Gets Simplified

| File | Change |
|---|---|
| `server/services/job.service.ts` | Remove `triggerNotification()`, `STATUS_TEMPLATE_MAP`, dynamic import. Replace with `notify("job.created", ...)` and `notify("job.status_changed", ...)` |
| `server/routes/settings.ts` | Remove duplicate `/notifications/templates` routes |
| `server/jobs/overdue-scheduler.ts` | Replace `wsBroadcast` + `emitDashboardChanged` with `notify("job.overdue", ...)` |
| `server/routes/jobs.ts` | Replace `wsBroadcast` warranty return + `emitDashboardChanged` with `notify("warranty.return", ...)` and `notify` for dashboard refresh |
| `prisma/schema.prisma` | Remove SMS from `NotifyChannel` enum, add `Alert` model |
| `shared/schemas/settings.schema.ts` | Remove `SMS` from `updateNotificationTemplateSchema` channel enum |
| `shared/permissions.ts` | Keep as-is (notifications permissions unchanged) |

### Seed Data

Remove any SMS templates from `prisma/seed.ts`. Only WhatsApp templates remain.

### Migration

A Prisma migration will:
1. Delete any SMS channel templates from `notification_templates` (SQL: `DELETE FROM notification_templates WHERE channel = 'SMS'`)
2. Create the `alerts` table
3. Remove `SMS` from `NotifyChannel` enum

### Tests

Existing tests to **rewrite/update**:
- `server/__tests__/notification-sender.test.ts` → rewrite for `notifications/channels/whatsapp.ts`
- `server/__tests__/notification-outbox.test.ts` → rewrite for the new registry + outbox process
- `server/__tests__/notification-renderer.test.ts` → update import path
- `server/__tests__/warranty-alert.test.ts` → update to use `notify("warranty.return", ...)` instead of direct `wsBroadcast`

New tests to add:
- `server/__tests__/notification-registry.test.ts` — test `notify()` routes events to correct handlers
- `server/__tests__/alerts-api.test.ts` — test GET/PATCH alert endpoints
- `server/__tests__/in-app-channel.test.ts` — test alert creation and WS broadcast