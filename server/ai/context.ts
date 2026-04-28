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
    parts.push("## Shop Knowledge\n", ...memories.map((m) => `- ${m.content}`));
  }

  return (
    parts.join("\n\n") ||
    "You are a helpful AI assistant for a phone repair shop."
  );
}

export function getToolDefinitions() {
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
              description:
                "Optional specific table name. If omitted, returns schema for all main tables.",
            },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "queryDatabase",
        description:
          "Execute a read-only SQL query against the business database",
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
