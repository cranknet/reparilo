import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";

interface ToolResult {
  data: string;
  success: boolean;
}

const ALLOWED_TABLES = new Set([
  "jobs",
  "customers",
  "devices",
  "job_repairs",
  "job_parts",
  "job_notes",
  "job_photos",
  "job_parts_waiting",
  "repair_catalog",
  "parts_catalog",
  "audit_logs",
  "users",
  "shop_settings",
]);

const BLOCKED_TABLES = new Set(["accounts", "sessions", "verifications"]);

function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

const KEYWORD_PREFIX_RE = /^(FROM|JOIN|UPDATE|INTO)\s+/i;
const QUOTE_RE = /"/g;

function extractTableNames(sql: string): string[] {
  const tables: string[] = [];
  const fromMatch = sql.match(/\bFROM\s+([^\s(]+)/gi);
  const joinMatch = sql.match(/\bJOIN\s+([^\s(]+)/gi);
  const updateMatch = sql.match(/\bUPDATE\s+([^\s(]+)/gi);
  const intoMatch = sql.match(/\bINTO\s+([^\s(]+)/gi);
  for (const m of [
    ...(fromMatch ?? []),
    ...(joinMatch ?? []),
    ...(updateMatch ?? []),
    ...(intoMatch ?? []),
  ]) {
    const table = m
      .replace(KEYWORD_PREFIX_RE, "")
      .replace(QUOTE_RE, "")
      .toLowerCase();
    tables.push(table);
  }
  return tables;
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
      const columns = await prisma.$queryRaw(
        Prisma.sql`SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = ${table} AND table_schema = 'public'
         ORDER BY ordinal_position`
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

  const stripped = stripSqlComments(trimmed);
  const tables = extractTableNames(stripped);
  for (const table of tables) {
    if (BLOCKED_TABLES.has(table)) {
      return {
        success: false,
        data: `Access to table '${table}' is not allowed`,
      };
    }
    if (!ALLOWED_TABLES.has(table)) {
      return {
        success: false,
        data: `Table '${table}' is not in the allowed list`,
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
