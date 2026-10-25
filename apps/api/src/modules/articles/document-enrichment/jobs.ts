import { logger } from "@adapters/logger";
import type { DocumentEmbedSnapshotJob, DocumentImageMeasureJob } from "@kyomi/worker";
import { runEmbedSnapshotJob } from "./embed-snapshot";
import { runImageMeasureJob } from "./image-measure";
import type { DocumentPatchStore } from "./store";

/**
 * Placeholder until the storage module provides the version-checked patch function. Queued jobs
 * fail loudly (and dead-letter) rather than silently dropping enrichment.
 */
export const unwiredDocumentPatchStore: DocumentPatchStore = {
  async load() {
    throw new Error("Document patch store is not wired");
  },
  async patch() {
    throw new Error("Document patch store is not wired");
  },
};

export async function handleDocumentEnrichmentJob(
  job: DocumentImageMeasureJob | DocumentEmbedSnapshotJob,
  store: DocumentPatchStore = unwiredDocumentPatchStore,
): Promise<void> {
  const startTime = Date.now();
  const { target } = job.payload;
  const result =
    job.type === "document.image-measure"
      ? await runImageMeasureJob(target, { store })
      : await runEmbedSnapshotJob(target, { store });
  logger.info("worker.job.document_enrichment.completed", {
    jobType: job.type,
    target,
    ...result,
    durationMs: Date.now() - startTime,
  });
}
