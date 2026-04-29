import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type {
  AgentDefinitionCreateInput,
  AgentDefinitionUpdateInput,
  AiInstructionInput,
  AiMemoryInput,
} from "@shared/schemas/ai.schema";

export async function listAgentDefinitions(prisma: PrismaClient) {
  return await prisma.aiAgentDefinition.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function getAgentDefinition(prisma: PrismaClient, id: string) {
  return await prisma.aiAgentDefinition.findUnique({ where: { id } });
}

export async function createAgentDefinition(
  prisma: PrismaClient,
  data: AgentDefinitionCreateInput
) {
  return await prisma.aiAgentDefinition.create({ data });
}

export async function updateAgentDefinition(
  prisma: PrismaClient,
  id: string,
  data: AgentDefinitionUpdateInput
) {
  const existing = await prisma.aiAgentDefinition.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const safeData = { ...data };
  if (existing.isBuiltIn && safeData.name !== undefined) {
    safeData.name = undefined;
  }

  return await prisma.aiAgentDefinition.update({
    where: { id },
    data: safeData,
  });
}

export async function deleteAgentDefinition(prisma: PrismaClient, id: string) {
  const existing = await prisma.aiAgentDefinition.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  if (existing.isBuiltIn) {
    throw new AppError("BUILTIN_AGENT_DELETE");
  }
  return await prisma.aiAgentDefinition.delete({ where: { id } });
}

export async function listMemories(prisma: PrismaClient) {
  return await prisma.aiMemory.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createMemory(prisma: PrismaClient, data: AiMemoryInput) {
  return await prisma.aiMemory.create({
    data: { ...data, source: "manual" },
  });
}

export async function updateMemory(
  prisma: PrismaClient,
  id: string,
  data: AiMemoryInput
) {
  const existing = await prisma.aiMemory.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  return await prisma.aiMemory.update({ where: { id }, data });
}

export async function deleteMemory(prisma: PrismaClient, id: string) {
  const existing = await prisma.aiMemory.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  return await prisma.aiMemory.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listInstructions(prisma: PrismaClient) {
  return await prisma.aiInstruction.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createInstruction(
  prisma: PrismaClient,
  data: AiInstructionInput
) {
  return await prisma.aiInstruction.create({ data });
}

export async function updateInstruction(
  prisma: PrismaClient,
  id: string,
  data: AiInstructionInput
) {
  const existing = await prisma.aiInstruction.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  return await prisma.aiInstruction.update({ where: { id }, data });
}

export async function deleteInstruction(prisma: PrismaClient, id: string) {
  const existing = await prisma.aiInstruction.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  return await prisma.aiInstruction.update({
    where: { id },
    data: { isActive: false },
  });
}
