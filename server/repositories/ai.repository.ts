import type { Prisma, PrismaClient } from "@generated/client";
import type {
  AgentDefinitionCreateInput,
  AgentDefinitionUpdateInput,
  AiInstructionInput,
  AiMemoryInput,
  UpdateConversationInput,
  UpdateMessageInput,
} from "@shared/schemas/ai.schema.js";

export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

export async function findManyConversations(
  prisma: DbClient,
  where: Prisma.AiConversationWhereInput,
  orderBy: Prisma.AiConversationOrderByWithRelationInput[],
  take: number,
  cursor?: string,
  select?: Prisma.AiConversationSelect
) {
  return await prisma.aiConversation.findMany({
    where,
    orderBy,
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    ...(select ? { select } : {}),
  });
}

export async function rawDistinctOnLastAssistant(
  prisma: PrismaClient,
  ids: string[]
) {
  return await prisma.$queryRaw<
    Array<{ conversationId: string; agentName: string | null }>
  >`
    SELECT DISTINCT ON ("conversationId") "conversationId", "agentName"
    FROM "ai_messages"
    WHERE "conversationId" = ANY(${ids}::text[])
      AND role = 'ASSISTANT'
      AND "agentName" IS NOT NULL
    ORDER BY "conversationId", "createdAt" DESC
  `;
}

export async function findFirstConversation(
  prisma: DbClient,
  where: Prisma.AiConversationWhereInput,
  select?: Prisma.AiConversationSelect,
  include?: Prisma.AiConversationInclude
) {
  return await prisma.aiConversation.findFirst({
    where,
    ...(select ? { select } : {}),
    ...(include ? { include } : {}),
  });
}

export async function createConversation(
  prisma: DbClient,
  data: Prisma.AiConversationCreateInput
) {
  return await prisma.aiConversation.create({ data });
}

export async function updateConversation(
  prisma: DbClient,
  where: Prisma.AiConversationWhereUniqueInput,
  data: UpdateConversationInput
) {
  return await prisma.aiConversation.update({ where, data });
}

export async function deleteConversation(
  prisma: DbClient,
  where: Prisma.AiConversationWhereUniqueInput
) {
  return await prisma.aiConversation.delete({ where });
}

export async function deleteManyConversations(
  prisma: DbClient,
  where: Prisma.AiConversationWhereInput
) {
  return await prisma.aiConversation.deleteMany({ where });
}

export async function findManyMessages(
  prisma: DbClient,
  where: Prisma.AiMessageWhereInput,
  orderBy: Prisma.AiMessageOrderByWithRelationInput,
  skip: number,
  take: number
) {
  return await prisma.aiMessage.findMany({ where, orderBy, skip, take });
}

export async function countMessages(
  prisma: DbClient,
  where: Prisma.AiMessageWhereInput
) {
  return await prisma.aiMessage.count({ where });
}

export async function findFirstMessage(
  prisma: DbClient,
  where: Prisma.AiMessageWhereInput
) {
  return await prisma.aiMessage.findFirst({ where });
}

export async function updateMessage(
  prisma: DbClient,
  where: Prisma.AiMessageWhereUniqueInput,
  data: UpdateMessageInput
) {
  return await prisma.aiMessage.update({ where, data });
}

export async function deleteMessage(
  prisma: DbClient,
  where: Prisma.AiMessageWhereUniqueInput
) {
  return await prisma.aiMessage.delete({ where });
}

export async function findManyAgentDefinitions(prisma: DbClient) {
  return await prisma.aiAgentDefinition.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function findUniqueAgentDefinition(
  prisma: DbClient,
  where: Prisma.AiAgentDefinitionWhereUniqueInput
) {
  return await prisma.aiAgentDefinition.findUnique({ where });
}

export async function createAgentDefinition(
  prisma: DbClient,
  data: AgentDefinitionCreateInput
) {
  return await prisma.aiAgentDefinition.create({ data });
}

export async function updateAgentDefinition(
  prisma: DbClient,
  where: Prisma.AiAgentDefinitionWhereUniqueInput,
  data: AgentDefinitionUpdateInput
) {
  return await prisma.aiAgentDefinition.update({ where, data });
}

export async function deleteAgentDefinition(
  prisma: DbClient,
  where: Prisma.AiAgentDefinitionWhereUniqueInput
) {
  return await prisma.aiAgentDefinition.delete({ where });
}

export async function findManyMemories(
  prisma: DbClient,
  where: Prisma.AiMemoryWhereInput,
  orderBy: Prisma.AiMemoryOrderByWithRelationInput,
  take: number
) {
  return await prisma.aiMemory.findMany({ where, orderBy, take });
}

export async function findUniqueMemory(
  prisma: DbClient,
  where: Prisma.AiMemoryWhereUniqueInput
) {
  return await prisma.aiMemory.findUnique({ where });
}

export async function createMemory(
  prisma: DbClient,
  data: AiMemoryInput & { source: string }
) {
  return await prisma.aiMemory.create({ data });
}

export async function updateMemory(
  prisma: DbClient,
  where: Prisma.AiMemoryWhereUniqueInput,
  data: AiMemoryInput
) {
  return await prisma.aiMemory.update({ where, data });
}

export async function softDeleteMemory(
  prisma: DbClient,
  where: Prisma.AiMemoryWhereUniqueInput
) {
  return await prisma.aiMemory.update({ where, data: { isActive: false } });
}

export async function findManyInstructions(
  prisma: DbClient,
  where: Prisma.AiInstructionWhereInput,
  orderBy: Prisma.AiInstructionOrderByWithRelationInput,
  take: number
) {
  return await prisma.aiInstruction.findMany({ where, orderBy, take });
}

export async function findUniqueInstruction(
  prisma: DbClient,
  where: Prisma.AiInstructionWhereUniqueInput
) {
  return await prisma.aiInstruction.findUnique({ where });
}

export async function createInstruction(
  prisma: DbClient,
  data: AiInstructionInput
) {
  return await prisma.aiInstruction.create({ data });
}

export async function updateInstruction(
  prisma: DbClient,
  where: Prisma.AiInstructionWhereUniqueInput,
  data: AiInstructionInput
) {
  return await prisma.aiInstruction.update({ where, data });
}
