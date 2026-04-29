# Tasks: Notification System SSOT

**Input**: Design documents from `/specs/001-notification-ssot/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and shared constants that all user stories depend on

- [x] T001 Update `NotifyChannel` enum in `prisma/schema.prisma`: remove `SMS`, add `IN_APP`
- [x] T002 Add `InAppNotification` model to `prisma/schema.prisma` per data-model.md (id, userId, jobId, type, message, readAt, createdAt, indexes, map to `in_app_notifications`)
- [x] T003 Add `InAppNotification` relation to `User` model and `Job` model in `prisma/schema.prisma`
- [x] T004 [P] Create shared `ACTION_ICONS` constant in `shared/constants/action-icons.ts` using canonical icon set from `status-history-timeline.tsx`
- [x] T005 [P] Replace `templateIdParamSchema` with in-app notification Zod schemas in `shared/schemas/notification.schema.ts` (listQuerySchema, markReadParamSchema, markReadAllSchema per contracts/notifications-api.md)
- [x] T006 [P] Remove `SMS` from `channel` enum in `updateNotificationTemplateSchema` in `shared/schemas/settings.schema.ts` (change `z.enum(["WHATSAPP", "SMS"])` to `z.enum(["WHATSAPP"])`)
- [x] T007 [P] Add `InAppNotification` type export in `shared/types/index.ts` (Prisma payload type)
- [x] T008 Create Prisma migration for schema changes and run `pnpm prisma generate`

**Checkpoint**: Schema and shared types ready. All downstream tasks can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core `notify()` dispatch and channel handlers that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create `server/services/notification-dispatch.ts` with `notify()` function, `ChannelHandler` interface, handler map `{ IN_APP, WHATSAPP }` that fans out to all matching channel handlers, `IN_APP` handler (creates InAppNotification rows + WebSocket push), and `WHATSAPP` handler (renders template + queues outbox entry) per research R1
- [x] T010 Create `server/services/notification-inapp.service.ts` with `getInAppNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`, and `cleanupReadNotifications()` functions per contracts/notifications-api.md and research R3
- [x] T011 Remove SMS dead path from `server/services/notification-outbox.service.ts` `processOutbox()` (delete the `else if (entry.channel === "SMS")` branch that always fails; do not modify WHATSAPP processing logic — FR-017)
- [x] T012 [P] Remove SMS dead path from `server/services/notification-sender.ts` (remove any SMS-specific references if they exist)
- [x] T013 Update `server/index.ts`: import and start notification cleanup worker alongside outbox worker, remove `emitDashboardChanged`/`dashboard-events` import

**Checkpoint**: Foundation ready — `notify()` function exists, in-app notification service layer exists, cleanup mechanism exists.

---

## Phase 3: User Story 1 - Unified Notification Dispatch (Priority: P1) 🎯 MVP

**Goal**: All notifications dispatch through a single `notify()` function — zero direct `wsBroadcast` calls for notification purposes

**Independent Test**: Trigger a job status change, an overdue event, and a warranty return. Verify all three go through `notify()` and reach the correct channels.

### Implementation for User Story 1

- [x] T014 [US1] Replace `triggerNotification()` call at `server/services/job.service.ts:282-293` with `notify(app, { eventName: "job_created", ... })`
- [x] T015 [US1] Replace `triggerNotification()` call at `server/services/job.service.ts:448-463` with `notify(app, { eventName: templateName, ... })`
- [x] T016 [US1] Remove `triggerNotification()` function and `STATUS_TEMPLATE_MAP` from `server/services/job.service.ts` (now handled by `notify()` + template lookup)
- [x] T017 [US1] Remove `findTemplate` import from `server/services/job.service.ts` (now used inside `notify()`)
- [x] T018 [US1] Replace `wsBroadcast` call at `server/routes/jobs.ts:260-267` (WARRANTY_RETURN_CREATED) with `notify(app, { eventName: "warranty_return_created", ... })`
- [x] T019 [US1] Replace `emitDashboardChanged` calls at `server/routes/jobs.ts:269,311,369` with `notify(app, ...)` for events that need in-app notification (e.g., job creation, status change); remove calls for events that don't need in-app notification since TanStack Query already invalidates dashboard data
- [x] T020 [US1] Replace `wsBroadcast` call at `server/jobs/overdue-scheduler.ts:44-47` (JOB_OVERDUE) with `notify(app, { eventName: "job_overdue", ... })`
- [x] T021 [US1] Remove `emitDashboardChanged` call at `server/jobs/overdue-scheduler.ts:49-51` per research R4 — dashboard auto-invalidates via TanStack Query
- [x] T022 [US1] Delete `server/lib/dashboard-events.ts` and remove all imports of `emitDashboardChanged` / `DashboardTarget` across the codebase
- [x] T023 [US1] Update `server/routes/jobs.ts` `jobDashboardTargets` helper: remove or adapt if no longer needed after `emitDashboardChanged` removal

**Checkpoint**: `notify()` is the only notification dispatch — grep for direct `wsBroadcast` in notification contexts returns zero. WhatsApp and in-app notifications both work via `notify()`.

---

## Phase 4: User Story 2 - Duplicate Route Elimination (Priority: P1)

**Goal**: Each notification template API route exists in exactly one file

**Independent Test**: `GET /api/notifications/templates` and `PUT /api/notifications/templates/:id` work correctly. `GET /api/settings/notifications/templates` returns 404.

### Implementation for User Story 2

- [x] T024 [US2] Remove duplicate `GET /notifications/templates` route from `server/routes/settings.ts` (lines 93-96)
- [x] T025 [US2] Remove duplicate `PUT /notifications/templates/:id` route from `server/routes/settings.ts` (lines 98-122)
- [x] T026 [US2] Remove `getNotificationTemplates` and `updateNotificationTemplate` imports from `server/routes/settings.ts` if no longer used there
- [x] T027 [US2] Update `src/stores/settings.ts` `fetchNotificationTemplates` (line 169-181) to call `GET /notifications/templates` instead of `GET /settings/notifications/templates`
- [x] T028 [US2] Update `src/stores/settings.ts` `updateNotificationTemplate` (line 183-205) to call `PUT /notifications/templates/:id` instead of `PUT /settings/notifications/templates/:id`
- [x] T029 [US2] Verify `getNotificationTemplates` and `updateNotificationTemplate` in `server/services/settings.service.ts` are still used by `server/routes/notifications.ts`; note result for T050

**Checkpoint**: `grep -r "notifications/templates" server/routes/settings.ts` returns nothing. Frontend calls canonical `/notifications/` routes.

---

## Phase 5: User Story 3 - Consistent Template Variable Syntax (Priority: P2)

**Goal**: Template editor inserts `{{variable}}` syntax that renders correctly on the server

**Independent Test**: Open template editor, click "customerName" button, verify `{{customerName}}` is inserted. Send test notification and verify variable is replaced.

### Implementation for User Story 3

- [x] T030 [US3] Change `TEMPLATE_VARIABLES` array in `src/components/modules/settings/template-editor.tsx` (lines 7-12) from single-brace `["{customerName}", "{jobCode}", "{status}", "{estimatedDate}"]` to double-brace `["{{customerName}}", "{{jobCode}}", "{{status}}", "{{estimatedDate}}"]`
- [x] T031 [US3] Add i18n key for template variable helper text if any new user-facing strings reference double-brace syntax in `src/i18n/locales/en.json`

**Checkpoint**: Template editor inserts `{{var}}`. Server renderer expects `{{var}}`. End-to-end alignment confirmed.

---

## Phase 6: User Story 4 - Dead Code and Channel Removal (Priority: P2)

**Goal**: Zero references to the SMS channel; `ACTION_ICONS` defined once; `dashboard:invalidate` removed; `templateIdParamSchema` removed

**Independent Test**: `rg "SMS" shared/ src/ server/ --type ts` returns zero active code references. `rg "ACTION_ICONS" shared/ src/ --type ts` shows one definition + imports only.

### Implementation for User Story 4

- [x] T032 [P] [US4] Remove SMS channel references from `src/components/modules/settings/settings-notifications-tab.tsx` (remove SMS group filter/section)
- [x] T033 [US4] Verify SMS removed from `shared/schemas/settings.schema.ts` — confirm T006 is complete
- [x] T034 [US4] Verify SMS removed from `shared/types/index.ts` / Prisma generated types — confirm after T008 migration
- [x] T035 [US4] Replace local `ACTION_ICONS` definition in `src/components/modules/jobs/status-history-timeline.tsx` (lines 21-41) with import from `shared/constants/action-icons.ts`
- [x] T036 [US4] Replace local `ACTION_ICONS` definition in `src/components/modules/profile/activity-timeline.tsx` (lines 6-26) with import from `shared/constants/action-icons.ts`
- [x] T037 [US4] Verify `dashboard:invalidate` broadcast removed — `server/lib/dashboard-events.ts` deleted in T022, confirm no other files emit this event type
- [x] T038 [US4] Verify old `templateIdParamSchema` replaced — `shared/schemas/notification.schema.ts` updated in T005, confirm no imports of old schema remain

**Checkpoint**: All dead code removed. No SMS references. ACTION_ICONS in one place. dashboard:invalidate gone.

---

## Phase 7: User Story 5 - Persistent In-App Notifications (Priority: P3)

**Goal**: In-app notifications persist across page refreshes; bell badge counts from database; 30-day auto-cleanup runs

**Independent Test**: Receive notification → refresh page → notification still visible. Mark as read → refresh → read state persists.

### Implementation for User Story 5

- [x] T039 [US5] Add in-app notification CRUD routes to `server/routes/notifications.ts`: `GET /in-app` (list for current user with filter/unreadCount), `PUT /in-app/:id/read` (mark read), `PUT /in-app/read-all` (mark all read) per contracts/notifications-api.md
- [x] T040 [US5] Rewrite `src/stores/alerts.ts` as API-backed Zustand store: fetch from `GET /notifications/in-app` on init, subscribe to WebSocket `NOTIFICATION` event type, call `PUT /notifications/in-app/:id/read` and `PUT /notifications/in-app/read-all` per research R7
- [x] T041 [US5] Update `src/components/modules/top-bar.tsx` WebSocket handler to process `NOTIFICATION` event type (replacing `WARRANTY_RETURN_CREATED` and `JOB_OVERDUE` handlers), use persisted store for badge count (unreadCount from API)
- [x] T042 [US5] Add i18n keys for any new in-app notification messages/types in `src/i18n/locales/en.json` and run `pnpm run sync-locales`
- [x] T043 [US5] Start cleanup worker in `server/index.ts` alongside outbox worker — call `cleanupReadNotifications()` on a 15-minute interval per research R3 (extends T013 import changes)

**Checkpoint**: In-app notifications survive page refresh. Badge count reflects DB state. 30-day cleanup running.

---

## Phase 8: User Story 6 - Monolithic Notifications Page Decomposition (Priority: P3)

**Goal**: Notifications page under 200 lines, composed of focused sub-components

**Independent Test**: All notification page functionality works identically after decomposition: view alerts, WhatsApp settings, outbox log, test send.

### Implementation for User Story 6

- [x] T044 [P] [US6] Create `src/components/modules/notifications/alert-list.tsx` — extract alert list with filter tabs (All/Unread/Read) and mark-read/mark-all-read from `src/pages/notifications/index.tsx`
- [x] T045 [P] [US6] Create `src/components/modules/notifications/channel-settings.tsx` — extract WhatsApp settings form (enable toggle, business ID, phone ID, API token, save) from `src/pages/notifications/index.tsx`
- [x] T046 [P] [US6] Create `src/components/modules/notifications/outbox-log.tsx` — extract outbox log table and test-send buttons from `src/pages/notifications/index.tsx`
- [x] T047 [US6] Rewrite `src/pages/notifications/index.tsx` as a thin composition page (<200 lines) that renders `AlertList`, `ChannelSettings`, and `OutboxLog` sub-components
- [x] T048 [US6] Add i18n keys for tab labels or section headers if introducing new strings in `src/i18n/locales/en.json` and run `pnpm run sync-locales`

**Checkpoint**: Notifications page under 200 lines. Each sub-component renders in isolation. All functionality preserved.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verification, cleanup, and quality gates

- [x] T049 Run `pnpm check` and fix any lint/type warnings — zero warnings allowed per Constitution VII
- [x] T050 Remove `getNotificationTemplates` and `updateNotificationTemplate` from `server/services/settings.service.ts` if T029 confirmed they are no longer imported anywhere
- [x] T051 Remove `notifications: ["send"]` permission from `shared/permissions.ts` if unused (research confirmed no route checks it)
- [x] T052 Verify all i18n keys added to `en.json` and synced to `ar.json` and `fr.json` via `pnpm run sync-locales`
- [x] T053 Run verification checklist from `quickstart.md`: grep for direct wsBroadcast, duplicate routes, SMS references, ACTION_ICONS duplication, template syntax, persistence; also manually test WhatsApp test-send end-to-end to verify no regression (FR-016/SC-007)
- [x] T054 Sync `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` per project rule (`cp`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion (schema + shared types) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs `notify()` function)
- **US2 (Phase 4)**: Depends on Phase 1 (schema changes) but independent of US1 — can run in parallel with US1
- **US3 (Phase 5)**: Independent — can run any time after Phase 1
- **US4 (Phase 6)**: Depends on Phase 1 (ACTION_ICONS in shared/, SMS enum removed) — some tasks parallel with US1/US2/US3
- **US5 (Phase 7)**: Depends on Phase 2 (in-app service layer) and US1 (notify() pushes IN_APP notifications)
- **US6 (Phase 8)**: Depends on US5 (needs persisted alert store for decomposed components)
- **Polish (Phase 9)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2. No dependency on other stories.
- **US2 (P1)**: Depends on Phase 1 only. Independent of US1.
- **US3 (P2)**: Depends on Phase 1 only. Independent of US1, US2.
- **US4 (P2)**: Depends on Phase 1. Partially overlaps US1 (T023 deletes dashboard-events.ts which US1 also touches).
- **US5 (P3)**: Depends on Phase 2 + US1 (notify() must push IN_APP events).
- **US6 (P3)**: Depends on US5 (alert store must be API-backed before decomposing page).

### Within Each User Story

- Models/schema before services
- Services before routes
- Server before frontend (for API-backed features)
- Core implementation before integration

### Parallel Opportunities

**Phase 1**: T004, T005, T006, T007 can run in parallel (different files)
**Phase 2**: T011, T012 can run in parallel (different files)
**US3 (Phase 5)**: Can run entirely in parallel with US1 and US2
**US4 (Phase 6)**: T032 can run in parallel (different file); T033, T034 are sequential verification tasks
**US6 (Phase 8)**: T044, T045, T046 can run in parallel (different new component files)

---

## Parallel Example: Phase 1

```text
# Launch shared constants and schemas in parallel:
Task: "Create shared ACTION_ICONS constant in shared/constants/action-icons.ts"
Task: "Replace templateIdParamSchema with in-app notification Zod schemas in shared/schemas/notification.schema.ts"
Task: "Remove SMS from updateNotificationTemplateSchema in shared/schemas/settings.schema.ts"
Task: "Add InAppNotification type export in shared/types/index.ts"
```

## Parallel Example: User Story 6

```text
# Launch all three decomposed components in parallel:
Task: "Create alert-list.tsx in src/components/modules/notifications/"
Task: "Create channel-settings.tsx in src/components/modules/notifications/"
Task: "Create outbox-log.tsx in src/components/modules/notifications/"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (schema + shared types)
2. Complete Phase 2: Foundational (`notify()` + service layer)
3. Complete Phase 3: User Story 1 (unified dispatch)
4. Complete Phase 4: User Story 2 (duplicate routes)
5. **STOP and VALIDATE**: Test that all notifications dispatch through `notify()`, no duplicate routes exist, WhatsApp still works
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Schema and `notify()` ready
2. Add US1 + US2 → Unified dispatch + clean routes (MVP!)
3. Add US3 + US4 → Template syntax fix + dead code removal
4. Add US5 → Persistent in-app notifications
5. Add US6 → Page decomposition
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers (after Phase 2):

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (unified dispatch)
   - Developer B: US2 (duplicate routes) + US3 (template syntax)
   - Developer C: US4 (dead code removal)
3. Then:
   - Developer A: US5 (persistent notifications)
   - Developer B: US6 (page decomposition)
4. Polish pass together

---

## Notes

- [P] tasks = different files, no dependencies
- [US] label maps task to specific user story for traceability
- US1 and US2 are both P1 but US1 depends on Phase 2 while US2 depends only on Phase 1 — they can overlap
- US5 depends on US1 because `notify()` must create `InAppNotification` rows (the IN_APP channel handler)
- US6 depends on US5 because the decomposed alert-list component uses the API-backed alert store
- Template-editor variable fix (US3) is a one-line change but packaged as its own story for traceability
- Prisma migration (T008) should be created and tested before any service code references the new model
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently