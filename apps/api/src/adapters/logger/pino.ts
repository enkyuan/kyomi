import pino from "pino";

import { SERVICE_NAME } from "@config/constants";

export type LogLevel = "info" | "warn" | "error";
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

export type LoggerOptions = {
  readonly nodeEnv: "development" | "production" | "test";
  readonly logLevel?: LogLevel | undefined;
};

function configuredLogLevel(options: LoggerOptions): LogLevel {
  return options.logLevel ?? (options.nodeEnv === "production" ? "warn" : "info");
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

const DRIVER_ERROR_KEYS = [
  "code",
  "severity",
  "detail",
  "hint",
  "position",
  "table",
  "column",
  "constraint",
  "schema",
  "dataType",
] as const;

function normalizeForJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    const record = value as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = { name: value.name, message: value.message };
    for (const key of DRIVER_ERROR_KEYS) {
      const val = record[key];
      if (typeof val === "string" && val.length > 0) {
        result[key] = val;
      }
    }
    // The cause chain (DrizzleQueryError's underlying pg DatabaseError, say) comes before the
    // stack: a log line is truncated from the end, and the stack must not push the root cause out.
    if (value.cause !== undefined) {
      result.cause = normalizeForJson(value.cause, seen);
    }
    result.stack = value.stack;
    return result;
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

function emitPrettyLog(level: LogLevel, event: string, context: LogContext = {}) {
  process.stdout.write(`${formatLogLine(level, event, context)}\n`);
}

/**
 * Build the process logger: pretty single-line output in development, JSON through pino in
 * production, filtered at the configured level. Effect code reaches it through the `AppLogger`
 * service in `./service`.
 */
export function createLogger(options: LoggerOptions): AppLogger {
  const minimum = LEVEL_ORDER[configuredLogLevel(options)];
  const base =
    options.nodeEnv === "production"
      ? pino({ level: configuredLogLevel(options), timestamp: pino.stdTimeFunctions.isoTime })
      : null;
  const emit = (level: LogLevel, event: string, context: LogContext = {}) => {
    if (LEVEL_ORDER[level] < minimum) {
      return;
    }
    if (base) {
      base[level]({ event, ...context });
    } else {
      emitPrettyLog(level, event, context);
    }
  };

  return {
    info: (event, context) => emit("info", event, context),
    warn: (event, context) => emit("warn", event, context),
    error: (event, context) => emit("error", event, context),
  };
}
