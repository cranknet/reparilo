# Quickstart: Notification System SSOT

**Branch**: `001-notification-ssot` | **Date**: 2026-04-29

## Architecture Overview

```
                    ┌─────────────┐
  Job Events ──────→│             │
  Overdue Event ───→│  notify()   │──→ IN_APP handler ──→ DB write + WebSocket push
  Warranty Event ──→│  (single    │
  Future events ───→│   entry)    │──→ WHATSAPP handler ──→ renderTemplate → queueNotification → outbox
                    └─────────────┘
```

## Key Concepts

### 1. Unified Dispatch (`notify()`)

Every notification in the system goes through a single `notify()` function in `server/services/notification-dispatch.ts`. This function:

- Accepts an `eventName` (e.g., `"JOB_OVERDUE"`), a `context` (job, customer, variables), and `recipient` info
- Looks up templates matching the event name across all channels
- Fans out to each channel's handler

### 2. Channel Handlers

Each `NotifyChannel` has a handler implementing a common interface:

```
ChannelHandler = {
  handle(prisma, event, template, context) => Promise<void>
}
```

- `IN_APP`: Creates `InAppNotification` rows per recipient + pushes via WebSocket
- `WHATSAPP`: Renders template, creates `NotificationOutbox` row (existing outbox worker processes it)

### 3. Persistent In-App Notifications

In-app alerts are stored in the `InAppNotification` table, not ephemeral Zustand state. They survive page refreshes and are accessible across devices.

### 4. 30-Day Auto-Cleanup

Read notifications where `readAt < now() - 30 days` are deleted by a periodic cleanup job running alongside the outbox worker.

## Call Site Migration

| File | Before | After |
|------|--------|-------|
| `job.service.ts:282-293` | `triggerNotification(prisma, { templateName: "job_created", ... })` | `notify(app, { eventName: "job_created", ... })` |
| `job.service.ts:448-463` | `triggerNotification(prisma, { templateName, ... })` | `notify(app, { eventName: templateName, ... })` |
| `overdue-scheduler.ts:44-47` | `app.wsBroadcast(c => c.role === "OWNER", { type: "JOB_OVERDUE", ... })` | `notify(app, { eventName: "job_overdue", recipients: { role: "OWNER" }, ... })` |
| `jobs.ts:260-267` | `app.wsBroadcast(c => c.role === "OWNER", { type: "WARRANTY_RETURN_CREATED", ... })` | `notify(app, { eventName: "warranty_return_created", recipients: { role: "OWNER" }, ... })` |

## File Changes Summary

### New Files
- `server/services/notification-dispatch.ts` — unified `notify()` + channel handlers
- `shared/constants/action-icons.ts` — shared `ACTION_ICONS` mapping
- `src/components/modules/notifications/alert-list.tsx` — decomposed alert list component
- `src/components/modules/notifications/channel-settings.tsx` — decomposed channel settings component
- `src/components/modules/notifications/outbox-log.tsx` — decomposed outbox log component

### Deleted Files
- `server/lib/dashboard-events.ts` — absorbed into notification-dispatch

### Modified Files
- `server/services/notification-outbox.service.ts` — remove SMS dead path
- `server/services/notification-sender.ts` — remove SMS dead path
- `server/services/settings.service.ts` — remove `getNotificationTemplates`, `updateNotificationTemplate` (moved to notifications route directly or kept if still used by other settings)
- `server/services/job.service.ts` — replace `triggerNotification` with `notify()`
- `server/routes/notifications.ts` — add in-app notification CRUD routes, keep template + outbox routes
- `server/routes/settings.ts` — remove duplicate template routes (lines 93-122)
- `server/routes/jobs.ts` — replace `wsBroadcast` with `notify()`
- `server/jobs/overdue-scheduler.ts` — replace `wsBroadcast`/`emitDashboardChanged` with `notify()`
- `server/index.ts` — update imports, start notification cleanup worker
- `shared/schemas/notification.schema.ts` — replace with proper in-app notification schemas
- `shared/schemas/settings.schema.ts` — remove SMS from channel enum
- `shared/types/index.ts` — add `InAppNotification` type
- `prisma/schema.prisma` — add `InAppNotification` model, update `NotifyChannel` enum
- `src/pages/notifications/index.tsx` — decompose into sub-components (under 200 lines)
- `src/components/modules/settings/template-editor.tsx` — fix `{var}` → `{{var}}`
- `src/components/modules/top-bar.tsx` — use persisted notifications + DB badge count
- `src/components/modules/jobs/status-history-timeline.tsx` — import shared `ACTION_ICONS`
- `src/components/modules/profile/activity-timeline.tsx` — import shared `ACTION_ICONS`
- `src/stores/alerts.ts` — API-backed store for persisted notifications
- `src/stores/settings.ts` — update API paths from `/settings/` to `/notifications/`

## Verification Checklist

After implementation, verify:

1. `notify()` is the only way to send notifications — grep for direct `wsBroadcast` calls in notification contexts returns zero results
2. No duplicate template routes exist — `grep -r "notifications/templates" server/routes/settings.ts` returns nothing
3. Template editor inserts `{{var}}` — check `TEMPLATE_VARIABLES` in template-editor.tsx
4. No SMS references remain — `rg "SMS" shared/ src/ server/ --type ts`
5. `ACTION_ICONS` defined once — `rg "ACTION_ICONS" shared/ src/ --type ts`
6. In-app notifications survive page refresh — manual test
7. All existing WhatsApp notifications still send — manual test with test-send button
8. `pnpm check` passes with zero warnings