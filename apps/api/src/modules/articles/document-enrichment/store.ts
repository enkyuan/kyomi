import { Context, type Effect } from "effect";
import type { DocumentTarget } from "@kyomi/ingest";
import type { DatabaseError } from "@shared/effect/errors";

export type StoredDocumentState = {
  document: object;
  documentVersion: number;
  compilerVersion: string;
};

export type DocumentPatchExpectation = { documentVersion: number; compilerVersion: string };

export type DocumentPatchStoreShape = {
  readonly load: (
    target: DocumentTarget,
  ) => Effect.Effect<StoredDocumentState | null, DatabaseError>;
  readonly patch: (
    target: DocumentTarget,
    expected: DocumentPatchExpectation,
    fn: (document: object) => object,
  ) => Effect.Effect<{ status: "patched" | "stale" | "missing" | "invalid" }, DatabaseError>;
};

/**
 * Port the enrichment jobs use to read and patch a stored KDM document. The storage module
 * provides it over `Db` (`document/store.ts`); jobs that need it do not type-check without a Layer
 * for it, so a missing wiring is a compile error instead of a runtime failure.
 *
 * `patch` runs `fn` inside the storage transaction against the current document, re-validates,
 * and refuses any change other than image width/height/placeholder and embed.snapshot. `stale`
 * means the document was recompiled since `load`; the job is dropped, not retried, because the
 * compiler's enqueue will queue fresh jobs for the new document.
 */
export class DocumentPatchStore extends Context.Service<
  DocumentPatchStore,
  DocumentPatchStoreShape
>()("kyomi/DocumentPatchStore") {}
