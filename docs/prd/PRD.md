# Reparilo
## Repair Shop Management System
### Product Requirements Document · MVP · v1.3

---

| Field | Value |
|---|---|
| Product Name | Reparilo |
| Version | 1.2 — MVP |
| Status | Draft |
| Scope | Single-shop, web + Android |
| Target Market | Mobile phone repair shops |
| Primary Language | Arabic / French / English |

---

## 1. Product Overview

Reparilo is a repair shop management system designed for single-location mobile phone repair shops. It streamlines the full lifecycle of a repair job — from customer intake to delivery — while giving shop owners an AI-powered analyst for business intelligence. The MVP targets two primary surfaces: a web app and an Android app sharing the same backend.

---

## 2. Problem Statement

- Customers repeatedly call the shop asking whether their device is ready, creating interruptions for staff.
- Front desk staff cannot recall a device brand, model, or repair status without digging through paper records.
- No structured tracking of parts cost per job means the shop cannot accurately calculate profit margins.
- Warranty returns are not linked to original jobs, making quality tracking impossible.

---

## 3. Goals & Success Metrics

| Goal | Success Metric |
|---|---|
| Eliminate status calls | Customer self-tracks via QR link; inbound status calls drop to near zero |
| Fast job lookup | Any job retrievable in < 5 seconds by name or Job ID |
| Accurate job costing | Parts + labor cost auto-calculated per job |
| Business insights on demand | Owner answers any business question via AI chat |

---

## 4. Users & Roles

| Role | Permissions Summary |
|---|---|
| Owner | Full access: all job operations, all statuses, AI analyst, shop settings, user management, notification templates |
| Technician | Create jobs, update status (Intake through Done), add parts, add notes (internal or customer-visible), receive assignment alerts |
| Front Desk | View all jobs and notes (read-only), move to Delivered or Returned, add note on delivery/return, receive Done alerts, send customer notifications |

> Note: The Owner account inherits all Technician permissions and can act as a technician when needed.

---

## 5. Job Lifecycle & Status Flow

### 5.1 Status States

| Status | Set By | Description |
|---|---|---|
| INTAKE | Technician / Owner | Device received, job card created |
| WAITING_FOR_PARTS | Technician / Owner | Repair blocked pending a part order |
| IN_REPAIR | Technician / Owner | Active repair in progress |
| ON_HOLD | Technician / Owner | Customer approved quote, waiting to proceed |
| DONE | Technician / Owner | Repair complete, awaiting customer pickup |
| DELIVERED | Front Desk / Owner | Device handed back to customer |
| RETURNED | Front Desk / Owner | Customer collected unrepaired device |
| CANCELLED | Technician / Owner | Job cancelled or device deemed irreparable |

### 5.2 Status Flow

```
INTAKE → WAITING_FOR_PARTS → IN_REPAIR → ON_HOLD → DONE → DELIVERED
```

- Any active status → `CANCELLED`
- `DONE` → `RETURNED` (if customer declines pickup)

---

## 6. Job Card — Intake Form

### 6.1 Required Fields

- Customer name + phone number (auto-links to existing customer profile by phone)
- Device: brand, model, color (selected from device catalog or created on the fly)
- Reported problem
- Physical condition notes
- Assigned technician
- Estimated repair cost
- Estimated ready date

### 6.2 Optional Fields

- Deposit amount
- Device photos — up to 5 photos at intake

### 6.3 Job ID Format

**Format: `REP-2026-0042-X7K`**

- `REP` — fixed prefix
- `2026` — year, resets counter annually
- `0042` — sequential counter for the year
- `X7K` — 3-character random alphanumeric suffix

### 6.4 Warranty Return Flow

When creating a new job, search previous jobs by customer phone. If a completed job is found, the new job can be flagged as a warranty return and linked to the original Job ID. Owner receives an in-app alert on every warranty return creation.

---

## 7. Parts & Pricing

### 7.1 Repair Catalog

- Predefined list of repair types (Screen Replacement, Battery, Charging Port, etc.) with categories: Hardware, Software, Diagnostic, Other.
- Each entry has a default price overridable per job.
- Ad-hoc repairs not in catalog can be added directly on a job.
- Full CRUD by Owner.

### 7.2 Parts Consumed

- Parts are logged as consumed entries per job — no stock inventory tracked.
- Each entry: part name, category, unit price, quantity, supplier, total cost (stored).
- Technician can pick from the parts catalog or add an ad-hoc part.
- All fields are snapshotted at time of use — catalog changes never affect historical records.

### 7.3 Cost Calculation

**Final Job Cost = Sum(JobRepair.price) + Sum(JobPart.totalCost)**

If final cost differs from the estimate, the system flags the difference on the job card.

### 7.4 Waiting for Parts

When status is `WAITING_FOR_PARTS`, technician logs: part name + supplier. Visible to front desk.

---

## 8. Receipt & Printing

### 8.1 Intake Receipt

- Shop name, logo, address, phone
- Job ID (human-readable) + QR code (tracking URL + access code)
- Device details, reported problem, estimated cost, estimated ready date
- Deposit amount if applicable
- Printed on 80×80mm thermal paper via ESC/POS printer

### 8.2 Final Receipt

- All intake receipt fields
- Final repair description, itemized cost (labor + parts), payment confirmation
- Printed on 80×80mm thermal paper

---

## 9. Customer Self-Tracking

- Public tracking page accessible via QR code on receipt.
- URL contains Job ID + access code — both required to view.
- Displays: device info, current status, customer-visible notes, estimated ready date.
- Does NOT display: cost, internal notes, technician name, other jobs.
- Available in Arabic, French, and English — customer toggles language on page.

---

## 10. Notifications

### 10.1 Customer Notifications

WhatsApp / SMS intent — pre-filled message opened on shop device, sent with one tap. No API required for MVP.

Supported template variables:
`{customerName}` `{jobId}` `{deviceModel}` `{shopName}` `{status}` `{estimatedDate}` `{trackingLink}`

Owner has full CRUD on templates. Default templates pre-loaded at setup.

### 10.2 Internal Alerts

| Event | Recipient | Content |
|---|---|---|
| New job assigned | Technician | Job ID, device model, reported problem |
| Job moved to DONE | Front Desk | Job ID, device model, customer name |
| Job overdue (past estimated date) | Owner + Technician | Job ID, device, overdue duration |
| Warranty return created | Owner | New Job ID, original Job ID, customer name |

---

## 11. Shop Settings

- Shop name, logo, address, phone number
- Default currency (default: DZD)
- Receipt footer text

Managed by Owner only.

---

## 12. Out of Scope — MVP

- Multi-location support
- Customer accounts or login
- Automated WhatsApp / SMS API
- Stock inventory management
- Supplier ordering / purchase orders
- Accounting or payroll integration
- Online repair booking
- Offline mode

---

## 13. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| UI Generation | Google Stitch |
| Routing | React Router v7 |
| Server State | TanStack Query |
| Client State | Zustand |
| Backend | Fastify (REST API — same project) |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | Better Auth |
| Real-time Alerts | Soketi (self-hosted) + Pusher-js client |
| AI Analyst | OpenAI-compatible endpoint — server-side |
| Receipt Printing | escpos npm package — ESC/POS 80×80mm |
| QR Code | qrcode npm package |
| Android | Capacitor — wraps Vite build into APK |
| Reverse Proxy | Nginx + Certbot (SSL) |
| Infrastructure | Hetzner VPS — Docker Compose |

### 13.1 Project Structure

Single project, single package.json — frontend and backend live together. No monorepo.

```
reparilo/
├── src/                      # React frontend
│   ├── pages/                # Route-level components
│   ├── components/
│   │   ├── ui/               # Base UI components (Stitch generated)
│   │   └── modules/          # Feature components (jobs, parts...)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Axios client, utils
│   └── stores/               # Zustand client state
├── server/                   # Fastify REST API
│   ├── routes/               # jobs, parts, users, notifications, ai
│   ├── services/             # Business logic
│   ├── plugins/              # Auth, Redis, Prisma plugins
│   └── middlewares/          # Role guards, validation
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── android/                  # Capacitor Android (generated)
├── package.json              # Single package.json
├── vite.config.ts
├── capacitor.config.ts
├── docker-compose.yml
└── nginx.conf
```

### 13.2 Dev Scripts

| Script | Action |
|---|---|
| npm run dev | Runs Vite frontend + Fastify API concurrently |
| npm run build | Vite production build to dist/ |
| npm run android | cap sync && cap open android |
| npm run server | Runs Fastify API only |

---

## 14. Database Schema

| Table | Purpose |
|---|---|
| users | Accounts and roles (Owner, Technician, Front Desk) |
| customers | Reusable customer profiles, unique by phone number |
| devices | Reusable device catalog, unique by brand + model |
| jobs | Core repair job record |
| job_photos | Intake photos stored on VPS local disk |
| job_notes | Internal and customer-visible notes per job |
| job_parts_waiting | Parts being ordered for a waiting job |
| parts_catalog | Reusable parts list with categories |
| job_parts | Consumed parts per job (snapshotted) |
| repair_catalog | Predefined repair types with categories |
| job_repairs | Repairs performed per job (snapshotted) |
| audit_logs | Full change history per job |
| notification_templates | WhatsApp/SMS message templates |
| shop_settings | Single-row shop configuration |
| ai_settings | Single-row AI endpoint configuration |
| ai_chat_history | Persisted AI chat log, capped at 20 messages |

### 14.1 Key Design Decisions

- All catalog values (part price, repair price) are snapshotted on job use — historical records are never affected by catalog edits.
- Ad-hoc parts and repairs (not in catalog) are fully supported — `partId` / `repairId` are nullable.
- Customer identified by phone number — same phone auto-links to existing customer across multiple jobs.
- Device is a reusable entity — same brand/model combination is never duplicated.
- Audit log tracks every meaningful state change with before/after values.
- Job cost is always computed as: `Sum(JobRepair.price) + Sum(JobPart.totalCost)`.

---

## 15. AI Data Analyst — Integration Spec

### 15.1 Overview

The AI analyst is an owner-only chat interface backed by any OpenAI-compatible endpoint. It has direct read-only database access via function calling and streams responses word by word. All configuration is stored in the database.

### 15.2 Settings Panel

A collapsible settings panel lives inside the chat UI. It contains:

- **API Endpoint URL** — text input, any OpenAI-compatible base URL
- **API Key** — password input, encrypted with AES-256 before storage in DB
- **Model** — dropdown, auto-fetched from endpoint `/models` on connection test, stored in DB
- **Temperature** — slider 0 to 2, labelled: Precise (0) ↔ Creative (2), default 0.7
- **Test Connection** button — hits endpoint, fetches model list, confirms connectivity

Settings persisted in `ai_settings` table (single row). API key encrypted at rest using server-side secret from environment variables.

### 15.3 Chat UI

| Element | Behaviour |
|---|---|
| Message bubbles | Owner messages right-aligned, AI responses left-aligned |
| Streaming | AI response streams word by word via OpenAI `stream: true` |
| Input | Text input with send button, Enter to send, Shift+Enter for newline |
| Clear chat | Button to wipe DB history and reset session to empty state |
| Loading state | Typing indicator shown while awaiting first stream token |
| Error state | Inline error message if endpoint fails or key is invalid |

### 15.4 Conversation History

- Full message history persisted in `ai_chat_history` table across sessions.
- Owner returns to previous conversation on next login.
- Hard cap of 20 messages — when a new message is saved, messages beyond 20 are pruned oldest-first.
- Clear chat wipes the entire `ai_chat_history` table and resets the UI.
- History passed as `messages[]` array on every API call — AI maintains full context within the 20-message window.

### 15.5 System Prompt

Fixed, managed in code only — not user-editable. It instructs the AI to:

- Act as a business data analyst for a phone repair shop.
- Only answer questions about shop data — jobs, revenue, parts, suppliers, technicians.
- Use available tool calls to query the database for accurate, real-time answers.
- Never expose raw SQL, schema details, or internal implementation to the owner.
- Respond in the same language the owner uses in the chat.

### 15.6 Database Tool Calls (Function Calling)

The AI has read-only access to the database via a single tool: `queryDatabase`. It cannot write, update, or delete any data.

| Tool | Description |
|---|---|
| `queryDatabase(query)` | Executes a read-only query against the database and returns the result. The AI constructs the query based on the owner's question and the available schema context injected into the system prompt. |

---

## 16. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Platform | Web (all modern browsers) + Android (Capacitor) |
| Authentication | Username + password, JWT + refresh tokens via Better Auth |
| Roles | Owner, Technician, Front Desk — enforced server-side |
| Receipt Printing | 80×80mm thermal via ESC/POS (USB or Bluetooth) |
| Language | Arabic (RTL), French, English — switchable per session |
| Real-time | WebSocket via Soketi — in-app alerts only |
| File Storage | Local VPS disk — job photos and shop logo |
| Offline Mode | Not required for MVP |
| Currency | DZD default, configurable in shop settings |
| AI Key Security | AES-256 encryption, server-side secret via env variable |
| AI History Cap | 20 messages max, oldest pruned on new message save |
