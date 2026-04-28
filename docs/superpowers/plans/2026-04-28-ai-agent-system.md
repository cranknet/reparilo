# AI Agent System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock AI analyst with a full agent system: SSE streaming chat, multi-agent definitions, conversation persistence with history panel, memories, instructions, and real OpenAI-backed tool execution — adapted to Reparilo's Fastify + React Router + Zustand + react-i18next stack.

**Architecture:** The reference codebase (`Code/`) uses Next.js App Router with per-user settings and multi-model Prisma schema. We adapt it to Reparilo's stack: Fastify routes, React Router pages, Zustand stores, global `AiSettings` (single-row), and existing `AiChatHistory` model extended with new models. The front-end reuses the reference's component structure but uses Material Symbols icons, Tailwind (Reparilo's Material Design color tokens), react-i18next, and Zustand instead of Radix/shadcn.

**Tech Stack:** Fastify (server), React Router v7 (client), Zustand (state), react-i18next (i18n), OpenAI SDK, Prisma 7, Zod, Tailwind CSS 4, Vitest

**Key differences from reference:**
- Global `AiSettings` (single row) instead of per-user `AgentSettings`
- Flat Fastify route plugin (not Next.js route handlers)
- Zustand store instead of React Context for chat panel state
- react-i18next `useTranslation()` instead of next-intl `useTranslations()`
- Material Symbols icons instead of Remix Icon
- No CSRF for streaming (use existing Axios CSRF for mutations, raw fetch for SSE)
- Conversation scoped to current user (userId FK on AiConversation)

---

## File Structure

### Prisma schema additions
- Modify: `prisma/schema.prisma` — add `AiConversation`, `AiMessage`, `AiAgentDefinition`, `AiMemory`, `AiInstruction` models; extend `AiSettings`

### Server — new files
- Create: `server/routes/ai.ts` — rewrite as full Fastify plugin with sub-routes
- Create: `server/services/ai-chat.service.ts` — SSE streaming, conversation/message CRUD
- Create: `server/services/ai-agent.service.ts` — agent definitions, memories, instructions CRUD
- Create: `server/ai/stream.ts` — OpenAI streaming logic, tool execution, context assembly
- Create: `server/ai/tools.ts` — built-in tool implementations (queryDatabase, getSchema)
- Create: `server/ai/context.ts` — system prompt assembly (agent definition + memories + instructions + schema)

### Shared — new files
- Create: `shared/schemas/ai.schema.ts` — Zod schemas for all AI endpoints

### Front-end — new/modified files
- Modify: `src/app.tsx` — add `/ai-analyst` routes
- Create: `src/pages/ai-analyst/index.tsx` — rewrite as agent chat page (server data loader replaced by store)
- Create: `src/pages/ai-analyst/chat-interface.tsx` — main chat UI with SSE streaming
- Create: `src/pages/ai-analyst/markdown-renderer.tsx` — react-markdown + remark-gfm + rehype-highlight
- Create: `src/pages/ai-analyst/layout.tsx` — chat layout with side panel
- Create: `src/pages/ai-analyst/settings/page.tsx` — settings + definitions tabs
- Create: `src/pages/ai-analyst/settings/agent-settings-tabs.tsx` — connection & agents tabs
- Create: `src/pages/ai-analyst/settings/agent-definitions-tab.tsx` — agent definitions CRUD
- Create: `src/pages/ai-analyst/memories/page.tsx` — memories & instructions management
- Create: `src/components/modules/ai-analyst/chat-panel-store.ts` — Zustand store for chat panel
- Create: `src/components/modules/ai-analyst/conversation-history-panel.tsx` — side panel
- Create: `src/components/modules/ai-analyst/conversation-item.tsx` — single conversation row
- Create: `src/components/modules/ai-analyst/conversation-group.tsx` — date grouping
- Create: `src/components/modules/ai-analyst/chat-empty-state.tsx` — welcome / suggestions
- Create: `src/components/modules/ai-analyst/agent-selector.tsx` — agent pill selector
- Create: `src/components/modules/ai-analyst/rename-dialog.tsx` — rename conversation dialog
- Modify: `src/components/modules/ai-analyst/chat-input.tsx` — keep, adapt for streaming
- Modify: `src/components/modules/ai-analyst/chat-message.tsx` — keep, add markdown rendering
- Delete: `src/components/modules/ai-analyst/config-panel.tsx` — replaced by settings page
- Modify: `src/i18n/locales/en.json` — add new i18n keys for AI agent features

---

## Task 1: Prisma Schema — Add Agent Models

**Files:**
- Modify: `prisma/schema.prisma`

This task adds the new models needed for conversations, agent definitions, memories, and instructions. We keep the existing `AiSettings` and `AiChatHistory` models. The new `AiConversation` and `AiMessage` models provide full conversation management. `AiAgentDefinition`, `AiMemory`, `AiInstruction` support the multi-agent system.

- [ ] **Step 1: Add new enum and models to prisma/schema.prisma**

Add after the existing `AiChatHistory` model (around line 519), before `ShopSettings`:

```prisma
enum AiMessageFeedback {
  THUMBS_UP
  THUMBS_DOWN
}

// ─────────────────────────────────────────────
// AI CONVERSATIONS
// ─────────────────────────────────────────────

model AiConversation {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String?
  starred   Boolean     @default(false)
  messages  AiMessage[]
  createdAt DateTime    @default(now()) @db.Timestamptz
  updatedAt DateTime    @updatedAt      @db.Timestamptz

  @@index([userId, updatedAt])
  @@index([userId, starred])
  @@map("ai_conversations")
}

model AiMessage {
  id             String           @id @default(cuid())
  conversationId String
  conversation   AiConversation   @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           AiRole
  content        String           @db.Text
  agentName      String?
  toolCalls      Json?
  pinned         Boolean          @default(false)
  feedback       AiMessageFeedback?
  createdAt      DateTime         @default(now()) @db.Timestamptz

  @@index([conversationId, createdAt])
  @@map("ai_messages")
}

// ─────────────────────────────────────────────
// AI AGENT DEFINITIONS
// ─────────────────────────────────────────────

model AiAgentDefinition {
  id                String   @id @default(cuid())
  name              String   @unique
  displayName       String
  instructions      String   @default("") @db.Text
  toolNames         String[] @default([])
  handoffKeywords   String[] @default([])
  isActive          Boolean  @default(true)
  isBuiltIn         Boolean  @default(false)
  enabledHostedTools String[] @default([])
  vectorStoreId     String?
  createdAt         DateTime @default(now()) @db.Timestamptz
  updatedAt         DateTime @updatedAt      @db.Timestamptz

  @@map("ai_agent_definitions")
}

// ─────────────────────────────────────────────
// AI MEMORIES
// Per-shop persistent knowledge for the AI agent.
// ─────────────────────────────────────────────

model AiMemory {
  id        String   @id @default(cuid())
  content   String   @db.Text
  tags      String[] @default([])
  source    String   @default("manual")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt      @db.Timestamptz

  @@map("ai_memories")
}

// ─────────────────────────────────────────────
// AI INSTRUCTIONS
// Reusable instruction snippets for agent context.
// ─────────────────────────────────────────────

model AiInstruction {
  id        String   @id @default(cuid())
  content   String   @db.Text
  tags      String[] @default([])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt      @db.Timestamptz

  @@map("ai_instructions")
}
```

Also add the relation to the `User` model — add `conversations AiConversation[]` alongside the existing `chatHistory AiChatHistory[]`.

- [ ] **Step 2: Run migration**

```bash
pnpm db:migrate
```

Expected: Migration created and applied successfully.

- [ ] **Step 3: Generate Prisma client**

```bash
pnpm db:generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(ai): add conversation, message, agent definition, memory, instruction models"
```

---

## Task 2: Shared Schemas — AI Endpoint Validation

**Files:**
- Create: `shared/schemas/ai.schema.ts`
- Modify: `shared/schemas/index.ts`

- [ ] **Step 1: Create shared/schemas/ai.schema.ts**

```typescript
import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  starred: z.boolean().optional(),
});

export const bulkDeleteConversationsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(50),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(10_000),
  language: z.string().min(2).max(5).optional(),
  conversationId: z.string().cuid().optional(),
  agentName: z.string().min(1).max(100).optional(),
});

export const updateMessageSchema = z.object({
  pinned: z.boolean().optional(),
  feedback: z.enum(["THUMBS_UP", "THUMBS_DOWN"]).nullable().optional(),
});

export const listQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const messagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const agentDefinitionCreateSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  instructions: z.string().max(50_000).default(""),
  toolNames: z.array(z.string()).default([]),
  handoffKeywords: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  enabledHostedTools: z.array(z.string()).default([]),
  vectorStoreId: z.string().optional(),
});

export const agentDefinitionUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  instructions: z.string().max(50_000).optional(),
  toolNames: z.array(z.string()).optional(),
  handoffKeywords: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  enabledHostedTools: z.array(z.string()).optional(),
  vectorStoreId: z.string().nullable().optional(),
});

export const aiMemorySchema = z.object({
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string()).default([]),
});

export const aiInstructionSchema = z.object({
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string()).default([]),
});

export const exportQuerySchema = z.object({
  format: z.enum(["text", "json"]).default("text"),
});

export const updateAiSettingsExtendedSchema = z.object({
  endpointUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  enabled: z.boolean().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type BulkDeleteConversationsInput = z.infer<typeof bulkDeleteConversationsSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
export type AgentDefinitionCreateInput = z.infer<typeof agentDefinitionCreateSchema>;
export type AgentDefinitionUpdateInput = z.infer<typeof agentDefinitionUpdateSchema>;
export type AiMemoryInput = z.infer<typeof aiMemorySchema>;
export type AiInstructionInput = z.infer<typeof aiInstructionSchema>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
export type UpdateAiSettingsExtendedInput = z.infer<typeof updateAiSettingsExtendedSchema>;
```

- [ ] **Step 2: Export from shared/schemas/index.ts**

Add these exports to the barrel:

```typescript
export type {
  AgentDefinitionCreateInput,
  AgentDefinitionUpdateInput,
  AiInstructionInput,
  AiMemoryInput,
  BulkDeleteConversationsInput,
  ChatMessageInput,
  CreateConversationInput,
  ExportQueryInput,
  ListQueryInput,
  MessagesQueryInput,
  UpdateAiSettingsExtendedInput,
  UpdateConversationInput,
  UpdateMessageInput,
} from "./ai.schema";
export {
  agentDefinitionCreateSchema,
  agentDefinitionUpdateSchema,
  aiInstructionSchema,
  aiMemorySchema,
  bulkDeleteConversationsSchema,
  chatMessageSchema,
  createConversationSchema,
  exportQuerySchema,
  listQuerySchema,
  messagesQuerySchema,
  updateAiSettingsExtendedSchema,
  updateConversationSchema,
  updateMessageSchema,
} from "./ai.schema";
```

- [ ] **Step 3: Verify types compile**

```bash
pnpm check
```

- [ ] **Step 4: Commit**

```bash
git add shared/schemas/ai.schema.ts shared/schemas/index.ts
git commit -m "feat(ai): add Zod validation schemas for AI agent endpoints"
```

---

## Task 3: Extend AiSettings — Add `enabled` Field

**Files:**
- Modify: `prisma/schema.prisma`

The existing `AiSettings` model needs an `enabled` boolean to match the reference's on/off toggle.

- [ ] **Step 1: Add `enabled` field to AiSettings model**

In `prisma/schema.prisma`, find the `AiSettings` model (around line 490) and add:

```prisma
model AiSettings {
  id              String   @id
  endpointUrl     String   @default("")
  apiKeyEncrypted String   @default("")
  model           String?
  temperature     Float    @default(0.7)
  enabled         Boolean  @default(false)
  createdAt       DateTime @default(now()) @db.Timestamptz
  updatedAt       DateTime @updatedAt      @db.Timestamptz

  @@map("ai_settings")
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm db:migrate
pnpm db:generate
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(ai): add enabled field to AiSettings"
```

---

## Task 4: AI Agent Service — Definitions, Memories, Instructions CRUD

**Files:**
- Create: `server/services/ai-agent.service.ts`
- Create: `server/services/__tests__/ai-agent.service.test.ts`

- [ ] **Step 1: Create server/services/ai-agent.service.ts**

```typescript
import type { PrismaClient } from "@generated/client";
import type {
  AgentDefinitionCreateInput,
  AgentDefinitionUpdateInput,
  AiInstructionInput,
  AiMemoryInput,
} from "@shared/schemas";

export async function listAgentDefinitions(prisma: PrismaClient) {
  return prisma.aiAgentDefinition.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function getAgentDefinition(prisma: PrismaClient, id: string) {
  return prisma.aiAgentDefinition.findUnique({ where: { id } });
}

export async function createAgentDefinition(
  prisma: PrismaClient,
  data: AgentDefinitionCreateInput
) {
  return prisma.aiAgentDefinition.create({ data });
}

export async function updateAgentDefinition(
  prisma: PrismaClient,
  id: string,
  data: AgentDefinitionUpdateInput
) {
  const existing = await prisma.aiAgentDefinition.findUnique({ where: { id } });
  if (!existing) return null;

  if (existing.isBuiltIn && data.name !== undefined) {
    delete data.name;
  }

  return prisma.aiAgentDefinition.update({ where: { id }, data });
}

export async function deleteAgentDefinition(prisma: PrismaClient, id: string) {
  const existing = await prisma.aiAgentDefinition.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.isBuiltIn) {
    throw new Error("Cannot delete built-in agent definitions");
  }
  return prisma.aiAgentDefinition.delete({ where: { id } });
}

export async function listMemories(prisma: PrismaClient) {
  return prisma.aiMemory.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createMemory(
  prisma: PrismaClient,
  data: AiMemoryInput
) {
  return prisma.aiMemory.create({
    data: { ...data, source: "manual" },
  });
}

export async function updateMemory(
  prisma: PrismaClient,
  id: string,
  data: AiMemoryInput
) {
  const existing = await prisma.aiMemory.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.aiMemory.update({ where: { id }, data });
}

export async function deleteMemory(prisma: PrismaClient, id: string) {
  const existing = await prisma.aiMemory.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.aiMemory.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listInstructions(prisma: PrismaClient) {
  return prisma.aiInstruction.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createInstruction(
  prisma: PrismaClient,
  data: AiInstructionInput
) {
  return prisma.aiInstruction.create({ data });
}

export async function updateInstruction(
  prisma: PrismaClient,
  id: string,
  data: AiInstructionInput
) {
  const existing = await prisma.aiInstruction.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.aiInstruction.update({ where: { id }, data });
}

export async function deleteInstruction(prisma: PrismaClient, id: string) {
  const existing = await prisma.aiInstruction.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.aiInstruction.update({
    where: { id },
    data: { isActive: false },
  });
}
```

- [ ] **Step 2: Create server/services/__tests__/ai-agent.service.test.ts**

```typescript
import type { PrismaClient } from "@generated/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentDefinition,
  deleteAgentDefinition,
  listAgentDefinitions,
  updateAgentDefinition,
} from "../ai-agent.service";

function mockPrisma() {
  return {
    aiAgentDefinition: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("ai-agent.service", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  describe("listAgentDefinitions", () => {
    it("returns all definitions ordered by createdAt", async () => {
      const defs = [
        { id: "1", name: "general_assistant", displayName: "General Assistant" },
      ];
      (prisma.aiAgentDefinition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(defs);
      const result = await listAgentDefinitions(prisma);
      expect(result).toEqual(defs);
      expect(prisma.aiAgentDefinition.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("deleteAgentDefinition", () => {
    it("rejects deletion of built-in definitions", async () => {
      (prisma.aiAgentDefinition.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "1",
        isBuiltIn: true,
      });
      await expect(deleteAgentDefinition(prisma, "1")).rejects.toThrow(
        "Cannot delete built-in agent definitions"
      );
    });

    it("returns null when definition not found", async () => {
      (prisma.aiAgentDefinition.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await deleteAgentDefinition(prisma, "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("updateAgentDefinition", () => {
    it("strips name update for built-in agents", async () => {
      (prisma.aiAgentDefinition.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "1",
        isBuiltIn: true,
        name: "general_assistant",
      });
      const updated = { id: "1", name: "general_assistant", displayName: "New Name" };
      (prisma.aiAgentDefinition.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await updateAgentDefinition(prisma, "1", {
        name: "new_name",
        displayName: "New Name",
      });

      expect(prisma.aiAgentDefinition.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: expect.not.objectContaining({ name: "new_name" }),
      });
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test -- server/services/__tests__/ai-agent.service.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/services/ai-agent.service.ts server/services/__tests__/ai-agent.service.test.ts
git commit -m "feat(ai): add agent definition, memory, instruction CRUD service"
```

---

## Task 5: AI Chat Service — Conversation & Message CRUD

**Files:**
- Create: `server/services/ai-chat.service.ts`
- Create: `server/services/__tests__/ai-chat.service.test.ts`

- [ ] **Step 1: Create server/services/ai-chat.service.ts**

```typescript
import type { PrismaClient } from "@generated/client";
import type {
  BulkDeleteConversationsInput,
  ListQueryInput,
  MessagesQueryInput,
  UpdateConversationInput,
  UpdateMessageInput,
} from "@shared/schemas";

export async function listConversations(
  prisma: PrismaClient,
  userId: string,
  query: ListQueryInput
) {
  const { search, cursor, limit } = query;
  const where = {
    userId,
    ...(search
      ? { title: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const conversations = await prisma.aiConversation.findMany({
    where,
    orderBy: [{ starred: "desc" }, { updatedAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      starred: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      messages: {
        where: { role: "USER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, limit) : conversations;
  const nextCursor = hasMore ? items.at(-1)?.id : undefined;

  const lastAssistantMessages = await prisma.aiMessage.findMany({
    where: {
      conversationId: { in: items.map((c) => c.id) },
      role: "ASSISTANT",
      agentName: { not: null },
    },
    distinct: ["conversationId"],
    orderBy: { createdAt: "desc" },
    select: { conversationId: true, agentName: true },
  });

  const agentNameMap = new Map(
    lastAssistantMessages.map((m) => [m.conversationId, m.agentName])
  );

  const result = items.map((conv) => ({
    id: conv.id,
    title: conv.title,
    starred: conv.starred,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    agentName: agentNameMap.get(conv.id) ?? null,
    messageCount: conv._count.messages,
    firstMessage: conv.messages[0]?.content?.slice(0, 100) ?? null,
  }));

  return { items: result, ...(nextCursor ? { nextCursor } : {}) };
}

export async function getConversation(
  prisma: PrismaClient,
  userId: string,
  id: string
) {
  return prisma.aiConversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
}

export async function createConversation(
  prisma: PrismaClient,
  userId: string,
  title?: string
) {
  return prisma.aiConversation.create({
    data: { userId, title: title ?? null },
  });
}

export async function updateConversation(
  prisma: PrismaClient,
  userId: string,
  id: string,
  data: UpdateConversationInput
) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id, userId },
  });
  if (!conversation) return null;
  return prisma.aiConversation.update({ where: { id }, data });
}

export async function deleteConversation(
  prisma: PrismaClient,
  userId: string,
  id: string
) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id, userId },
  });
  if (!conversation) return null;
  return prisma.aiConversation.delete({ where: { id } });
}

export async function bulkDeleteConversations(
  prisma: PrismaClient,
  userId: string,
  input: BulkDeleteConversationsInput
) {
  const result = await prisma.aiConversation.deleteMany({
    where: { id: { in: input.ids }, userId },
  });
  return { deleted: result.count };
}

export async function listMessages(
  prisma: PrismaClient,
  userId: string,
  conversationId: string,
  query: MessagesQueryInput
) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!conversation) return null;

  const { page, limit } = query;
  const [messages, total] = await Promise.all([
    prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.aiMessage.count({ where: { conversationId } }),
  ]);

  return { items: messages, total, page, limit };
}

export async function updateMessage(
  prisma: PrismaClient,
  userId: string,
  conversationId: string,
  messageId: string,
  data: UpdateMessageInput
) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!conversation) return null;

  const message = await prisma.aiMessage.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) return null;

  return prisma.aiMessage.update({ where: { id: messageId }, data });
}

export async function deleteMessage(
  prisma: PrismaClient,
  userId: string,
  conversationId: string,
  messageId: string
) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!conversation) return null;

  const message = await prisma.aiMessage.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) return null;

  return prisma.aiMessage.delete({ where: { id: messageId } });
}

export async function exportConversation(
  prisma: PrismaClient,
  userId: string,
  id: string
) {
  return prisma.aiConversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}
```

- [ ] **Step 2: Create server/services/__tests__/ai-chat.service.test.ts**

Write tests for `listConversations`, `updateConversation`, `bulkDeleteConversations`, and `listMessages` using the same `mockPrisma()` pattern from the settings tests.

- [ ] **Step 3: Run tests**

```bash
pnpm test -- server/services/__tests__/ai-chat.service.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add server/services/ai-chat.service.ts server/services/__tests__/ai-chat.service.test.ts
git commit -m "feat(ai): add conversation and message CRUD service"
```

---

## Task 6: AI Streaming — OpenAI Integration & Tool Execution

**Files:**
- Create: `server/ai/tools.ts`
- Create: `server/ai/context.ts`
- Create: `server/ai/stream.ts`

This is the core: assembling the system prompt, calling OpenAI with SSE, executing tools, and persisting messages.

- [ ] **Step 1: Create server/ai/tools.ts — Built-in tool implementations**

```typescript
import type { PrismaClient } from "@generated/client";

interface ToolResult {
  success: boolean;
  data: string;
}

export async function executeGetSchema(
  prisma: PrismaClient,
  tableName?: string
): Promise<ToolResult> {
  const tables = tableName ? [tableName] : [
    "jobs", "customers", "parts", "repairs", "users",
  ];

  const results: Record<string, unknown> = {};
  for (const table of tables) {
    try {
      const columns = await prisma.$queryRawUnsafe(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position`,
        table
      );
      results[table] = columns;
    } catch {
      results[table] = { error: `Table '${table}' not found` };
    }
  }
  return { success: true, data: JSON.stringify(results) };
}

export async function executeQueryDatabase(
  prisma: PrismaClient,
  sql: string
): Promise<ToolResult> {
  const normalizedSql = sql.trim().toLowerCase();
  const forbiddenKeywords = [
    "insert", "update", "delete", "drop", "alter", "create", "truncate", "grant",
  ];
  for (const kw of forbiddenKeywords) {
    if (normalizedSql.startsWith(kw)) {
      return { success: false, data: `Only SELECT queries are allowed. Found: ${kw}` };
    }
  }

  try {
    const result = await prisma.$queryRawUnsafe(sql);
    return { success: true, data: JSON.stringify(result) };
  } catch (err) {
    return {
      success: false,
      data: `Query error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
```

- [ ] **Step 2: Create server/ai/context.ts — System prompt assembly**

```typescript
import type { PrismaClient } from "@generated/client";

export async function assembleSystemPrompt(
  prisma: PrismaClient,
  agentName: string
): Promise<string> {
  const [definition, memories, instructions] = await Promise.all([
    prisma.aiAgentDefinition.findFirst({
      where: { name: agentName, isActive: true },
    }),
    prisma.aiMemory.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.aiInstruction.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const parts: string[] = [];

  if (definition?.instructions) {
    parts.push(definition.instructions);
  }

  if (instructions.length > 0) {
    parts.push(
      "## Additional Instructions\n",
      ...instructions.map((i) => `- ${i.content}`)
    );
  }

  if (memories.length > 0) {
    parts.push(
      "## Shop Knowledge\n",
      ...memories.map((m) => `- ${m.content}`)
    );
  }

  return parts.join("\n\n") || "You are a helpful AI assistant for a phone repair shop.";
}

export function getToolDefinitions(agentName: string, prisma: PrismaClient) {
  return [
    {
      type: "function" as const,
      function: {
        name: "getSchema",
        description: "Retrieve column definitions for database tables",
        parameters: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "Optional specific table name. If omitted, returns schema for all main tables.",
            },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "queryDatabase",
        description: "Execute a read-only SQL query against the business database",
        parameters: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "The SQL SELECT query to execute",
            },
          },
          required: ["sql"],
        },
      },
    },
  ];
}
```

- [ ] **Step 3: Create server/ai/stream.ts — SSE streaming with OpenAI**

```typescript
import type { PrismaClient } from "@generated/client";
import OpenAI from "openai";
import type { AiSettings } from "@generated/client";
import { decryptSecret, isEncrypted } from "../lib/crypto.js";
import { assembleSystemPrompt, getToolDefinitions } from "./context.js";
import { executeGetSchema, executeQueryDatabase } from "./tools.js";

interface StreamParams {
  prisma: PrismaClient;
  settings: AiSettings;
  userId: string;
  message: string;
  conversationId?: string;
  agentName?: string;
  language?: string;
}

interface StreamResult {
  conversationId: string;
  stream: ReadableStream<Uint8Array>;
}

function resolveApiKey(settings: AiSettings): string {
  if (!settings.apiKeyEncrypted) return "";
  return isEncrypted(settings.apiKeyEncrypted)
    ? decryptSecret(settings.apiKeyEncrypted)
    : settings.apiKeyEncrypted;
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function streamChat(params: StreamParams): Promise<StreamResult> {
  const { prisma, settings, userId, message, conversationId, agentName, language } = params;

  const apiKey = resolveApiKey(settings);
  if (!apiKey || !settings.endpointUrl) {
    throw new Error("AI is not configured. Please set up your API key and endpoint.");
  }

  const resolvedAgentName = agentName ?? "general_assistant";

  let conversationId = conversationId;
  if (!conversationId) {
    const conv = await prisma.aiConversation.create({
      data: { userId },
    });
    conversationId = conv.id;
  }

  await prisma.aiMessage.create({
    data: {
      conversationId,
      role: "USER",
      content: message,
    },
  });

  const previousMessages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 30,
    select: { role: true, content: true },
  });

  const systemPrompt = await assembleSystemPrompt(prisma, resolvedAgentName);
  const tools = getToolDefinitions(resolvedAgentName, prisma);

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...previousMessages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  const client = new OpenAI({
    apiKey,
    baseURL: settings.endpointUrl,
    timeout: 60_000,
  });

  const encoder = new TextEncoder();
  let assistantContent = "";
  const toolCallsLog: Array<{ tool: string; status: string; result?: string }> = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await client.chat.completions.create({
          model: settings.model ?? "gpt-4o",
          messages: openaiMessages,
          tools,
          temperature: settings.temperature ?? 0.7,
          stream: true,
        });

        let currentToolCall: {
          id: string;
          name: string;
          arguments: string;
        } | null = null;
        const toolCalls: Array<{
          id: string;
          function: { name: string; arguments: string };
        }> = [];

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            assistantContent += delta.content;
            controller.enqueue(encoder.encode(sseEvent({
              type: "content",
              delta: delta.content,
              agentName: resolvedAgentName,
            })));
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                if (currentToolCall) {
                  toolCalls.push({
                    id: currentToolCall.id,
                    function: {
                      name: currentToolCall.name,
                      arguments: currentToolCall.arguments,
                    },
                  });
                }
                currentToolCall = {
                  id: tc.id,
                  name: tc.function?.name ?? "",
                  arguments: tc.function?.arguments ?? "",
                };
                controller.enqueue(encoder.encode(sseEvent({
                  type: "tool_call",
                  tool: tc.function?.name,
                  status: "running",
                })));
              }
              if (tc.function?.arguments && currentToolCall) {
                currentToolCall.arguments += tc.function.arguments;
              }
            }
          }
        }

        if (currentToolCall) {
          toolCalls.push({
            id: currentToolCall.id,
            function: {
              name: currentToolCall.name,
              arguments: currentToolCall.arguments,
            },
          });
        }

        if (toolCalls.length > 0) {
          const followUpMessages: OpenAI.ChatCompletionMessageParam[] = [
            ...openaiMessages,
            {
              role: "assistant",
              content: assistantContent || null,
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })),
            },
          ];

          for (const tc of toolCalls) {
            const args = JSON.parse(tc.function.arguments || "{}");
            let result: string;

            if (tc.function.name === "queryDatabase") {
              result = (await executeQueryDatabase(prisma, args.sql)).data;
            } else if (tc.function.name === "getSchema") {
              result = (await executeGetSchema(prisma, args.tableName)).data;
            } else {
              result = `Unknown tool: ${tc.function.name}`;
            }

            followUpMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });

            controller.enqueue(encoder.encode(sseEvent({
              type: "tool_call",
              tool: tc.function.name,
              status: "completed",
              result: result.slice(0, 200),
            })));
          }

          const followUp = await client.chat.completions.create({
            model: settings.model ?? "gpt-4o",
            messages: followUpMessages,
            temperature: settings.temperature ?? 0.7,
            stream: true,
          });

          for await (const chunk of followUp) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              assistantContent += delta.content;
              controller.enqueue(encoder.encode(sseEvent({
                type: "content",
                delta: delta.content,
                agentName: resolvedAgentName,
              })));
            }
          }
        }

        await prisma.aiMessage.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: assistantContent,
            agentName: resolvedAgentName,
            toolCalls: toolCallsLog.length > 0 ? toolCallsLog : undefined,
          },
        });

        if (!params.conversationId) {
          const titleContent = message.slice(0, 80);
          await prisma.aiConversation.update({
            where: { id: conversationId },
            data: { title: titleContent },
          });
          controller.enqueue(encoder.encode(sseEvent({
            type: "title",
            title: titleContent,
          })));
        }

        controller.enqueue(encoder.encode(sseEvent({ type: "done" })));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(sseEvent({
          type: "error",
          message,
          errorType: "streamError",
        })));
        controller.close();
      }
    },
  });

  return { conversationId, stream };
}
```

- [ ] **Step 4: Commit**

```bash
git add server/ai/tools.ts server/ai/context.ts server/ai/stream.ts
git commit -m "feat(ai): add OpenAI streaming, tool execution, and context assembly"
```

---

## Task 7: AI Routes — Fastify Plugin Rewrite

**Files:**
- Modify: `server/routes/ai.ts`

Rewrite the stub AI route as a full Fastify plugin with sub-routes for conversations, messages, streaming, definitions, memories, instructions, settings, and tools.

- [ ] **Step 1: Rewrite server/routes/ai.ts**

The full route plugin covers:
- `GET /` — list conversations (paginated, cursor-based)
- `POST /` — bulk delete conversations
- `GET /:id` — get conversation with messages
- `PUT /:id` — update conversation (title, star)
- `DELETE /:id` — delete conversation
- `GET /:id/messages` — paginated messages
- `PUT /:id/messages/:messageId` — update message (pin, feedback)
- `DELETE /:id/messages/:messageId` — delete message
- `GET /:id/export` — export conversation
- `POST /chat/stream` — SSE streaming chat
- `GET /definitions` — list agent definitions
- `POST /definitions` — create definition
- `GET /definitions/:defId` — get definition
- `PUT /definitions/:defId` — update definition
- `DELETE /definitions/:defId` — delete definition
- `GET /memories` — list memories
- `POST /memories` — create memory
- `PUT /memories/:memId` — update memory
- `DELETE /memories/:memId` — soft-delete memory
- `GET /instructions` — list instructions
- `POST /instructions` — create instruction
- `PUT /instructions/:instId` — update instruction
- `DELETE /instructions/:instId` — soft-delete instruction
- `GET /tools/available` — list built-in tools
- `GET /settings` — get AI settings
- `PUT /settings` — update AI settings
- `POST /settings/test` — test AI connection

This is a large file (~400 lines). Follow the existing pattern from `server/routes/settings.ts`: use `requirePermission`, Zod validation, `resolveZodErrors`, and call the service layer.

Key points:
- `POST /chat/stream` returns `text/event-stream` with `X-Conversation-Id` header
- All conversation routes require `{ ai: ["access"] }` permission
- Settings mutation routes require `{ settings: ["edit"] }` permission
- The stream endpoint reads `req.user.id` for conversation scoping

- [ ] **Step 2: Register the routes in server/index.ts**

Add the import and registration. Change the existing `aiRoutes` registration to use the prefix:

```typescript
import { aiRoutes } from "./routes/ai.js";
// ...
app.register(aiRoutes, { prefix: "/api/ai" });
```

- [ ] **Step 3: Run the server to verify no startup errors**

```bash
pnpm server
```

Expected: Server starts without errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/ai.ts server/index.ts
git commit -m "feat(ai): rewrite AI routes as full Fastify plugin"
```

---

## Task 8: Chat Panel Zustand Store

**Files:**
- Create: `src/stores/ai-chat.ts`

This replaces the reference's `ChatPanelProvider` context with a Zustand store — simpler and follows Reparilo's existing state management pattern.

- [ ] **Step 1: Create src/stores/ai-chat.ts**

```typescript
import { create } from "zustand";

const STORAGE_KEY_OPEN = "ai-chat-panel";
const STORAGE_KEY_WIDTH = "ai-chat-panel-width";
const MIN_PANEL_WIDTH = 220;
const MAX_PANEL_WIDTH = 480;
const DEFAULT_PANEL_WIDTH = 280;

interface AiChatState {
  activeConversationId: string | null;
  mobileSheetOpen: boolean;
  panelCollapsed: boolean;
  panelOpen: boolean;
  panelWidth: number;
  refreshKey: number;

  createNewConversation: () => void;
  getDraft: (conversationId: string) => string;
  initFromStorage: () => void;
  setActiveConversationId: (id: string | null) => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileSheetOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  togglePanel: () => void;
  triggerRefresh: () => void;
  setDraft: (conversationId: string, text: string) => void;
}

const drafts = new Map<string, string>();

export const useAiChatStore = create<AiChatState>((set, get) => ({
  activeConversationId: null,
  mobileSheetOpen: false,
  panelCollapsed: false,
  panelOpen: true,
  panelWidth: DEFAULT_PANEL_WIDTH,
  refreshKey: 0,

  initFromStorage: () => {
    if (typeof window === "undefined") return;
    const isDesktop = window.innerWidth >= 1024;
    const storedOpen = localStorage.getItem(STORAGE_KEY_OPEN);
    const panelOpen = storedOpen === null ? isDesktop : storedOpen === "true";
    const storedWidth = localStorage.getItem(STORAGE_KEY_WIDTH);
    let panelWidth = DEFAULT_PANEL_WIDTH;
    if (storedWidth) {
      const parsed = Number(storedWidth);
      if (Number.isFinite(parsed)) {
        panelWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, parsed));
      }
    }
    set({ panelOpen, panelWidth });
  },

  createNewConversation: () => set({ activeConversationId: null }),

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  togglePanel: () => {
    const next = !get().panelOpen;
    localStorage.setItem(STORAGE_KEY_OPEN, String(next));
    set({ panelOpen: next });
  },

  setCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),

  setPanelWidth: (width) => {
    const clamped = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));
    localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped));
    set({ panelWidth: clamped });
  },

  setMobileSheetOpen: (open) => set({ mobileSheetOpen: open }),

  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),

  getDraft: (conversationId) => drafts.get(conversationId) ?? "",

  setDraft: (conversationId, text) => {
    if (text) {
      drafts.set(conversationId, text);
    } else {
      drafts.delete(conversationId);
    }
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/ai-chat.ts
git commit -m "feat(ai): add Zustand store for AI chat panel state"
```

---

## Task 9: i18n Keys for AI Agent Features

**Files:**
- Modify: `src/i18n/locales/en.json`

Add new keys for conversation history panel, agent selector, tool calls, memories, settings tabs, etc. Group them under an `ai_agent` namespace within the flat JSON (using dot-like prefixes).

- [ ] **Step 1: Add new i18n keys to en.json**

Add these keys (the exact location doesn't matter in a flat JSON; group near existing AI keys):

```json
{
  "ai_agent_title": "AI Analyst",
  "ai_agent_subtitle": "Ask about your shop data",
  "ai_agent_disabled": "AI Analyst is disabled",
  "ai_agent_disabled_desc": "Enable it in settings to start asking questions about your shop.",
  "ai_agent_open_settings": "Open Settings",
  "ai_agent_typing": "AI is thinking...",
  "ai_agent_send": "Send",
  "ai_agent_stop": "Stop generating",
  "ai_agent_retry": "Retry",
  "ai_agent_stream_error": "Something went wrong. Please try again.",
  "ai_agent_placeholder": "Ask about repairs, parts, revenue...",
  "ai_agent_press": "Press",
  "ai_agent_to_send": "to send",
  "ai_agent_copy_conversation": "Copy conversation",
  "ai_agent_conversation_copied": "Conversation copied",
  "ai_agent_conversation_copy_failed": "Failed to copy",
  "ai_agent_agent_switch_title": "Switch Agent?",
  "ai_agent_agent_switch_desc": "Switching agents will start a new conversation.",
  "ai_agent_new_conversation_title": "New Conversation?",
  "ai_agent_new_conversation_desc": "Start a new conversation? Current one will be saved.",

  "ai_agent_role_user": "You",
  "ai_agent_role_assistant": "AI",

  "ai_agent_tool_analyzing": "Analyzing your data...",
  "ai_agent_tool_used": "Used {{count}} tools",
  "ai_agent_tool_get_schema": "Inspecting Schema",
  "ai_agent_tool_query_database": "Querying Database",
  "ai_agent_tool_name_get_schema": "Get Schema",
  "ai_agent_tool_name_query_database": "Query Database",
  "ai_agent_tool_error_suggestion": "Try rephrasing your question.",

  "ai_agent_empty_welcome": "Ask About Your Shop",
  "ai_agent_empty_desc": "Get insights on repairs, inventory, revenue, and customers.",
  "ai_agent_empty_sales": "Sales Analysis",
  "ai_agent_empty_inventory": "Inventory Management",
  "ai_agent_empty_customers": "Customer Insights",
  "ai_agent_empty_finance": "Financial Reports",
  "ai_agent_empty_quick_tip": "Quick questions:",
  "ai_agent_empty_featured_hint": "Most popular — ask about your shop",
  "ai_agent_prompt_sales_trend": "Sales trend",
  "ai_agent_prompt_sales_trend_text": "What's the sales trend this month?",
  "ai_agent_prompt_top_products": "Top repairs",
  "ai_agent_prompt_top_products_text": "Which repairs bring in the most revenue?",
  "ai_agent_prompt_profit_margin": "Profit margins",
  "ai_agent_prompt_profit_margin_text": "What are my profit margins by repair type?",
  "ai_agent_prompt_stock_level": "Stock levels",
  "ai_agent_prompt_stock_level_text": "Which parts are running low?",
  "ai_agent_prompt_low_stock": "Low stock alerts",
  "ai_agent_prompt_low_stock_text": "Show parts below minimum stock",
  "ai_agent_prompt_stock_value": "Stock value",
  "ai_agent_prompt_stock_value_text": "What's the total value of my parts inventory?",
  "ai_agent_prompt_top_customers": "Top customers",
  "ai_agent_prompt_top_customers_text": "Who are my most frequent customers?",
  "ai_agent_prompt_customer_history": "Customer history",
  "ai_agent_prompt_customer_history_text": "Show a customer's full repair history",
  "ai_agent_prompt_customer_debt": "Outstanding balances",
  "ai_agent_prompt_customer_debt_text": "Which customers have outstanding balances?",
  "ai_agent_prompt_daily_revenue": "Daily revenue",
  "ai_agent_prompt_daily_revenue_text": "What's today's revenue?",
  "ai_agent_prompt_expenses": "Expenses",
  "ai_agent_prompt_expenses_text": "What are my expenses this month?",
  "ai_agent_prompt_profit_report": "Profit report",
  "ai_agent_prompt_profit_report_text": "Show profit report for this month",
  "ai_agent_prompt_recent_sales": "Recent sales",
  "ai_agent_prompt_recent_sales_text": "Show recent sales",
  "ai_agent_prompt_inventory_check": "Inventory check",
  "ai_agent_prompt_inventory_check_text": "Check current inventory status",
  "ai_agent_prompt_today_summary": "Today's summary",
  "ai_agent_prompt_today_summary_text": "Give me today's business summary",

  "ai_history_title": "Conversations",
  "ai_history_new": "New Conversation",
  "ai_history_search": "Search conversations...",
  "ai_history_empty": "No conversations yet",
  "ai_history_empty_desc": "Start a conversation to see it here.",
  "ai_history_starred": "Starred",
  "ai_history_today": "Today",
  "ai_history_yesterday": "Yesterday",
  "ai_history_this_week": "This Week",
  "ai_history_older": "Older",
  "ai_history_untitled": "Untitled",
  "ai_history_just_now": "Just now",
  "ai_history_message_count": "{{count}} messages",
  "ai_history_rename": "Rename",
  "ai_history_star": "Star",
  "ai_history_unstar": "Unstar",
  "ai_history_delete": "Delete",
  "ai_history_delete_title": "Delete Conversation?",
  "ai_history_delete_desc": "This action cannot be undone.",
  "ai_history_delete_selected": "Delete Selected",
  "ai_history_delete_selected_title": "Delete {{count}} Conversations?",
  "ai_history_delete_selected_desc": "This will permanently delete {{count}} conversations.",
  "ai_history_select_mode": "Select mode",
  "ai_history_collapse": "Collapse panel",
  "ai_history_expand": "Expand panel",
  "ai_history_resize": "Resize panel",
  "ai_history_rename_title": "Rename Conversation",
  "ai_history_rename_placeholder": "Enter new title...",
  "ai_history_save": "Save",
  "ai_history_cancel": "Cancel",
  "ai_history_collapsed_label": "CHATS",

  "ai_settings_title": "AI Settings",
  "ai_settings_description": "Configure your AI assistant connection and agents.",
  "ai_settings_tabs_connection": "Connection",
  "ai_settings_tabs_agents": "Agents",
  "ai_settings_status_section": "Status",
  "ai_settings_enabled": "AI Enabled",
  "ai_settings_enabled_desc": "Enable or disable the AI analyst feature.",
  "ai_settings_provider_section": "Provider",
  "ai_settings_endpoint_section": "Endpoint",
  "ai_settings_custom_base_url": "Base URL",
  "ai_settings_custom_base_url_placeholder": "https://api.openai.com/v1",
  "ai_settings_url_format_hint": "URL should start with http:// or https://",
  "ai_settings_api_key": "API Key",
  "ai_settings_api_key_placeholder": "Enter your API key",
  "ai_settings_show_api_key": "Show API key",
  "ai_settings_hide_api_key": "Hide API key",
  "ai_settings_test_connection": "Test Connection",
  "ai_settings_testing_connection": "Testing...",
  "ai_settings_connected": "Connected",
  "ai_settings_connection_failed": "Connection failed",
  "ai_settings_connection_success": "Connection successful!",
  "ai_settings_last_verified": "Last verified: {{time}}",
  "ai_settings_model_configuration": "Model Configuration",
  "ai_settings_model": "Model",
  "ai_settings_model_placeholder": "gpt-4o",
  "ai_settings_browse_models": "Browse models",
  "ai_settings_model_search": "Search models...",
  "ai_settings_model_no_results": "No models found",
  "ai_settings_model_fetch_error": "Failed to fetch models",
  "ai_settings_behaviour_section": "Behaviour",
  "ai_settings_temperature": "Temperature",
  "ai_settings_temperature_hint": "Lower = more precise, higher = more creative",
  "ai_settings_max_tokens": "Max Tokens",
  "ai_settings_max_tokens_range_hint": "Recommended: 100–16,384",
  "ai_settings_save": "Save Settings",
  "ai_settings_saving": "Saving...",
  "ai_settings_saved": "Settings saved successfully",
  "ai_settings_discard": "Discard Changes",
  "ai_settings_retry": "Retry",

  "ai_defs_title": "Agent Definitions",
  "ai_defs_description": "Manage AI agents with different capabilities.",
  "ai_defs_add": "Add Agent",
  "ai_defs_edit": "Edit Agent",
  "ai_defs_view": "View Agent",
  "ai_defs_empty": "No agents yet",
  "ai_defs_empty_desc": "Create your first agent to get started.",
  "ai_defs_display_name": "Display Name",
  "ai_defs_display_name_placeholder": "e.g. Data Analyst",
  "ai_defs_name": "Agent ID",
  "ai_defs_name_placeholder": "e.g. data_analyst",
  "ai_defs_name_help": "Unique identifier used internally. Use lowercase with underscores.",
  "ai_defs_active": "Active",
  "ai_defs_active_desc": "Inactive agents won't appear in the selector.",
  "ai_defs_instructions": "System Instructions",
  "ai_defs_instructions_placeholder": "You are a helpful assistant...",
  "ai_defs_instructions_help": "These instructions guide the agent's behavior.",
  "ai_defs_tools": "Tools",
  "ai_defs_advanced": "Advanced Settings",
  "ai_defs_keywords": "Handoff Keywords",
  "ai_defs_keywords_placeholder": "e.g. sales, revenue, profit",
  "ai_defs_keywords_help": "Comma-separated keywords that trigger this agent.",
  "ai_defs_built_in": "Built-in",
  "ai_defs_hosted_tools": "Hosted Tools",
  "ai_defs_hosted_web_search": "Web Search",
  "ai_defs_hosted_file_search": "File Search",
  "ai_defs_vector_store_id": "Vector Store ID",
  "ai_defs_vector_store_placeholder": "Enter OpenAI vector store ID",
  "ai_defs_created": "Agent created",
  "ai_defs_updated": "Agent updated",
  "ai_defs_deleted": "Agent deleted",
  "ai_defs_delete_confirm_title": "Delete Agent?",
  "ai_defs_delete_confirm_desc": "This action cannot be undone.",
  "ai_defs_failed_tools": "Failed to load tools",

  "ai_memories_title": "AI Memories",
  "ai_memories_section": "Memories",
  "ai_memories_description": "Persistent knowledge the AI uses across conversations.",
  "ai_memories_add": "Add Memory",
  "ai_memories_edit": "Edit Memory",
  "ai_memories_placeholder": "Enter memory content...",
  "ai_memories_empty": "No memories yet",
  "ai_memories_added": "Memory added",
  "ai_memories_updated": "Memory updated",
  "ai_memories_deleted": "Memory deleted",
  "ai_memories_delete": "Delete Memory?",
  "ai_memories_delete_confirm": "This memory will be permanently removed.",
  "ai_memories_source": "Source: {{source}}",

  "ai_instructions_section": "Instructions",
  "ai_instructions_description": "Reusable instruction snippets added to agent context.",
  "ai_instructions_add": "Add Instruction",
  "ai_instructions_edit": "Edit Instruction",
  "ai_instructions_placeholder": "Enter instruction content...",
  "ai_instructions_empty": "No instructions yet",
  "ai_instructions_added": "Instruction added",
  "ai_instructions_updated": "Instruction updated",
  "ai_instructions_deleted": "Instruction deleted",
  "ai_instructions_delete": "Delete Instruction?",
  "ai_instructions_delete_confirm": "This instruction will be permanently removed.",

  "ai_content_label": "Content",
  "ai_tags_label": "Tags",
  "ai_tags_placeholder": "Enter tags separated by commas...",
  "ai_tags_help": "Tags help categorize and filter content.",
  "ai_saving": "Saving..."
}
```

- [ ] **Step 2: Sync locales**

```bash
pnpm sync-locales
```

This auto-translates the new keys to `ar.json` and `fr.json`.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(ai): add i18n keys for AI agent system"
```

---

## Task 10: Markdown Renderer & Code Highlight Styles

**Files:**
- Create: `src/pages/ai-analyst/markdown-renderer.tsx`
- Create: `src/pages/ai-analyst/code-highlight.css`

We need `react-markdown`, `remark-gfm`, and `rehype-highlight` as dependencies.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add react-markdown remark-gfm rehype-highlight highlight.js
```

- [ ] **Step 2: Create src/pages/ai-analyst/markdown-renderer.tsx**

```tsx
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "./code-highlight.css";

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

interface MarkdownRendererProps {
  className?: string;
  content: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <Markdown rehypePlugins={rehypePlugins} remarkPlugins={remarkPlugins}>
        {content}
      </Markdown>
    </div>
  );
}
```

- [ ] **Step 3: Create src/pages/ai-analyst/code-highlight.css**

Copy the code highlight CSS from `Code/ai-agent/code-highlight.css` — it provides light/dark GitHub-style syntax colors. This file is 144 lines and is identical to the reference; copy it verbatim.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ai-analyst/markdown-renderer.tsx src/pages/ai-analyst/code-highlight.css package.json pnpm-lock.yaml
git commit -m "feat(ai): add markdown renderer with syntax highlighting"
```

---

## Task 11: Chat Interface — Main Chat Component with SSE

**Files:**
- Create: `src/pages/ai-analyst/chat-interface.tsx`

This is the core chat component, adapted from `Code/ai-agent/chat-interface.tsx` (1154 lines) to use:
- `useTranslation()` from react-i18next instead of `useTranslations()` from next-intl
- `useAiChatStore` Zustand store instead of `useChatPanel` context
- Material Symbols icons instead of Remix Icon
- `api` (Axios) for mutations, raw `fetch` for SSE streaming
- Reparilo's Tailwind color tokens (e.g. `bg-primary`, `text-on-primary`) instead of shadcn tokens

Key behaviors to port:
- SSE stream parsing with `ReadableStream` reader
- Tool call accordion (collapsible showing running/completed tools)
- Error handling with retry for retryable errors
- Agent selector with pending-switch confirmation
- Typing indicator with active tool name
- Auto-scroll with user-scroll-up detection
- Copy conversation
- Keyboard shortcuts display

- [ ] **Step 1: Create the file**

The component should be ~800-1000 lines, directly adapted from the reference. Key structural differences:
- Import `{ useTranslation } from "react-i18next"` — translation function is `t("key")` not namespaced
- Import `{ useAiChatStore } from "@/stores/ai-chat"`
- SSE endpoint: `POST /api/ai/chat/stream` (not `/api/agent/chat/stream`)
- Conversation messages endpoint: `GET /api/ai/:id/messages`
- Use `api.get()` / `api.put()` / `api.delete()` for CRUD mutations
- Use raw `fetch()` for SSE (Axios doesn't support streaming well)

- [ ] **Step 2: Commit**

```bash
git add src/pages/ai-analyst/chat-interface.tsx
git commit -m "feat(ai): add main chat interface with SSE streaming"
```

---

## Task 12: Agent Selector Component

**Files:**
- Create: `src/components/modules/ai-analyst/agent-selector.tsx`

Adapted from `Code/ai-agent/_components/agent-selector.tsx`. Horizontal scrollable pill buttons using Material Symbols check icon.

- [ ] **Step 1: Create the file**

Uses `useTranslation()` and Tailwind with Reparilo's color tokens. The scroll area uses native overflow-x-auto instead of Radix ScrollArea (since Reparilo doesn't have that component).

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/ai-analyst/agent-selector.tsx
git commit -m "feat(ai): add agent selector component"
```

---

## Task 13: Chat Empty State

**Files:**
- Create: `src/components/modules/ai-analyst/chat-empty-state.tsx`

Adapted from `Code/ai-agent/_components/chat-empty-state.tsx`. Shows capability cards (Sales, Inventory, Customers, Finance) with suggested prompts when no conversation is active.

- [ ] **Step 1: Create the file**

Uses the i18n keys added in Task 9 (`ai_agent_empty_*`, `ai_agent_prompt_*`). Material Symbols icons instead of Remix.

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/ai-analyst/chat-empty-state.tsx
git commit -m "feat(ai): add chat empty state with capability cards"
```

---

## Task 14: Conversation History Panel

**Files:**
- Create: `src/components/modules/ai-analyst/conversation-group.tsx`
- Create: `src/components/modules/ai-analyst/conversation-item.tsx`
- Create: `src/components/modules/ai-analyst/conversation-history-panel.tsx`
- Create: `src/components/modules/ai-analyst/rename-dialog.tsx`

These are adapted from the reference's `_components/` directory:
- `conversation-group.tsx` — groups by date (starred, today, yesterday, this week, older)
- `conversation-item.tsx` — individual row with star, delete, rename, swipe gestures
- `conversation-history-panel.tsx` — full side panel with search, infinite scroll, CRUD
- `rename-dialog.tsx` — rename dialog

Key adaptations:
- `useAiChatStore` Zustand store instead of `useChatPanel` context
- `api` (Axios) for mutations
- `useTranslation()` from react-i18next
- Material Symbols icons
- Reparilo color tokens

- [ ] **Step 1: Create all four files**

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/ai-analyst/
git commit -m "feat(ai): add conversation history panel components"
```

---

## Task 15: Chat Layout & Page

**Files:**
- Create: `src/pages/ai-analyst/layout.tsx`
- Modify: `src/pages/ai-analyst/index.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create src/pages/ai-analyst/layout.tsx**

A wrapper component that initializes the store from localStorage and renders the side panel + children:

```tsx
import { useEffect } from "react";
import { useAiChatStore } from "@/stores/ai-chat";
import ConversationHistoryPanel from "@/components/modules/ai-analyst/conversation-history-panel";

export default function AiAnalystLayout({ children }: { children: React.ReactNode }) {
  const initFromStorage = useAiChatStore((s) => s.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ConversationHistoryPanel />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite src/pages/ai-analyst/index.tsx**

The page component checks if AI is enabled (via settings API), then renders the chat interface:

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import ChatInterface from "./chat-interface";

export default function AiAnalystPage() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/ai/settings")
      .then((res) => setEnabled(res.data.enabled ?? false))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-2xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <ChatInterface agentEnabled={enabled} />
  );
}
```

- [ ] **Step 3: Update src/app.tsx — add routes**

Add the AI analyst route inside the `<ProtectedRoute>` block:

```tsx
import AiAnalystLayout from "@/pages/ai-analyst/layout";
import AiAnalystPage from "@/pages/ai-analyst";
import AiAgentSettingsPage from "@/pages/ai-analyst/settings/page";
import AiMemoriesPage from "@/pages/ai-analyst/memories/page";
// ...

// Inside the routes, add:
<Route
  element={
    <DashboardLayout>
      <AiAnalystLayout>
        <AiAnalystPage />
      </AiAnalystLayout>
    </DashboardLayout>
  }
  path="/ai-analyst"
/>
<Route
  element={
    <DashboardLayout>
      <AiAgentSettingsPage />
    </DashboardLayout>
  }
  path="/ai-analyst/settings"
/>
<Route
  element={
    <DashboardLayout>
      <AiMemoriesPage />
    </DashboardLayout>
  }
  path="/ai-analyst/memories"
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ai-analyst/layout.tsx src/pages/ai-analyst/index.tsx src/app.tsx
git commit -m "feat(ai): add AI analyst page, layout, and routes"
```

---

## Task 16: Settings Page — Connection & Agent Definitions Tabs

**Files:**
- Create: `src/pages/ai-analyst/settings/page.tsx`
- Create: `src/pages/ai-analyst/settings/agent-settings-tabs.tsx`
- Create: `src/pages/ai-analyst/settings/agent-definitions-tab.tsx`

Adapted from `Code/ai-agent/settings/`. Two tabs: Connection (endpoint, API key, model, temperature, test connection, enable/disable toggle) and Agents (agent definitions CRUD).

Key adaptations:
- `api` (Axios) for data fetching and mutations
- `useTranslation()` from react-i18next
- Material Symbols icons
- Reparilo color tokens and form styling patterns (look at existing settings page for reference: `src/components/modules/settings/`)
- Settings API endpoints: `GET /api/ai/settings`, `PUT /api/ai/settings`, `POST /api/ai/settings/test`
- Definitions API: `GET /api/ai/definitions`, `POST /api/ai/definitions`, etc.

- [ ] **Step 1: Create the three settings files**

- [ ] **Step 2: Commit**

```bash
git add src/pages/ai-analyst/settings/
git commit -m "feat(ai): add AI settings page with connection and agent tabs"
```

---

## Task 17: Memories Page

**Files:**
- Create: `src/pages/ai-analyst/memories/page.tsx`
- Create: `src/pages/ai-analyst/memories/memories-list.tsx`

Adapted from `Code/ai-agent/memories/`. Shows memories and instructions in two cards with CRUD (add, edit, delete).

- [ ] **Step 1: Create both files**

Uses `api.get("/ai/memories")`, `api.get("/ai/instructions")`, and mutation endpoints.

- [ ] **Step 2: Commit**

```bash
git add src/pages/ai-analyst/memories/
git commit -m "feat(ai): add memories and instructions management page"
```

---

## Task 18: Update Existing Components & Clean Up

**Files:**
- Modify: `src/components/modules/ai-analyst/chat-input.tsx`
- Modify: `src/components/modules/ai-analyst/chat-message.tsx`
- Delete: `src/components/modules/ai-analyst/config-panel.tsx`
- Modify: `src/components/modules/sidebar.tsx` or dashboard AI callout — update link to `/ai-analyst`

- [ ] **Step 1: Update chat-message.tsx**

Add markdown rendering for assistant messages using the dynamic-imported `MarkdownRenderer`. Keep the existing styling structure (Material Design tokens) but render markdown content instead of plain text.

- [ ] **Step 2: Update chat-input.tsx**

The existing chat-input is mostly fine. Ensure it passes through any new props needed by the chat interface (e.g., streaming state for the stop button is handled by the parent now).

- [ ] **Step 3: Delete config-panel.tsx**

The config panel is replaced by the settings page. Remove the file and any imports.

- [ ] **Step 4: Update navigation links**

Find and update any links that reference the old AI analyst path to point to `/ai-analyst`.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/modules/ai-analyst/
git commit -m "feat(ai): update existing AI components, remove config panel"
```

---

## Task 19: Seed Built-in Agent Definitions

**Files:**
- Modify: `prisma/seed.ts`

Add seeding of built-in agent definitions so the system has agents out of the box.

- [ ] **Step 1: Add agent seeding to prisma/seed.ts**

Add after existing seed data:

```typescript
await prisma.aiAgentDefinition.upsert({
  where: { name: "general_assistant" },
  update: {},
  create: {
    name: "general_assistant",
    displayName: "General Assistant",
    instructions: `You are a helpful AI assistant for a phone repair shop called Reparilo.
You have access to the shop's database and can answer questions about repairs, parts, customers, revenue, and more.
Always respond in the language the user writes in. Be concise and data-driven.
When showing numbers, format them as currency when appropriate.`,
    toolNames: ["queryDatabase", "getSchema"],
    isActive: true,
    isBuiltIn: true,
  },
});

await prisma.aiAgentDefinition.upsert({
  where: { name: "data_analyst" },
  update: {},
  create: {
    name: "data_analyst",
    displayName: "Data Analyst",
    instructions: `You are a data analyst for a phone repair shop. You specialize in business insights, revenue analysis, and trend detection.
Always start by understanding the time period the user is interested in.
Use charts-friendly formats when possible (tables with clear headers).
Respond in the user's language.`,
    toolNames: ["queryDatabase", "getSchema"],
    isActive: true,
    isBuiltIn: true,
  },
});
```

- [ ] **Step 2: Run seed**

```bash
pnpm db:seed
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(ai): seed built-in agent definitions"
```

---

## Task 20: Integration Verification

**Files:**
- No new files

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All existing tests + new AI tests pass.

- [ ] **Step 2: Run lint/format check**

```bash
pnpm check
```

Fix any issues with `pnpm fix`.

- [ ] **Step 3: Start dev server and verify**

```bash
pnpm dev
```

Manual verification:
1. Navigate to `/ai-analyst` — should show chat empty state
2. Type a message — should stream a response (if API key configured)
3. Side panel should show conversations
4. Navigate to `/ai-analyst/settings` — should show connection + agent tabs
5. Navigate to `/ai-analyst/memories` — should show memories + instructions
6. Test conversation CRUD: rename, star, delete
7. Test RTL layout with Arabic locale
8. Check for console errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(ai): full AI agent system — streaming, conversations, multi-agent, tools"
```
