import type { PrismaClient } from "@generated/client";
import type {
  BulkDeleteConversationsInput,
  ListQueryInput,
  MessagesQueryInput,
  UpdateConversationInput,
  UpdateMessageInput,
} from "@shared/schemas/ai.schema";
import {
  countMessages,
  createConversation as createConversationRepo,
  deleteConversation as deleteConversationRepo,
  deleteManyConversations,
  deleteMessage as deleteMessageRepo,
  findFirstConversation,
  findFirstMessage,
  findManyConversations,
  findManyMessages,
  rawDistinctOnLastAssistant,
  updateConversation as updateConversationRepo,
  updateMessage as updateMessageRepo,
} from "../repositories/ai.repository.js";
import type { DbClient } from "../repositories/types.js";

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

  const conversations = (await findManyConversations(
    prisma,
    where,
    [{ starred: "desc" }, { updatedAt: "desc" }],
    limit + 1,
    cursor,
    {
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
    }
  )) as unknown as Array<{
    id: string;
    title: string | null;
    starred: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { messages: number };
    messages: Array<{ content: string }>;
  }>;

  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, limit) : conversations;
  const nextCursor = hasMore ? items.at(-1)?.id : undefined;

  const ids = items.map((c) => c.id);

  const lastAssistantMessages = await rawDistinctOnLastAssistant(prisma, ids);

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
  prisma: DbClient,
  userId: string,
  id: string
) {
  return await findFirstConversation(prisma, { id, userId }, undefined, {
    messages: { orderBy: { createdAt: "asc" }, take: 50 },
  });
}

export async function createConversation(
  prisma: DbClient,
  userId: string,
  title?: string
) {
  return await createConversationRepo(prisma, { userId, title: title ?? null });
}

export async function updateConversation(
  prisma: DbClient,
  userId: string,
  id: string,
  data: UpdateConversationInput
) {
  const conversation = await findFirstConversation(prisma, { id, userId });
  if (!conversation) {
    return null;
  }
  return await updateConversationRepo(prisma, { id }, data);
}

export async function deleteConversation(
  prisma: DbClient,
  userId: string,
  id: string
) {
  const conversation = await findFirstConversation(prisma, { id, userId });
  if (!conversation) {
    return null;
  }
  return await deleteConversationRepo(prisma, { id });
}

export async function bulkDeleteConversations(
  prisma: DbClient,
  userId: string,
  input: BulkDeleteConversationsInput
) {
  const result = await deleteManyConversations(prisma, {
    id: { in: input.ids },
    userId,
  });
  return { deleted: result.count };
}

export async function listMessages(
  prisma: DbClient,
  userId: string,
  conversationId: string,
  query: MessagesQueryInput
) {
  const conversation = await findFirstConversation(prisma, {
    id: conversationId,
    userId,
  });
  if (!conversation) {
    return null;
  }

  const { page, limit } = query;
  const [messages, total] = await Promise.all([
    findManyMessages(
      prisma,
      { conversationId },
      { createdAt: "asc" },
      (page - 1) * limit,
      limit
    ),
    countMessages(prisma, { conversationId }),
  ]);

  return { items: messages, total, page, limit };
}

export async function updateMessage(
  prisma: DbClient,
  userId: string,
  conversationId: string,
  messageId: string,
  data: UpdateMessageInput
) {
  const conversation = await findFirstConversation(prisma, {
    id: conversationId,
    userId,
  });
  if (!conversation) {
    return null;
  }

  const message = await findFirstMessage(prisma, {
    id: messageId,
    conversationId,
  });
  if (!message) {
    return null;
  }

  return await updateMessageRepo(prisma, { id: messageId }, data);
}

export async function deleteMessage(
  prisma: DbClient,
  userId: string,
  conversationId: string,
  messageId: string
) {
  const conversation = await findFirstConversation(prisma, {
    id: conversationId,
    userId,
  });
  if (!conversation) {
    return null;
  }

  const message = await findFirstMessage(prisma, {
    id: messageId,
    conversationId,
  });
  if (!message) {
    return null;
  }

  return await deleteMessageRepo(prisma, { id: messageId });
}

export async function exportConversation(
  prisma: DbClient,
  userId: string,
  id: string
) {
  return await findFirstConversation(prisma, { id, userId }, undefined, {
    messages: { orderBy: { createdAt: "asc" } },
  });
}
