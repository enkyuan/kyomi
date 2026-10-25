/**
 * The single seam between ingest and the KDM compiler. Callers store whatever this returns next to
 * the sanitized HTML; `null` means "no document" and the HTML body keeps serving on its own.
 *
 * The document is plain JSON here. `@kyomi/reader/document` owns its schema, and the API validates
 * with it before serving or patching, so the worker stays independent of the reader package.
 */
export type StoredDocumentJson = Record<string, unknown>;

export type StoredDocument = {
  document: StoredDocumentJson;
  documentVersion: number;
  compilerVersion: string;
};

export type StoredDocumentInput = {
  raw: string;
  format: "html" | "markdown" | "text";
  origin: "feed_html" | "feed_markdown" | "feed_summary" | "extracted_html" | "text_fallback";
  baseUrl: string | null;
  title: string | null;
};

export type StoredDocumentCompiler = {
  /** Compiler version stamped on new documents; rows with any other value are stale. */
  version: string;
  compile(input: StoredDocumentInput): StoredDocument | null;
};

// TODO(kdm-compiler): replace with `compileArticleDocument` from `./document` once it is exported.
let compiler: StoredDocumentCompiler | null = null;

export function setStoredDocumentCompiler(next: StoredDocumentCompiler | null): void {
  compiler = next;
}

export function currentCompilerVersion(): string | null {
  return compiler?.version ?? null;
}

/** Never throws: a compiler failure must not block ingest, which still stores the HTML body. */
export function compileStoredDocument(input: StoredDocumentInput): StoredDocument | null {
  if (!compiler || !input.raw.trim()) {
    return null;
  }
  try {
    return compiler.compile(input);
  } catch {
    return null;
  }
}

export const EMPTY_STORED_DOCUMENT = {
  document: null,
  documentVersion: null,
  compilerVersion: null,
} as const;

export function toStoredDocumentColumns(
  stored: StoredDocument | null,
):
  | { document: StoredDocumentJson; documentVersion: number; compilerVersion: string }
  | typeof EMPTY_STORED_DOCUMENT {
  return stored ?? EMPTY_STORED_DOCUMENT;
}
