# Feature Specification: Notification System Single Source of Truth

**Feature Branch**: `001-notification-ssot`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "current project has notification system with duplicate code, try to suggest single source of truth notification system, no duplicate, create clean code, expandable, maintanable, reusable notification system, delete any old bloat, repetitive code. do not migrate."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified Notification Dispatch (Priority: P1)

As a developer maintaining the system, I need a single entry point to send any type of notification (in-app alert, WhatsApp message, or future channels like SMS/email/push) so that adding a new notification trigger or channel requires changes in only one place.

**Why this priority**: The current system has notifications triggered through 3 different mechanisms (`triggerNotification()`, direct `wsBroadcast()`, and `emitDashboardChanged()`), creating confusion about which path to use. Consolidating dispatch is the foundational change that all other improvements depend on.

**Independent Test**: Can be fully tested by calling the unified dispatch function with different notification types and verifying each is delivered through the correct channel, and delivers value by eliminating the question "where do I send this notification?"

**Acceptance Scenarios**:

1. **Given** a job status changes to "completed", **When** the system dispatches a notification, **Then** the notification is sent through a single `notify()` function that routes to the correct channel(s) based on template configuration
2. **Given** an overdue job is detected, **When** the scheduler dispatches an alert, **Then** it uses the same `notify()` function (not a separate `wsBroadcast` call)
3. **Given** a warranty return is created, **When** the system notifies the owner, **Then** it uses the same `notify()` function (not a direct `wsBroadcast` call)
4. **Given** a developer wants to add a new notification type, **When** they call `notify()` with a new event name, **Then** no new dispatch plumbing is required — only a template entry and a single call site

---

### User Story 2 - Duplicate Route Elimination (Priority: P1)

As a developer, I need all notification API routes to exist in exactly one place so that there is no confusion about which endpoint to call and no risk of endpoints diverging.

**Why this priority**: Currently there are duplicate GET and PUT routes for notification templates across `notifications.ts` and `settings.ts`. This is the most critical duplication because it creates real bugs — the frontend uses one path while the other exists as dead code.

**Independent Test**: Can be tested by verifying that only one set of template routes exists, the frontend calls the canonical routes, and all CRUD operations work correctly.

**Acceptance Scenarios**:

1. **Given** the notification system routes, **When** listing all API endpoints, **Then** each notification template endpoint appears exactly once (no duplicates in `settings.ts`)
2. **Given** a GET request for notification templates, **When** sent to either the old `/settings/notifications/templates` or the canonical `/notifications/templates`, **Then** only the canonical route responds and the duplicate returns 404
3. **Given** a PUT request to update a template, **When** sent to the canonical route, **Then** it succeeds with proper validation and RBAC

---

### User Story 3 - Consistent Template Variable Syntax (Priority: P2)

As a shop owner editing notification templates, I need the variable insertion buttons in the template editor to produce syntax that the server actually renders, so that my templates work as expected when messages are sent.

**Why this priority**: This is a functional bug — the UI inserts `{varName}` but the renderer expects `{{varName}}`, meaning customer-facing messages would show raw variable placeholders instead of actual values.

**Independent Test**: Can be tested by creating a template with variable insertion buttons, sending a test notification, and verifying the variable is replaced with the actual value in the delivered message.

**Acceptance Scenarios**:

1. **Given** a template editor open, **When** the user clicks the "customerName" variable button, **Then** the inserted syntax uses double braces `{{customerName}}`
2. **Given** a template with `{{customerName}}`, **When** the notification is rendered, **Then** the variable is replaced with the actual customer name
3. **Given** the template renderer, **When** it encounters a variable that has no value provided, **Then** it leaves the placeholder visible rather than removing it silently

---

### User Story 4 - Dead Code and Channel Removal (Priority: P2)

As a developer, I need the codebase to contain only notification channels that actually work, so that I don't maintain dead code paths that add confusion.

**Why this priority**: The SMS channel exists across the Prisma schema, Zod schemas, API, and UI but always fails with "SMS not yet implemented." This dead code should be removed. The unused `templateIdParamSchema`, unused `dashboard:invalidate` consumer, and duplicate `ACTION_ICONS` mapping should also be eliminated.

**Independent Test**: Can be tested by verifying the codebase has no references to the removed dead code, the app compiles/runs without error, and existing WhatsApp + in-app notifications still work.

**Acceptance Scenarios**:

1. **Given** the `NotifyChannel` enum, **When** listing its values, **Then** it contains `WHATSAPP` and `IN_APP` (SMS removed, IN_APP added)
2. **Given** the Zod schema for `updateNotificationTemplateSchema`, **When** listing valid channels, **Then** it contains only `WHATSAPP`
3. **Given** the settings notifications tab, **When** rendering the channel filter, **Then** it shows only WhatsApp (no SMS group)
4. **Given** the `ACTION_ICONS` mapping, **When** searching the codebase, **Then** it is defined in exactly one file and imported elsewhere
5. **Given** the `dashboard:invalidate` WebSocket event, **When** searching for consumers, **Then** the broadcast is removed

---

### User Story 5 - Persistent In-App Notifications (Priority: P3)

As a shop owner, I need my in-app notification alerts to persist across page refreshes and devices, so that I don't miss important notifications when I close the browser or switch tabs.

**Why this priority**: Currently in-app alerts are stored only in a Zustand store (ephemeral memory), meaning every page refresh erases all notifications. This is a usability issue that undermines trust in the notification system.

**Independent Test**: Can be tested by receiving a notification, refreshing the page, and verifying the notification still appears.

**Acceptance Scenarios**:

1. **Given** an in-app notification is received, **When** the user refreshes the page, **Then** the notification is still visible
2. **Given** a notification exists in the store, **When** the user marks it as read, **Then** the read state persists across page refreshes
3. **Given** multiple notifications exist, **When** the user clicks "mark all read", **Then** all notifications are marked as read and the state persists

---

### User Story 6 - Monolithic Notifications Page Decomposition (Priority: P3)

As a developer, I need the 673-line notifications page to be decomposed into focused, maintainable components, so that each concern (alerts, WhatsApp settings, outbox logs) can be developed and tested independently.

**Why this priority**: While the monolith works, it makes the system harder to maintain and extend. After the unified dispatch and route consolidation are done, decomposing the page is a natural cleanup that makes future changes easier.

**Independent Test**: Can be tested by verifying that all existing notification page functionality (view alerts, edit templates, view outbox, test send) still works after decomposition, and each sub-component can be rendered in isolation.

**Acceptance Scenarios**:

1. **Given** the notifications page, **When** viewing the page structure, **Then** it composes from separate alert-list, channel-settings, and outbox-log components
2. **Given** the alert list component, **When** rendered in isolation, **Then** it displays and manages in-app alerts correctly
3. **Given** the channel settings component, **When** rendered in isolation, **Then** it displays WhatsApp configuration and template editing correctly

---

### Edge Cases

- What happens when a notification is dispatched for a channel that has no template configured? (Should fail gracefully with a logged warning, not crash the workflow)
- What happens when the WhatsApp API is unreachable? (Already handled: outbox marks as FAILED with error message — should continue working this way)
- What happens when a template uses a variable that the job context doesn't provide? (Should render with a fallback or the raw placeholder)
- What happens when `notify()` is called with multiple channels for the same event? (Should fan out to all channels)
- What happens if the old duplicate routes are removed but cached frontend code still calls them? (Frontend should be updated to call canonical routes; old paths return 404)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single `notify()` function as the only entry point for dispatching all notification types (in-app, WhatsApp, and future channels)
- **FR-002**: System MUST route in-app alerts through the same `notify()` function instead of direct `wsBroadcast()` calls
- **FR-003**: System MUST remove duplicate notification template API routes — only `GET/PUT /notifications/templates` in `notifications.ts` should exist; the duplicates in `settings.ts` MUST be deleted
- **FR-004**: System MUST update frontend API calls to use the canonical `/notifications/templates` routes
- **FR-005**: System MUST use consistent double-brace `{{variable}}` syntax for template variables in both the template editor UI and the server renderer
- **FR-006**: System MUST remove the dead SMS channel from the `NotifyChannel` enum, Zod schemas, Prisma schema, and all UI references
- **FR-007**: System MUST consolidate the `ACTION_ICONS` mapping into a single shared definition and import it in both timeline components
- **FR-008**: System MUST replace the unused `templateIdParamSchema` in `shared/schemas/notification.schema.ts` with in-app notification validation schemas
- **FR-009**: System MUST remove the unused `dashboard:invalidate` WebSocket broadcast
- **FR-010**: System MUST persist in-app notifications to the database so they survive page refreshes and are accessible across devices
- **FR-011**: System MUST provide per-user read state for in-app notifications so individual users can mark notifications as read
- **FR-012**: System MUST display the notification bell badge count based on all unread in-app notifications from the database, not just session-received alerts
- **FR-013**: System MUST deliver in-app notifications via real-time WebSocket push (not through the outbox worker) with a simultaneous DB write for persistence
- **FR-014**: System MUST automatically delete read in-app notifications after 30 days to prevent unbounded growth
- **FR-015**: System MUST decompose the notifications page into focused sub-components (alert list, channel settings, outbox log)
- **FR-016**: System MUST maintain backward compatibility for all existing WhatsApp notification delivery — no regression in message sending or template rendering
- **FR-017**: System MUST maintain the existing outbox worker pattern (polling, retry on failure, status tracking) for WhatsApp delivery

### Key Entities

- **NotificationEvent**: Represents something that happened (job status change, overdue detected, warranty return). Has a name, associated job/customer context, and variable data. This is the input to `notify()`.
- **NotificationTemplate**: Already exists in Prisma. Stores the message template per channel with `{{variable}}` placeholders. Only `WHATSAPP` templates are user-editable; `IN_APP` channel notifications bypass the template system entirely — `InAppNotification` rows are created directly by the dispatch handler.
- **NotificationOutbox**: Already exists in Prisma. Stores queued WhatsApp messages with status tracking. Remains unchanged for WhatsApp delivery.
- **InAppNotification**: New entity. Persists in-app alerts to the database with read state per user. Delivered via real-time WebSocket push (not through the outbox worker). The DB write happens alongside the WebSocket push for persistence and history. Read notifications are automatically deleted after 30 days. Replaces the ephemeral Zustand store.
- **NotifyChannel**: Enum narrowing from `{WHATSAPP, SMS}` to `{WHATSAPP, IN_APP}` — removing dead code and adding the channel for persistent in-app alerts. `IN_APP` channel uses instant WebSocket delivery; `WHATSAPP` continues using the outbox worker pattern.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The codebase contains exactly one function (`notify()`) for dispatching all notification types — zero direct `wsBroadcast()` calls remain for notification purposes (dashboard utility broadcasts are excluded)
- **SC-002**: Each notification template API route exists in exactly one file with zero route duplication
- **SC-003**: Template variable insertion in the UI produces `{{variable}}` syntax that renders correctly in 100% of test notifications
- **SC-004**: Zero references to the SMS channel remain in active code paths (Prisma enum, Zod schema, UI)
- **SC-005**: `ACTION_ICONS` is defined in exactly one file and imported in consuming components
- **SC-006**: In-app notifications persist across full page refresh — a received notification remains visible after refresh
- **SC-007**: All existing WhatsApp notification delivery continues working without regression — outbox processes, sends, and tracks status as before
- **SC-008**: The notifications page source file is under 200 lines, delegating to focused sub-components

## Clarifications

### Session 2026-04-29

- Q: Should in-app notifications be delivered via WebSocket real-time push or queued through the outbox worker? → A: Real-time WebSocket push + DB write (no outbox — instant delivery)
- Q: Should persisted in-app notifications have an automatic cleanup/retention policy? → A: Auto-delete read notifications after 30 days
- Q: What does "do not migrate" cover — SMS enum removal, ephemeral alerts, or both? → A: Both — fresh start for SMS removal and in-app persistence (no data migration needed)
- Q: How should the notification bell badge count behave with persistent notifications? → A: Count all unread from database (matches persistence)

## Assumptions

- The WhatsApp Business API integration is working as intended and should not be altered in behavior — only the dispatch path to it changes
- The existing outbox worker polling mechanism (5-second interval, batch of 10) is acceptable and should be preserved
- In-app notifications should be stored in the database (new Prisma model) rather than remaining ephemeral
- In-app notifications are delivered via real-time WebSocket push with simultaneous DB write, not through the outbox polling worker
- Read in-app notifications are automatically deleted after 30 days
- The `/settings/whatsapp` routes for WhatsApp configuration will remain in `settings.ts` since they are WhatsApp-specific config, not notification template management
- Encryption of the WhatsApp API token via `encryptSecret`/`decryptWhatsAppConfig` will remain unchanged
- The frontend will be updated to call canonical `/notifications/templates` routes instead of `/settings/notifications/templates`
- Removing the SMS channel does not require a data migration — the seed data only contains WhatsApp templates, and removing the enum value from the Prisma schema with a migration is acceptable
- No migration of existing ephemeral in-app alerts to the new persistent store — alerts start fresh from deployment onward
- The `dashboard:invalidate` event is unused on the frontend and will be removed from the broadcast side
- Template conditional syntax (`{{#if variable}}...{{/if}}`) introduced in the renderer should be preserved as-is