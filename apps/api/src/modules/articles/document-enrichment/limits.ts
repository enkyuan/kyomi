/** Runs `fn` over `items` with at most `limit` in flight. Results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Caps concurrent work per key (host) inside one process. */
export function createKeyedGate(limitPerKey: number) {
  const active = new Map<string, number>();
  const waiters = new Map<string, (() => void)[]>();

  async function acquire(key: string) {
    while ((active.get(key) ?? 0) >= limitPerKey) {
      await new Promise<void>((resolve) => {
        const queue = waiters.get(key) ?? [];
        queue.push(resolve);
        waiters.set(key, queue);
      });
    }
    active.set(key, (active.get(key) ?? 0) + 1);
  }

  function release(key: string) {
    const count = (active.get(key) ?? 1) - 1;
    if (count <= 0) active.delete(key);
    else active.set(key, count);
    waiters.get(key)?.shift()?.();
  }

  return {
    async run<T>(key: string, task: () => Promise<T>): Promise<T> {
      await acquire(key);
      try {
        return await task();
      } finally {
        release(key);
      }
    },
  };
}

export type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
};

/** Retries retryable failures with exponential backoff; stops at the first success or hard failure. */
export async function retryFetch<T extends { ok: boolean; retryable?: boolean }>(
  task: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let result = await task();
  for (let attempt = 1; attempt < options.attempts; attempt += 1) {
    if (result.ok || !result.retryable) return result;
    await sleep(options.baseDelayMs * 2 ** (attempt - 1));
    result = await task();
  }
  return result;
}
