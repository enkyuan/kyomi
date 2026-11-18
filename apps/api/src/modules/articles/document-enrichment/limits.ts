import { Context, Duration, Effect, Layer, Schedule, Semaphore } from "effect";

/** Caps concurrent work per key (a host) inside one process. */
export type KeyedGate = {
  readonly run: <A, E, R>(key: string, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
};

type GateEntry = { readonly semaphore: Semaphore.Semaphore; users: number };

/**
 * A gate with `limitPerKey` permits for each key. A key's semaphore exists only while someone is
 * running or waiting on it, so the map stays as small as the work in flight. Waiters are freed in
 * arrival order and an interrupted waiter leaves without taking a permit.
 */
export const makeKeyedGate = (limitPerKey: number): Effect.Effect<KeyedGate> =>
  Effect.sync(() => {
    const entries = new Map<string, GateEntry>();
    const enter = (key: string) =>
      Effect.sync(() => {
        const entry = entries.get(key) ?? {
          semaphore: Semaphore.makeUnsafe(limitPerKey),
          users: 0,
        };
        entry.users += 1;
        entries.set(key, entry);
        return entry;
      });
    const leave = (key: string, entry: GateEntry) =>
      Effect.sync(() => {
        entry.users -= 1;
        if (entry.users === 0) {
          entries.delete(key);
        }
      });
    return {
      run: (key, effect) =>
        Effect.acquireUseRelease(
          enter(key),
          (entry) => entry.semaphore.withPermit(effect),
          (entry) => leave(key, entry),
        ),
    };
  });

/** How many requests enrichment may have open against one host. */
const IMAGE_REQUESTS_PER_HOST = 2;
const EMBED_REQUESTS_PER_HOST = 1;

type EnrichmentGatesShape = { readonly images: KeyedGate; readonly embeds: KeyedGate };

/** The gates, built once per worker so every job it runs shares them. */
export const makeEnrichmentGates: Effect.Effect<EnrichmentGatesShape> = Effect.gen(function* () {
  return {
    images: yield* makeKeyedGate(IMAGE_REQUESTS_PER_HOST),
    embeds: yield* makeKeyedGate(EMBED_REQUESTS_PER_HOST),
  };
});

/** Per-host politeness for the enrichment jobs. */
export class EnrichmentGates extends Context.Service<EnrichmentGates, EnrichmentGatesShape>()(
  "kyomi/EnrichmentGates",
) {
  static readonly layer = Layer.effect(EnrichmentGates, makeEnrichmentGates);
}

export type RetryOptions = {
  /** Total tries, the first included. */
  attempts: number;
  baseDelayMs: number;
};

/** Retries failures marked `retryable` with exponential backoff; any other failure ends it. */
export const retryTransient =
  (options: RetryOptions) =>
  <A, E extends { readonly retryable: boolean }, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.retry(effect, {
      schedule: Schedule.exponential(Duration.millis(options.baseDelayMs)),
      times: options.attempts - 1,
      while: (error) => error.retryable,
    });
