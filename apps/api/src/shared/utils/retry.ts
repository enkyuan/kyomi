function sleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 1,
  baseDelayMs = 100,
  maxDelayMs = 2_000,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const hasNextAttempt = i + 1 < attempts;
      if (!hasNextAttempt) {
        break;
      }

      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** i);
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponentialDelay * 0.2)));
      await sleep(exponentialDelay + jitter);
    }
  }
  throw lastError;
}
