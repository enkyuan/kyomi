import { Data } from "effect";
import type { FeedRefreshFailureClass, FeedRefreshResult } from "@kyomi/ingest";
import {
  ERROR_CATALOGUE,
  InternalError,
  fromAppError,
  isApiError,
  type ApiError,
} from "@shared/effect/errors";
import { AppError } from "@shared/errors/app";

/** A feed refresh that finished without a usable feed and is worth another attempt. */
export class FeedRefreshFailed extends Data.TaggedError("FeedRefreshFailed")<{
  readonly message: string;
  readonly feedId: string;
  readonly failureClass?: FeedRefreshFailureClass;
}> {}

/** Everything a job handler can fail with. Anything else is mapped to one of these first. */
export type JobFailure = ApiError | FeedRefreshFailed;

export type JobFailureClass = {
  /** `expected` failures are about the job's input (log at warn); `platform` ones are ours (error). */
  severity: "expected" | "platform";
  code: string;
  /** Whether running the job again can succeed. Permanent failures are acknowledged, not retried. */
  retryable: boolean;
};

/**
 * Map what a legacy Promise operation threw to a typed job failure, by class and never by message:
 * `AppError` keeps its status and code, typed errors pass through, and anything else is an
 * `InternalError` that keeps the original cause.
 */
export function toJobFailure(cause: unknown): JobFailure {
  if (cause instanceof AppError) {
    return fromAppError(cause);
  }
  if (isApiError(cause) || cause instanceof FeedRefreshFailed) {
    return cause;
  }
  return new InternalError({
    message: cause instanceof Error ? cause.message : "Job failed",
    cause,
  });
}

/**
 * A request that cannot succeed unchanged (4xx other than 408 and 429) is permanent; server and
 * infrastructure failures are retryable. The same rule `classifyOpmlItemError` applies to AppError.
 */
function retryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export function classifyJobFailure(error: JobFailure): JobFailureClass {
  if (error._tag === "FeedRefreshFailed") {
    return error.failureClass === undefined
      ? { severity: "platform", code: "unknown", retryable: true }
      : { severity: "expected", code: error.failureClass, retryable: true };
  }
  const { status, code: defaultCode, expose } = ERROR_CATALOGUE[error._tag];
  const code =
    expose && "code" in error && typeof error.code === "string" ? error.code : defaultCode;
  const retryable = retryableStatus(status);
  return { severity: retryable ? "platform" : "expected", code, retryable };
}

/**
 * A feed refresh result that will fail again unchanged (HTTP 4xx other than 408/429, certificate
 * errors, HTML where a feed should be). The refresh service has already recorded the outcome on
 * the feed row, so the scheduler's backoff owns the next attempt and the job is acknowledged.
 */
export function isNonRetryableFeedRefreshFailure(result: FeedRefreshResult): boolean {
  return !result.ok && Boolean(result.permanent);
}
