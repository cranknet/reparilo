import type { PrismaClient } from "@generated/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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
        {
          id: "1",
          name: "general_assistant",
          displayName: "General Assistant",
        },
      ];
      (
        prisma.aiAgentDefinition.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(defs);
      const result = await listAgentDefinitions(prisma);
      expect(result).toEqual(defs);
      expect(prisma.aiAgentDefinition.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("deleteAgentDefinition", () => {
    it("rejects deletion of built-in definitions", async () => {
      (
        prisma.aiAgentDefinition.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "1",
        isBuiltIn: true,
      });
      await expect(deleteAgentDefinition(prisma, "1")).rejects.toThrow(
        "errors.builtin_agent_delete"
      );
    });

    it("returns null when definition not found", async () => {
      (
        prisma.aiAgentDefinition.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      const result = await deleteAgentDefinition(prisma, "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("updateAgentDefinition", () => {
    it("strips name update for built-in agents", async () => {
      (
        prisma.aiAgentDefinition.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "1",
        isBuiltIn: true,
        name: "general_assistant",
      });
      const updated = {
        id: "1",
        name: "general_assistant",
        displayName: "New Name",
      };
      (
        prisma.aiAgentDefinition.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(updated);

      const _result = await updateAgentDefinition(prisma, "1", {
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
