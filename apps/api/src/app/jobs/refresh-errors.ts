import type { FeedRefreshResult } from "@kyomi/worker";

export type FeedRefreshErrorSeverity = "feed" | "platform";

export type FeedRefreshErrorClass = {
  severity: FeedRefreshErrorSeverity;
  code:
    | "http_404"
    | "http_4xx"
    | "http_5xx"
    | "certificate"
    | "parser_limit"
    | "network"
    | "unknown";
  retryable: boolean;
};

// Non-retryable failures are ones where re-running the job would deterministically fail again
// (permanent HTTP 4xx, feed row deleted, etc.). The refresh service persists the outcome to the
// feeds row before returning, so acking here is safe — the scheduler backoff owns the next attempt.
export function isNonRetryableFeedRefreshFailure(result: FeedRefreshResult): boolean {
  if (result.ok) {
    return false;
  }
  return Boolean(result.permanent);
}

export function classifyFeedRefreshError(error: unknown): FeedRefreshErrorClass {
  const message = error instanceof Error ? error.message : String(error);

  if (/HTTP 404/.test(message)) {
    return { severity: "feed", code: "http_404", retryable: false };
  }

  if (/HTTP 4\d\d/.test(message)) {
    return { severity: "feed", code: "http_4xx", retryable: false };
  }

  if (/HTTP 5\d\d/.test(message)) {
    return { severity: "feed", code: "http_5xx", retryable: true };
  }

  if (/certificate|UNABLE_TO_GET_ISSUER_CERT/i.test(message)) {
    return { severity: "feed", code: "certificate", retryable: false };
  }

  if (/Entity expansion limit exceeded/i.test(message)) {
    return { severity: "feed", code: "parser_limit", retryable: false };
  }

  if (/Unable to connect|fetch failed|network/i.test(message)) {
    return { severity: "feed", code: "network", retryable: true };
  }

  return { severity: "platform", code: "unknown", retryable: true };
}
