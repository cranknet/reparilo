# Data Model: Notification System SSOT

**Branch**: `001-notification-ssot` | **Date**: 2026-04-29

## Entity Changes

### New Models

#### InAppNotification

```
InAppNotification
├── id: String (cuid, PK)
├── userId: String (FK → User.id)
├── user: User (relation)
├── jobId: String? (FK → Job.id, nullable)
├── job: Job? (relation, onDelete: SetNull)
├── type: String (e.g., "JOB_OVERDUE", "WARRANTY_RETURN_CREATED", "JOB_STATUS_CHANGED")
├── message: String (@db.Text)
├── readAt: DateTime? (@db.Timestamptz, nullable — null means unread)
├── createdAt: DateTime (@default(now()), @db.Timestamptz)
├── @@index([userId, readAt])
├── @@index([readAt, createdAt])  ← for cleanup query
└── @@map("in_app_notifications")
```

**Design notes:**
- One row per recipient per notification (not broadcast + read tracking)
- `readAt` nullable: null = unread, datetime = when marked read
- `type` is a free-form string matching the event name from `notify()` — no enum to avoid coupling with future event types
- `message` is a rendered human-readable string (already interpolated, not a template)
- Cleanup: `DELETE WHERE "readAt" IS NOT NULL AND "readAt" < now() - interval '30 days'`

### Modified Models

#### NotifyChannel (enum)

**Before:** `{ WHATSAPP, SMS }`
**After:** `{ WHATSAPP, IN_APP }`

- `SMS` removed (dead code, no data rows reference it)
- `IN_APP` added for the new persistent in-app notification channel

#### NotificationTemplate

**No schema changes.** The `channel` field type changes implicitly via `NotifyChannel` enum update. Existing `WHATSAPP` templates remain valid.

#### NotificationOutbox

**No schema changes.** Continues to serve WhatsApp delivery only.

### Deleted Models

None. All existing models retained with modifications above.

## Relationships

```
User 1──┐
        │
        ├── N InAppNotification (each user receives their own copy)
        │
Job 1───┤
        │
        ├── N InAppNotification (optional, links to relevant job)
        │
        └── N NotificationOutbox (existing, WhatsApp delivery)
```

## State Transitions

### InAppNotification

```
[created] ──→ UNREAD (readAt = null)
                │
                └──→ READ (readAt = set to now())
                        │
                        └──→ [auto-deleted after 30 days]
```

- No "dismissed" state separate from read — dismissing marks as read (sets `readAt`)
- No "failed" state — in-app notifications always succeed (WebSocket send + DB write)

### NotificationOutbox (unchanged)

```
[created] ──→ QUEUED ──→ SENT
                  │
                  └──→ FAILED (error message stored)
```

## Validation Rules

- `InAppNotification.userId`: Required, must reference existing User
- `InAppNotification.type`: Required, non-empty string
- `InAppNotification.message`: Required, non-empty string
- `InAppNotification.jobId`: Optional, must reference existing Job if provided
- `InAppNotification.readAt`: Nullable datetime; once set, cannot be unset

## Index Strategy

| Index | Columns | Purpose |
|-------|---------|---------|
| `in_app_notifications_userId_readAt_idx` | `userId, readAt` | Fetch user's notifications, filter by read/unread |
| `in_app_notifications_readAt_createdAt_idx` | `readAt, createdAt` | Cleanup: find read notifications older than 30 days |