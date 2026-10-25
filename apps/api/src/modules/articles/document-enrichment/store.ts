/**
 * The slice of document storage the enrichment jobs need. The storage module implements it on top
 * of its version-checked patch function; jobs never touch the database directly.
 *
 * `save` must reject (return false) when the stored version differs from `expectedVersion`, and
 * must validate the document against `readerDocumentSchema` before writing.
 */
export type StoredDocument<TDocument extends object = object> = {
  document: TDocument;
  version: number;
};

export type DocumentPatchStore = {
  load(articleId: string): Promise<StoredDocument | null>;
  save(articleId: string, document: object, expectedVersion: number): Promise<boolean>;
};
