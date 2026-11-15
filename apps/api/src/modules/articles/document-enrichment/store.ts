import type { DocumentTarget } from "@kyomi/worker";

export type StoredDocumentState = {
  document: object;
  documentVersion: number;
  compilerVersion: string;
};

export type DocumentPatchExpectation = { documentVersion: number; compilerVersion: string };

/**
 * Port the enrichment jobs use to read and patch a stored KDM document. The storage module
 * implements it with `loadStoredDocument` / `patchStoredDocument`, injecting `db`.
 *
 * `patch` runs `fn` inside the storage transaction against the current document, re-validates,
 * and refuses any change other than image width/height/placeholder and embed.snapshot. `stale`
 * means the document was recompiled since `load`; the job is dropped, not retried, because the
 * compiler's enqueue will queue fresh jobs for the new document.
 */
export type DocumentPatchStore = {
  load(target: DocumentTarget): Promise<StoredDocumentState | null>;
  patch(
    target: DocumentTarget,
    expected: DocumentPatchExpectation,
    fn: (document: object) => object,
  ): Promise<{ status: "patched" | "stale" | "missing" | "invalid" }>;
};
