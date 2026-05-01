import { AppError } from "@shared/errors/app-error.js";
import type {
  AgentDefinitionCreateInput,
  AgentDefinitionUpdateInput,
  AiInstructionInput,
  AiMemoryInput,
} from "@shared/schemas/ai.schema";
import type { DbClient } from "../repositories/ai.repository.js";
import {
  createAgentDefinition as createAgentDefinitionRepo,
  createInstruction as createInstructionRepo,
  createMemory as createMemoryRepo,
  deleteAgentDefinition as deleteAgentDefinitionRepo,
  findManyAgentDefinitions,
  findManyInstructions,
  findManyMemories,
  findUniqueAgentDefinition,
  findUniqueInstruction,
  findUniqueMemory,
  updateAgentDefinition as updateAgentDefinitionRepo,
  updateInstruction as updateInstructionRepo,
  updateMemory as updateMemoryRepo,
} from "../repositories/ai.repository.js";

export async function listAgentDefinitions(prisma: DbClient) {
  return await findManyAgentDefinitions(prisma);
}

export async function getAgentDefinition(prisma: DbClient, id: string) {
  return await findUniqueAgentDefinition(prisma, { id });
}

export async function createAgentDefinition(
  prisma: DbClient,
  data: AgentDefinitionCreateInput
) {
  return await createAgentDefinitionRepo(prisma, data);
}

export async function updateAgentDefinition(
  prisma: DbClient,
  id: string,
  data: AgentDefinitionUpdateInput
) {
  const existing = await findUniqueAgentDefinition(prisma, { id });
  if (!existing) {
    return null;
  }

  const safeData = { ...data };
  if (existing.isBuiltIn && safeData.name !== undefined) {
    safeData.name = undefined;
  }

  return await updateAgentDefinitionRepo(prisma, { id }, safeData);
}

export async function deleteAgentDefinition(prisma: DbClient, id: string) {
  const existing = await findUniqueAgentDefinition(prisma, { id });
  if (!existing) {
    return null;
  }
  if (existing.isBuiltIn) {
    throw new AppError("BUILTIN_AGENT_DELETE");
  }
  return await deleteAgentDefinitionRepo(prisma, { id });
}

export async function listMemories(prisma: DbClient) {
  return await findManyMemories(
    prisma,
    { isActive: true },
    { createdAt: "desc" },
    100
  );
}

export async function createMemory(prisma: DbClient, data: AiMemoryInput) {
  return await createMemoryRepo(prisma, { ...data, source: "manual" });
}

export async function updateMemory(
  prisma: DbClient,
  id: string,
  data: AiMemoryInput
) {
  const existing = await findUniqueMemory(prisma, { id });
  if (!existing) {
    return null;
  }
  return await updateMemoryRepo(prisma, { id }, data);
}

export async function deleteMemory(prisma: DbClient, id: string) {
  const existing = await findUniqueMemory(prisma, { id });
  if (!existing) {
    return null;
  }
  return await updateMemoryRepo(
    prisma,
    { id },
    { content: existing.content, tags: existing.tags, isActive: false }
  );
}

export async function listInstructions(prisma: DbClient) {
  return await findManyInstructions(
    prisma,
    { isActive: true },
    { createdAt: "desc" },
    50
  );
}

export async function createInstruction(
  prisma: DbClient,
  data: AiInstructionInput
) {
  return await createInstructionRepo(prisma, data);
}

export async function updateInstruction(
  prisma: DbClient,
  id: string,
  data: AiInstructionInput
) {
  const existing = await findUniqueInstruction(prisma, { id });
  if (!existing) {
    return null;
  }
  return await updateInstructionRepo(prisma, { id }, data);
}

export async function deleteInstruction(prisma: DbClient, id: string) {
  const existing = await findUniqueInstruction(prisma, { id });
  if (!existing) {
    return null;
  }
  return await updateInstructionRepo(
    prisma,
    { id },
    { content: existing.content, tags: existing.tags, isActive: false }
  );
}
