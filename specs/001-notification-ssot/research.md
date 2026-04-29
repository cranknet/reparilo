# Research: Notification System SSOT

**Branch**: `001-notification-ssot` | **Date**: 2026-04-29

## Research Tasks

### R1: Unified dispatch function design pattern

**Decision**: Strategy pattern with channel-specific handlers registered in a map.

**Rationale**: The `notify()` function needs to fan out to multiple channels per event. A handler map (`Record<NotifyChannel, ChannelHandler>`) allows adding new channels by registering a handler — no dispatch modification needed. Each handler implements a common interface: `handle(event, template, context) => void | Promise<void>`. Channel handlers are resolved by looking up templates for a given event name across all channels.

**Alternatives considered**:
- Event emitter pattern (publish/subscribe): Overkill for 2 channels with no cross-cutting concerns. Adds complexity with listener lifecycle management.
- Pipeline/middleware pattern: Unnecessary — notification processing is a simple fan-out, not a transformation chain.
- Direct function calls per channel: Current approach; creates the scattered dispatch problem we're solving.

### R2: In-app notification persistence model

**Decision**: New `InAppNotification` Prisma model with per-user read state. No separate `NotificationRead` table — use a single model with `readAt` timestamp per notification per user.

**Rationale**: In a single-location shop with 1-10 users, a simple model where each notification is created per-recipient-user is sufficient. The `readAt` field serves as both read state and the filter for cleanup (delete where `readAt` is not null AND `readAt` < 30 days ago). No need for a many-to-many read-state tracking table at this scale.

**Alternatives considered**:
- Broadcast + individual read-state table (one notification row, many read rows): More normalized but adds a join for every query. Unnecessary complexity for <10 users.
- JSON field for read-by user IDs on a single notification row: Doesn't scale, hard to query, prevents proper indexing.

### R3: Notification cleanup mechanism

**Decision**: Prisma-level scheduled cleanup as part of the existing outbox worker interval. Add a `cleanupReadNotifications()` function called alongside `processOutbox()` in the same 5-second polling cycle (or at a lower frequency like every 15 minutes).

**Rationale**: The app already has a long-running interval for the outbox worker. Adding notification cleanup to this same pattern keeps the architecture consistent. Running it every 15 minutes is sufficient — the 30-day threshold means exact timing doesn't matter.

**Alternatives considered**:
- PostgreSQL cron (pg_cron): Requires extension installation and adds an external dependency. Overkill for a simple delete query.
- Separate Node.js cron library: Adds a dependency for a single cleanup query.

### R4: How to handle `dashboard:invalidate` event

**Decision**: Remove the `dashboard:invalidate` broadcast from `emitDashboardChanged()`. The function itself and the `dashboard-events.ts` module are deleted — their functionality is absorbed into `notify()` for in-app notifications (which already pushes to relevant users via WebSocket). Dashboard data freshness is already ensured by the page's own query invalidation after mutations.

**Rationale**: The `dashboard:invalidate` event has zero frontend consumers. The top-bar `useWs` handler only processes `WARRANTY_RETURN_CREATED` and `JOB_OVERDUE`. Dashboard pages use TanStack Query which auto-invalidates after mutations. Keeping an unused broadcast is dead code.

**Alternatives considered**:
- Implement a frontend consumer that triggers TanStack Query invalidation: This already happens via mutation callbacks. Adding redundant WS-driven invalidation creates dual invalidation paths.
- Keep but document: Still dead code. Principle I (Simplicity First) says remove it.

### R5: Template variable syntax fix approach

**Decision**: Change `TEMPLATE_VARIABLES` in `template-editor.tsx` from `["{customerName}", "{jobCode}", "{status}", "{estimatedDate}"]` to `["{{customerName}}", "{{jobCode}}", "{{status}}", "{{estimatedDate}}"]`.

**Rationale**: The server renderer (`notification-renderer.ts`) uses `{{variable}}` double-brace syntax with regex `/\{\{(\w+)\}\}/g`. The seed data also uses `{{customerName}}`. Only the UI template editor inserts single-brace. Changing the UI to double-brace is the minimal fix that aligns all three.

**Alternatives considered**:
- Change server renderer to support both `{var}` and `{{var}}`: Makes the renderer ambiguous; a single `{` in WhatsApp message text could be mistaken for a variable.
- Change server to single-brace: Breaks all existing seeded templates and would require a data migration.

### R6: How to remove SMS from NotifyChannel enum safely

**Decision**: Remove `SMS` from `NotifyChannel` enum in Prisma schema, create a migration. Since no outbox rows use SMS (the channel always fails immediately), and no templates with SMS channel are seeded, the migration is a simple enum value drop.

**Rationale**: The Prisma migration will generate an `ALTER TYPE "NotifyChannel" DROP VALUE 'SMS'` statement. PostgreSQL supports dropping enum values since version 12. No data rows reference SMS.

**Alternatives considered**:
- Keep SMS but mark as deprecated: Still maintains dead code paths and UI elements. Violates Principle I.
- Soft-delete via application-level filtering: Adds filtering complexity everywhere for a value that is never used.

### R7: Frontend alerts store migration from ephemeral to API-backed

**Decision**: Replace the current Zustand `alerts` store with an API-backed store that: (1) fetches notifications from `GET /notifications/in-app` on mount, (2) subscribes to WebSocket for real-time pushes, (3) calls `PUT /notifications/in-app/:id/read` for marking read, (4) calls `PUT /notifications/in-app/read-all` for mark all read. The store shape stays similar but data comes from API + WS instead of being generated client-side.

**Rationale**: The current store interface (`addAlert`, `dismissAlert`, `markRead`, `markAllRead`) maps naturally to a persisted model. `addAlert` is replaced by WS-driven insertion (server pushes new notification). The store hydrates from API on load. This provides persistence without changing the consumer API significantly.

**Alternatives considered**:
- TanStack Query for notification state: Adds complexity for real-time data that arrives via WebSocket. TanStack Query is better for request/response, not push.
- Keep ephemeral store + add separate persistence layer: Two sources of truth, which is the exact problem we're solving.

### R8: ACTION_ICONS consolidation approach

**Decision**: Move `ACTION_ICONS` to a new shared constant file at `shared/constants/action-icons.ts`, export it, and import it in both timeline components. Use the icon choices from `status-history-timeline.tsx` as the canonical set (since it's the primary/primary-viewed timeline) and update `activity-timeline.tsx` to use the same values where they differ.

**Rationale**: The icon choices differ slightly between the two components (e.g., `NOTE_ADDED: "sticky_note_2"` vs `"note_add"`). Since these are stylistic differences in otherwise identical mappings, picking one as canonical eliminates the duplication without loss of functionality. The status history timeline is viewed more frequently.

**Alternatives considered**:
- Keep separate but share only `NOTIFICATION_SENT`: Still leaves 18 other duplicated entries. Doesn't solve the root problem.
- Parameterize icon choices per component: Over-engineering for what are effectively the same mappings with minor stylistic variance.

## Unresolved Items

None — all unknowns from Technical Context have been resolved.