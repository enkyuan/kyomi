import { Effect, Layer } from "effect";
import type { ReaderDocument } from "@kyomi/reader/document";
import { Db } from "@adapters/db/service";
import { DocumentPatchStore } from "@modules/articles/document-enrichment/store";
import { loadStoredDocument, patchStoredDocument } from "./patch";

/**
 * Binds `Db` to the storage functions in the shape of enrichment's `DocumentPatchStore` port
 * (`document-enrichment/store.ts`). `DocumentTarget` is the one type from `@kyomi/ingest` both
 * sides share.
 */
export const makeDocumentPatchStore = Effect.gen(function* () {
  const db = yield* Db;
  return DocumentPatchStore.of({
    load: (target) => loadStoredDocument(target).pipe(Effect.provideService(Db, db)),
    patch: (target, expected, fn) =>
      patchStoredDocument(target, expected, (document) => fn(document) as ReaderDocument).pipe(
        Effect.provideService(Db, db),
        Effect.map((result) => ({ status: result.status })),
      ),
  });
});

export const DocumentPatchStoreLive = Layer.effect(DocumentPatchStore, makeDocumentPatchStore);
