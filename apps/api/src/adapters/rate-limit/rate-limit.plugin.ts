import { Elysia } from "elysia";
import { logger } from "@adapters/logger";
import { getRedis } from "@adapters/redis";
import { AppError } from "@shared/errors/app-error";

export type RateLimitRule = {
  name: string;
  max: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  ttlMs: number;
};

const RATE_LIMIT_KEY_PREFIX = "cronos:rate-limit";
const rateLimitEvalScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

const memoryRateLimitState = new Map<string, { count: number; resetAt: number }>();

const MEMORY_PRUNE_INTERVAL_MS = 60_000;
let memoryPruneTimer: ReturnType<typeof setInterval> | null = null;

function ensureMemoryPruneTimer(): void {
  if (memoryPruneTimer !== null) {
    return;
  }
  memoryPruneTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryRateLimitState) {
      if (entry.resetAt <= now) {
        memoryRateLimitState.delete(key);
      }
    }
  }, MEMORY_PRUNE_INTERVAL_MS);
  // Allow the process to exit even if the timer is still running
  memoryPruneTimer.unref?.();
}

function consumeInMemoryRateLimit(key: string, rule: RateLimitRule): RateLimitState {
  ensureMemoryPruneTimer();
  const now = Date.now();
  const current = memoryRateLimitState.get(key);
  if (!current || current.resetAt <= now) {
    memoryRateLimitState.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { count: 1, ttlMs: rule.windowMs };
  }

  current.count += 1;
  return { count: current.count, ttlMs: Math.max(0, current.resetAt - now) };
}

async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitState> {
  try {
    const redis = getRedis();
    const result = (await redis.eval(rateLimitEvalScript, 1, key, String(rule.windowMs))) as [
      number | string,
      number | string,
    ];
    return {
      count: Number(result[0]) || 0,
      ttlMs: Math.max(0, Number(result[1]) || 0),
    };
  } catch (error) {
    logger.warn("rate_limit.redis_fallback", {
      bucket: rule.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return consumeInMemoryRateLimit(key, rule);
  }
}

async function enforceRateLimit(subject: string, rule: RateLimitRule): Promise<void> {
  const normalizedSubject = subject.trim();
  if (!normalizedSubject) {
    throw new AppError("Rate limit subject is required", {
      status: 500,
      code: "RATE_LIMIT_SUBJECT_MISSING",
    });
  }

  const key = `${RATE_LIMIT_KEY_PREFIX}:${rule.name}:${normalizedSubject}`;
  const state = await consumeRateLimit(key, rule);
  if (state.count <= rule.max) {
    return;
  }

  throw new AppError("Too many requests", {
    status: 429,
    code: "RATE_LIMITED",
    details: {
      bucket: rule.name,
      retryAfterSeconds: Math.max(1, Math.ceil(state.ttlMs / 1000)),
    },
  });
}

export async function enforceRateLimitForContext(
  context: unknown,
  subject: string,
  rule: RateLimitRule,
): Promise<void> {
  const handler = (context as { enforceRateLimit?: unknown }).enforceRateLimit;
  if (typeof handler !== "function") {
    throw new Error("rateLimitPlugin must be registered before using rate limits");
  }
  await handler(subject, rule);
}

export const rateLimitPlugin = new Elysia({
  name: "rate-limit.plugin",
})
  .decorate("rateLimitEnabled", true)
  .decorate("enforceRateLimit", enforceRateLimit);
