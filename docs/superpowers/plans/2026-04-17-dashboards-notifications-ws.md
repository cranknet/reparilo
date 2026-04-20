# Dashboards, Notifications, and WebSocket Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all dashboard mock data with real analytics, ship browser-intent WhatsApp notifications (no provider), and secure the WebSocket endpoint with Better Auth — so owner/technician/front-desk dashboards show live shop state and staff can notify customers with one click.

**Architecture:** Three independently-shippable phases. Phase 1 adds a typed event bus + Better Auth WS validation (foundation for live updates). Phase 2 adds a `JobNotification` intent table, status-triggered auto-surfacing, and a `wa.me` deep-link flow (no SDK, no provider). Phase 3 adds composable widget endpoints under `/api/analytics/*` and wires every dashboard widget to real Prisma queries. Phases 2 and 3 both consume Phase 1 events for live UI invalidation.

**Tech Stack:** Fastify + `@fastify/websocket`, Prisma 7 / PostgreSQL 17, Better Auth 1.6, Zod, React + react-query (via axios in `src/lib/api.ts`), Zustand stores, Vitest. Trilingual i18n via `react-i18next` (keys in `src/i18n/locales/en.json`, sync via `pnpm run sync-locales`).

**Branch note:** Work continues on `feat/unified-rbac`. Each phase ends with a commit; you may open a PR after any phase.

---

## File Structure

### New files

- `server/events/event-bus.ts` — typed EventEmitter for cross-module events (job/notification)
- `server/events/__tests__/event-bus.test.ts` — unit tests for bus
- `server/plugins/ws-hub.ts` — in-memory WS client registry + role-scoped broadcast
- `server/plugins/__tests__/ws-hub.test.ts` — unit tests for hub
- `server/services/notification.service.ts` — create/list/mark-sent/dismiss for `JobNotification`
- `server/services/__tests__/notification.service.test.ts` — service tests
- `server/services/analytics.service.ts` — widget queries (financial-trends, overdue, schedule, etc.)
- `server/services/__tests__/analytics.service.test.ts` — service tests
- `server/routes/analytics.ts` — `/api/analytics/*` endpoints
- `shared/schemas/notifications.ts` — Zod schemas for notification endpoints
- `shared/schemas/analytics.ts` — Zod schemas for analytics query params
- `shared/lib/wa-intent.ts` — pure template-render + `wa.me` URL builder
- `shared/__tests__/wa-intent.test.ts` — tests for renderer
- `src/hooks/use-analytics.ts` — react-query wrappers for widget endpoints
- `src/hooks/use-notifications.ts` — react-query wrappers + mark-sent mutation
- `src/hooks/use-realtime.ts` — WS client hook, invalidates react-query caches on events
- `src/components/modules/dashboard/pending-notifications-widget.tsx` — queue of notify-customer prompts
- `src/components/modules/notifications/notify-customer-button.tsx` — manual-trigger button
- `prisma/migrations/<timestamp>_add_job_notifications/migration.sql` — migration (generated)

### Modified files

- `server/plugins/websocket.ts` — swap cookie-string check for Better Auth session validation, wire to `wsHub`
- `server/index.ts` — register `analyticsRoutes` under `/api/analytics`
- `server/services/job.service.ts` — emit `job.status.changed` after `transitionStatus`
- `server/routes/notifications.ts` — add pending/mark-sent/dismiss/manual endpoints
- `prisma/schema.prisma` — add `autoTriggerOn` to `NotificationTemplate`, new `JobNotification` model
- `shared/constants/roles.ts` — add `reports:view_self` + `analytics:view` permission strings where needed
- `shared/schemas/index.ts` — re-export new schemas
- `src/pages/dashboard/front-desk.tsx` — delete `MOCK_ALERTS` / `MOCK_WAITING`, wire analytics + pending-notifications
- `src/pages/dashboard/technician.tsx` — delete all MOCK_* constants, wire analytics
- `src/pages/dashboard/index.tsx` — delete all MOCK_* constants, wire analytics
- `src/components/modules/dashboard/priority-alerts-panel.tsx` — accept real alert shape
- `src/components/modules/dashboard/waiting-customers.tsx` — accept real customer shape
- `src/i18n/locales/en.json` — new widget + notification copy keys

---

## Phase 1 — WebSocket Session Validation + Event Bus

Foundation for live dashboard updates and notification prompts.

### Task 1: Create typed event bus

**Files:**
- Create: `server/events/event-bus.ts`
- Test: `server/events/__tests__/event-bus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/events/__tests__/event-bus.test.ts
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../event-bus.js";

describe("EventBus", () => {
  it("delivers job.status.changed payload to subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("job.status.changed", handler);
    bus.emit("job.status.changed", {
      jobId: "j1",
      fromStatus: "INTAKE",
      toStatus: "IN_REPAIR",
      technicianId: "u1",
    });
    expect(handler).toHaveBeenCalledWith({
      jobId: "j1",
      fromStatus: "INTAKE",
      toStatus: "IN_REPAIR",
      technicianId: "u1",
    });
  });

  it("supports multiple event types independently", () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("job.status.changed", a);
    bus.on("notification.pending", b);
    bus.emit("notification.pending", { notificationId: "n1", jobId: "j1" });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test server/events/__tests__/event-bus.test.ts`
Expected: FAIL — cannot resolve `../event-bus.js`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// server/events/event-bus.ts
import { EventEmitter } from "node:events";

export type BusEvents = {
  "job.status.changed": {
    jobId: string;
    fromStatus: string;
    toStatus: string;
    technicianId: string | null;
  };
  "notification.pending": { notificationId: string; jobId: string };
  "notification.sent": { notificationId: string; jobId: string };
};

export class EventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends keyof BusEvents>(
    event: K,
    handler: (payload: BusEvents[K]) => void
  ): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}

export const bus = new EventBus();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test server/events/__tests__/event-bus.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/events/event-bus.ts server/events/__tests__/event-bus.test.ts
git commit -m "feat(events): add typed event bus for cross-module messaging"
```

---

### Task 2: Create WebSocket hub

**Files:**
- Create: `server/plugins/ws-hub.ts`
- Test: `server/plugins/__tests__/ws-hub.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/plugins/__tests__/ws-hub.test.ts
import { describe, expect, it, vi } from "vitest";
import { WsHub } from "../ws-hub.js";

function makeSocket() {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
  };
}

describe("WsHub", () => {
  it("broadcasts to all registered clients when no filter given", () => {
    const hub = new WsHub();
    const a = makeSocket();
    const b = makeSocket();
    hub.register(a as never, { userId: "u1", role: "OWNER" });
    hub.register(b as never, { userId: "u2", role: "TECHNICIAN" });
    hub.broadcast({ type: "job.status.changed", payload: { jobId: "j1" } });
    expect(a.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "job.status.changed", payload: { jobId: "j1" } })
    );
    expect(b.send).toHaveBeenCalled();
  });

  it("applies filter predicate to limit recipients", () => {
    const hub = new WsHub();
    const owner = makeSocket();
    const tech = makeSocket();
    hub.register(owner as never, { userId: "u1", role: "OWNER" });
    hub.register(tech as never, { userId: "u2", role: "TECHNICIAN" });
    hub.broadcast(
      { type: "owner-only", payload: {} },
      (meta) => meta.role === "OWNER"
    );
    expect(owner.send).toHaveBeenCalled();
    expect(tech.send).not.toHaveBeenCalled();
  });

  it("skips sockets that are not open (readyState !== 1)", () => {
    const hub = new WsHub();
    const closing = makeSocket();
    closing.readyState = 2;
    hub.register(closing as never, { userId: "u1", role: "OWNER" });
    hub.broadcast({ type: "x", payload: {} });
    expect(closing.send).not.toHaveBeenCalled();
  });

  it("unregister removes the client", () => {
    const hub = new WsHub();
    const s = makeSocket();
    const id = hub.register(s as never, { userId: "u1", role: "OWNER" });
    hub.unregister(id);
    hub.broadcast({ type: "x", payload: {} });
    expect(s.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test server/plugins/__tests__/ws-hub.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// server/plugins/ws-hub.ts
import { randomUUID } from "node:crypto";

type ClientMeta = { userId: string; role: string };
interface SocketLike {
  readyState: number;
  send(data: string): void;
}
type Client = { socket: SocketLike; meta: ClientMeta };

export type WsEvent = { type: string; payload: unknown };

export class WsHub {
  private clients = new Map<string, Client>();

  register(socket: SocketLike, meta: ClientMeta): string {
    const id = randomUUID();
    this.clients.set(id, { socket, meta });
    return id;
  }

  unregister(id: string): void {
    this.clients.delete(id);
  }

  broadcast(event: WsEvent, filter?: (meta: ClientMeta) => boolean): void {
    const msg = JSON.stringify(event);
    for (const { socket, meta } of this.clients.values()) {
      if (filter && !filter(meta)) continue;
      if (socket.readyState !== 1) continue;
      socket.send(msg);
    }
  }

  get size(): number {
    return this.clients.size;
  }
}

export const wsHub = new WsHub();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test server/plugins/__tests__/ws-hub.test.ts`
Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add server/plugins/ws-hub.ts server/plugins/__tests__/ws-hub.test.ts
git commit -m "feat(ws): add in-memory hub with role-scoped broadcast"
```

---

### Task 3: Validate WS sessions via Better Auth + wire hub

**Files:**
- Modify: `server/plugins/websocket.ts`

- [ ] **Step 1: Replace file contents**

```ts
// server/plugins/websocket.ts
import type { FastifyPluginAsync } from "fastify";
import { getSessionFromRequest } from "../lib/auth.js";
import { bus } from "../events/event-bus.js";
import { wsHub } from "./ws-hub.js";

export const websocketPlugin: FastifyPluginAsync = async (app) => {
  bus.on("job.status.changed", (payload) => {
    wsHub.broadcast({ type: "job.status.changed", payload });
  });
  bus.on("notification.pending", (payload) => {
    wsHub.broadcast(
      { type: "notification.pending", payload },
      (meta) => meta.role === "OWNER" || meta.role === "FRONT_DESK"
    );
  });
  bus.on("notification.sent", (payload) => {
    wsHub.broadcast({ type: "notification.sent", payload });
  });

  app.get("/ws", { websocket: true }, async (socket, req) => {
    const session = await getSessionFromRequest(app.auth, req);
    if (!session || !session.isActive) {
      app.log.warn("WS connection rejected — no valid session");
      socket.close(4001, "Unauthorized");
      return;
    }
    const clientId = wsHub.register(socket, {
      userId: session.id,
      role: session.role,
    });
    app.log.info(
      { userId: session.id, role: session.role, clientId },
      "WS client connected"
    );
    socket.on("close", () => {
      wsHub.unregister(clientId);
      app.log.info({ clientId }, "WS client disconnected");
    });
  });
};
```

- [ ] **Step 2: Smoke-test that server starts without error**

Run: `pnpm run dev:server` (or the project's server command)
Expected: Server starts on :4000, no new errors in logs. Kill with Ctrl+C.

- [ ] **Step 3: Manual WS connection test**

With server running, in a browser dev tools console on `http://localhost:5173` (after signing in so the session cookie is set):

```js
const ws = new WebSocket(`ws://${location.host}/ws`);
ws.onopen = () => console.log("open");
ws.onclose = (e) => console.log("close", e.code, e.reason);
```

Expected: `open` logs. In a private/incognito window without session cookie, same script should log `close 4001 Unauthorized`.

- [ ] **Step 4: Commit**

```bash
git add server/plugins/websocket.ts
git commit -m "feat(ws): validate sessions via Better Auth, wire event bus to hub"
```

---

### Task 4: Emit job.status.changed from job service

**Files:**
- Modify: `server/services/job.service.ts`

- [ ] **Step 1: Read the file to locate `transitionStatus`**

Run: `pnpm -s exec grep -n "export.*transitionStatus" server/services/job.service.ts`
Expected: one hit — note the function definition line.

- [ ] **Step 2: Add the import at the top of the file**

```ts
// server/services/job.service.ts — add near other imports
import { bus } from "../events/event-bus.js";
```

- [ ] **Step 3: Emit after a successful status transition**

Find the block inside `transitionStatus` that returns the updated job after the Prisma update + audit log. Add the `bus.emit` call immediately before `return` of the success path. The emit looks like:

```ts
bus.emit("job.status.changed", {
  jobId: updatedJob.id,
  fromStatus: previousStatus,
  toStatus: newStatus,
  technicianId: updatedJob.technicianId,
});
```

Do not emit on error paths. If `previousStatus` / `newStatus` / `updatedJob` are named differently in the file, use the equivalent local names but keep the payload shape exact.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add server/services/job.service.ts
git commit -m "feat(jobs): emit job.status.changed on transition"
```

---

## Phase 2 — Browser-Intent Notifications (wa.me)

No SDK, no provider. Backend tracks intent; frontend opens a WhatsApp deep link.

### Task 5: Prisma migration — add notification intent model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_job_notifications/migration.sql` (generated)

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, add `autoTriggerOn` to `NotificationTemplate` and append a new `JobNotification` model + enum:

```prisma
// Replace the NotificationTemplate model with:
model NotificationTemplate {
  id            String        @id @default(cuid())
  name          String
  channel       NotifyChannel
  body          String        @db.Text
  isDefault     Boolean       @default(false)
  autoTriggerOn JobStatus?
  createdAt     DateTime      @default(now()) @db.Timestamptz
  updatedAt     DateTime      @updatedAt      @db.Timestamptz

  notifications JobNotification[]

  @@unique([name, channel])
  @@index([channel])
  @@index([autoTriggerOn])
  @@map("notification_templates")
}

// Append at the bottom of the file:
enum NotificationStatus {
  PENDING
  SENT
  DISMISSED
}

enum NotificationTrigger {
  AUTO
  MANUAL
}

model JobNotification {
  id           String               @id @default(cuid())
  jobId        String
  job          Job                  @relation(fields: [jobId], references: [id], onDelete: Cascade)
  templateId   String
  template     NotificationTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)
  status       NotificationStatus   @default(PENDING)
  triggeredBy  NotificationTrigger
  sentAt       DateTime?            @db.Timestamptz
  sentByUserId String?
  sentBy       User?                @relation(fields: [sentByUserId], references: [id], onDelete: SetNull)
  createdAt    DateTime             @default(now()) @db.Timestamptz
  updatedAt    DateTime             @updatedAt      @db.Timestamptz

  @@index([jobId])
  @@index([status])
  @@index([status, createdAt])
  @@map("job_notifications")
}
```

Also add to the `Job` model's relations block (near other `@relation` lines):

```prisma
  notifications   JobNotification[]
```

And to the `User` model's relations block:

```prisma
  sentNotifications JobNotification[]
```

- [ ] **Step 2: Generate and run the migration**

Run: `pnpm prisma migrate dev --name add_job_notifications`
Expected: Prisma prints "Applied migration ..." and regenerates the client. No prompts.

- [ ] **Step 3: Verify the migration SQL looks sane**

Run: `pnpm -s exec ls -1t prisma/migrations | head -1`
Note the folder name, then: `pnpm -s exec cat prisma/migrations/<that-folder>/migration.sql`
Expected: `CREATE TYPE "NotificationStatus"`, `CREATE TYPE "NotificationTrigger"`, `ALTER TABLE "notification_templates" ADD COLUMN "autoTriggerOn"`, `CREATE TABLE "job_notifications"`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add JobNotification + autoTriggerOn to templates"
```

---

### Task 6: Add Zod schemas for notification endpoints

**Files:**
- Create: `shared/schemas/notifications.ts`
- Modify: `shared/schemas/index.ts`

- [ ] **Step 1: Create the schema file**

```ts
// shared/schemas/notifications.ts
import { z } from "zod";

export const listPendingNotificationsQuerySchema = z.object({
  jobId: z.string().optional(),
});

export const markNotificationSentSchema = z.object({
  sentAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
});

export const createManualNotificationSchema = z.object({
  jobId: z.string().min(1),
  templateId: z.string().min(1),
});

export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  autoTriggerOn: z
    .enum([
      "INTAKE",
      "WAITING_FOR_PARTS",
      "IN_REPAIR",
      "ON_HOLD",
      "DONE",
      "DELIVERED",
      "RETURNED",
      "CANCELLED",
    ])
    .nullable()
    .optional(),
});

export type ListPendingNotificationsQuery = z.infer<
  typeof listPendingNotificationsQuerySchema
>;
export type MarkNotificationSentInput = z.infer<
  typeof markNotificationSentSchema
>;
export type CreateManualNotificationInput = z.infer<
  typeof createManualNotificationSchema
>;
export type UpdateNotificationTemplateInput = z.infer<
  typeof updateNotificationTemplateSchema
>;
```

- [ ] **Step 2: Re-export from the barrel**

In `shared/schemas/index.ts`, replace any existing `updateNotificationTemplateSchema` import/export with a re-export from the new file, and add the new schemas:

```ts
// shared/schemas/index.ts — add (or replace existing notification export with):
export * from "./notifications.js";
```

If the old `updateNotificationTemplateSchema` was defined inline in `index.ts`, delete the inline definition (the new file is authoritative).

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add shared/schemas/notifications.ts shared/schemas/index.ts
git commit -m "feat(schemas): add notification intent schemas"
```

---

### Task 7: Notification service — create/list/mark-sent/dismiss

**Files:**
- Create: `server/services/notification.service.ts`
- Test: `server/services/__tests__/notification.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/services/__tests__/notification.service.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPendingForStatus,
  listPending,
  markSent,
  dismiss,
  createManual,
} from "../notification.service.js";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    notificationTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    jobNotification: {
      create: vi.fn().mockImplementation(({ data }) => ({
        id: "n_new",
        ...data,
        createdAt: new Date(),
      })),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ where, data }) => ({
        id: where.id,
        ...data,
      })),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({ id: "j1" }),
    },
    ...overrides,
  } as never;
}

describe("notification.service", () => {
  describe("createPendingForStatus", () => {
    it("creates one pending notification per auto-trigger template match", async () => {
      const prisma = makePrisma({
        notificationTemplate: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: "t1" }, { id: "t2" }]),
        },
      });
      const result = await createPendingForStatus(prisma, "j1", "DONE");
      expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith({
        where: { autoTriggerOn: "DONE" },
      });
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no templates match", async () => {
      const prisma = makePrisma();
      const result = await createPendingForStatus(prisma, "j1", "ON_HOLD");
      expect(result).toEqual([]);
    });
  });

  describe("markSent", () => {
    it("sets status=SENT, sentAt, sentByUserId", async () => {
      const prisma = makePrisma();
      await markSent(prisma, "n1", "u1", new Date("2026-04-17T10:00:00Z"));
      expect(prisma.jobNotification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: {
          status: "SENT",
          sentAt: new Date("2026-04-17T10:00:00Z"),
          sentByUserId: "u1",
        },
      });
    });
  });

  describe("dismiss", () => {
    it("sets status=DISMISSED", async () => {
      const prisma = makePrisma();
      await dismiss(prisma, "n1");
      expect(prisma.jobNotification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { status: "DISMISSED" },
      });
    });
  });

  describe("createManual", () => {
    it("creates a MANUAL pending notification", async () => {
      const prisma = makePrisma({
        notificationTemplate: {
          findUnique: vi.fn().mockResolvedValue({ id: "t1" }),
        },
      });
      const result = await createManual(prisma, "j1", "t1");
      expect(prisma.jobNotification.create).toHaveBeenCalledWith({
        data: {
          jobId: "j1",
          templateId: "t1",
          triggeredBy: "MANUAL",
          status: "PENDING",
        },
      });
      expect(result).toMatchObject({ triggeredBy: "MANUAL" });
    });

    it("returns error when template missing", async () => {
      const prisma = makePrisma();
      const result = await createManual(prisma, "j1", "missing");
      expect(result).toEqual({ error: "TEMPLATE_NOT_FOUND" });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test server/services/__tests__/notification.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// server/services/notification.service.ts
import type { JobStatus, PrismaClient } from "@prisma/client";

type PrismaOrTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function createPendingForStatus(
  prisma: PrismaOrTx,
  jobId: string,
  status: JobStatus
) {
  const templates = await prisma.notificationTemplate.findMany({
    where: { autoTriggerOn: status },
  });
  const created = [];
  for (const template of templates) {
    const row = await prisma.jobNotification.create({
      data: {
        jobId,
        templateId: template.id,
        triggeredBy: "AUTO",
        status: "PENDING",
      },
    });
    created.push(row);
  }
  return created;
}

export async function listPending(
  prisma: PrismaOrTx,
  opts: { jobId?: string } = {}
) {
  return prisma.jobNotification.findMany({
    where: {
      status: "PENDING",
      ...(opts.jobId ? { jobId: opts.jobId } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      template: true,
      job: {
        select: {
          id: true,
          jobCode: true,
          status: true,
          customer: { select: { id: true, name: true, phone: true } },
          device: { select: { brand: true, model: true } },
        },
      },
    },
  });
}

export async function markSent(
  prisma: PrismaOrTx,
  notificationId: string,
  userId: string,
  sentAt: Date
) {
  return prisma.jobNotification.update({
    where: { id: notificationId },
    data: {
      status: "SENT",
      sentAt,
      sentByUserId: userId,
    },
  });
}

export async function dismiss(prisma: PrismaOrTx, notificationId: string) {
  return prisma.jobNotification.update({
    where: { id: notificationId },
    data: { status: "DISMISSED" },
  });
}

export async function createManual(
  prisma: PrismaOrTx,
  jobId: string,
  templateId: string
): Promise<
  | { error: "JOB_NOT_FOUND" | "TEMPLATE_NOT_FOUND" }
  | Awaited<ReturnType<PrismaOrTx["jobNotification"]["create"]>>
> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { error: "JOB_NOT_FOUND" };
  const template = await prisma.notificationTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) return { error: "TEMPLATE_NOT_FOUND" };
  return prisma.jobNotification.create({
    data: {
      jobId,
      templateId,
      triggeredBy: "MANUAL",
      status: "PENDING",
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test server/services/__tests__/notification.service.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/notification.service.ts server/services/__tests__/notification.service.test.ts
git commit -m "feat(notifications): add notification intent service"
```

---

### Task 8: Hook bus → create pending notifications on status change

**Files:**
- Create: `server/events/notification-triggers.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create the subscriber module**

```ts
// server/events/notification-triggers.ts
import type { PrismaClient } from "@prisma/client";
import { bus } from "./event-bus.js";
import { createPendingForStatus } from "../services/notification.service.js";

export function registerNotificationTriggers(
  prisma: PrismaClient,
  log: { error: (err: unknown, msg?: string) => void }
): void {
  bus.on("job.status.changed", async ({ jobId, toStatus }) => {
    try {
      const created = await createPendingForStatus(
        prisma,
        jobId,
        toStatus as never
      );
      for (const row of created) {
        bus.emit("notification.pending", {
          notificationId: row.id,
          jobId: row.jobId,
        });
      }
    } catch (err) {
      log.error(err, "Failed to create pending notifications");
    }
  });
}
```

- [ ] **Step 2: Register the subscriber in server bootstrap**

In `server/index.ts`, add after `await app.register(prismaPlugin);` but before `await app.register(websocketPlugin);`:

```ts
import { registerNotificationTriggers } from "./events/notification-triggers.js";
// ...
registerNotificationTriggers(app.prisma, app.log);
```

Place the new `import` with the other imports at the top of the file.

- [ ] **Step 3: Smoke-test**

Run: `pnpm run dev:server`, then in another terminal: transition a job status via the existing API (e.g. PATCH `/api/jobs/:id/status` with `{ status: "DONE" }`) for a job whose templates include one with `autoTriggerOn = "DONE"`.
Expected: Server logs include no errors; a row appears in `job_notifications` with `status = 'PENDING'`, `triggeredBy = 'AUTO'`.

Verify with: `pnpm prisma studio` → `job_notifications` table.

- [ ] **Step 4: Commit**

```bash
git add server/events/notification-triggers.ts server/index.ts
git commit -m "feat(notifications): auto-create pending notifications on job status change"
```

---

### Task 9: Notification endpoints

**Files:**
- Modify: `server/routes/notifications.ts`
- Modify: `shared/constants/roles.ts`

- [ ] **Step 1: Add `notifications:send` permission to TECHNICIAN (optional) and confirm front-desk already has it**

Open `shared/constants/roles.ts` and verify `FRONT_DESK` includes `"notifications:send"` (it does). No edit needed here unless you want technicians to send — leave as-is.

- [ ] **Step 2: Replace `server/routes/notifications.ts` contents**

```ts
// server/routes/notifications.ts
import {
  createManualNotificationSchema,
  listPendingNotificationsQuerySchema,
  markNotificationSentSchema,
  updateNotificationTemplateSchema,
} from "@shared/schemas";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { bus } from "../events/event-bus.js";
import {
  createManual,
  dismiss,
  listPending,
  markSent,
} from "../services/notification.service.js";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
} from "../services/settings.service.js";

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return reply
    .status(status)
    .send({ error: code, message, details: details ?? {} });
}

function getUserId(req: FastifyRequest): string {
  if (!req.user) throw new Error("Unauthorized");
  return req.user.id;
}

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/templates",
    { preHandler: [requirePermission("notifications:read")] },
    async (_req, reply) => {
      const templates = await getNotificationTemplates(app.prisma);
      return reply.send(templates);
    }
  );

  app.put(
    "/templates/:id",
    { preHandler: [requirePermission("notifications:manage")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateNotificationTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid body", {
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const updated = await updateNotificationTemplate(
        app.prisma,
        id,
        parsed.data
      );
      if (!updated) {
        return sendError(
          reply,
          404,
          "TEMPLATE_NOT_FOUND",
          "Notification template not found"
        );
      }
      return reply.send(updated);
    }
  );

  app.get(
    "/pending",
    { preHandler: [requirePermission("notifications:read")] },
    async (req, reply) => {
      const parsed = listPendingNotificationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid query", {
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const rows = await listPending(app.prisma, parsed.data);
      return reply.send(rows);
    }
  );

  app.post(
    "/",
    { preHandler: [requirePermission("notifications:send")] },
    async (req, reply) => {
      const parsed = createManualNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid body", {
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await createManual(
        app.prisma,
        parsed.data.jobId,
        parsed.data.templateId
      );
      if ("error" in result && result.error === "JOB_NOT_FOUND") {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in result && result.error === "TEMPLATE_NOT_FOUND") {
        return sendError(
          reply,
          404,
          "TEMPLATE_NOT_FOUND",
          "Template not found"
        );
      }
      bus.emit("notification.pending", {
        notificationId: result.id,
        jobId: result.jobId,
      });
      return reply.status(201).send(result);
    }
  );

  app.patch(
    "/:id/sent",
    { preHandler: [requirePermission("notifications:send")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = markNotificationSentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid body", {
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const userId = getUserId(req);
      const updated = await markSent(app.prisma, id, userId, parsed.data);
      await app.prisma.auditLog.create({
        data: {
          jobId: updated.jobId,
          userId,
          action: "NOTIFICATION_SENT",
          metadata: { notificationId: id },
        },
      });
      bus.emit("notification.sent", {
        notificationId: id,
        jobId: updated.jobId,
      });
      return reply.send(updated);
    }
  );

  app.patch(
    "/:id/dismiss",
    { preHandler: [requirePermission("notifications:send")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const updated = await dismiss(app.prisma, id);
      return reply.send(updated);
    }
  );
};
```

Note: `markNotificationSentSchema` transforms the input to a `Date`; the service signature expects `Date`, matching. If the route call shape mismatches, adjust by passing `parsed.data ?? new Date()`.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Manual happy-path test**

With `pnpm run dev:server` + signed-in browser, use the Network tab / curl to hit:
- `GET /api/notifications/pending` → `[]` or existing rows
- `POST /api/notifications` with body `{ jobId, templateId }` → 201 with new row
- `PATCH /api/notifications/<id>/sent` → 200, status now `SENT`, audit log written

Expected: All three succeed. Verify the audit log row with `pnpm prisma studio`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/notifications.ts
git commit -m "feat(notifications): add pending/send/dismiss/manual endpoints"
```

---

### Task 10: wa.me URL builder + template renderer

**Files:**
- Create: `shared/lib/wa-intent.ts`
- Test: `shared/__tests__/wa-intent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// shared/__tests__/wa-intent.test.ts
import { describe, expect, it } from "vitest";
import { renderTemplate, buildWaMeUrl } from "../lib/wa-intent.js";

describe("renderTemplate", () => {
  it("substitutes {{vars}} case-sensitively", () => {
    expect(
      renderTemplate("Hi {{name}}, job {{jobCode}} is ready.", {
        name: "Ben",
        jobCode: "R-0042",
      })
    ).toBe("Hi Ben, job R-0042 is ready.");
  });

  it("leaves unknown vars as-is", () => {
    expect(renderTemplate("Hello {{mystery}}", { name: "Ben" })).toBe(
      "Hello {{mystery}}"
    );
  });

  it("handles empty vars map", () => {
    expect(renderTemplate("No vars here.", {})).toBe("No vars here.");
  });
});

describe("buildWaMeUrl", () => {
  it("strips non-digits from phone and includes text", () => {
    const url = buildWaMeUrl("+213 555 12 34 56", "Hi Ben");
    expect(url).toBe("https://wa.me/213555123456?text=Hi%20Ben");
  });

  it("encodes special characters in text", () => {
    const url = buildWaMeUrl("0555123456", "Order #42 & receipt");
    expect(url).toBe("https://wa.me/0555123456?text=Order%20%2342%20%26%20receipt");
  });

  it("returns null when phone has no digits", () => {
    expect(buildWaMeUrl("abc", "x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test shared/__tests__/wa-intent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// shared/lib/wa-intent.ts
export function renderTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
}

export function buildWaMeUrl(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test shared/__tests__/wa-intent.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add shared/lib/wa-intent.ts shared/__tests__/wa-intent.test.ts
git commit -m "feat(shared): add wa.me URL builder and template renderer"
```

---

### Task 11: Frontend — useNotifications hook

**Files:**
- Create: `src/hooks/use-notifications.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/use-notifications.ts
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";

export type PendingNotification = {
  id: string;
  status: "PENDING" | "SENT" | "DISMISSED";
  triggeredBy: "AUTO" | "MANUAL";
  createdAt: string;
  template: {
    id: string;
    name: string;
    channel: "WHATSAPP" | "SMS";
    body: string;
  };
  job: {
    id: string;
    jobCode: string;
    status: string;
    customer: { id: string; name: string; phone: string };
    device: { brand: string; model: string };
  };
};

export function usePendingNotifications(jobId?: string) {
  return useQuery<PendingNotification[]>({
    queryKey: ["notifications", "pending", jobId ?? "all"],
    queryFn: async () => {
      const res = await api.get("/notifications/pending", {
        params: jobId ? { jobId } : undefined,
      });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useMarkNotificationSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/notifications/${id}/sent`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "pending"] });
    },
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/notifications/${id}/dismiss`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "pending"] });
    },
  });
}

export function useCreateManualNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; templateId: string }) => {
      const res = await api.post("/notifications", input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "pending"] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors. If `@tanstack/react-query` types are missing, stop and install: `pnpm add @tanstack/react-query` — but it's almost certainly already a dep (dashboards already use it). Verify with `grep tanstack package.json`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-notifications.ts
git commit -m "feat(hooks): add notification queries and mutations"
```

---

### Task 12: Frontend — NotifyCustomerButton

**Files:**
- Create: `src/components/modules/notifications/notify-customer-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/modules/notifications/notify-customer-button.tsx
import { useTranslation } from "react-i18next";
import { buildWaMeUrl, renderTemplate } from "@shared/lib/wa-intent";
import {
  useMarkNotificationSent,
  type PendingNotification,
} from "@/hooks/use-notifications";

type Props = {
  notification: PendingNotification;
  variant?: "filled" | "tonal";
};

export default function NotifyCustomerButton({
  notification,
  variant = "filled",
}: Props) {
  const { t } = useTranslation();
  const markSent = useMarkNotificationSent();

  const handleClick = () => {
    const vars: Record<string, string> = {
      name: notification.job.customer.name,
      jobCode: notification.job.jobCode,
      deviceBrand: notification.job.device.brand,
      deviceModel: notification.job.device.model,
      status: notification.job.status,
    };
    const text = renderTemplate(notification.template.body, vars);
    const url = buildWaMeUrl(notification.job.customer.phone, text);
    if (!url) {
      alert(t("notifications.invalid_phone"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    markSent.mutate(notification.id);
  };

  const classes =
    variant === "filled"
      ? "bg-primary text-on-primary hover:bg-primary/90"
      : "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/90";

  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-sm transition-colors ${classes} disabled:opacity-50`}
      disabled={markSent.isPending}
      onClick={handleClick}
      type="button"
    >
      <span className="material-symbols-outlined text-base">send</span>
      {t("notifications.notify_on_whatsapp")}
    </button>
  );
}
```

- [ ] **Step 2: Add locale keys**

In `src/i18n/locales/en.json`, add under the root object:

```json
"notifications": {
  "notify_on_whatsapp": "Notify on WhatsApp",
  "invalid_phone": "Customer phone number is invalid or missing.",
  "pending_header": "Pending customer notifications",
  "no_pending": "No notifications waiting",
  "dismiss": "Dismiss",
  "auto_label": "Auto",
  "manual_label": "Manual"
}
```

Then sync translations: `pnpm run sync-locales`.
Expected: `fr.json` and `ar.json` are updated automatically. If the script fails, commit `en.json` alone and ask the user to run sync.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/notifications/notify-customer-button.tsx src/i18n/locales/
git commit -m "feat(ui): add NotifyCustomerButton with wa.me deep link"
```

---

### Task 13: Frontend — PendingNotificationsWidget

**Files:**
- Create: `src/components/modules/dashboard/pending-notifications-widget.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/modules/dashboard/pending-notifications-widget.tsx
import { useTranslation } from "react-i18next";
import NotifyCustomerButton from "@/components/modules/notifications/notify-customer-button";
import {
  useDismissNotification,
  usePendingNotifications,
} from "@/hooks/use-notifications";

export default function PendingNotificationsWidget() {
  const { t } = useTranslation();
  const { data, isLoading } = usePendingNotifications();
  const dismiss = useDismissNotification();

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-on-surface text-sm uppercase tracking-wide">
          {t("notifications.pending_header")}
        </h3>
        {data && data.length > 0 ? (
          <span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-on-primary text-xs">
            {data.length}
          </span>
        ) : null}
      </header>

      {isLoading ? (
        <div className="py-6 text-center text-on-surface-variant text-sm">
          …
        </div>
      ) : null}

      {!isLoading && (!data || data.length === 0) ? (
        <div className="py-6 text-center text-on-surface-variant text-sm">
          {t("notifications.no_pending")}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {data?.map((n) => (
          <li
            className="flex flex-col gap-2 rounded-xl bg-surface-container-high p-3"
            key={n.id}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-on-surface text-sm">
                  {n.job.customer.name}
                </div>
                <div className="text-on-surface-variant text-xs">
                  #{n.job.jobCode} — {n.template.name}
                </div>
              </div>
              <span className="rounded-full bg-surface-container px-2 py-0.5 font-medium text-[10px] text-on-surface-variant uppercase">
                {n.triggeredBy === "AUTO"
                  ? t("notifications.auto_label")
                  : t("notifications.manual_label")}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-full px-3 py-1 font-medium text-on-surface-variant text-xs hover:bg-surface-container"
                onClick={() => dismiss.mutate(n.id)}
                type="button"
              >
                {t("notifications.dismiss")}
              </button>
              <NotifyCustomerButton notification={n} variant="tonal" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/dashboard/pending-notifications-widget.tsx
git commit -m "feat(ui): add pending notifications widget"
```

---

## Phase 3 — Dashboard Analytics

Replace every `MOCK_*` constant with real queries via composable widget endpoints.

### Task 14: Analytics service — queries

**Files:**
- Create: `server/services/analytics.service.ts`
- Test: `server/services/__tests__/analytics.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/services/__tests__/analytics.service.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  getOverdueJobs,
  getWaitingQueue,
  getTechnicianSchedule,
  getLowStockAlerts,
  getPickupReady,
} from "../analytics.service.js";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    job: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    jobPartsWaiting: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as never;
}

describe("analytics.service", () => {
  describe("getOverdueJobs", () => {
    it("queries jobs with estimatedDate before today and non-terminal status", async () => {
      const prisma = makePrisma();
      await getOverdueJobs(prisma);
      const args = prisma.job.findMany.mock.calls[0][0];
      expect(args.where.estimatedDate.lt).toBeInstanceOf(Date);
      expect(args.where.status.in).toEqual(
        expect.arrayContaining(["IN_REPAIR", "WAITING_FOR_PARTS", "ON_HOLD"])
      );
    });
  });

  describe("getWaitingQueue", () => {
    it("fetches INTAKE jobs sorted by createdAt ascending", async () => {
      const prisma = makePrisma();
      await getWaitingQueue(prisma);
      const args = prisma.job.findMany.mock.calls[0][0];
      expect(args.where.status).toBe("INTAKE");
      expect(args.orderBy).toEqual({ createdAt: "asc" });
    });
  });

  describe("getTechnicianSchedule", () => {
    it("filters by technicianId and active statuses", async () => {
      const prisma = makePrisma();
      await getTechnicianSchedule(prisma, "u1");
      const args = prisma.job.findMany.mock.calls[0][0];
      expect(args.where.technicianId).toBe("u1");
      expect(args.where.status.in).toEqual(
        expect.arrayContaining(["IN_REPAIR", "WAITING_FOR_PARTS", "ON_HOLD"])
      );
    });
  });

  describe("getLowStockAlerts", () => {
    it("returns distinct part names currently being waited on", async () => {
      const prisma = makePrisma({
        jobPartsWaiting: {
          findMany: vi.fn().mockResolvedValue([
            { id: "w1", partName: "Screen X", supplier: "S1", jobId: "j1" },
            { id: "w2", partName: "Screen X", supplier: "S1", jobId: "j2" },
            { id: "w3", partName: "Battery Y", supplier: "S2", jobId: "j3" },
          ]),
        },
      });
      const result = await getLowStockAlerts(prisma);
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.partName === "Screen X")?.jobCount).toBe(2);
      expect(result.find((r) => r.partName === "Battery Y")?.jobCount).toBe(1);
    });
  });

  describe("getPickupReady", () => {
    it("returns DONE jobs not yet DELIVERED", async () => {
      const prisma = makePrisma();
      await getPickupReady(prisma);
      const args = prisma.job.findMany.mock.calls[0][0];
      expect(args.where.status).toBe("DONE");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test server/services/__tests__/analytics.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// server/services/analytics.service.ts
import type { PrismaClient } from "@prisma/client";

type PrismaOrTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

const ACTIVE_STATUSES = ["IN_REPAIR", "WAITING_FOR_PARTS", "ON_HOLD"] as const;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const jobSelect = {
  id: true,
  jobCode: true,
  status: true,
  estimatedDate: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, phone: true } },
  device: { select: { brand: true, model: true } },
  technician: { select: { id: true, name: true, username: true } },
} as const;

export async function getOverdueJobs(prisma: PrismaOrTx) {
  return prisma.job.findMany({
    where: {
      estimatedDate: { lt: startOfToday() },
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { estimatedDate: "asc" },
    select: jobSelect,
  });
}

export async function getWaitingQueue(prisma: PrismaOrTx) {
  return prisma.job.findMany({
    where: { status: "INTAKE" },
    orderBy: { createdAt: "asc" },
    select: jobSelect,
  });
}

export async function getPickupReady(prisma: PrismaOrTx) {
  return prisma.job.findMany({
    where: { status: "DONE" },
    orderBy: { updatedAt: "desc" },
    select: jobSelect,
  });
}

export async function getTechnicianSchedule(
  prisma: PrismaOrTx,
  technicianId: string
) {
  return prisma.job.findMany({
    where: {
      technicianId,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: [{ estimatedDate: "asc" }, { createdAt: "asc" }],
    select: jobSelect,
  });
}

export async function getLowStockAlerts(prisma: PrismaOrTx) {
  const waiting = await prisma.jobPartsWaiting.findMany({
    orderBy: { createdAt: "desc" },
  });
  const byPart = new Map<
    string,
    { partName: string; supplier: string | null; jobCount: number }
  >();
  for (const row of waiting) {
    const key = row.partName;
    const existing = byPart.get(key);
    if (existing) {
      existing.jobCount += 1;
    } else {
      byPart.set(key, {
        partName: row.partName,
        supplier: row.supplier ?? null,
        jobCount: 1,
      });
    }
  }
  return Array.from(byPart.values()).sort((a, b) => b.jobCount - a.jobCount);
}

export async function getFinancialTrends(prisma: PrismaOrTx, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const rows = await prisma.$queryRaw<
    Array<{ day: Date; revenue: number; jobCount: number }>
  >`
    SELECT
      DATE_TRUNC('day', j."updatedAt")::timestamp AS day,
      COALESCE(SUM(jr."price"), 0)::float + COALESCE(SUM(jp."totalCost"), 0)::float AS revenue,
      COUNT(DISTINCT j."id")::int AS "jobCount"
    FROM "jobs" j
    LEFT JOIN "job_repairs" jr ON jr."jobId" = j."id"
    LEFT JOIN "job_parts" jp ON jp."jobId" = j."id"
    WHERE j."updatedAt" >= ${since}
      AND j."status" IN ('DONE', 'DELIVERED')
    GROUP BY DATE_TRUNC('day', j."updatedAt")
    ORDER BY day ASC
  `;
  return rows;
}

export async function getWarrantyReturns(prisma: PrismaOrTx, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return prisma.job.findMany({
    where: {
      isWarrantyReturn: true,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: jobSelect,
  });
}

export async function getRecentActivity(
  prisma: PrismaOrTx,
  opts: { userId?: string; limit?: number } = {}
) {
  return prisma.auditLog.findMany({
    where: opts.userId ? { userId: opts.userId } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 20,
    include: {
      user: { select: { id: true, name: true, username: true } },
      job: { select: { id: true, jobCode: true } },
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test server/services/__tests__/analytics.service.test.ts`
Expected: PASS — all five describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add server/services/analytics.service.ts server/services/__tests__/analytics.service.test.ts
git commit -m "feat(analytics): add widget query service"
```

---

### Task 15: Analytics routes

**Files:**
- Create: `server/routes/analytics.ts`
- Modify: `server/index.ts`
- Modify: `shared/constants/roles.ts`

- [ ] **Step 1: Add analytics permission string**

In `shared/constants/roles.ts`, add `"analytics:view"` to each role's array:
- `OWNER`: append `"analytics:view"`
- `TECHNICIAN`: append `"analytics:view"` (scoped to self at route level)
- `FRONT_DESK`: append `"analytics:view"`

- [ ] **Step 2: Create the route file**

```ts
// server/routes/analytics.ts
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  getFinancialTrends,
  getLowStockAlerts,
  getOverdueJobs,
  getPickupReady,
  getRecentActivity,
  getTechnicianSchedule,
  getWaitingQueue,
  getWarrantyReturns,
} from "../services/analytics.service.js";

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string
) {
  return reply.status(status).send({ error: code, message });
}

function getUserId(req: FastifyRequest): string {
  if (!req.user) throw new Error("Unauthorized");
  return req.user.id;
}

function getRole(req: FastifyRequest): string {
  if (!req.user) throw new Error("Unauthorized");
  return req.user.role;
}

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("analytics:view"));

  app.get("/overdue-jobs", async (_req, reply) => {
    return reply.send(await getOverdueJobs(app.prisma));
  });

  app.get("/waiting-queue", async (_req, reply) => {
    return reply.send(await getWaitingQueue(app.prisma));
  });

  app.get("/pickup-ready", async (_req, reply) => {
    return reply.send(await getPickupReady(app.prisma));
  });

  app.get("/tech-schedule", async (req, reply) => {
    const userId = getUserId(req);
    const role = getRole(req);
    const { technicianId } = req.query as { technicianId?: string };
    const targetId = role === "OWNER" ? technicianId ?? userId : userId;
    return reply.send(await getTechnicianSchedule(app.prisma, targetId));
  });

  app.get("/low-stock-alerts", async (_req, reply) => {
    return reply.send(await getLowStockAlerts(app.prisma));
  });

  app.get("/financial-trends", async (req, reply) => {
    if (getRole(req) !== "OWNER") {
      return sendError(reply, 403, "FORBIDDEN", "Owner-only metric");
    }
    const { days } = req.query as { days?: string };
    const parsedDays = days ? Math.min(Math.max(Number(days), 1), 365) : 30;
    return reply.send(await getFinancialTrends(app.prisma, parsedDays));
  });

  app.get("/warranty-returns", async (req, reply) => {
    if (getRole(req) !== "OWNER") {
      return sendError(reply, 403, "FORBIDDEN", "Owner-only metric");
    }
    const { days } = req.query as { days?: string };
    const parsedDays = days ? Math.min(Math.max(Number(days), 1), 365) : 30;
    return reply.send(await getWarrantyReturns(app.prisma, parsedDays));
  });

  app.get("/recent-activity", async (req, reply) => {
    const role = getRole(req);
    const userId = getUserId(req);
    const { limit } = req.query as { limit?: string };
    const parsedLimit = limit ? Math.min(Math.max(Number(limit), 1), 100) : 20;
    const scope = role === "TECHNICIAN" ? { userId } : {};
    return reply.send(
      await getRecentActivity(app.prisma, { ...scope, limit: parsedLimit })
    );
  });
};
```

- [ ] **Step 3: Register the route plugin**

In `server/index.ts`, add the import with the other route imports:

```ts
import { analyticsRoutes } from "./routes/analytics.js";
```

And register with the other `/api/*` registrations:

```ts
app.register(analyticsRoutes, { prefix: "/api/analytics" });
```

- [ ] **Step 4: Smoke-test endpoints**

With `pnpm run dev:server` running and a signed-in session, hit in the browser or via curl with cookies:
- `GET /api/analytics/waiting-queue`
- `GET /api/analytics/overdue-jobs`
- `GET /api/analytics/tech-schedule`
- `GET /api/analytics/financial-trends?days=7` (as owner; as front-desk should 403)

Expected: 200 with JSON arrays (possibly empty). 403 for owner-only endpoints when signed in as non-owner.

- [ ] **Step 5: Commit**

```bash
git add server/routes/analytics.ts server/index.ts shared/constants/roles.ts
git commit -m "feat(analytics): add /api/analytics/* widget endpoints"
```

---

### Task 16: useAnalytics hook

**Files:**
- Create: `src/hooks/use-analytics.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/use-analytics.ts
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

type JobSummary = {
  id: string;
  jobCode: string;
  status: string;
  estimatedDate: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string };
  device: { brand: string; model: string };
  technician: { id: string; name: string; username: string } | null;
};

export function useOverdueJobs() {
  return useQuery<JobSummary[]>({
    queryKey: ["analytics", "overdue-jobs"],
    queryFn: async () => (await api.get("/analytics/overdue-jobs")).data,
    staleTime: 60_000,
  });
}

export function useWaitingQueue() {
  return useQuery<JobSummary[]>({
    queryKey: ["analytics", "waiting-queue"],
    queryFn: async () => (await api.get("/analytics/waiting-queue")).data,
    staleTime: 30_000,
  });
}

export function usePickupReady() {
  return useQuery<JobSummary[]>({
    queryKey: ["analytics", "pickup-ready"],
    queryFn: async () => (await api.get("/analytics/pickup-ready")).data,
    staleTime: 30_000,
  });
}

export function useTechSchedule(technicianId?: string) {
  return useQuery<JobSummary[]>({
    queryKey: ["analytics", "tech-schedule", technicianId ?? "self"],
    queryFn: async () => {
      const res = await api.get("/analytics/tech-schedule", {
        params: technicianId ? { technicianId } : undefined,
      });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useLowStockAlerts() {
  return useQuery<
    Array<{ partName: string; supplier: string | null; jobCount: number }>
  >({
    queryKey: ["analytics", "low-stock-alerts"],
    queryFn: async () => (await api.get("/analytics/low-stock-alerts")).data,
    staleTime: 60_000,
  });
}

export function useFinancialTrends(days = 30) {
  return useQuery<
    Array<{ day: string; revenue: number; jobCount: number }>
  >({
    queryKey: ["analytics", "financial-trends", days],
    queryFn: async () =>
      (await api.get("/analytics/financial-trends", { params: { days } })).data,
    staleTime: 5 * 60_000,
  });
}

export function useWarrantyReturns(days = 30) {
  return useQuery<JobSummary[]>({
    queryKey: ["analytics", "warranty-returns", days],
    queryFn: async () =>
      (await api.get("/analytics/warranty-returns", { params: { days } })).data,
    staleTime: 5 * 60_000,
  });
}

export function useRecentActivity(limit = 20) {
  return useQuery<
    Array<{
      id: string;
      action: string;
      fromValue: string | null;
      toValue: string | null;
      createdAt: string;
      user: { id: string; name: string; username: string };
      job: { id: string; jobCode: string } | null;
    }>
  >({
    queryKey: ["analytics", "recent-activity", limit],
    queryFn: async () =>
      (await api.get("/analytics/recent-activity", { params: { limit } })).data,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-analytics.ts
git commit -m "feat(hooks): add analytics widget queries"
```

---

### Task 17: Wire front-desk dashboard to real data

**Files:**
- Modify: `src/pages/dashboard/front-desk.tsx`
- Modify: `src/components/modules/dashboard/priority-alerts-panel.tsx` (if its prop shape is incompatible — see Step 4)
- Modify: `src/components/modules/dashboard/waiting-customers.tsx` (same note)

- [ ] **Step 1: Read the current widget component contracts**

Run: `pnpm -s exec cat src/components/modules/dashboard/priority-alerts-panel.tsx src/components/modules/dashboard/waiting-customers.tsx`

Note the exact `alerts` / `customers` prop shapes.

- [ ] **Step 2: Replace the front-desk page — delete MOCK constants and wire real data**

Replace the body of `src/pages/dashboard/front-desk.tsx` with:

```tsx
import {
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  type JobStatusType,
} from "@shared/constants";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActiveRepairsQueue from "@/components/modules/dashboard/active-repairs-queue";
import PendingNotificationsWidget from "@/components/modules/dashboard/pending-notifications-widget";
import PriorityAlertsPanel from "@/components/modules/dashboard/priority-alerts-panel";
import QuickIntakeForm from "@/components/modules/dashboard/quick-intake-form";
import QuickStatsChips from "@/components/modules/dashboard/quick-stats-chips";
import TodayOverview from "@/components/modules/dashboard/today-overview";
import WaitingCustomers from "@/components/modules/dashboard/waiting-customers";
import {
  useLowStockAlerts,
  useOverdueJobs,
  usePickupReady,
  useWaitingQueue,
} from "@/hooks/use-analytics";
import { useJobsStore } from "@/stores/jobs";

function timeAgo(date: Date | string): string {
  const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FrontDeskPage() {
  const { t } = useTranslation();
  const { jobs, isLoadingJobs, fetchJobs } = useJobsStore();
  const overdue = useOverdueJobs();
  const pickup = usePickupReady();
  const waiting = useWaitingQueue();
  const lowStock = useLowStockAlerts();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const activeRepairs = useMemo(() => {
    const isCompleted = (s: JobStatusType) =>
      COMPLETED_STATUSES.includes(s) || s === "CANCELLED";
    return jobs
      .filter(
        (j) => ACTIVE_STATUSES.includes(j.status) || isCompleted(j.status)
      )
      .map((j) => ({
        id: j.jobCode,
        deviceModel: `${j.device.brand} ${j.device.model}`,
        customerName: j.customer.name,
        status: j.status,
        estimatedCompletion: j.estimatedDate
          ? formatDate(j.estimatedDate)
          : undefined,
        completedAt:
          COMPLETED_STATUSES.includes(j.status) && j.updatedAt
            ? timeAgo(j.updatedAt)
            : undefined,
        technician: j.technician?.name ?? "Unassigned",
      }));
  }, [jobs]);

  const recentIntakes = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "INTAKE")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 3)
        .map((j) => ({
          id: j.jobCode,
          device: `${j.device.brand} ${j.device.model}`,
          status: j.status,
          timeAgo: timeAgo(j.createdAt),
        })),
    [jobs]
  );

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const { completedToday, totalToday } = useMemo(() => {
    const todayJobs = jobs.filter(
      (j) => new Date(j.createdAt).getTime() >= todayStart
    );
    const completed = todayJobs.filter((j) =>
      COMPLETED_STATUSES.includes(j.status)
    ).length;
    return { completedToday: completed, totalToday: todayJobs.length };
  }, [jobs, todayStart]);

  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      icon: string;
      title: string;
      description: string;
      variant: "error" | "secondary" | "tertiary";
    }> = [];
    if (overdue.data && overdue.data.length > 0) {
      list.push({
        id: "alert-overdue",
        icon: "warning",
        title: t("front_desk.alerts.overdue_title", {
          count: overdue.data.length,
        }),
        description: t("front_desk.alerts.overdue_desc"),
        variant: "error",
      });
    }
    if (pickup.data && pickup.data.length > 0) {
      list.push({
        id: "alert-pickup",
        icon: "check_circle",
        title: t("front_desk.alerts.pickup_title", {
          count: pickup.data.length,
        }),
        description: t("front_desk.alerts.pickup_desc"),
        variant: "secondary",
      });
    }
    if (lowStock.data && lowStock.data.length > 0) {
      list.push({
        id: "alert-parts",
        icon: "inventory_2",
        title: t("front_desk.alerts.parts_title", {
          count: lowStock.data.length,
        }),
        description: lowStock.data[0].partName,
        variant: "tertiary",
      });
    }
    return list;
  }, [overdue.data, pickup.data, lowStock.data, t]);

  const waitingCustomers = useMemo(
    () =>
      (waiting.data ?? []).slice(0, 6).map((j) => {
        const initials = j.customer.name
          .split(/\s+/)
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        const waitMinutes = Math.max(
          1,
          Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 60_000)
        );
        return {
          id: j.id,
          initials,
          name: j.customer.name,
          waitMinutes,
        };
      }),
    [waiting.data]
  );

  if (isLoadingJobs && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("front_desk.title")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("front_desk.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-5">
          <ActiveRepairsQueue jobs={activeRepairs} />
        </div>

        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-4">
          <TodayOverview
            completedToday={completedToday}
            recentIntakes={recentIntakes}
            totalToday={totalToday}
          />
          <QuickIntakeForm />
        </div>

        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-3">
          <PriorityAlertsPanel alerts={alerts} />
          <PendingNotificationsWidget />
          <WaitingCustomers customers={waitingCustomers} />
          <QuickStatsChips
            stats={[
              { labelKey: "front_desk.mttr", value: "—" },
              { labelKey: "front_desk.csat", value: "—" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
```

Note the alert-panel prop shape must match the widget's existing interface. If it differs, update the widget to accept this shape (one export).

- [ ] **Step 3: Add new locale keys**

In `src/i18n/locales/en.json`, add inside `front_desk`:

```json
"alerts": {
  "overdue_title": "{{count}} repairs overdue",
  "overdue_desc": "Action required",
  "pickup_title": "{{count}} ready for pickup",
  "pickup_desc": "Contact customers",
  "parts_title": "{{count}} parts arriving",
  "parts_desc": "See details"
}
```

Then run `pnpm run sync-locales`.

- [ ] **Step 4: Adjust widget components if needed**

If typecheck fails because `PriorityAlertsPanel`'s prop shape differs from the one above, open `src/components/modules/dashboard/priority-alerts-panel.tsx` and change its `Alert` type to:

```ts
type Alert = {
  id: string;
  icon: string;
  title: string;
  description: string;
  variant: "error" | "secondary" | "tertiary";
};
```

— and pass the new shape through. Only adjust if typecheck actually fails.

- [ ] **Step 5: Smoke-test in the browser**

Run: `pnpm run dev` (starts both server and Vite). Sign in as front-desk. Visit the front-desk dashboard.
Expected: Real waiting queue count, real pickup-ready count, real overdue count. Pending-notifications widget shows "No notifications waiting" initially. Transition a job to a status with `autoTriggerOn` set → widget updates (may need refresh until Task 19 adds realtime).

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard/front-desk.tsx src/components/modules/dashboard/ src/i18n/locales/
git commit -m "feat(dashboard): wire front-desk to real analytics + notifications"
```

---

### Task 18: Wire technician and owner dashboards to real data

**Files:**
- Modify: `src/pages/dashboard/technician.tsx`
- Modify: `src/pages/dashboard/index.tsx`

- [ ] **Step 1: Replace MOCK constants in `src/pages/dashboard/technician.tsx`**

Read the current file, then delete every `const MOCK_* = [...]` declaration and replace their usages. Minimally:

```tsx
// At the top of src/pages/dashboard/technician.tsx — add imports:
import {
  useLowStockAlerts,
  useRecentActivity,
  useTechSchedule,
} from "@/hooks/use-analytics";

// Inside the component (after existing hooks):
const schedule = useTechSchedule();
const activity = useRecentActivity(20);
const lowStock = useLowStockAlerts();
```

Then, wherever `MOCK_SCHEDULE` was used, pass `schedule.data ?? []` shaped to the component's expected prop. Same for `MOCK_ACTIVITY` → `activity.data ?? []`, `MOCK_PARTS_ALERTS` → `lowStock.data ?? []`. For `MOCK_PRIORITY_ACTIONS`, derive from `schedule.data` filtered by `status === 'WAITING_FOR_PARTS'` or overdue `estimatedDate < today`.

If existing widget components expect fields that aren't in the analytics response (e.g. a "last_update" string), map the analytics data to the expected shape inline with `.map(...)`.

Delete the now-unused `MOCK_*` constants entirely.

- [ ] **Step 2: Replace MOCK constants in `src/pages/dashboard/index.tsx`**

Same pattern. Add:

```tsx
import {
  useFinancialTrends,
  useOverdueJobs,
  useWarrantyReturns,
} from "@/hooks/use-analytics";

// Inside the component:
const trends = useFinancialTrends(30);
const overdue = useOverdueJobs();
const warranty = useWarrantyReturns(30);
```

Replace `MOCK_FINANCIAL_DATA` with `trends.data ?? []` (mapped to the chart's expected `{ label, value }` shape using `day` and `revenue`). Replace `MOCK_OVERDUE_JOBS` with `overdue.data ?? []`. Replace `MOCK_WARRANTY_RETURNS` with `warranty.data ?? []`.

Delete the MOCK constants.

- [ ] **Step 3: Typecheck + visual smoke-test**

Run: `pnpm exec tsc --noEmit` → 0 errors.
Run: `pnpm run dev`, sign in as a technician → schedule loads real assigned jobs. Sign in as owner → financial chart renders; if DB is empty, show an "empty state" via the widget's existing behavior. No MOCK strings visible anywhere.

Run: `pnpm -s exec grep -n "MOCK_" src/pages/dashboard/` — expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/
git commit -m "feat(dashboard): replace MOCK_* on technician and owner dashboards with real analytics"
```

---

### Task 19: Realtime client — invalidate queries on WS events

**Files:**
- Create: `src/hooks/use-realtime.ts`
- Modify: `src/App.tsx` (mount the hook at app root)

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/use-realtime.ts
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type WsMessage =
  | { type: "job.status.changed"; payload: { jobId: string } }
  | { type: "notification.pending"; payload: { jobId: string } }
  | { type: "notification.sent"; payload: { jobId: string } };

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const base = import.meta.env.VITE_API_BASE_URL || window.location.host;
  const hostOnly = base.replace(/^https?:\/\//, "");
  return `${proto}//${hostOnly}/ws`;
}

export function useRealtime(): void {
  const qc = useQueryClient();
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(getWsUrl());
      socket.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === "job.status.changed") {
            qc.invalidateQueries({ queryKey: ["analytics"] });
            qc.invalidateQueries({ queryKey: ["notifications", "pending"] });
          } else if (
            msg.type === "notification.pending" ||
            msg.type === "notification.sent"
          ) {
            qc.invalidateQueries({ queryKey: ["notifications", "pending"] });
          }
        } catch {
          // Ignore malformed frames
        }
      };
      socket.onclose = () => {
        if (closed) return;
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
      }
      socket?.close();
    };
  }, [qc]);
}
```

- [ ] **Step 2: Mount the hook inside an authenticated layout wrapper**

Find the component in `src/App.tsx` that gates authenticated routes (search for where the session is checked). Add inside that component (before its `return`):

```tsx
useRealtime();
```

And import at the top:

```tsx
import { useRealtime } from "@/hooks/use-realtime";
```

If there's no obvious auth-layout component, create a `src/components/providers/realtime-provider.tsx`:

```tsx
import { type ReactNode } from "react";
import { useRealtime } from "@/hooks/use-realtime";

export default function RealtimeProvider({ children }: { children: ReactNode }) {
  useRealtime();
  return <>{children}</>;
}
```

and wrap the authenticated routes section of `App.tsx` in `<RealtimeProvider>…</RealtimeProvider>`.

- [ ] **Step 3: End-to-end realtime test**

Open two browser windows signed in as different roles. In window A, transition a job status (via the existing job detail page). In window B, watch the front-desk dashboard — pending-notifications widget and overdue counts should update within ~1 second without a manual refresh.

Expected: Live update visible. Kill the server, wait 4 seconds, restart — WS should reconnect automatically.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-realtime.ts src/App.tsx src/components/providers/
git commit -m "feat(realtime): reconnecting WS client invalidates analytics queries"
```

---

### Task 20: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass, including existing RBAC and route-security tests.

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run linter**

Run: `pnpm exec ultracite check` (or the project's configured lint command)
Expected: 0 errors. Fix any issues by applying best practices — do not suppress.

- [ ] **Step 4: Search for remaining mocks**

Run: `pnpm -s exec grep -rn "MOCK_" src/pages/dashboard/ src/components/modules/dashboard/`
Expected: no output.

Run: `pnpm -s exec grep -rn "TODO.*implement\|not implemented\|ai analyst" server/`
Expected: only the AI analyst stub in `server/routes/ai.ts` (out of scope for this plan).

- [ ] **Step 5: Manual flow: auto-notification end-to-end**

1. As owner, visit Settings → Notifications, pick a WhatsApp template, set `autoTriggerOn = DONE`, save.
2. As technician, transition a job to `DONE`.
3. As front-desk, observe pending-notifications widget shows the new item within 1s.
4. Click "Notify on WhatsApp" — a new tab opens with `https://wa.me/…?text=…` containing the rendered template; the widget removes the item.
5. Verify `audit_logs` table has a `NOTIFICATION_SENT` row (via `pnpm prisma studio`).

Expected: All five steps succeed.

- [ ] **Step 6: Commit the final state and push**

If any docs/session-notes were added during execution, commit them now:

```bash
git add docs/session-notes.md
git commit -m "docs: session notes from dashboards/notifications/ws implementation"
```

Ready to merge once code review passes.

---

## Out of Scope (Deferred)

- AI analyst implementation (separate plan — user opted out for now).
- Twilio / WhatsApp Business API programmatic send (browser-intent path chosen).
- SMS channel send path (template kept for future, no delivery wired).
- Background job queue / Redis / BullMQ (not needed at current shop scale).
- `AiChatHistory` routes (depends on AI analyst plan).
