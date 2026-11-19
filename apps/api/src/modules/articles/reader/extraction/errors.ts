import { Data } from "effect";

/**
 * The source page could not be turned into an article (blocked URL, timeout, not HTML, no
 * readable body, ...). An expected outcome, not a defect: the workflow records it on the cache and
 * the article and answers `{ ok: false, errorCode, errorMessage }`, so it never reaches the wire as
 * an HTTP error. `errorCode` is the stable machine code stored with the failure.
 */
export class ExtractionFailed extends Data.TaggedError("ExtractionFailed")<{
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly cause?: unknown;
}> {
  override get message() {
    return this.errorMessage;
  }
}

export const blockedUrl = () =>
  new ExtractionFailed({
    errorCode: "BLOCKED_URL",
    errorMessage: "Invalid or unsafe URL provided.",
  });
