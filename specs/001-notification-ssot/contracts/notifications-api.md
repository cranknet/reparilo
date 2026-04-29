# Notifications API Contract

**Branch**: `001-notification-ssot` | **Date**: 2026-04-29

## Base URL

`/api/notifications`

## Authentication

All endpoints require authenticated session via Better Auth. Role-based permissions noted per endpoint.

---

## In-App Notifications

### GET /api/notifications/in-app

List in-app notifications for the current user.

**Permission**: `notifications: ["read"]`
**Roles**: OWNER, TECHNICIAN, FRONT_DESK

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | `string` | `"all"` | One of: `"all"`, `"unread"`, `"read"` |
| `limit` | `number` | `50` | Max results (1-100) |

**Response 200**:

```json
{
  "notifications": [
    {
      "id": "clx...",
      "type": "JOB_OVERDUE",
      "message": "Job REP-001 is overdue",
      "job": { "id": "clx...", "jobCode": "REP-001" },
      "readAt": null,
      "createdAt": "2026-04-29T10:30:00Z"
    }
  ],
  "unreadCount": 3
}
```

### PUT /api/notifications/in-app/:id/read

Mark a single in-app notification as read.

**Permission**: `notifications: ["read"]`
**Roles**: OWNER, TECHNICIAN, FRONT_DESK

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Notification ID (cuid) |

**Response 200**:

```json
{
  "id": "clx...",
  "readAt": "2026-04-29T11:00:00Z"
}
```

**Response 404**: Notification not found or not owned by current user.

### PUT /api/notifications/in-app/read-all

Mark all in-app notifications as read for the current user.

**Permission**: `notifications: ["read"]`
**Roles**: OWNER, TECHNICIAN, FRONT_DESK

**Response 200**:

```json
{
  "count": 5
}
```

---

## Notification Templates

### GET /api/notifications/templates

List all notification templates.

**Permission**: `notifications: ["read"]`
**Roles**: OWNER, TECHNICIAN, FRONT_DESK

**Response 200**:

```json
{
  "templates": [
    {
      "id": "clx...",
      "name": "job_done",
      "channel": "WHATSAPP",
      "body": "Hi {{customerName}}, your repair {{jobCode}} is done!",
      "isDefault": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-04-29T00:00:00Z"
    }
  ]
}
```

### PUT /api/notifications/templates/:id

Update a notification template.

**Permission**: `notifications: ["manage"]`
**Roles**: OWNER only

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Template ID (cuid) |

**Request Body**:

```json
{
  "name": "job_done",
  "channel": "WHATSAPP",
  "body": "Updated template body with {{customerName}}",
  "isDefault": true
}
```

**Validation**:
- `name`: Required, non-empty string
- `channel`: Required, must be `"WHATSAPP"` (SMS removed, IN_APP templates are auto-generated not user-editable)
- `body`: Required, non-empty string
- `isDefault`: Optional, boolean

**Response 200**: Updated template object.
**Response 404**: Template not found.

---

## Notification Outbox

### GET /api/notifications/outbox

List recent outbox entries (WhatsApp delivery log).

**Permission**: `notifications: ["read"]`
**Roles**: OWNER, FRONT_DESK

**Response 200**:

```json
{
  "logs": [
    {
      "id": "clx...",
      "templateName": "job_done",
      "channel": "WHATSAPP",
      "recipientPhone": "213555123456",
      "status": "SENT",
      "error": null,
      "createdAt": "2026-04-29T10:30:00Z",
      "sentAt": "2026-04-29T10:30:01Z"
    }
  ]
}
```

### POST /api/notifications/test/:templateId

Send a test notification using a template.

**Permission**: `notifications: ["manage"]`
**Roles**: OWNER only

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `templateId` | `string` | Template ID (cuid) |

**Response 200**:

```json
{
  "queued": true,
  "outboxId": "clx..."
}
```

---

## WebSocket Events

### Server → Client: In-App Notification

Pushed when a new in-app notification is created for the user.

```json
{
  "type": "NOTIFICATION",
  "notification": {
    "id": "clx...",
    "type": "JOB_OVERDUE",
    "message": "Job REP-001 is overdue",
    "job": { "id": "clx...", "jobCode": "REP-001" },
    "readAt": null,
    "createdAt": "2026-04-29T10:30:00Z"
  }
}
```

**Client handling**: Insert into alerts store, update badge count.

### Server → Client: WARRANTY_RETURN_CREATED (DEPRECATED)

Replaced by the generic `NOTIFICATION` event above. Kept for backward compatibility during transition but should be removed.

### Server → Client: JOB_OVERDUE (DEPRECATED)

Replaced by the generic `NOTIFICATION` event above. Kept for backward compatibility during transition but should be removed.

### Server → Client: dashboard:invalidate (REMOVED)

This unused event is being removed entirely.

---

## Removed Endpoints

| Method | Path | Reason |
|--------|------|--------|
| GET | `/api/settings/notifications/templates` | Duplicate of `GET /api/notifications/templates` |
| PUT | `/api/settings/notifications/templates/:id` | Duplicate of `PUT /api/notifications/templates/:id` |