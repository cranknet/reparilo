import type { PrismaClient } from "@generated/client";

interface ToolResult {
  data: string;
  success: boolean;
}

export async function executeGetSchema(
  prisma: PrismaClient,
  tableName?: string
): Promise<ToolResult> {
  const tables = tableName
    ? [tableName]
    : ["jobs", "customers", "parts", "repairs", "users"];

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

const BLOCKED_PATTERNS = [
  /\bpg_catalog\b/i,
  /\bpg_toast\b/i,
  /\bpg_read_file\b/i,
  /\bpg_write_file\b/i,
  /\bdblink\b/i,
  /\blo_import\b/i,
  /\blo_export\b/i,
];

const SELECT_ONLY_REGEX = /^\s*SELECT\s/i;

export async function executeQueryDatabase(
  prisma: PrismaClient,
  sql: string
): Promise<ToolResult> {
  const trimmed = sql.trim();

  if (trimmed.includes(";")) {
    return { success: false, data: "Only single statements are allowed" };
  }

  if (!SELECT_ONLY_REGEX.test(trimmed)) {
    return { success: false, data: "Only SELECT queries are allowed" };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        success: false,
        data: "Access to system objects is not allowed",
      };
    }
  }

  try {
    const result = await prisma.$queryRawUnsafe(trimmed);
    return { success: true, data: JSON.stringify(result) };
  } catch (err) {
    return {
      success: false,
      data: `Query error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
