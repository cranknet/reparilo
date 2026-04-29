import type { PrismaClient } from "@generated/client";
import type {
  BulkDeleteConversationsInput,
  ListQueryInput,
  MessagesQueryInput,
  UpdateConversationInput,
  UpdateMessageInput,
} from "@shared/schemas/ai.schema";

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

  const ids = items.map((c) => c.id);

  const lastAssistantMessages = await prisma.$queryRaw<
    Array<{ conversationId: string; agentName: string | null }>
  >`
    SELECT DISTINCT ON ("conversationId") "conversationId", "agentName"
    FROM "ai_messages"
    WHERE "conversationId" = ANY(${ids}::text[])
      AND role = 'ASSISTANT'
      AND "agentName" IS NOT NULL
    ORDER BY "conversationId", "createdAt" DESC
  `;

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
  return await prisma.aiConversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
  });
}

export async function createConversation(
  prisma: PrismaClient,
  userId: string,
  title?: string
) {
  return await prisma.aiConversation.create({
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
  if (!conversation) {
    return null;
  }
  return await prisma.aiConversation.update({ where: { id }, data });
}

export async function deleteConversation(
  prisma: PrismaClient,
  userId: string,
  id: string
) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id, userId },
  });
  if (!conversation) {
    return null;
  }
  return await prisma.aiConversation.delete({ where: { id } });
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
  if (!conversation) {
    return null;
  }

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
  if (!conversation) {
    return null;
  }

  const message = await prisma.aiMessage.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) {
    return null;
  }

  return await prisma.aiMessage.update({ where: { id: messageId }, data });
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
  if (!conversation) {
    return null;
  }

  const message = await prisma.aiMessage.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) {
    return null;
  }

  return await prisma.aiMessage.delete({ where: { id: messageId } });
}

export async function exportConversation(
  prisma: PrismaClient,
  userId: string,
  id: string
) {
  return await prisma.aiConversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}
