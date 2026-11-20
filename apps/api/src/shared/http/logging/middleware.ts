import { Elysia } from "elysia";
import logixlysia, { type LogLevel as LogixlysiaLevel } from "logixlysia";
import { SERVICE_NAME } from "@config/constants";
import type { Env } from "@config/env";

type LogixlysiaContext = {
  request: Request;
  requestId?: unknown;
  store?: {
    logger?: {
      mergeContext?: (key: Request | object, partial: Record<string, unknown>) => void;
    };
  };
};

/** The slice of the validated environment request logging reads. */
export type LoggingConfig = Pick<Env, "NODE_ENV" | "LOG_LEVEL">;

function getPinoLevel(env: LoggingConfig) {
  return env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "warn" : "info");
}

function getRequestLogFilter(env: LoggingConfig): { level: LogixlysiaLevel[] } | undefined {
  if (env.LOG_LEVEL === "error") {
    return { level: ["ERROR"] };
  }
  if (env.LOG_LEVEL === "warn") {
    return { level: ["WARNING", "ERROR"] };
  }
  return undefined;
}

function mergeRequestIdIntoLogixlysiaContext(context: LogixlysiaContext) {
  if (typeof context.requestId !== "string") {
    return;
  }
  context.store?.logger?.mergeContext?.(context.request, {
    requestId: context.requestId,
  });
}

/**
 * Human-readable request logging through Logixlysia, configured from the validated environment.
 * Domain events are logged by Effect code through the `AppLogger` service, not from the context.
 */
export const loggingMiddleware = (env: LoggingConfig) =>
  new Elysia({
    name: "logging",
  })
    .use(
      logixlysia({
        preset: env.NODE_ENV === "production" ? "prod" : "dev",
        config: {
          autoRedact: true,
          contextDepth: 2,
          customLogFormat:
            "{now} {service}{level} {method} {pathname} {status} {duration} {message}{speed}",
          logFilter: getRequestLogFilter(env),
          pino: {
            base: {
              environment: env.NODE_ENV,
              service: SERVICE_NAME,
            },
            level: getPinoLevel(env),
            redact: {
              censor: "[redacted]",
              paths: ["authorization", "cookie", "password", "set-cookie", "token"],
            },
          },
          service: "kyomi-api",
          showContextTree: true,
          showStartupMessage: false,
          slowThreshold: 500,
          timestamp: {
            translateTime: "yyyy-mm-dd HH:MM:ss.SSS",
          },
          useColors: env.NODE_ENV !== "production",
          verySlowThreshold: 1000,
        },
      }),
    )
    .derive((context) => {
      mergeRequestIdIntoLogixlysiaContext(context as LogixlysiaContext);
      return {};
    });
