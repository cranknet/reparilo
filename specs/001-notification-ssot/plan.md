# Implementation Plan: Notification System Single Source of Truth

**Branch**: `001-notification-ssot` | **Date**: 2026-04-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-notification-ssot/spec.md`

## Summary

Consolidate the notification system into a single source of truth by: (1) creating a unified `notify()` dispatch function replacing 3 scattered mechanisms, (2) eliminating duplicate API routes, (3) fixing the template variable syntax mismatch, (4) removing dead SMS channel code, (5) persisting in-app notifications to the database with real-time WebSocket delivery, (6) decomposing the monolithic notifications page.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js ≥ 20.19.0
**Primary Dependencies**: Fastify 5, Prisma 7, React 19, Zustand, TanStack Query, i18next
**Storage**: PostgreSQL (via Prisma 7)
**Testing**: Vitest (server unit/integration tests exist)
**Target Platform**: Web (Vite 8) + Android (Capacitor)
**Project Type**: Web application (monolithic frontend + backend)
**Performance Goals**: In-app notifications delivered in <1s (WebSocket push); WhatsApp delivery unchanged (5s polling)
**Constraints**: Single package.json; trilingual (AR/FR/EN); no barrel files; no migration of existing data
**Scale/Scope**: Single-location repair shop (1-10 concurrent users)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Removing duplication and dead code simplifies; no speculative features added |
| II. Surgical Changes | PASS | Changes limited to notification-related files; not refactoring unrelated code |
| III. Think Before Coding | PASS | Research phase identifies all unknowns before implementation |
| IV. Goal-Driven Execution | PASS | 17 FRs with measurable success criteria (SC-001 through SC-008) |
| V. Shared Source of Truth | PASS | Core goal of this feature — establishing notification SSOT |
| VI. Trilingual by Default | PASS | New UI strings will go through i18n; existing i18n keys preserved |
| VII. Quality Gates | PASS | Will run `pnpm check` / `pnpm fix`; no suppressed warnings |

**Result**: PASS — no violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-notification-ssot/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── notifications-api.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
server/
├── services/
│   ├── notification-dispatch.ts    # NEW: unified notify() + channel handlers
│   ├── notification-inapp.service.ts  # NEW: in-app notification CRUD + cleanup
│   ├── notification-outbox.service.ts  # MODIFY: remove SMS, update queueNotification
│   ├── notification-sender.ts          # MODIFY: remove SMS dead path
│   ├── notification-renderer.ts        # KEEP: unchanged
│   ├── settings.service.ts             # MODIFY: remove duplicate template fns (keep for settings route but remove notification-specific)
│   └── job.service.ts                  # MODIFY: replace triggerNotification with notify()
├── routes/
│   ├── notifications.ts            # MODIFY: add in-app notification CRUD routes
│   ├── settings.ts                 # MODIFY: remove duplicate template routes
│   └── jobs.ts                     # MODIFY: replace wsBroadcast with notify()
├── jobs/
│   └── overdue-scheduler.ts        # MODIFY: replace wsBroadcast/emitDashboardChanged with notify()
├── lib/
│   └── dashboard-events.ts         # DELETE: absorbed into notification-dispatch
├── plugins/
│   └── websocket.ts                # KEEP: wsBroadcast stays as low-level utility
└── index.ts                        # MODIFY: update imports, start cleanup worker

shared/
├── schemas/
│   ├── notification.schema.ts      # MODIFY: replace unused templateIdParamSchema with proper schemas
│   └── settings.schema.ts          # MODIFY: remove SMS from channel enum
├── types/
│   └── index.ts                    # MODIFY: add InAppNotification type
└── constants/
    └── action-icons.ts             # NEW: shared ACTION_ICONS mapping

src/
├── pages/notifications/
│   └── index.tsx                   # REWRITE: decompose into sub-components
├── components/modules/
│   ├── notifications/              # NEW: decomposed sub-components
│   │   ├── alert-list.tsx          # NEW: in-app alert list
│   │   ├── channel-settings.tsx    # NEW: WhatsApp settings + template editor
│   │   └── outbox-log.tsx          # NEW: outbox log table
│   ├── settings/
│   │   └── template-editor.tsx     # MODIFY: fix {var} to {{var}} syntax
│   ├── top-bar.tsx                 # MODIFY: use persisted notifications + badge from DB
│   ├── jobs/status-history-timeline.tsx  # MODIFY: import shared ACTION_ICONS
│   └── profile/activity-timeline.tsx     # MODIFY: import shared ACTION_ICONS
├── stores/
│   ├── alerts.ts                   # REWRITE: API-backed store for persisted notifications
│   └── settings.ts                 # MODIFY: update API paths from /settings/ to /notifications/
└── hooks/
    └── use-ws.ts                   # KEEP: unchanged

prisma/
└── schema.prisma                   # MODIFY: add InAppNotification model, remove SMS from NotifyChannel, add cleanup index
```

**Structure Decision**: Standard monolithic web app structure following existing conventions. New files organized by concern within existing directory hierarchy.