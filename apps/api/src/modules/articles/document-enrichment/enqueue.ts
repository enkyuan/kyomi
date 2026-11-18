import { Effect } from "effect";
import {
  SNAPSHOT_PROVIDERS,
  collectEmbedsToSnapshot,
  collectImagesToMeasure,
} from "@kyomi/ingest/enrichment";
import type { DocumentTarget } from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { serializeError } from "@shared/errors/serialize";

type EnrichmentJobType = "document.image-measure" | "document.embed-snapshot";

/** The enrichment jobs a document has work for. */
function jobsFor(document: object): EnrichmentJobType[] {
  const jobs: EnrichmentJobType[] = [];
  if (collectImagesToMeasure(document).length > 0) jobs.push("document.image-measure");
  if (collectEmbedsToSnapshot(document, new Set(SNAPSHOT_PROVIDERS)).length > 0) {
    jobs.push("document.embed-snapshot");
  }
  return jobs;
}

/** At most one job per type, so this bounds the publishes in flight. */
const PUBLISH_CONCURRENCY = 2;

/**
 * Queues the post-persistence enrichment jobs for a stored KDM document. Storage calls this after
 * every successful document write. Only jobs with work to do are queued, and failures are logged,
 * never raised: enrichment must not fail persistence. Jobs are idempotent, so calling this twice
 * for one document is harmless.
 */
export const enqueueDocumentEnrichment = Effect.fn("articles.documentEnrichment.enqueue")(
  function* (target: DocumentTarget, document: object) {
    const log = yield* AppLogger;
    const queue = yield* JobQueue;
    const jobs = yield* Effect.try({
      try: () => jobsFor(document),
      catch: (error) => error,
    }).pipe(
      Effect.catch((error) =>
        log
          .warn("document_enrichment.enqueue_failed", { target, error: serializeError(error) })
          .pipe(Effect.as([] as EnrichmentJobType[])),
      ),
    );

    yield* Effect.forEach(
      jobs,
      (type) =>
        queue.publish({ type, payload: { target } }).pipe(
          Effect.catchTag("RedisError", (error) =>
            log.warn("document_enrichment.enqueue_failed", {
              target,
              type,
              error: serializeError(error),
            }),
          ),
        ),
      { concurrency: PUBLISH_CONCURRENCY, discard: true },
    );
  },
);
