import { Data } from "effect";
import { DatabaseError, UpstreamError } from "@shared/effect/errors";

/**
 * Operator-script failures. These never reach HTTP, so they sit beside the module instead of in
 * the API error catalogue; infrastructure failures reuse `DatabaseError` and `UpstreamError`.
 */

/** A command-line flag has a malformed value or an invalid combination. */
export class InvalidArguments extends Data.TaggedError("InvalidArguments")<{
  readonly message: string;
}> {}

/** An embeddings classifier was requested but the Cloudflare Worker values are not set. */
export class EmbeddingsNotConfigured extends Data.TaggedError("EmbeddingsNotConfigured")<{
  readonly message: string;
}> {}

/**
 * Some of a feed's items could not be embedded. The feed is recorded as failed (so
 * `--retry-failed` picks it up) instead of writing the missing items as abstentions.
 */
export class EmbeddingsIncomplete extends Data.TaggedError("EmbeddingsIncomplete")<{
  readonly failed: number;
  readonly total: number;
}> {
  override get message() {
    return `Embedding classification failed for ${this.failed} of ${this.total} items`;
  }
}

/** A file the operator script reads or writes could not be accessed. */
export class CatalogFileError extends Data.TaggedError("CatalogFileError")<{
  readonly path: string;
  readonly cause: unknown;
}> {
  override get message() {
    return `Cannot access ${this.path}: ${errorText(this.cause)}`;
  }
}

/** The labeled training articles are not (all) in this database, or failed to embed. */
export class TrainingDataIncomplete extends Data.TaggedError("TrainingDataIncomplete")<{
  readonly message: string;
}> {}

/** The category-model trainer rejected its input (no examples, an unknown label). */
export class TrainingFailed extends Data.TaggedError("TrainingFailed")<{
  readonly cause: unknown;
}> {
  override get message() {
    return errorText(this.cause);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The text recorded for a failed feed (`feed_category_backfill_status.last_error`). Infrastructure
 * errors carry the driver or HTTP error as `cause`; that message is what operators need to see.
 */
export function failureMessage(error: unknown): string {
  if (error instanceof DatabaseError || error instanceof UpstreamError) {
    return errorText(error.cause);
  }
  return errorText(error);
}
