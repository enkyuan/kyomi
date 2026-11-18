import { Clock, Effect } from "effect";
import type { DocumentEmbedSnapshotJob, DocumentImageMeasureJob } from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { runEmbedSnapshotJob } from "./embed-snapshot";
import { runImageMeasureJob } from "./image-measure";

/**
 * Runs one enrichment job. It needs `DocumentPatchStore`, `EnrichmentGates` and an `HttpClient`;
 * a runtime that lacks any of them does not type-check, so an unwired store cannot reach a worker.
 */
export const handleDocumentEnrichmentJob = Effect.fn("articles.documentEnrichment.job")(function* (
  job: DocumentImageMeasureJob | DocumentEmbedSnapshotJob,
) {
  const log = yield* AppLogger;
  const startedAt = yield* Clock.currentTimeMillis;
  const { target } = job.payload;
  const result =
    job.type === "document.image-measure"
      ? yield* runImageMeasureJob(target)
      : yield* runEmbedSnapshotJob(target);
  const finishedAt = yield* Clock.currentTimeMillis;
  yield* log.info("worker.job.document_enrichment.completed", {
    jobType: job.type,
    target,
    ...result,
    durationMs: finishedAt - startedAt,
  });
});
