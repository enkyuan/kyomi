import type { db } from "@adapters/db/client";
import type { ReaderDocument } from "@kyomi/reader/document";
import {
  loadStoredDocument,
  patchStoredDocument,
  type DocumentPatchExpectation,
  type DocumentPatchTarget,
} from "./patch";

/**
 * Binds `db` to the storage functions in the shape of enrichment's `DocumentPatchStore` port
 * (`document-enrichment/store.ts`), which this satisfies structurally. `DocumentPatchTarget` is
 * structurally identical to enrichment's `DocumentTarget` from `@kyomi/worker`.
 */
export function createDocumentPatchStore(database: typeof db) {
  return {
    load: (target: DocumentPatchTarget) => loadStoredDocument(database, target),
    patch: async (
      target: DocumentPatchTarget,
      expected: DocumentPatchExpectation,
      fn: (document: object) => object,
    ): Promise<{ status: "patched" | "stale" | "missing" | "invalid" }> => {
      const result = await patchStoredDocument(
        database,
        target,
        expected,
        (document) => fn(document) as ReaderDocument,
      );
      return { status: result.status };
    },
  };
}
