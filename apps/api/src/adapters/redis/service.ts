import IORedis, { type RedisOptions } from "ioredis";
import { Context, Effect, Layer } from "effect";
import type { Env } from "@config/env/runtime";
import { AppConfig } from "@config/env/service";
import { AppLogger } from "@adapters/logger/service";
import { RedisError } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";

export type RedisClient = IORedis;

export type RedisShape = {
  readonly client: RedisClient;
  /** Run a Promise-based ioredis call, mapping any throw to `RedisError`. */
  readonly use: <A>(
    operation: string,
    run: (client: RedisClient) => Promise<A>,
  ) => Effect.Effect<A, RedisError>;
};

/** The error-reply code (`NOGROUP`, `WRONGTYPE`) of an ioredis `ReplyError`, when there is one. */
export function redisReplyCode(cause: unknown): string | undefined {
  if (cause instanceof Error && cause.name === "ReplyError") {
    return cause.message.split(" ", 1)[0] || undefined;
  }
  return undefined;
}

/** What a client needs from the environment. */
type RedisSettings = Pick<
  Env,
  "REDIS_URL" | "REDIS_CONNECT_TIMEOUT_MS" | "REDIS_COMMAND_TIMEOUT_MS"
>;

/**
 * The client options. A connection that cannot be made within `connectTimeout`, and a command with
 * no reply within `commandTimeout`, fail instead of waiting forever. A command timeout of 0 is left
 * unset (no limit). Clients duplicated from this one (the blocking reads) inherit both.
 */
export function redisClientOptions(config: RedisSettings): RedisOptions {
  return {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: config.REDIS_CONNECT_TIMEOUT_MS,
    commandTimeout: config.REDIS_COMMAND_TIMEOUT_MS || undefined,
  };
}

export function makeRedis(client: RedisClient): RedisShape {
  return {
    client,
    use: (operation, run) =>
      Effect.tryPromise({
        try: () => run(client),
        catch: (cause) => new RedisError({ operation, cause, code: redisReplyCode(cause) }),
      }),
  };
}

/** Redis through ioredis. The connection is owned by the layer's scope and closed on release. */
export class Redis extends Context.Service<Redis, RedisShape>()("kyomi/Redis") {
  static readonly layer = Layer.effect(
    Redis,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const log = yield* AppLogger;
      const client = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const created = new IORedis(config.REDIS_URL, redisClientOptions(config));
          created.on("error", (error) => {
            Effect.runSync(log.error("redis.client.error", { error: error.message }));
          });
          return created;
        }),
        (created) =>
          Effect.tryPromise({ try: () => created.quit(), catch: (cause) => cause }).pipe(
            Effect.catch((error) =>
              log
                .warn("lifecycle.redis.quit.failed", { error: serializeError(error) })
                .pipe(Effect.andThen(Effect.sync(() => created.disconnect()))),
            ),
          ),
      );
      return Redis.of(makeRedis(client));
    }),
  );
}
