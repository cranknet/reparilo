import type { PrismaClient } from "@generated/client";
import { Prisma } from "@generated/client";
import { logger } from "../utils/logger.js";

const SQL_COMMENT_REGEX = /--|\/\*/;
const LIMIT_REGEX = /\bLIMIT\s+\d+/i;

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
]);

const BLOCKED_TABLES = new Set([
  "accounts",
  "sessions",
  "verifications",
  "shop_settings",
]);

const BLOCKED_COLUMNS: Record<string, Set<string>> = {
  users: new Set(["password"]),
};

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
    } catch (error) {
      logger.warn({ err: error, table }, "AI schema lookup failed");
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
  /\bUNION\b/i,
  /\bWITH\s/i,
  /\binformation_schema\b/i,
  /\bpg_sleep\b/i,
  /\bwaitfor\b/i,
  /\bbenchmark\b/i,
];

const MAX_QUERY_LENGTH = 2000;

const SELECT_ONLY_REGEX = /^\s*SELECT\s/i;
const SELECT_COLUMNS_RE = /\bSELECT\s+(.+?)\s+FROM/i;
const AS_ALIAS_RE = /.*\bas\s+/i;
const TABLE_PREFIX_RE = /.*\./;

function checkBlockedColumns(
  sql: string,
  table: string,
  blocked: Set<string>
): string | null {
  const selectMatch = sql.match(SELECT_COLUMNS_RE);
  if (!selectMatch || selectMatch[1].includes("*")) {
    return null;
  }
  const columns = selectMatch[1].split(",").map((c) => c.trim().toLowerCase());
  for (const col of columns) {
    const colName = col.replace(AS_ALIAS_RE, "").replace(TABLE_PREFIX_RE, "");
    if (blocked.has(colName)) {
      return `Access to column '${colName}' on table '${table}' is not allowed`;
    }
  }
  return null;
}

function validateTables(sql: string, tables: string[]): string | null {
  for (const table of tables) {
    if (BLOCKED_TABLES.has(table)) {
      return `Access to table '${table}' is not allowed`;
    }
    if (!ALLOWED_TABLES.has(table)) {
      return `Table '${table}' is not in the allowed list`;
    }
    const blocked = BLOCKED_COLUMNS[table];
    if (blocked) {
      const colError = checkBlockedColumns(sql, table, blocked);
      if (colError) {
        return colError;
      }
    }
  }
  return null;
}

export async function executeQueryDatabase(
  prisma: PrismaClient,
  sql: string
): Promise<ToolResult> {
  let trimmed = sql.trim().replace(/\s+/g, " ");

  if (trimmed.length > MAX_QUERY_LENGTH) {
    return { success: false, data: "Query exceeds maximum allowed length" };
  }

  if (trimmed.includes(";")) {
    return { success: false, data: "Only single statements are allowed" };
  }

  if (SQL_COMMENT_REGEX.test(trimmed)) {
    return { success: false, data: "SQL comments are not allowed" };
  }

  if (trimmed.includes("'")) {
    return { success: false, data: "String literals are not allowed" };
  }

  if (!SELECT_ONLY_REGEX.test(trimmed)) {
    return { success: false, data: "Only SELECT queries are allowed" };
  }

  const parenDepth = [...trimmed].reduce((acc, ch) => {
    if (ch === "(") {
      return acc + 1;
    }
    if (ch === ")") {
      return acc - 1;
    }
    return acc;
  }, 0);
  if (parenDepth !== 0) {
    return { success: false, data: "Unbalanced parentheses in query" };
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
  const tableError = validateTables(stripped, tables);
  if (tableError) {
    return { success: false, data: tableError };
  }

  if (!LIMIT_REGEX.test(stripped)) {
    trimmed = `${stripped} LIMIT 100`;
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
