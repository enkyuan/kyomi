import pino from "pino";

import { env } from "@config/env";

type LogLevel = "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;
export type AppLogger = {
  info: (event: string, context?: LogContext) => void;
  warn: (event: string, context?: LogContext) => void;
  error: (event: string, context?: LogContext) => void;
};

function getConfiguredLogLevel(): LogLevel {
  const raw = env.LOG_LEVEL;
  if (raw === "error" || raw === "warn" || raw === "info") {
    return raw;
  }
  return env.NODE_ENV === "production" ? "warn" : "info";
}

const baseLogger = pino({
  level: getConfiguredLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const logger: AppLogger = {
  info: (event: string, context: LogContext = {}) => {
    baseLogger.info({ event, ...context });
  },
  warn: (event: string, context: LogContext = {}) => {
    baseLogger.warn({ event, ...context });
  },
  error: (event: string, context: LogContext = {}) => {
    baseLogger.error({ event, ...context });
  },
};
