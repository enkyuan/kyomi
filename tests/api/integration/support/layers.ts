import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { Db, dbShape, type Database, type DbShape } from "@adapters/db/service";
import type { LogContext } from "@adapters/logger/pino";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { Redis, makeRedis, type RedisClient } from "@adapters/redis/service";
import { AppConfig } from "@config/env/service";

/**
 * Test Layers for the Effect services. Swap these in with `Effect.provide` or `ManagedRuntime.make`
 * instead of `mock.module` or patching `globalThis.fetch`. Time comes from `TestClock.layer()` in
 * `effect/testing`.
 */

const BASE_ENV: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/kyomi_test",
  REDIS_URL: "redis://127.0.0.1:6379",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret",
};

/** A validated config from fixed values, independent of the process environment. */
export const testConfig = (overrides: Record<string, string> = {}) =>
  AppConfig.layerFrom({ ...BASE_ENV, ...overrides });

export type LogEntry = {
  readonly level: "info" | "warn" | "error";
  readonly event: string;
  readonly context: LogContext;
};

/** An `AppLogger` that records every entry instead of writing it. */
export function recordingLogger() {
  const entries: LogEntry[] = [];
  const record =
    (level: LogEntry["level"]) =>
    (event: string, context: LogContext = {}) => {
      entries.push({ level, event, context });
    };
  const layer = AppLogger.layerFromSink({
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
  });
  return { entries, layer };
}

/** A silent logger for tests that do not assert on logs. */
export const silentLogger = recordingLogger().layer;

/**
 * A fake Drizzle client. Provide only the methods the code under test calls; any other access
 * throws so a missing stub is loud.
 */
export function fakeDb(methods: Partial<Record<keyof Database, unknown>> = {}) {
  const client = new Proxy(methods, {
    get(target, property) {
      if (property in target) {
        return Reflect.get(target, property);
      }
      throw new Error(`fakeDb: unexpected call to ${String(property)}`);
    },
  }) as unknown as Database;
  return Layer.succeed(Db, Db.of(dbShape(client, {} as DbShape["pool"])));
}

/** The real database through the production `Db` layer; needs `DATABASE_URL` to be reachable. */
export const realDb = (overrides: Record<string, string> = {}) =>
  Db.layer.pipe(Layer.provide(testConfig(overrides)), Layer.provide(silentLogger));

/**
 * A fake Redis client. Provide only the commands the code under test calls (`xlen`, `xpending`);
 * any other command throws.
 */
export function fakeRedis(commands: Partial<Record<keyof RedisClient, unknown>> = {}) {
  const client = new Proxy(commands, {
    get(target, property) {
      if (property in target) {
        return Reflect.get(target, property);
      }
      throw new Error(`fakeRedis: unexpected command ${String(property)}`);
    },
  }) as unknown as RedisClient;
  return Layer.succeed(Redis, Redis.of(makeRedis(client)));
}

/**
 * `Redis` and the real `JobQueue` over the same fake client: publishing runs `xadd` (and whatever
 * else the code under test calls) against `commands`.
 */
export function fakeQueue(commands: Partial<Record<keyof RedisClient, unknown>> = {}) {
  const redis = fakeRedis(commands);
  return Layer.mergeAll(
    redis,
    JobQueue.layer.pipe(Layer.provide(Layer.mergeAll(redis, testConfig()))),
  );
}

/** An error shaped like an ioredis `ReplyError` (`name`, and the reply code leading the message). */
export function replyError(message: string): Error {
  const error = new Error(message);
  error.name = "ReplyError";
  return error;
}

/** An `HttpClient` that answers every request from `respond`; no network. */
export const fakeHttpClient = (
  respond: (request: {
    readonly method: string;
    readonly url: string;
  }) => Response | Promise<Response>,
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.promise(async () =>
        HttpClientResponse.fromWeb(
          request,
          await respond({ method: request.method, url: request.url }),
        ),
      ),
    ),
  );
