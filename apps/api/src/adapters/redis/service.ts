import IORedis from "ioredis";
import { Context, Effect, Layer } from "effect";
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
          const created = new IORedis(config.REDIS_URL, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
          });
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
