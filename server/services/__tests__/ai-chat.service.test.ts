import type { PrismaClient } from "@generated/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkDeleteConversations,
  listConversations,
  listMessages,
  updateConversation,
} from "../ai-chat.service";

function mockPrisma() {
  const $queryRaw = vi.fn().mockResolvedValue([]);
  return {
    $queryRaw,
    aiConversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    aiMessage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("ai-chat.service", () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  describe("listConversations", () => {
    it("returns conversations ordered by starred desc then updatedAt desc", async () => {
      const conversations = [
        {
          id: "conv1",
          title: "Starred chat",
          starred: true,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          _count: { messages: 5 },
          messages: [{ content: "Hello" }],
        },
        {
          id: "conv2",
          title: "Regular chat",
          starred: false,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-03"),
          _count: { messages: 2 },
          messages: [{ content: "Hi there" }],
        },
      ];

      (
        prisma.aiConversation.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(conversations);

      const result = await listConversations(prisma, "user1", {
        search: undefined,
        cursor: undefined,
        limit: 30,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: "conv1",
        title: "Starred chat",
        starred: true,
        createdAt: conversations[0].createdAt,
        updatedAt: conversations[0].updatedAt,
        agentName: null,
        messageCount: 5,
        firstMessage: "Hello",
      });
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns nextCursor when there are more results than limit", async () => {
      const conversations = Array.from({ length: 4 }, (_, i) => ({
        id: `conv${i + 1}`,
        title: `Chat ${i + 1}`,
        starred: false,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        _count: { messages: 1 },
        messages: [{ content: "msg" }],
      }));

      (
        prisma.aiConversation.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(conversations);

      const result = await listConversations(prisma, "user1", {
        search: undefined,
        cursor: undefined,
        limit: 3,
      });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBe("conv3");
    });

    it("filters by search term", async () => {
      (
        prisma.aiConversation.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await listConversations(prisma, "user1", {
        search: "battery",
        cursor: undefined,
        limit: 30,
      });

      expect(prisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: "user1",
            title: { contains: "battery", mode: "insensitive" },
          },
        })
      );
    });

    it("uses cursor-based pagination with skip 1", async () => {
      (
        prisma.aiConversation.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await listConversations(prisma, "user1", {
        search: undefined,
        cursor: "cursor123",
        limit: 30,
      });

      expect(prisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "cursor123" },
          skip: 1,
        })
      );
    });

    it("maps agentName from last assistant messages", async () => {
      const conversations = [
        {
          id: "conv1",
          title: "Chat 1",
          starred: false,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          _count: { messages: 3 },
          messages: [],
        },
      ];

      (
        prisma.aiConversation.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(conversations);
      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
        { conversationId: "conv1", agentName: "tech_expert" },
      ]);

      const result = await listConversations(prisma, "user1", {
        search: undefined,
        cursor: undefined,
        limit: 30,
      });

      expect(result.items[0].agentName).toBe("tech_expert");
    });
  });

  describe("updateConversation", () => {
    it("returns null when conversation not found", async () => {
      (
        prisma.aiConversation.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await updateConversation(prisma, "user1", "nonexistent", {
        title: "New Title",
      });

      expect(result).toBeNull();
    });

    it("updates and returns the conversation", async () => {
      const existing = {
        id: "conv1",
        userId: "user1",
        title: "Old Title",
        starred: false,
      };
      const updated = { ...existing, title: "New Title" };

      (
        prisma.aiConversation.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existing);
      (
        prisma.aiConversation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(updated);

      const result = await updateConversation(prisma, "user1", "conv1", {
        title: "New Title",
      });

      expect(result).toEqual(updated);
      expect(prisma.aiConversation.update).toHaveBeenCalledWith({
        where: { id: "conv1" },
        data: { title: "New Title" },
      });
    });

    it("updates starred status", async () => {
      const existing = {
        id: "conv1",
        userId: "user1",
        title: "Chat",
        starred: false,
      };
      const updated = { ...existing, starred: true };

      (
        prisma.aiConversation.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existing);
      (
        prisma.aiConversation.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(updated);

      const result = await updateConversation(prisma, "user1", "conv1", {
        starred: true,
      });

      expect(result).toEqual(updated);
      expect(prisma.aiConversation.update).toHaveBeenCalledWith({
        where: { id: "conv1" },
        data: { starred: true },
      });
    });
  });

  describe("bulkDeleteConversations", () => {
    it("deletes multiple conversations and returns count", async () => {
      (
        prisma.aiConversation.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 3 });

      const result = await bulkDeleteConversations(prisma, "user1", {
        ids: ["conv1", "conv2", "conv3"],
      });

      expect(result).toEqual({ deleted: 3 });
      expect(prisma.aiConversation.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["conv1", "conv2", "conv3"] },
          userId: "user1",
        },
      });
    });

    it("returns zero when no conversations match", async () => {
      (
        prisma.aiConversation.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 0 });

      const result = await bulkDeleteConversations(prisma, "user1", {
        ids: ["nonexistent"],
      });

      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe("listMessages", () => {
    it("returns null when conversation not found", async () => {
      (
        prisma.aiConversation.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await listMessages(prisma, "user1", "nonexistent", {
        page: 1,
        limit: 50,
      });

      expect(result).toBeNull();
    });

    it("returns paginated messages with total count", async () => {
      (
        prisma.aiConversation.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: "conv1" });

      const messages = [
        { id: "msg1", content: "Hello", role: "USER" },
        { id: "msg2", content: "Hi!", role: "ASSISTANT" },
      ];

      (prisma.aiMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        messages
      );
      (prisma.aiMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        25
      );

      const result = await listMessages(prisma, "user1", "conv1", {
        page: 1,
        limit: 50,
      });

      expect(result).toEqual({
        items: messages,
        total: 25,
        page: 1,
        limit: 50,
      });
    });

    it("applies pagination offset correctly", async () => {
      (
        prisma.aiConversation.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: "conv1" });
      (prisma.aiMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.aiMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await listMessages(prisma, "user1", "conv1", {
        page: 3,
        limit: 10,
      });

      expect(prisma.aiMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });
  });
});
