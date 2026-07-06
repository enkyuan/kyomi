import pino from "pino";

import { SERVICE_NAME } from "@config/constants";
import { env } from "@config/env";

type LogLevel = "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;
export type AppLogger = {
  info: (event: string, context?: LogContext) => void;
  warn: (event: string, context?: LogContext) => void;
  error: (event: string, context?: LogContext) => void;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  info: 10,
  warn: 20,
  error: 30,
};
const LEVEL_LABEL: Record<LogLevel, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};
const MAX_STRING_LENGTH = 240;
const MAX_STRUCTURED_LENGTH = 480;

function getConfiguredLogLevel(): LogLevel {
  const raw = env.LOG_LEVEL;
  if (raw === "error" || raw === "warn" || raw === "info") {
    return raw;
  }
  return env.NODE_ENV === "production" ? "warn" : "info";
}

function shouldLog(level: LogLevel) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getConfiguredLogLevel()];
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatTimestamp(date: Date) {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
      date.getMilliseconds(),
      3,
    )}`,
  ].join(" ");
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function normalizeForJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item, seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeForJson(item, seen)]),
    );
  }
  return value;
}

function stringifyStructured(value: unknown) {
  try {
    return JSON.stringify(normalizeForJson(value));
  } catch {
    return JSON.stringify(String(value));
  }
}

function formatString(value: string) {
  const truncated = truncate(value, MAX_STRING_LENGTH);
  if (/^[\w./:@-]+$/.test(truncated)) {
    return truncated;
  }
  return JSON.stringify(truncated);
}

function formatContextValue(value: unknown) {
  if (typeof value === "string") {
    return formatString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value == null) {
    return String(value);
  }
  return truncate(stringifyStructured(value), MAX_STRUCTURED_LENGTH);
}

export function formatLogLine(level: LogLevel, event: string, context: LogContext = {}) {
  const timestamp = formatTimestamp(new Date());
  const fields = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatContextValue(value)}`);
  return [timestamp, SERVICE_NAME, LEVEL_LABEL[level], event, ...fields].join(" ");
}

const baseLogger = pino({
  level: getConfiguredLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
});

function emitPrettyLog(level: LogLevel, event: string, context: LogContext = {}) {
  if (!shouldLog(level)) {
    return;
  }
  process.stdout.write(`${formatLogLine(level, event, context)}\n`);
}

function emitJsonLog(level: LogLevel, event: string, context: LogContext = {}) {
  baseLogger[level]({ event, ...context });
}

const emitLog = env.NODE_ENV === "production" ? emitJsonLog : emitPrettyLog;

export const logger: AppLogger = {
  info: (event: string, context: LogContext = {}) => {
    emitLog("info", event, context);
  },
  warn: (event: string, context: LogContext = {}) => {
    emitLog("warn", event, context);
  },
  error: (event: string, context: LogContext = {}) => {
    emitLog("error", event, context);
  },
};
