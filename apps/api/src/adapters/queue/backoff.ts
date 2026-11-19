/** How long a failed job waits before its next attempt. */
export type RetryBackoff = {
  /** The longest the first retry can wait; each later retry can wait twice as long as the last. */
  readonly baseMs: number;
  /** The longest any retry can wait. */
  readonly maxMs: number;
};

export const DEFAULT_RETRY_BACKOFF: RetryBackoff = { baseMs: 5_000, maxMs: 300_000 };

/** Past this many retries the doubling would only overflow; the cap has long been reached. */
const MAX_DOUBLINGS = 30;

/**
 * The longest a retry can wait: `baseMs` for the first, doubling each time, never more than
 * `maxMs`. `retry` counts from 1 (the first retry after the first failure).
 */
export function retryCeilingMs(retry: number, backoff: RetryBackoff = DEFAULT_RETRY_BACKOFF) {
  const doublings = Math.min(Math.max(retry - 1, 0), MAX_DOUBLINGS);
  return Math.min(backoff.maxMs, backoff.baseMs * 2 ** doublings);
}

/**
 * Full jitter: a delay anywhere from none to `retryCeilingMs`, chosen by `fraction` in `[0, 1)`.
 * Spreading retries over the whole window, instead of adding a little noise to a fixed delay, is
 * what keeps jobs that failed together (one feed host down, one rate limit hit) from coming back
 * as one burst.
 */
export function retryDelayMs(
  retry: number,
  fraction: number,
  backoff: RetryBackoff = DEFAULT_RETRY_BACKOFF,
) {
  return Math.floor(retryCeilingMs(retry, backoff) * Math.min(Math.max(fraction, 0), 0.999_999));
}
