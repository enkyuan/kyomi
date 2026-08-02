import { AppError } from "@shared/errors/app";

export type OpmlRetryDecision = {
  retryable: boolean;
  code: string;
};

const PERMANENT_CODES = new Set([
  "INVALID_FEED_URL",
  "FEED_URL_FORBIDDEN",
  "OPML_FEED_URL_INVALID",
  "FEED_PARSE_FAILED",
]);

export function classifyOpmlItemError(error: unknown): OpmlRetryDecision {
  if (error instanceof AppError) {
    if (PERMANENT_CODES.has(error.code)) {
      return { retryable: false, code: error.code };
    }
    if (error.status === 408 || error.status === 429 || error.status >= 500) {
      return { retryable: true, code: error.code };
    }
    if (error.status >= 400 && error.status < 500) {
      return { retryable: false, code: error.code };
    }
  }
  return { retryable: true, code: "OPML_FEED_IMPORT_FAILED" };
}

/** Capped exponential backoff (5s doubling to a 900s ceiling) with jitter clamped to +/-20%. */
export function computeOpmlRetryDelayMs(attempt: number, jitter: number): number {
  const base = Math.min(900_000, 5_000 * 2 ** Math.max(0, attempt - 1));
  const boundedJitter = Math.min(0.2, Math.max(-0.2, jitter));
  return Math.round(base * (1 + boundedJitter));
}

/** Maps crypto.getRandomValues to a value in [-0.2, 0.2] for production retry jitter. */
export function randomOpmlRetryJitter(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const unit = buffer[0]! / 0xffffffff;
  return unit * 0.4 - 0.2;
}
