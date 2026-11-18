import { Clock, Context, Duration, Effect, Layer, Schedule } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { Redis } from "@adapters/redis/service";
import { InternalError, RateLimited } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";

export type RateLimitRule = {
  name: string;
  max: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  ttlMs: number;
};

const RATE_LIMIT_KEY_PREFIX = "kyomi:rate-limit";
const MEMORY_PRUNE_INTERVAL = Duration.minutes(1);
const rateLimitEvalScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

export type RateLimiterShape = {
  /**
   * Count one hit for `subject` in the rule's window. Fails with `RateLimited` (429, with the
   * bucket and `retryAfterSeconds` in its details) once the window's `max` is exceeded.
   */
  readonly enforce: (
    subject: string,
    rule: RateLimitRule,
  ) => Effect.Effect<void, RateLimited | InternalError>;
};

/**
 * Fixed-window rate limiting. Counters live in Redis; when Redis fails the hit is counted in this
 * process instead (and logged), so a Redis outage degrades the limit rather than the endpoint.
 * The in-memory fallback and its pruning fiber belong to the layer's scope.
 */
export class RateLimiter extends Context.Service<RateLimiter, RateLimiterShape>()(
  "kyomi/RateLimiter",
) {
  static readonly layer = Layer.effect(
    RateLimiter,
    Effect.gen(function* () {
      const redis = yield* Redis;
      const log = yield* AppLogger;
      const memory = new Map<string, { count: number; resetAt: number }>();

      const consumeInMemory = (key: string, rule: RateLimitRule) =>
        Effect.map(Clock.currentTimeMillis, (now): RateLimitState => {
          const current = memory.get(key);
          if (!current || current.resetAt <= now) {
            memory.set(key, { count: 1, resetAt: now + rule.windowMs });
            return { count: 1, ttlMs: rule.windowMs };
          }
          current.count += 1;
          return { count: current.count, ttlMs: Math.max(0, current.resetAt - now) };
        });

      const consume = (key: string, rule: RateLimitRule) =>
        redis
          .use("rate-limit.eval", async (client) => {
            const [count, ttl] = (await client.eval(
              rateLimitEvalScript,
              1,
              key,
              String(rule.windowMs),
            )) as [number | string, number | string];
            return {
              count: Number(count) || 0,
              ttlMs: Math.max(0, Number(ttl) || 0),
            } satisfies RateLimitState;
          })
          .pipe(
            Effect.catchTag("RedisError", (error) =>
              log
                .warn("rate_limit.redis_fallback", {
                  bucket: rule.name,
                  error: serializeError(error.cause),
                })
                .pipe(Effect.andThen(consumeInMemory(key, rule))),
            ),
          );

      const enforce = Effect.fn("rateLimit.enforce")(function* (
        subject: string,
        rule: RateLimitRule,
      ) {
        const normalizedSubject = subject.trim();
        if (!normalizedSubject) {
          return yield* new InternalError({
            message: "Rate limit subject is required",
            code: "RATE_LIMIT_SUBJECT_MISSING",
          });
        }

        const state = yield* consume(
          `${RATE_LIMIT_KEY_PREFIX}:${rule.name}:${normalizedSubject}`,
          rule,
        );
        if (state.count > rule.max) {
          return yield* new RateLimited({
            message: "Too many requests",
            code: "RATE_LIMITED",
            details: {
              bucket: rule.name,
              retryAfterSeconds: Math.max(1, Math.ceil(state.ttlMs / 1000)),
            },
          });
        }
      });

      const prune = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        for (const [key, entry] of memory) {
          if (entry.resetAt <= now) {
            memory.delete(key);
          }
        }
      });
      yield* Effect.forkScoped(
        Effect.sleep(MEMORY_PRUNE_INTERVAL).pipe(
          Effect.andThen(prune),
          Effect.repeat(Schedule.forever),
        ),
      );

      return RateLimiter.of({ enforce });
    }),
  );
}
