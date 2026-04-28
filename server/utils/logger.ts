import { inspect } from "node:util";

type LogFn = (msg: string, ...args: unknown[]) => void;

interface Logger {
  debug: LogFn;
  error: LogFn;
  info: LogFn;
  warn: LogFn;
}

function formatMessage(level: string, msg: string, args: unknown[]): string {
  const ts = new Date().toISOString();
  const merged =
    args.length > 0
      ? `${msg} ${args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 4 }))).join(" ")}`
      : msg;
  return `${ts} ${level.toUpperCase()} ${merged}`;
}

function createLogger(): Logger {
  return {
    debug(msg: string, ...args: unknown[]) {
      if (process.env.LOG_LEVEL === "debug") {
        process.stdout.write(`${formatMessage("debug", msg, args)}\n`);
      }
    },
    error(msg: string, ...args: unknown[]) {
      process.stderr.write(`${formatMessage("error", msg, args)}\n`);
    },
    info(msg: string, ...args: unknown[]) {
      process.stdout.write(`${formatMessage("info", msg, args)}\n`);
    },
    warn(msg: string, ...args: unknown[]) {
      process.stderr.write(`${formatMessage("warn", msg, args)}\n`);
    },
  };
}

export const logger: Logger = createLogger();
