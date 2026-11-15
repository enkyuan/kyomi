import type { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { enqueueDocumentEnrichment } from "@modules/articles/document-enrichment/enqueue";
import type { DocumentTarget } from "@kyomi/worker";
import { loadStoredDocument } from "./patch";

type DB = typeof db;

/**
 * Queues enrichment for a document that was just persisted. Loads the stored document unless the
 * caller already holds it. Never throws: enrichment must not fail the write that triggered it.
 */
export async function enqueueEnrichmentForStoredDocument(
  database: DB,
  target: DocumentTarget,
  document?: object,
): Promise<void> {
  try {
    const stored = document ?? (await loadStoredDocument(database, target))?.document;
    if (stored) {
      await enqueueDocumentEnrichment(target, stored);
    }
  } catch (error) {
    logger.warn("document_enrichment.enqueue_failed", {
      target,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
