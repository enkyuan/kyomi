import { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import { RateLimiter, type RateLimitRule } from "./service";

export type { RateLimitRule } from "./service";

/**
 * Puts `enforceRateLimit(subject, rule)` on the Elysia context for routes that check a limit
 * before running their Effect. It runs the `RateLimiter` service on the app runtime and rejects
 * with the typed `RateLimited` error, which `registerErrorHandlers` renders as a 429.
 */
export function rateLimitPlugin(runtime: ManagedRuntime.ManagedRuntime<RateLimiter, unknown>) {
  return new Elysia({ name: "rate-limit.plugin" })
    .decorate("rateLimitEnabled", true)
    .decorate("enforceRateLimit", (subject: string, rule: RateLimitRule) =>
      runtime.runPromise(RateLimiter.use((limiter) => limiter.enforce(subject, rule))),
    );
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
