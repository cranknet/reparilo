import pino from "pino";

export const logger = pino({
  name: "reparilo",
  level: process.env.LOG_LEVEL ?? "info",
});
