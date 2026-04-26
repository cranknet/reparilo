# Missing Features Design — Reparilo

**Date**: 2026-04-26
**Approach**: Depth-first — build one feature fully, then the next.
**Order**: Dashboard metrics → Customer management → WhatsApp notifications

---

## 1. Dashboard Metrics (Mock → Real Data)

### Problem
The owner dashboard displays hardcoded/mock data for:
- Revenue this month card (`"--"` placeholder)
- Average profit margin card (`"--"` placeholder)
- Financial trend chart (`MOCK_FINANCIAL_DATA` — 7 fabricated data points)
- Overdue jobs list (`MOCK_OVERDUE_JOBS`)
- Warranty returns list (`MOCK_WARRANTY_RETURNS`)

The `/jobs/metrics` endpoint only returns status counts. Revenue, margin, and trend data are not surfaced.

### Backend Changes

Extend the existing `/dashboard` route (already exists at `server/routes/dashboard.ts`) to return:

| Field | Computation | Notes |
|---|---|---|
| `revenueThisMonth` | `SUM(JobRepair.price) + SUM(JobPart.totalCost)` for jobs with status DONE or DELIVERED where `updatedAt` falls within current month | Uses actual charged amounts (not estimatedCost, which is only the intake estimate) |
| `costThisMonth` | `SUM(JobPart.totalCost)` for same jobs (DONE/DELIVERED this month) | Parts cost only — repair labor is margin |
| `avgProfitMargin` | Avg of `(repairTotal - partsCost) / repairTotal` across completed jobs this month | Percentage, 0-100 |
| `completedToday` | Count of jobs with status DONE where `updatedAt::date = today` | Already partially available |
| `overdueJobs` | Jobs where `estimatedDate < today AND status NOT IN (DONE, DELIVERED, CANCELLED, RETURNED)` | Includes job code, device brand+model, repair description, hours overdue |
| `warrantyReturns` | Jobs where `isWarrantyReturn = true AND status IN (INTAKE, IN_REPAIR)` | Includes job code, description, priority, time since creation |
| `financialTrend` | Daily revenue for last 7 days, grouped by `createdAt::date` | Array of `{ date, revenue, cost }` |

The `dashboard.service.ts` already exists with a `getMetrics` function. Extend it with these queries. Use Prisma aggregate queries (not raw SQL unless necessary for date grouping).

### Frontend Changes

- Replace `MOCK_FINANCIAL_DATA` with data from the dashboard API.
- Replace `MOCK_OVERDUE_JOBS` and `MOCK_WARRANTY_RETURNS` with real data.
- Wire the four metric cards to real values from the API response. Show `"--"` as fallback until data loads.
- The "Daily Summary" print button remains non-functional (print/export is a separate feature).
- Add a `<Suspense>` or loading skeleton for the dashboard while data is fetching.

### Success Criteria
- Revenue card shows actual monthly revenue (not `"--"`).
- Margin card shows actual average profit margin percentage.
- Financial trend chart shows real daily data.
- Overdue jobs list shows real overdue jobs from the DB.
- Warranty returns list shows real warranty return jobs.
- Dashboard still renders correctly with zero data (new shop with no jobs).

---

## 2. Customer Management (Detail + History + CRUD)

### Problem
Customers are only created/edited as part of job intake. There is no dedicated customer page. Staff cannot look up a returning customer's history, search by phone, or edit customer details outside the intake flow.

### Backend Changes

Add to `server/routes/customers.ts`:

| Endpoint | Method | Description |
|---|---|---|
| `GET /customers/:id` | GET | Customer detail + their jobs (with status, device, jobCode, estimatedCost, finalCost, createdAt) |
| `GET /customers/search` | GET | Search by phone number (exact or prefix match). Returns customer list. Query param: `phone` |

Existing endpoints that remain unchanged:
- `GET /customers` — list (already exists)
- `POST /customers` — create (already exists)
- `PUT /customers/:id` — update (already exists)

No delete endpoint — Customer has `Restrict` on Job foreign key, so customers with jobs cannot be deleted.

### Frontend Changes

New pages:

**`/customers`** — Customer list page:
- Search bar (phone number lookup, primary identifier for phone repair shops)
- Paginated table: name, phone, email, job count, last visit date
- Click a row → navigate to customer detail

**`/customers/:id`** — Customer detail page:
- Contact info card (name, phone, email) with inline edit capability
- Full job history table: jobCode, device, reported problem, status badge, date, final cost
- Click a job row → navigate to `/jobs/:id`
- "Create Customer" button on the list page, opening a modal (reuse form logic from job intake)

Route permissions use existing `customers: ["view", "create", "edit"]` from the RBAC matrix.

### Success Criteria
- Staff can search for a customer by phone number.
- Staff can view a customer's full job history.
- Staff can create and edit customers from the dedicated page (not just through job intake).
- Permissions are enforced (OWNER sees all, TECHNICIAN can view+create, FRONT_DESK can view+create+edit).

---

## 3. WhatsApp Notifications (Send Pipeline)

### Problem
`NotificationTemplate` records exist in the DB and can be managed via API, but no message is ever dispatched. The `channel` field says `WHATSAPP` or `SMS`, but there's no sending logic, no provider integration, and no trigger mechanism.

### Design Approach
This is WhatsApp-first. SMS can be added later by adding another provider to the pipeline.

### Backend Architecture

**Notification service** (`server/services/notification.service.ts`):
- `renderTemplate(template, data)`: Replace `{{variable}}` placeholders in template body with actual data (customerName, jobCode, status, estimatedDate, shopName). Simple regex-based substitution.
- `sendWhatsApp(to, message)`: Call the WhatsApp Business API (Meta Cloud API) to send a message. Returns success/failure.
- `queueNotification(jobId, templateName, recipient)`: Persist to `NotificationOutbox` table, marking status as QUEUED. Worker picks it up and processes.

**Queue mechanism**: DB outbox pattern.
- New `NotificationOutbox` model with fields: `id`, `jobId`, `templateName`, `channel`, `recipientPhone`, `renderedBody`, `status` (QUEUED/SENT/FAILED), `error`, `createdAt`, `sentAt`.
- A `setInterval`-based worker runs every 5 seconds, picks up QUEUED messages, sends them, updates status. For a single-location shop, this is sufficient — no Redis/RabbitMQ needed.
- On send failure, status becomes FAILED with error details. Manual retry via admin UI.

**WhatsApp provider config**: Store in `ShopSettings` (extend with optional `whatsappApiToken`, `whatsappPhoneNumberId`, `whatsappBusinessId` fields) or a new `NotificationProvider` single-row table. Encrypt the API token at rest using the existing AES encryption utility (`server/utils/`).

**Trigger points** (called from `job.service.ts`):
- `JOB_CREATED` → send "job confirmation" template to customer
- `STATUS_CHANGED` → send "status update" template when status transitions
- `JOB_DONE` → send "ready for pickup" template
- `JOB_DELIVERED` → send "delivery confirmation" template (optional, can be phased)

Triggers check whether the customer has a phone number, whether a matching template exists, and whether the notification channel is configured. If not, silently skip (no error thrown to the caller).

### Prisma Schema Addition

```prisma
model NotificationOutbox {
  id             String   @id @default(cuid())
  jobId          String?
  job            Job?     @relation(fields: [jobId], references: [id], onDelete: SetNull)
  templateName   String
  channel        NotifyChannel
  recipientPhone String
  renderedBody   String   @db.Text
  status         String   @default("QUEUED") // QUEUED | SENT | FAILED
  error          String?  @db.Text
  createdAt      DateTime @default(now()) @db.Timestamptz
  sentAt         DateTime? @db.Timestamptz

  @@index([status, createdAt])
  @@map("notification_outbox")
}
```

Add relation to `Job` model:
```prisma
model Job {
  // ... existing fields ...
  notifications  NotificationOutbox[]
}
```

Extend `ShopSettings` with WhatsApp config fields (or use a new model — preference is to extend existing).

### Frontend Changes

- **Notifications page**: Add "Send test" button per template. Add a simple log table showing recent notifications with status (SENT/FAILED/QUEUED), recipient, timestamp.
- **Settings page**: Add WhatsApp provider configuration section (API token, phone number ID, business ID) under a "Notifications" tab. Toggle to enable/disable notification sending.
- Show a success/error toast when test message is sent.

### Success Criteria
- Creating a job sends a WhatsApp confirmation message to the customer (if phone matches WhatsApp format and provider is configured).
- Changing a job status sends a WhatsApp status update to the customer.
- Sending fails gracefully (logged as FAILED, doesn't block the job operation).
- Staff can view notification delivery history in the UI.
- Staff can send a test message from the notifications settings page.
- If WhatsApp credentials are not configured, no messages are sent and no errors are thrown to the caller.

---

## Implementation Order

1. **Dashboard Metrics** — mostly frontend wiring + extending an existing service. Low risk, high visibility.
2. **Customer Management** — new pages + 2 new API endpoints. Medium scope, no external deps.
3. **WhatsApp Notifications** — new service, external provider, new DB model, background worker. Highest complexity, done last.

Each feature is fully built and tested before moving to the next.