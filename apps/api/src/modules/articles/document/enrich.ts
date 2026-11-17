import { Effect } from "effect";
import type { DocumentTarget } from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { enqueueDocumentEnrichment } from "@modules/articles/document-enrichment/enqueue";
import { serializeError } from "@shared/errors/serialize";
import { loadStoredDocument } from "./patch";

/**
 * Queues enrichment for a document that was just persisted. Loads the stored document unless the
 * caller already holds it. Never fails: enrichment must not fail the write that triggered it, so
 * a read or publish failure is logged and the document simply stays un-enriched.
 */
export const enqueueEnrichmentForStoredDocument = Effect.fn("articles.document.enrich")(function* (
  target: DocumentTarget,
  document?: object,
) {
  const log = yield* AppLogger;
  yield* Effect.gen(function* () {
    const stored = document ?? (yield* loadStoredDocument(target))?.document;
    if (stored) {
      yield* enqueueDocumentEnrichment(target, stored);
    }
  }).pipe(
    Effect.catchTag("DatabaseError", (error) =>
      log.warn("document_enrichment.enqueue_failed", { target, error: serializeError(error) }),
    ),
  );
});
