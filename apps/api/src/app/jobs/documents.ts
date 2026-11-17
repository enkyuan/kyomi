import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import type {
  DocumentEmbedSnapshotJob,
  DocumentImageMeasureJob,
  DocumentTarget,
} from "@kyomi/ingest";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import { enqueueEnrichmentForStoredDocument } from "@modules/articles/document/enrich";
import { makeDocumentPatchStore } from "@modules/articles/document/store";
import { DocumentPatchStore } from "@modules/articles/document-enrichment/store";
import { handleDocumentEnrichmentJob } from "@modules/articles/document-enrichment/jobs";
import { EnrichmentGates, makeEnrichmentGates } from "@modules/articles/document-enrichment/limits";

type DocumentServices = Db | AppLogger | JobQueue | HttpClient.HttpClient;

/**
 * The document-enrichment operations bound to the services in scope. The per-host gates are built
 * here once, so every job a worker runs shares them instead of each getting its own.
 */
export const makeDocumentJobs = Effect.gen(function* () {
  const services = yield* Effect.context<DocumentServices>();
  const store = yield* makeDocumentPatchStore;
  const gates = yield* makeEnrichmentGates;
  const provide = <A, E>(
    effect: Effect.Effect<A, E, DocumentServices | DocumentPatchStore | EnrichmentGates>,
  ) =>
    effect.pipe(
      Effect.provideService(DocumentPatchStore, store),
      Effect.provideService(EnrichmentGates, gates),
      Effect.provideContext(services),
    );

  return {
    /** Queue enrichment for a document that was just stored. Never fails. */
    enqueueForStoredDocument: (target: DocumentTarget) =>
      provide(enqueueEnrichmentForStoredDocument(target)),
    /** Run one enrichment job. */
    handle: (job: DocumentImageMeasureJob | DocumentEmbedSnapshotJob) =>
      provide(handleDocumentEnrichmentJob(job)),
  };
});
