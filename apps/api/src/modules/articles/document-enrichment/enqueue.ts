import { getRedis } from "@adapters/redis";
import { logger } from "@adapters/logger";
import { publishJob } from "@adapters/queue/publish";
import {
  SNAPSHOT_PROVIDERS,
  collectEmbedsToSnapshot,
  collectImagesToMeasure,
} from "@kyomi/worker/enrichment";
import type { DocumentTarget } from "@kyomi/worker";
import type Redis from "ioredis";

/**
 * Queues the post-persistence enrichment jobs for a stored KDM document. Storage calls this after
 * every successful document write. Only jobs with work to do are queued, and failures are logged,
 * never thrown: enrichment must not fail persistence. Jobs are idempotent, so calling this twice
 * for one document is harmless.
 */
export async function enqueueDocumentEnrichment(
  target: DocumentTarget,
  document: object,
  redis: Redis = getRedis(),
): Promise<void> {
  const jobs: ("document.image-measure" | "document.embed-snapshot")[] = [];
  if (collectImagesToMeasure(document).length > 0) jobs.push("document.image-measure");
  if (collectEmbedsToSnapshot(document, new Set(SNAPSHOT_PROVIDERS)).length > 0) {
    jobs.push("document.embed-snapshot");
  }

  await Promise.all(
    jobs.map(async (type) => {
      try {
        await publishJob(redis, { type, payload: { target } });
      } catch (error) {
        logger.warn("document_enrichment.enqueue_failed", {
          target,
          type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}
