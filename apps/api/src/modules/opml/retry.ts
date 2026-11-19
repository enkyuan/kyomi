import { Random } from "effect";
import { ERROR_CATALOGUE, type ApiError } from "@shared/effect/errors";

export type OpmlRetryDecision = {
  retryable: boolean;
  code: string;
  /** What is recorded on the item or task for the user to read. */
  message: string;
};

/** The code recorded for a failure that is not a typed public error (database, queue, unknown). */
export const OPML_FEED_IMPORT_FAILED = "OPML_FEED_IMPORT_FAILED";

const PERMANENT_CODES = new Set([
  "INVALID_FEED_URL",
  "FEED_URL_FORBIDDEN",
  "OPML_FEED_URL_INVALID",
  "FEED_PARSE_FAILED",
]);

/**
 * Whether importing an item again can succeed, decided from the typed error's code and status
 * (never its message): known-bad URLs and other client errors are permanent, timeouts, rate
 * limits and server errors retry, and infrastructure failures retry under a generic code.
 */
export function classifyOpmlItemError(error: ApiError): OpmlRetryDecision {
  const { status, code: defaultCode, expose } = ERROR_CATALOGUE[error._tag];
  const { message } = error;
  if (!expose) {
    return { retryable: true, code: OPML_FEED_IMPORT_FAILED, message };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : defaultCode;
  if (PERMANENT_CODES.has(code)) {
    return { retryable: false, code, message };
  }
  return { retryable: status === 429 || status >= 500, code, message };
}

/** Capped exponential backoff (5s doubling to a 900s ceiling) with jitter clamped to +/-20%. */
export function computeOpmlRetryDelayMs(attempt: number, jitter: number): number {
  const base = Math.min(900_000, 5_000 * 2 ** Math.max(0, attempt - 1));
  const boundedJitter = Math.min(0.2, Math.max(-0.2, jitter));
  return Math.round(base * (1 + boundedJitter));
}

/** A jitter in [-0.2, 0.2) from the `Random` service, so tests can seed it. */
export const opmlRetryJitter = Random.nextBetween(-0.2, 0.2);
