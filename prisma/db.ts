import { execSync, spawn } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import "dotenv/config";

import { hashPassword, hashPin } from "../src/lib/auth/password";
import {
  getSeedAdminPassword,
  SEEDED_ADMIN_USERNAME,
  shouldRequireSeedAdminPasswordChangeInProduction,
} from "../src/lib/auth/seed-admin";
import { INITIAL_SYSTEM_BOOTSTRAP_KEY } from "../src/lib/bootstrap-state";
import { prisma } from "../src/lib/prisma";

// ============================================================================
// TYPES
// ============================================================================

interface ParsedOptions {
  backup: boolean;
  backupFile: string | undefined;
  check: boolean;
  ci: boolean;
  dryRun: boolean;
  force: boolean;
  help: boolean;
  json: boolean;
  liveness: boolean;
  lockTimeout: number;
  metrics: boolean;
  metricsFile: string | undefined;
  noColor: boolean;
  noConfirm: boolean;
  productionReset: boolean;
  quiet: boolean;
  readiness: boolean;
  resetPassword: boolean;
  resetPin: boolean;
  retry: number;
  retryDelay: number;
  skipAdmin: boolean;
  startup: boolean;
  timeoutConnection: number;
  timeoutMigration: number;
  timeoutSeed: number;
  traceId: string | undefined;
  verbose: boolean;
}

interface CommandContext {
  command: string;
  isCI: boolean;
  isInteractive: boolean;
  metrics: Metrics;
  options: ParsedOptions;
  startTime: number;
  traceId: string;
}

interface Metrics {
  command: string;
  counts?: Record<string, number>;
  duration_ms: number;
  exit_code: number;
  steps: Array<{ name: string; duration_ms: number; success: boolean }>;
  success: boolean;
}

interface ConnectionStatus {
  attempts: number;
  connected: boolean;
  database: string;
  error: string | null;
  host: string;
  latencyMs: number;
  port: number;
}

type ExitCode = 0 | 1 | 2 | 3 | 4 | 5;

const EXIT_CODES = {
  SUCCESS: 0,
  RETRYABLE_ERROR: 1,
  CONFIGURATION_ERROR: 2,
  USER_CANCELLED: 3,
  DESTRUCTIVE_BLOCKED: 4,
  PARTIAL_FAILURE: 5,
} as const;

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  private readonly verbose: boolean;
  private readonly quiet: boolean;
  private readonly json: boolean;
  private readonly traceId: string;
  private readonly noColor: boolean;

  constructor(options: {
    verbose?: boolean;
    quiet?: boolean;
    json?: boolean;
    traceId?: string;
    noColor?: boolean;
  }) {
    this.verbose = options.verbose ?? false;
    this.quiet = options.quiet ?? false;
    this.json = options.json ?? process.env.NODE_ENV === "production";
    this.traceId = options.traceId ?? this.generateTraceId();
    this.noColor = options.noColor ?? false;
  }

  getTraceId(): string {
    return this.traceId;
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log("info", msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log("warn", msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log("error", msg, data);
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    if (this.verbose) {
      this.log("debug", msg, data);
    }
  }

  step(stepName: string, msg: string): void {
    this.info(msg, { step: stepName });
  }

  private log(
    level: string,
    msg: string,
    data?: Record<string, unknown>
  ): void {
    if (this.quiet && level !== "error") {
      return;
    }

    const entry = {
      ts: new Date().toISOString(),
      level,
      trace_id: this.traceId,
      ...data,
      msg,
    };

    if (this.json) {
      console.log(JSON.stringify(entry));
    } else {
      const time = new Date().toTimeString().slice(0, 8);
      const levelStr = level.toUpperCase().padEnd(5);
      const traceStr = this.traceId ? `[${this.traceId}] ` : "";
      const color = this.noColor ? "" : this.getColor(level);
      const reset = this.noColor ? "" : "\x1b[0m";
      console.log(`${color}[${time}] ${levelStr} ${traceStr}${msg}${reset}`);
    }
  }

  private getColor(level: string): string {
    switch (level) {
      case "error":
        return "\x1b[31m";
      case "warn":
        return "\x1b[33m";
      case "debug":
        return "\x1b[90m";
      default:
        return "\x1b[36m";
    }
  }

  private generateTraceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${timestamp}-${random}`;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function isCIEnvironment(): boolean {
  const ciIndicators = [
    "CI",
    "BUILD_NUMBER",
    "CI_PIPELINE_ID",
    "CIRCLECI",
    "TRAVIS",
    "GITHUB_ACTIONS",
    "GITLAB_CI",
  ];
  return ciIndicators.some((key) => Boolean(process.env[key]));
}

function isInteractiveMode(options: { ci?: boolean }): boolean {
  if (options.ci ?? isCIEnvironment()) {
    return false;
  }
  return process.stdin.isTTY && process.stdout.isTTY;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || "5432", 10),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    user: decodeURIComponent(parsed.username),
  };
}

function classifyConnectionError(error: unknown): {
  message: string;
  hint: string;
  retryable: boolean;
} {
  const errorMsg = error instanceof Error ? error.message : String(error);

  if (errorMsg.includes("ECONNREFUSED")) {
    return {
      message: "Database connection refused",
      hint: "Check if PostgreSQL is running and the host/port are correct",
      retryable: true,
    };
  }
  if (errorMsg.includes("ENOTFOUND")) {
    return {
      message: "Database hostname not found",
      hint: "Verify the DATABASE_URL hostname is correct",
      retryable: false,
    };
  }
  if (errorMsg.includes("authentication") || errorMsg.includes("password")) {
    return {
      message: "Database authentication failed",
      hint: "Check the username and password in DATABASE_URL",
      retryable: false,
    };
  }
  if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
    return {
      message: "Database connection timeout",
      hint: "Database may be overloaded or network is slow",
      retryable: true,
    };
  }
  if (errorMsg.includes("does not exist")) {
    return {
      message: "Database does not exist",
      hint: "Create the database first or check the database name",
      retryable: false,
    };
  }

  return {
    message: `Database connection error: ${errorMsg}`,
    hint: "Check DATABASE_URL and database server status",
    retryable: true,
  };
}

// ============================================================================
// SIGNAL HANDLERS
// ============================================================================

let shuttingDown = false;

function setupSignalHandlers(logger: Logger): void {
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info(`Received ${signal}, draining connections...`);

    const timeout = setTimeout(() => {
      logger.warn("Shutdown timeout reached, forcing exit");
      process.exit(1);
    }, 5000);

    try {
      await prisma.$disconnect();
      clearTimeout(timeout);
      logger.info("Connections drained, exiting");
      process.exit(0);
    } catch {
      logger.error("Disconnect failed, forcing exit");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ============================================================================
// SEED DATA CONSTANTS
// ============================================================================

const PERMISSIONS = [
  { code: "sales.create", name: "Create Sale", module: "sales" },
  { code: "sales.view", name: "View Sales", module: "sales" },
  { code: "sales.void", name: "Void Sale", module: "sales" },
  { code: "sales.discount", name: "Apply Discount", module: "sales" },
  { code: "sales.price_override", name: "Override Price", module: "sales" },
  { code: "inventory.view", name: "View Inventory", module: "inventory" },
  { code: "inventory.create", name: "Create Product", module: "inventory" },
  { code: "inventory.edit", name: "Edit Product", module: "inventory" },
  { code: "inventory.delete", name: "Delete Product", module: "inventory" },
  { code: "inventory.adjust", name: "Adjust Stock", module: "inventory" },
  { code: "inventory.count", name: "Count Stock", module: "inventory" },
  { code: "po.create", name: "Create PO", module: "purchases" },
  { code: "po.view", name: "View PO", module: "purchases" },
  { code: "po.receive", name: "Receive PO", module: "purchases" },
  { code: "po.cancel", name: "Cancel PO", module: "purchases" },
  { code: "returns.create", name: "Create Return", module: "returns" },
  { code: "returns.view", name: "View Returns", module: "returns" },
  { code: "returns.approve", name: "Approve Return", module: "returns" },
  { code: "trade_ins.create", name: "Create Trade-In", module: "trade_ins" },
  { code: "trade_ins.view", name: "View Trade-Ins", module: "trade_ins" },
  { code: "customers.create", name: "Create Customer", module: "customers" },
  { code: "customers.view", name: "View Customers", module: "customers" },
  { code: "customers.edit", name: "Edit Customer", module: "customers" },
  { code: "customers.delete", name: "Delete Customer", module: "customers" },
  { code: "customers.credit", name: "Manage Credit", module: "customers" },
  { code: "suppliers.create", name: "Create Supplier", module: "suppliers" },
  { code: "suppliers.view", name: "View Suppliers", module: "suppliers" },
  { code: "suppliers.edit", name: "Edit Supplier", module: "suppliers" },
  { code: "suppliers.delete", name: "Delete Supplier", module: "suppliers" },
  { code: "suppliers.pay", name: "Make Payment", module: "suppliers" },
  {
    code: "suppliers.return",
    name: "Process Supplier Return",
    module: "suppliers",
  },
  { code: "cash.shift_open", name: "Open Shift", module: "cash" },
  { code: "cash.shift_close", name: "Close Shift", module: "cash" },
  { code: "cash.expense", name: "Record Expense", module: "cash" },
  { code: "cash.withdrawal", name: "Withdraw Cash", module: "cash" },
  { code: "cash.float", name: "Add Float", module: "cash" },
  { code: "cash.view", name: "View Cash", module: "cash" },
  { code: "cash.safe_drop", name: "Safe Drop", module: "cash" },
  { code: "cash.force_close", name: "Force Close Shift", module: "cash" },
  { code: "attendance.view", name: "View Attendance", module: "attendance" },
  {
    code: "attendance.adjust",
    name: "Adjust Attendance",
    module: "attendance",
  },
  { code: "reports.sales", name: "Sales Report", module: "reports" },
  { code: "reports.inventory", name: "Inventory Report", module: "reports" },
  { code: "reports.financial", name: "Financial Report", module: "reports" },
  { code: "reports.staff", name: "Staff Report", module: "reports" },
  { code: "reports.export", name: "Export Reports", module: "reports" },
  { code: "settings.view", name: "View Settings", module: "settings" },
  { code: "settings.edit", name: "Edit Settings", module: "settings" },
  { code: "settings.users", name: "Manage Users", module: "settings" },
  { code: "settings.roles", name: "Manage Roles", module: "settings" },
  { code: "warranty.create", name: "Create Warranty", module: "warranty" },
  { code: "warranty.view", name: "View Warranty", module: "warranty" },
  { code: "warranty.claim", name: "Warranty Claim", module: "warranty" },
  {
    code: "notifications.manage",
    name: "Manage Notifications",
    module: "notifications",
  },
  { code: "audit.view", name: "View Audit", module: "audit" },
  {
    code: "sales.installment",
    name: "Create Installment Sale",
    module: "sales",
  },
  {
    code: "installments.collect",
    name: "Collect Installment Payment",
    module: "installments",
  },
  {
    code: "installments.view",
    name: "View Installment Plans",
    module: "installments",
  },
  { code: "loyalty.manage", name: "Manage Loyalty Program", module: "loyalty" },
  { code: "loyalty.adjust", name: "Adjust Loyalty Points", module: "loyalty" },
  {
    code: "inventory.reorder",
    name: "Manage Reorder Points",
    module: "inventory",
  },
  { code: "sms.send", name: "Send SMS", module: "sms" },
  { code: "sms.templates", name: "Manage SMS Templates", module: "sms" },
  { code: "companies.view", name: "View Companies", module: "companies" },
  { code: "companies.create", name: "Create Company", module: "companies" },
  { code: "companies.edit", name: "Edit Company", module: "companies" },
  { code: "companies.delete", name: "Delete Company", module: "companies" },
];

const CATEGORIES = [
  {
    slug: "smartphone",
    name: "Smartphone",
    nameAr: "هاتف ذكي",
    nameFr: "Smartphone",
    sortOrder: 1,
    productType: "PHONE" as const,
  },
  {
    slug: "tablet",
    name: "Tablet",
    nameAr: "جهاز لوحي",
    nameFr: "Tablette",
    sortOrder: 2,
    productType: "PHONE" as const,
  },
  {
    slug: "feature-phone",
    name: "Feature Phone",
    nameAr: "هاتف عادي",
    nameFr: "Téléphone basique",
    sortOrder: 3,
    productType: "PHONE" as const,
  },
  {
    slug: "cases-covers",
    name: "Cases & Covers",
    nameAr: "الأغطية والحافظات",
    nameFr: "Coques et Étuis",
    sortOrder: 4,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "screen-protectors",
    name: "Screen Protectors",
    nameAr: "واقيات الشاشة",
    nameFr: "Protections d'écran",
    sortOrder: 5,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "chargers-cables",
    name: "Chargers & Cables",
    nameAr: "الشواحن والكابلات",
    nameFr: "Chargeurs et Câbles",
    sortOrder: 6,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "audio",
    name: "Audio",
    nameAr: "الصوتيات",
    nameFr: "Audio",
    sortOrder: 7,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "power-banks",
    name: "Power Banks",
    nameAr: "بطاريات محمولة",
    nameFr: "Batteries externes",
    sortOrder: 8,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "memory-cards",
    name: "Memory Cards",
    nameAr: "بطاقات الذاكرة",
    nameFr: "Cartes mémoire",
    sortOrder: 9,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "smartwatches",
    name: "Smartwatches",
    nameAr: "الساعات الذكية",
    nameFr: "Montres connectées",
    sortOrder: 10,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "holders-mounts",
    name: "Holders & Mounts",
    nameAr: "حوامل ومثبتات",
    nameFr: "Supports et Fixations",
    sortOrder: 11,
    productType: "ACCESSORY" as const,
  },
  {
    slug: "prepaid-sim",
    name: "Prepaid SIM",
    nameAr: "شريحة مسبقة الدفع",
    nameFr: "SIM Prépayée",
    sortOrder: 12,
    productType: "SIM_CARD" as const,
  },
  {
    slug: "postpaid-sim",
    name: "Postpaid SIM",
    nameAr: "شريحة مؤجلة الدفع",
    nameFr: "SIM Postpayée",
    sortOrder: 13,
    productType: "SIM_CARD" as const,
  },
  {
    slug: "data-transfer",
    name: "Data Transfer",
    nameAr: "نقل البيانات",
    nameFr: "Transfert de données",
    sortOrder: 14,
    productType: "SERVICE" as const,
  },
  {
    slug: "phone-unlock",
    name: "Phone Unlock",
    nameAr: "فتح قفل الهاتف",
    nameFr: "Déverrouillage",
    sortOrder: 15,
    productType: "SERVICE" as const,
  },
  {
    slug: "software-service",
    name: "Software Service",
    nameAr: "خدمات البرمجيات",
    nameFr: "Service logiciel",
    sortOrder: 16,
    productType: "SERVICE" as const,
  },
];

const BRANDS = [
  { name: "Samsung", nameAr: "سامسونغ", nameFr: "Samsung" },
  { name: "Apple", nameAr: "آبل", nameFr: "Apple" },
  { name: "Xiaomi", nameAr: "شاومي", nameFr: "Xiaomi" },
  { name: "Huawei", nameAr: "هواوي", nameFr: "Huawei" },
  { name: "Honor", nameAr: "هونر", nameFr: "Honor" },
  { name: "Oppo", nameAr: "أوبو", nameFr: "Oppo" },
  { name: "Realme", nameAr: "ريلمي", nameFr: "Realme" },
  { name: "Infinix", nameAr: "إنفينيكس", nameFr: "Infinix" },
  { name: "Tecno", nameAr: "تكنو", nameFr: "Tecno" },
  { name: "itel", nameAr: "آيتل", nameFr: "itel" },
  { name: "Nokia", nameAr: "نوكيا", nameFr: "Nokia" },
  { name: "vivo", nameAr: "فيفو", nameFr: "vivo" },
  { name: "Condor", nameAr: "كوندور", nameFr: "Condor" },
  { name: "Iris", nameAr: "إيريس", nameFr: "Iris" },
  { name: "Nothing", nameAr: "ناثينغ", nameFr: "Nothing" },
  { name: "ZTE", nameAr: "زد تي إي", nameFr: "ZTE" },
  { name: "Motorola", nameAr: "موتورولا", nameFr: "Motorola" },
  { name: "OnePlus", nameAr: "ون بلس", nameFr: "OnePlus" },
  { name: "Google", nameAr: "غوغل", nameFr: "Google" },
];

const OPERATORS = [
  { name: "Mobilis" },
  { name: "Djezzy" },
  { name: "Ooredoo" },
];

const EXPENSE_CATEGORIES = [
  { name: "Rent", nameAr: "الإيجار", nameFr: "Loyer" },
  { name: "Utilities", nameAr: "المرافق", nameFr: "Services publics" },
  { name: "Salary", nameAr: "الرواتب", nameFr: "Salaires" },
  { name: "Transport", nameAr: "النقل", nameFr: "Transport" },
  { name: "Maintenance", nameAr: "الصيانة", nameFr: "Maintenance" },
  { name: "Packaging", nameAr: "التغليف", nameFr: "Emballage" },
  { name: "Telecom", nameAr: "الاتصالات", nameFr: "Télécom" },
  { name: "Taxes & Fees", nameAr: "الضرائب والرسوم", nameFr: "Taxes et Frais" },
  { name: "Insurance", nameAr: "التأمين", nameFr: "Assurance" },
  { name: "Cleaning", nameAr: "التنظيف", nameFr: "Nettoyage" },
  {
    name: "Food & Beverages",
    nameAr: "المأكولات والمشروبات",
    nameFr: "Nourriture et Boissons",
  },
  { name: "Miscellaneous", nameAr: "متنوع", nameFr: "Divers" },
];

const RETURN_REASONS = [
  { name: "Defective", nameAr: "معيب", nameFr: "Défectueux" },
  { name: "Wrong Item", nameAr: "منتج خاطئ", nameFr: "Mauvais article" },
  { name: "Changed Mind", nameAr: "تغيير الرأي", nameFr: "Changement d'avis" },
  {
    name: "Not as Described",
    nameAr: "لا يطابق الوصف",
    nameFr: "Non conforme à la description",
  },
  {
    name: "Warranty Claim",
    nameAr: "مطالبة ضمان",
    nameFr: "Réclamation de garantie",
  },
  { name: "Missing Parts", nameAr: "أجزاء ناقصة", nameFr: "Pièces manquantes" },
  { name: "Incompatible", nameAr: "غير متوافق", nameFr: "Incompatible" },
  { name: "Other", nameAr: "أخرى", nameFr: "Autre" },
];

const NOTIFICATION_DEFAULTS = [
  {
    notificationType: "LOW_STOCK",
    enabled: true,
    priority: "HIGH",
    thresholdValue: 5,
    cooldownMinutes: 60,
  },
  {
    notificationType: "OUT_OF_STOCK",
    enabled: true,
    priority: "URGENT",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "RETURN_REQUESTED",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "DISCOUNT_REQUESTED",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "SHIFT_OPEN",
    enabled: true,
    priority: "LOW",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "SHIFT_CLOSED",
    enabled: true,
    priority: "LOW",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "CASH_DISCREPANCY",
    enabled: true,
    priority: "HIGH",
    thresholdValue: 500,
    cooldownMinutes: 0,
  },
  {
    notificationType: "SUPPLIER_PAYMENT_DUE",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: null,
    cooldownMinutes: 1440,
  },
  {
    notificationType: "WARRANTY_EXPIRING",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: null,
    cooldownMinutes: 1440,
  },
  {
    notificationType: "LARGE_SALE",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: 50_000,
    cooldownMinutes: 0,
  },
  {
    notificationType: "VOID_SALE",
    enabled: true,
    priority: "HIGH",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "FAILED_LOGIN",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: null,
    cooldownMinutes: 5,
  },
  {
    notificationType: "BACKUP_FAILED",
    enabled: true,
    priority: "HIGH",
    thresholdValue: null,
    cooldownMinutes: 60,
  },
  {
    notificationType: "BACKUP_SUCCESS",
    enabled: true,
    priority: "LOW",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "STOCK_ADJUSTMENT",
    enabled: true,
    priority: "LOW",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "NEW_TRADE_IN",
    enabled: true,
    priority: "LOW",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "PRICE_CHANGE",
    enabled: true,
    priority: "LOW",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
  {
    notificationType: "SUPPLIER_RETURN",
    enabled: true,
    priority: "MEDIUM",
    thresholdValue: null,
    cooldownMinutes: 0,
  },
];

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function checkDatabaseConnection(
  ctx: CommandContext,
  logger: Logger
): Promise<ConnectionStatus> {
  const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || "");
  const result: ConnectionStatus = {
    connected: false,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    latencyMs: 0,
    error: null,
    attempts: 0,
  };

  const maxRetries = ctx.options.retry + 1;
  const retryDelay = ctx.options.retryDelay * 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    result.attempts = attempt;

    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      result.latencyMs = Date.now() - start;
      result.connected = true;
      logger.debug(`Connection OK (${result.latencyMs}ms)`);
      return result;
    } catch (error) {
      if (attempt < maxRetries) {
        logger.warn(
          `Connection attempt ${attempt} failed, retrying in ${ctx.options.retryDelay}s...`
        );
        await sleep(retryDelay);
      } else {
        const classified = classifyConnectionError(error);
        result.error = classified.message;
        logger.error(classified.message, {
          hint: classified.hint,
          retryable: classified.retryable,
        });
      }
    }
  }

  return result;
}

async function resetDatabase(
  ctx: CommandContext,
  logger: Logger
): Promise<void> {
  logger.info("Dropping schema...");

  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would execute DROP SCHEMA public CASCADE");
    return;
  }

  await prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE");
  await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  await prisma.$executeRawUnsafe("GRANT ALL ON SCHEMA public TO public");
  await prisma.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO public");

  logger.info("Schema reset complete");
}

function runMigrations(
  ctx: CommandContext,
  logger: Logger
): Promise<{ applied: number; pending: number }> {
  logger.info("Running migrations...");

  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would run prisma migrate deploy");
    return Promise.resolve({ applied: 0, pending: 0 });
  }

  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    });

    let applied = 0;

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(data);

      const matches = text.match(/Applying migration/g);
      if (matches) {
        applied += matches.length;
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      if (code === 0) {
        logger.info(`Migrations complete (${applied} applied)`);
        resolve({ applied, pending: 0 });
      } else {
        reject(new Error(`Migration failed with exit code ${code}`));
      }
    });

    child.on("error", (error: Error) => {
      reject(error);
    });
  });
}

const BOOTSTRAP_LOCK_ID = 12_345;

async function acquireBootstrapLock(
  ctx: CommandContext,
  logger: Logger
): Promise<boolean> {
  const timeout = ctx.options.lockTimeout * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await prisma.$queryRaw<
        [{ pg_try_advisory_lock: boolean }]
      >`
        SELECT pg_try_advisory_lock(${BOOTSTRAP_LOCK_ID}) as pg_try_advisory_lock
      `;

      if (result[0].pg_try_advisory_lock) {
        logger.debug("Bootstrap lock acquired");
        return true;
      }

      logger.info("Bootstrap in progress by another instance, waiting...");

      const bootstrapState = await prisma.bootstrapState.findUnique({
        where: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
      });

      if (bootstrapState) {
        logger.info("Bootstrap completed by another instance");
        return false;
      }

      await sleep(2000);
    } catch {
      logger.warn("Failed to acquire lock, retrying...");
      await sleep(1000);
    }
  }

  throw new Error("Bootstrap lock timeout - another instance may be stuck");
}

async function releaseBootstrapLock(logger: Logger): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${BOOTSTRAP_LOCK_ID})`;
    logger.debug("Bootstrap lock released");
  } catch {
    logger.warn("Failed to release bootstrap lock");
  }
}

async function seedReferenceData(
  ctx: CommandContext,
  logger: Logger
): Promise<{ ownerRoleId: string; counts: Record<string, number> }> {
  logger.step("seed", "Seeding reference data...");
  const counts: Record<string, number> = {};

  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would seed reference data");
    return { ownerRoleId: "", counts };
  }

  logger.step("permissions", "Creating permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  counts.permissions = PERMISSIONS.length;

  logger.step("roles", "Creating roles...");
  const allPermissions = await prisma.permission.findMany();

  const ownerRole = await prisma.role.upsert({
    where: { name: "owner" },
    update: {},
    create: {
      name: "owner",
      nameAr: "مالك",
      nameFr: "Propriétaire",
      description: "Full access to all system features",
      isSystem: true,
      permissions: {
        createMany: {
          data: allPermissions.map((p) => ({ permissionId: p.id })),
        },
      },
    },
  });

  const ownerExisting = await prisma.rolePermission.findMany({
    where: { roleId: ownerRole.id },
    select: { permissionId: true },
  });
  const ownerExistingIds = new Set(ownerExisting.map((rp) => rp.permissionId));
  const ownerMissing = allPermissions.filter(
    (p) => !ownerExistingIds.has(p.id)
  );
  if (ownerMissing.length > 0) {
    await prisma.rolePermission.createMany({
      data: ownerMissing.map((p) => ({
        roleId: ownerRole.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  const managerRole = await prisma.role.upsert({
    where: { name: "manager" },
    update: {},
    create: {
      name: "manager",
      nameAr: "مدير",
      nameFr: "Gérant",
      description: "Store management without role administration",
      isSystem: true,
      permissions: {
        createMany: {
          data: allPermissions
            .filter((p) => p.code !== "settings.roles")
            .map((p) => ({ permissionId: p.id })),
        },
      },
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: "cashier" },
    update: {},
    create: {
      name: "cashier",
      nameAr: "صراف",
      nameFr: "Caissier",
      description: "Point of sale and basic inventory access",
      isSystem: true,
      permissions: {
        createMany: {
          data: [
            "sales.create",
            "sales.view",
            "sales.discount",
            "returns.create",
            "returns.view",
            "cash.shift_open",
            "cash.shift_close",
            "cash.expense",
            "cash.view",
            "cash.safe_drop",
            "customers.create",
            "customers.view",
            "inventory.view",
            "warranty.view",
          ]
            .map(
              (code) =>
                allPermissions.find((p) => p.code === code)?.id as string
            )
            .filter(Boolean)
            .map((id) => ({ permissionId: id })),
        },
      },
    },
  });

  counts.roles = 3;

  logger.step("discount-limits", "Creating role discount limits...");
  await prisma.roleDiscountLimit.upsert({
    where: { roleId: ownerRole.id },
    update: {},
    create: {
      roleId: ownerRole.id,
      maxPercentage: 100,
      maxFixedAmount: 999_999,
      requiresReason: false,
      requiresApprovalAbove: 0,
    },
  });

  await prisma.roleDiscountLimit.upsert({
    where: { roleId: managerRole.id },
    update: {},
    create: {
      roleId: managerRole.id,
      maxPercentage: 30,
      maxFixedAmount: 50_000,
      requiresReason: true,
      requiresApprovalAbove: 30_000,
    },
  });

  await prisma.roleDiscountLimit.upsert({
    where: { roleId: cashierRole.id },
    update: {},
    create: {
      roleId: cashierRole.id,
      maxPercentage: 10,
      maxFixedAmount: 5000,
      requiresReason: true,
      requiresApprovalAbove: 2000,
    },
  });

  logger.step("customer", "Creating default customer...");
  await prisma.customer.upsert({
    where: { id: "00000000-0000-0000-0000-000000000000" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      fullName: "Walk-in Customer",
      fullNameAr: "عميل زائر",
      language: "en",
      isSystem: true,
      isDefault: true,
    },
  });

  logger.step("categories", "Creating categories...");
  const categoryMap = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        nameAr: category.nameAr,
        nameFr: category.nameFr,
        sortOrder: category.sortOrder,
        productType: category.productType,
      },
      create: {
        name: category.name,
        nameAr: category.nameAr,
        nameFr: category.nameFr,
        slug: category.slug,
        sortOrder: category.sortOrder,
        productType: category.productType,
      },
    });
    categoryMap.set(category.slug, created.id);
  }
  counts.categories = CATEGORIES.length;

  logger.step("brands", "Creating brands...");
  for (const brand of BRANDS) {
    await prisma.brand.upsert({
      where: { slug: brand.name.toLowerCase() },
      update: { nameAr: brand.nameAr, nameFr: brand.nameFr },
      create: {
        name: brand.name,
        nameAr: brand.nameAr,
        nameFr: brand.nameFr,
        slug: brand.name.toLowerCase(),
        isActive: true,
      },
    });
  }
  counts.brands = BRANDS.length;

  logger.step("operators", "Creating operators...");
  for (const operator of OPERATORS) {
    await prisma.operator.upsert({
      where: { name: operator.name },
      update: {},
      create: { name: operator.name },
    });
  }
  counts.operators = OPERATORS.length;

  logger.step("expense-categories", "Creating expense categories...");
  for (const ec of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: ec.name },
      update: { nameAr: ec.nameAr, nameFr: ec.nameFr },
      create: ec,
    });
  }

  logger.step("return-reasons", "Creating return reasons...");
  for (const reason of RETURN_REASONS) {
    await prisma.returnReason.upsert({
      where: { name: reason.name },
      update: { nameAr: reason.nameAr, nameFr: reason.nameFr },
      create: reason,
    });
  }

  logger.step("notification-settings", "Creating notification settings...");
  for (const s of NOTIFICATION_DEFAULTS) {
    await prisma.notificationSetting.upsert({
      where: { notificationType: s.notificationType as never },
      update: {},
      create: s as never,
    });
  }

  logger.step("reference", "Reference seeding completed!");
  return { ownerRoleId: ownerRole.id, counts };
}

const AGENT_DEFINITIONS = [
  {
    name: "general_assistant",
    displayName: "General Assistant",
    instructions: `You are a helpful assistant for a phone and accessories retail store.
You help with general questions about store operations, best practices, and how to use the POS system.

Rules:
- Be concise and practical
- Respond in the same language the user writes in
- If the user asks about data or numbers, tell them you'll route them to the data analyst
- Do not make up information about the store's specific data
- You do not have access to the database, so do not attempt to answer data questions`,
    toolNames: [] as string[],
    isBuiltIn: true,
    enabledHostedTools: ["web_search"],
  },
  {
    name: "data_analyst",
    displayName: "Data Analyst",
    instructions: `You are a data analyst for a phone and accessories retail store POS system.
You have access to the store's database via the queryDatabase tool.

Rules:
- Write PostgreSQL queries using double-quoted table names (e.g., SELECT * FROM "Product")
- Always use LIMIT to avoid returning too many rows
- Present results using markdown tables for tabular data
- Use markdown formatting: **bold** for key numbers, headers for sections
- When a query returns no results, say so clearly — do not make up data
- Respond in the same language the user writes in
- For monetary values, format as DZD (Algerian Dinar)
- The database schema will be provided below

{SCHEMA_PLACEHOLDER}`,
    toolNames: ["queryDatabase"],
    isBuiltIn: true,
    enabledHostedTools: [] as string[],
  },
];

async function syncAgentDefinitions(
  ctx: CommandContext,
  logger: Logger
): Promise<void> {
  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would create default agent definitions");
    return;
  }

  const adminUser = await prisma.user.findUnique({
    where: { username: SEEDED_ADMIN_USERNAME },
  });

  if (!adminUser) {
    logger.debug("No admin user found, skipping agent definitions");
    return;
  }

  logger.step("agent-definitions", "Creating default agent definitions...");

  for (const def of AGENT_DEFINITIONS) {
    await prisma.agentDefinition.upsert({
      where: {
        userId_name: {
          userId: adminUser.id,
          name: def.name,
        },
      },
      update: {
        displayName: def.displayName,
        instructions: def.instructions,
        toolNames: def.toolNames,
        enabledHostedTools: def.enabledHostedTools,
      },
      create: {
        userId: adminUser.id,
        ...def,
      },
    });
  }
}

const COMMON_PASSWORDS = [
  "password",
  "123456",
  "admin",
  "qwerty",
  "letmein",
  "welcome",
  "password123",
  "admin123",
];

function validatePassword(password: string): {
  valid: boolean;
  reason?: string;
} {
  if (password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters" };
  }

  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return { valid: false, reason: "Password is too common" };
  }

  return { valid: true };
}

async function promptPassword(logger: Logger): Promise<string | null> {
  const rl = createInterface({ input, output });

  try {
    process.stdout.write("Enter admin password (min 8 characters): ");
    let password = "";

    process.stdin.setRawMode(true);
    for await (const char of process.stdin) {
      if (char === "\n" || char === "\r" || char === "\u0003") {
        break;
      }
      password += char;
      process.stdout.write("*");
    }
    process.stdin.setRawMode(false);
    process.stdout.write("\n");

    const validation = validatePassword(password);
    if (!validation.valid) {
      logger.error(validation.reason || "Invalid password");
      return null;
    }

    process.stdout.write("Confirm password: ");
    let confirm = "";
    process.stdin.setRawMode(true);
    for await (const char of process.stdin) {
      if (char === "\n" || char === "\r" || char === "\u0003") {
        break;
      }
      confirm += char;
      process.stdout.write("*");
    }
    process.stdin.setRawMode(false);
    process.stdout.write("\n");

    if (password !== confirm) {
      logger.error("Passwords do not match");
      return null;
    }

    return password;
  } finally {
    rl.close();
  }
}

function displayPasswordForEnv(password: string): void {
  const line = `SEED_ADMIN_PASSWORD=${password}`;
  const border = "\u2500".repeat(Math.max(line.length + 4, 60));

  console.log("");
  console.log(`\u250c${border}\u2510`);
  console.log(
    `\u2502  Add to your .env file:${" ".repeat(Math.max(0, border.length - 27))}\u2502`
  );
  console.log(`\u2502${" ".repeat(border.length)}\u2502`);
  console.log(
    `\u2502  ${line}${" ".repeat(Math.max(0, border.length - line.length - 2))}\u2502`
  );
  console.log(`\u2502${" ".repeat(border.length)}\u2502`);
  console.log(
    `\u2502  This ensures the admin account works after restart${" ".repeat(Math.max(0, border.length - 55))}\u2502`
  );
  console.log(`\u2514${border}\u2518`);
  console.log("");

  if (process.platform === "darwin" || process.platform === "linux") {
    try {
      const clipboard =
        process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard";
      execSync(clipboard, { input: line });
      console.log("\u2713 Copied to clipboard!");
    } catch {
      // Clipboard not available
    }
  }
}

async function seedAdmin(
  ownerRoleId: string,
  ctx: CommandContext,
  logger: Logger
): Promise<{ created: boolean; password?: string }> {
  let password = getSeedAdminPassword();

  if (!password && ctx.isInteractive) {
    const prompted = await promptPassword(logger);
    if (!prompted) {
      logger.warn("No password provided, skipping admin creation");
      return { created: false };
    }
    password = prompted;
    displayPasswordForEnv(password);
  }

  if (!password) {
    logger.warn("SEED_ADMIN_PASSWORD not set, skipping admin creation");
    return { created: false };
  }

  const validation = validatePassword(password);
  if (!validation.valid) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Password validation failed: ${validation.reason}`);
    }
    logger.warn(`Password weak: ${validation.reason}`);
  }

  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would create/update admin user");
    return { created: true, password };
  }

  logger.step("admin", "Creating admin user...");

  const adminPasswordHash = await hashPassword(password);
  const adminPinHash = await hashPin("0000");
  const requirePasswordChange =
    shouldRequireSeedAdminPasswordChangeInProduction();

  await prisma.user.upsert({
    where: { username: SEEDED_ADMIN_USERNAME },
    update: ctx.options.resetPassword
      ? {
          passwordHash: adminPasswordHash,
          mustChangePassword: requirePasswordChange,
        }
      : {},
    create: {
      username: SEEDED_ADMIN_USERNAME,
      fullName: "System Administrator",
      passwordHash: adminPasswordHash,
      pinHash: adminPinHash,
      roleId: ownerRoleId,
      language: "en",
      isActive: true,
      mustChangePassword: requirePasswordChange,
    },
  });

  logger.info(
    `Admin user ${ctx.options.resetPassword ? "updated" : "created"}`
  );

  return { created: true, password: ctx.isInteractive ? password : undefined };
}

// ============================================================================
// CLI PARSER
// ============================================================================

function printHelp(): void {
  console.log(`
Phone POS AI - Database Management CLI

Usage:
  pnpm db <command> [options]
  node prisma/db.mjs <command> [options]  (Docker/production)

Commands:
  reset        Wipe DB, run migrations, seed everything
  seed         Seed reference data only
  bootstrap    Docker one-time: auto-detect and seed if fresh
  repair-admin Create/repair admin user
  status       Show database state and health

Options (global):
  -h, --help              Show help
  -v, --verbose           Detailed output
  -q, --quiet             Errors only
  --dry-run               Preview without executing
  --no-color              Disable colors
  --ci                    Force non-interactive mode
  --trace-id=<id>         Correlation ID for logs
  --timeout-connection=<s> Connection timeout (default: 30)
  --retry=<n>             Retry failed operations (default: 0)
  --retry-delay=<s>       Delay between retries (default: 5)
  --metrics               Output execution metrics

Command options:
  reset:
    --skip-admin          Skip admin seeding
    --no-confirm          Skip confirmation prompt
    --production-reset    REQUIRED in production
    --force               REQUIRED in production
    
  bootstrap:
    --force               Re-run even if complete
    --lock-timeout=<s>    Advisory lock timeout (default: 60)
    
  repair-admin:
    --reset-password      Force new password
    
  status:
    --json                JSON output
    --liveness            Kubernetes liveness probe
    --readiness           Kubernetes readiness probe
    --startup             Kubernetes startup probe

Exit codes:
  0  Success
  1  Retryable error (connection, timeout)
  2  Configuration error (missing env, validation)
  3  User cancelled
  4  Destructive action blocked (production safety)
  5  Partial failure

Examples:
  pnpm db reset
  pnpm db bootstrap --ci
  NODE_ENV=production pnpm db reset --force --production-reset --no-confirm
  pnpm db status --readiness
`);
}

function parseCLIArgs(argv: string[]): {
  command: string;
  options: ParsedOptions;
} {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h" },
      verbose: { type: "boolean", short: "v" },
      quiet: { type: "boolean", short: "q" },
      "dry-run": { type: "boolean" },
      "no-color": { type: "boolean" },
      ci: { type: "boolean" },
      "trace-id": { type: "string" },
      "timeout-connection": { type: "string", default: "30" },
      "timeout-migration": { type: "string", default: "300" },
      "timeout-seed": { type: "string", default: "120" },
      retry: { type: "string", default: "0" },
      "retry-delay": { type: "string", default: "5" },
      metrics: { type: "boolean" },
      "metrics-file": { type: "string" },
      "skip-admin": { type: "boolean" },
      "no-confirm": { type: "boolean" },
      "production-reset": { type: "boolean" },
      force: { type: "boolean" },
      backup: { type: "boolean" },
      "backup-file": { type: "string" },
      "lock-timeout": { type: "string", default: "60" },
      "reset-password": { type: "boolean" },
      "reset-pin": { type: "boolean" },
      json: { type: "boolean" },
      liveness: { type: "boolean" },
      readiness: { type: "boolean" },
      startup: { type: "boolean" },
      check: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0] || "";

  const bool = (key: string): boolean => (values[key] as boolean) ?? false;
  const str = (key: string): string | undefined =>
    values[key] as string | undefined;
  const num = (key: string, fallback: string): number =>
    Number.parseInt((values[key] as string) || fallback, 10);

  const options: ParsedOptions = {
    help: bool("help"),
    verbose: bool("verbose"),
    quiet: bool("quiet"),
    dryRun: bool("dry-run"),
    noColor: bool("no-color"),
    ci: bool("ci"),
    traceId: str("trace-id"),
    timeoutConnection: num("timeout-connection", "30"),
    timeoutMigration: num("timeout-migration", "300"),
    timeoutSeed: num("timeout-seed", "120"),
    retry: num("retry", "0"),
    retryDelay: num("retry-delay", "5"),
    metrics: bool("metrics"),
    metricsFile: str("metrics-file"),
    skipAdmin: bool("skip-admin"),
    noConfirm: bool("no-confirm"),
    productionReset: bool("production-reset"),
    force: bool("force"),
    backup: bool("backup"),
    backupFile: str("backup-file"),
    lockTimeout: num("lock-timeout", "60"),
    resetPassword: bool("reset-password"),
    resetPin: bool("reset-pin"),
    json: bool("json"),
    liveness: bool("liveness"),
    readiness: bool("readiness"),
    startup: bool("startup"),
    check: bool("check"),
  };

  return { command, options };
}

// ============================================================================
// COMMANDS
// ============================================================================

interface StatusResult {
  admin?: { exists: boolean; username?: string };
  bootstrap?: { complete: boolean; completed_at?: string };
  connection?: { ok: boolean; latency_ms: number };
  counts?: Record<string, number>;
  healthy: boolean;
  issues: string[];
  migrations?: { applied: number; pending: number };
}

async function collectDatabaseDetails(
  logger: Logger,
  result: StatusResult
): Promise<void> {
  logger.step("migrations", "Checking migrations...");
  try {
    const migrationStatus = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC
    `;
    const applied = migrationStatus.filter((m) => m.finished_at).length;
    const pending = migrationStatus.filter((m) => !m.finished_at).length;
    result.migrations = { applied, pending };

    if (pending > 0) {
      result.healthy = false;
      result.issues.push(`${pending} pending migrations`);
    }
  } catch {
    result.migrations = { applied: 0, pending: 0 };
  }

  logger.step("bootstrap", "Checking bootstrap state...");
  try {
    const bootstrapState = await prisma.bootstrapState.findUnique({
      where: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
    });
    result.bootstrap = {
      complete: !!bootstrapState,
      completed_at: bootstrapState?.completedAt?.toISOString(),
    };
  } catch {
    result.bootstrap = { complete: false };
    result.issues.push("Bootstrap state table not found");
  }

  logger.step("admin", "Checking admin user...");
  try {
    const admin = await prisma.user.findUnique({
      where: { username: SEEDED_ADMIN_USERNAME },
    });
    result.admin = {
      exists: !!admin,
      username: admin?.username,
    };

    if (!admin) {
      result.issues.push("Admin user not found");
    }
  } catch {
    result.admin = { exists: false };
    result.issues.push("Users table not found");
  }

  logger.step("counts", "Counting reference data...");
  try {
    result.counts = {
      permissions: await prisma.permission.count(),
      roles: await prisma.role.count(),
      categories: await prisma.category.count(),
      brands: await prisma.brand.count(),
      operators: await prisma.operator.count(),
    };
  } catch {
    result.counts = {
      permissions: 0,
      roles: 0,
      categories: 0,
      brands: 0,
      operators: 0,
    };
  }
}

function printStatusResult(result: StatusResult): void {
  console.log("");
  console.log("Database Status");
  console.log("=".repeat(50));
  console.log(
    `Connection: ${result.connection?.ok ? "OK" : "FAILED"} (${result.connection?.latency_ms}ms)`
  );
  console.log(
    `Migrations: ${result.migrations?.applied} applied, ${result.migrations?.pending} pending`
  );
  console.log(
    `Bootstrap: ${result.bootstrap?.complete ? "Complete" : "Not complete"}`
  );
  console.log(`Admin User: ${result.admin?.exists ? "EXISTS" : "MISSING"}`);
  console.log("");
  console.log("Reference Data Counts:");
  for (const [key, value] of Object.entries(result.counts || {})) {
    console.log(`  ${key}: ${value}`);
  }
  console.log("");
  console.log(`Health: ${result.healthy ? "OK" : "ISSUES FOUND"}`);
  if (result.issues.length > 0) {
    console.log("Issues:");
    for (const issue of result.issues) {
      console.log(`  - ${issue}`);
    }
  }
}

function resolveStatusExitCode(
  ctx: CommandContext,
  result: StatusResult
): ExitCode | null {
  if (ctx.options.readiness || ctx.options.check) {
    return result.healthy ? EXIT_CODES.SUCCESS : EXIT_CODES.RETRYABLE_ERROR;
  }

  if (ctx.options.startup) {
    return result.connection?.ok
      ? EXIT_CODES.SUCCESS
      : EXIT_CODES.RETRYABLE_ERROR;
  }

  return null;
}

async function statusCommand(
  ctx: CommandContext,
  logger: Logger
): Promise<ExitCode> {
  const isProd = process.env.NODE_ENV === "production";
  const jsonMode = ctx.options.json || isProd || ctx.options.ci;

  const result: StatusResult = {
    healthy: true,
    issues: [],
  };

  logger.step("connection", "Checking connection...");
  const connection = await checkDatabaseConnection(ctx, logger);
  result.connection = {
    ok: connection.connected,
    latency_ms: connection.latencyMs,
  };

  if (!connection.connected) {
    result.healthy = false;
    result.issues.push("Database connection failed");
  }

  if (ctx.options.liveness) {
    if (jsonMode) {
      console.log(JSON.stringify(result));
    }
    return result.healthy ? EXIT_CODES.SUCCESS : EXIT_CODES.RETRYABLE_ERROR;
  }

  if (connection.connected) {
    await collectDatabaseDetails(logger, result);
  }

  if (jsonMode) {
    console.log(JSON.stringify(result));
  } else {
    printStatusResult(result);
  }

  const probeExit = resolveStatusExitCode(ctx, result);
  if (probeExit !== null) {
    return probeExit;
  }

  return EXIT_CODES.SUCCESS;
}

async function seedCommand(
  ctx: CommandContext,
  logger: Logger
): Promise<ExitCode> {
  logger.info("Starting seed...");

  const connection = await checkDatabaseConnection(ctx, logger);
  if (!connection.connected) {
    logger.error("Database connection failed");
    return EXIT_CODES.RETRYABLE_ERROR;
  }

  const { counts } = await seedReferenceData(ctx, logger);

  if (ctx.options.metrics) {
    const metrics: Metrics = {
      duration_ms: Date.now() - ctx.startTime,
      command: "seed",
      success: true,
      exit_code: 0,
      steps: [
        {
          name: "seed",
          duration_ms: Date.now() - ctx.startTime,
          success: true,
        },
      ],
      counts,
    };
    console.log(JSON.stringify(metrics));
  }

  return EXIT_CODES.SUCCESS;
}
async function bootstrapCommand(
  ctx: CommandContext,
  logger: Logger
): Promise<ExitCode> {
  logger.info("Starting bootstrap...");

  if (ctx.options.ci) {
    logger.info("Running in CI mode (non-interactive)");
  }

  const connection = await checkDatabaseConnection(ctx, logger);
  if (!connection.connected) {
    logger.error("Database connection failed");
    return EXIT_CODES.RETRYABLE_ERROR;
  }

  const skipLock = ctx.options.force;
  const lockAcquired = skipLock || (await acquireBootstrapLock(ctx, logger));
  if (!lockAcquired) {
    logger.info("Bootstrap already complete (detected during lock wait)");
    return EXIT_CODES.SUCCESS;
  }

  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would check existing bootstrap state");
    logger.info("DRY RUN: Would run migrations");
    logger.info("DRY RUN: Would seed reference data");
    logger.info("DRY RUN: Would create/update admin user");
    logger.info("DRY RUN: Would mark bootstrap complete");
    return EXIT_CODES.SUCCESS;
  }

  try {
    const existingBootstrap = await prisma.bootstrapState.findUnique({
      where: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
    });

    if (existingBootstrap && !ctx.options.force) {
      logger.info("Bootstrap already complete, skipping");
      return EXIT_CODES.SUCCESS;
    }

    if (existingBootstrap && ctx.options.force) {
      logger.warn("--force specified, re-running bootstrap");
    }

    const migrationsStart = Date.now();
    await runMigrations(ctx, logger);
    const migrationsMs = Date.now() - migrationsStart;

    const seedStart = Date.now();
    const { ownerRoleId, counts } = await seedReferenceData(ctx, logger);
    const seedMs = Date.now() - seedStart;

    const adminStart = Date.now();
    const adminResult = await seedAdmin(ownerRoleId, ctx, logger);
    const adminMs = Date.now() - adminStart;

    if (adminResult.created) {
      await syncAgentDefinitions(ctx, logger);
    }

    await prisma.bootstrapState.upsert({
      where: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
      update: { completedAt: new Date() },
      create: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
    });

    logger.info("Bootstrap complete");

    if (ctx.options.metrics) {
      const metrics: Metrics = {
        duration_ms: Date.now() - ctx.startTime,
        command: "bootstrap",
        success: true,
        exit_code: 0,
        steps: [
          {
            name: "connection",
            duration_ms: connection.latencyMs,
            success: true,
          },
          { name: "migrations", duration_ms: migrationsMs, success: true },
          { name: "seed", duration_ms: seedMs, success: true },
          { name: "admin", duration_ms: adminMs, success: adminResult.created },
        ],
        counts,
      };
      console.log(JSON.stringify(metrics));
    }

    return EXIT_CODES.SUCCESS;
  } finally {
    await releaseBootstrapLock(logger);
  }
}

async function resetCommand(
  ctx: CommandContext,
  logger: Logger
): Promise<ExitCode> {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !(ctx.options.force && ctx.options.productionReset)) {
    logger.error("Database reset is BLOCKED in production");
    logger.info("To reset production database:");
    logger.info("  db reset --force --production-reset --no-confirm");
    return EXIT_CODES.DESTRUCTIVE_BLOCKED;
  }

  if (!ctx.options.noConfirm && ctx.isInteractive) {
    let counts: { users: number; products: number; sales: number };
    try {
      counts = {
        users: await prisma.user.count(),
        products: await prisma.product.count(),
        sales: await prisma.sale.count(),
      };
    } catch {
      counts = { users: 0, products: 0, sales: 0 };
    }

    logger.warn("This will DELETE ALL DATA:");
    logger.warn(
      `  ${counts.users} users, ${counts.products} products, ${counts.sales} sales`
    );

    const rl = createInterface({ input, output });
    const answer = await rl.question("Continue? (y/N): ");
    rl.close();

    if (answer.toLowerCase() !== "y") {
      logger.info("Cancelled");
      return EXIT_CODES.USER_CANCELLED;
    }
  }

  logger.info("Starting database reset...");

  const resetStart = Date.now();
  await resetDatabase(ctx, logger);
  const resetMs = Date.now() - resetStart;

  const migrationsStart = Date.now();
  await runMigrations(ctx, logger);
  const migrationsMs = Date.now() - migrationsStart;

  const seedStart = Date.now();
  const { ownerRoleId, counts } = await seedReferenceData(ctx, logger);
  const seedMs = Date.now() - seedStart;

  if (!ctx.options.skipAdmin) {
    await seedAdmin(ownerRoleId, ctx, logger);
    await syncAgentDefinitions(ctx, logger);
  }

  if (ctx.options.dryRun) {
    logger.info("DRY RUN: Would mark bootstrap complete");
  } else {
    await prisma.bootstrapState.upsert({
      where: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
      update: { completedAt: new Date() },
      create: { key: INITIAL_SYSTEM_BOOTSTRAP_KEY },
    });
  }

  logger.info("Database reset complete");

  if (ctx.options.metrics) {
    const metrics: Metrics = {
      duration_ms: Date.now() - ctx.startTime,
      command: "reset",
      success: true,
      exit_code: 0,
      steps: [
        { name: "reset", duration_ms: resetMs, success: true },
        { name: "migrations", duration_ms: migrationsMs, success: true },
        { name: "seed", duration_ms: seedMs, success: true },
      ],
      counts,
    };
    console.log(JSON.stringify(metrics));
  }

  return EXIT_CODES.SUCCESS;
}

async function repairAdminCommand(
  ctx: CommandContext,
  logger: Logger
): Promise<ExitCode> {
  logger.info("Checking admin user...");

  const connection = await checkDatabaseConnection(ctx, logger);
  if (!connection.connected) {
    logger.error("Database connection failed");
    return EXIT_CODES.RETRYABLE_ERROR;
  }

  const ownerRole = await prisma.role.findUnique({
    where: { name: "owner" },
  });

  if (!ownerRole) {
    logger.error("Owner role not found. Run 'db seed' first.");
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  const result = await seedAdmin(ownerRole.id, ctx, logger);

  if (!result.created) {
    logger.warn("Admin user not created");
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  if (result.password && ctx.isInteractive) {
    displayPasswordForEnv(result.password);
  }

  return EXIT_CODES.SUCCESS;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<ExitCode> {
  const { command, options } = parseCLIArgs(process.argv.slice(2));

  if (options.help || !command) {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }

  const isCI = options.ci || isCIEnvironment();
  const isInteractive = isInteractiveMode({ ci: options.ci });

  const jsonMode =
    options.json ||
    options.liveness ||
    options.readiness ||
    options.startup ||
    process.env.NODE_ENV === "production";

  const logger = new Logger({
    verbose: options.verbose,
    quiet: options.quiet,
    json: jsonMode,
    traceId: options.traceId,
    noColor: options.noColor,
  });

  setupSignalHandlers(logger);

  const ctx: CommandContext = {
    command,
    options,
    traceId: logger.getTraceId(),
    isCI,
    isInteractive,
    startTime: Date.now(),
    metrics: {
      duration_ms: 0,
      command,
      success: false,
      exit_code: 1,
      steps: [],
    },
  };

  if (!prisma) {
    logger.error("DATABASE_URL environment variable is not set");
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  logger.debug(`Running command: ${command}`);

  try {
    let exitCode: ExitCode;

    switch (command) {
      case "reset":
        exitCode = await resetCommand(ctx, logger);
        break;
      case "seed":
        exitCode = await seedCommand(ctx, logger);
        break;
      case "bootstrap":
        exitCode = await bootstrapCommand(ctx, logger);
        break;
      case "repair-admin":
        exitCode = await repairAdminCommand(ctx, logger);
        break;
      case "status":
        exitCode = await statusCommand(ctx, logger);
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        printHelp();
        exitCode = EXIT_CODES.CONFIGURATION_ERROR;
    }

    return exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    return EXIT_CODES.RETRYABLE_ERROR;
  }
}

const isDirectRun =
  process.argv[1]?.endsWith("/prisma/db.ts") ||
  process.argv[1]?.endsWith("/prisma/db.mjs");

if (isDirectRun) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error: Error) => {
      if (error.message?.includes("DATABASE_URL")) {
        console.error("ERROR: DATABASE_URL environment variable is not set");
        process.exit(2);
      }
      console.error("Fatal error:", error);
      process.exit(1);
    })
    .finally(async () => {
      try {
        await prisma.$disconnect();
      } catch {
        // prisma may not be initialized
      }
    });
}

export {
  bootstrapCommand,
  repairAdminCommand,
  resetCommand,
  seedCommand,
  statusCommand,
};
