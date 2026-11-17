import { Cause, Context, Effect, Layer, Logger, Option } from "effect";
import { RequestContext } from "@shared/effect/request";
import { AppConfig } from "@config/env/service";
import { createLogger, type AppLogger as LogSink, type LogContext } from "./pino";
import { redactForLog } from "./redact";

/**
 * Event-named structured logging for Effect code: `log.warn("health.ready.failed", { error })`.
 * Same event-name contract, output formats and level filtering as the legacy `logger`, with
 * sensitive context keys redacted. (`LogSink` is the legacy synchronous `AppLogger` type.)
 */
export type AppLoggerShape = {
  readonly info: (event: string, context?: LogContext) => Effect.Effect<void>;
  readonly warn: (event: string, context?: LogContext) => Effect.Effect<void>;
  readonly error: (event: string, context?: LogContext) => Effect.Effect<void>;
};

export function fromSink(sink: LogSink): AppLoggerShape {
  const emit =
    (level: "info" | "warn" | "error") =>
    (event: string, context: LogContext = {}) =>
      Effect.serviceOption(RequestContext).pipe(
        Effect.map((request) =>
          sink[level](
            event,
            redactForLog(
              Option.isSome(request) ? { requestId: request.value.requestId, ...context } : context,
            ),
          ),
        ),
      );
  return { info: emit("info"), warn: emit("warn"), error: emit("error") };
}

const LEVEL_BY_EFFECT_LEVEL = {
  Fatal: "error",
  Error: "error",
  Warn: "warn",
  Info: "info",
  Debug: undefined,
  Trace: undefined,
  All: undefined,
  None: undefined,
} as const;

/** Route `Effect.log*` calls (and unhandled fiber failures) into the same sink. */
export function effectLogger(sink: LogSink) {
  return Logger.make(({ logLevel, message, cause }) => {
    const level = LEVEL_BY_EFFECT_LEVEL[logLevel];
    if (!level) {
      return;
    }
    const parts = Array.isArray(message) ? message : [message];
    const event = typeof parts[0] === "string" ? parts[0] : "effect.log";
    sink[level](event, {
      detail: parts.slice(1),
      cause: cause.reasons.length > 0 ? Cause.pretty(cause) : undefined,
    });
  });
}

export class AppLogger extends Context.Service<AppLogger, AppLoggerShape>()("kyomi/AppLogger") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      return AppLogger.layerFromSink(
        createLogger({ nodeEnv: config.NODE_ENV, logLevel: config.LOG_LEVEL }),
      );
    }),
  );

  /** Wrap any sink (tests pass a recording one). */
  static layerFromSink = (sink: LogSink) =>
    Layer.merge(
      Layer.succeed(AppLogger, AppLogger.of(fromSink(sink))),
      Logger.layer([effectLogger(sink)]),
    );
}
