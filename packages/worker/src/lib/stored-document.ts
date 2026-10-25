import type { ReaderDocument } from "@kyomi/reader/document";
import {
  ARTICLE_COMPILER_VERSION,
  compileArticleDocument,
  type CompileArticleDocumentInput,
} from "../document";

/**
 * The single seam between ingest and the KDM compiler. Callers store whatever this returns next to
 * the sanitized HTML; `null` means "no document" and the HTML body keeps serving on its own.
 */
export type StoredDocument = {
  document: ReaderDocument;
  documentVersion: number;
  compilerVersion: string;
};

export type StoredDocumentInput = {
  raw: string;
  format: NonNullable<CompileArticleDocumentInput["format"]>;
  origin: CompileArticleDocumentInput["origin"];
  baseUrl: string | null;
  title: string | null;
};

export type StoredDocumentCompiler = {
  /** Compiler version stamped on new documents; rows with any other value are stale. */
  version: string;
  compile(input: StoredDocumentInput): Promise<StoredDocument | null>;
};

const articleDocumentCompiler: StoredDocumentCompiler = {
  version: ARTICLE_COMPILER_VERSION,
  compile: async (input) => {
    const result = await compileArticleDocument({
      body: input.raw,
      format: input.format,
      origin: input.origin,
      baseUrl: input.baseUrl,
      meta: { title: input.title },
    });
    return result.document
      ? {
          document: result.document,
          documentVersion: result.documentVersion,
          compilerVersion: result.compilerVersion,
        }
      : null;
  },
};

let compiler: StoredDocumentCompiler | null = articleDocumentCompiler;

export function setStoredDocumentCompiler(next: StoredDocumentCompiler | null): void {
  compiler = next;
}

export function currentCompilerVersion(): string | null {
  return compiler?.version ?? null;
}

/** Never throws: a compiler failure must not block ingest, which still stores the HTML body. */
export async function compileStoredDocument(
  input: StoredDocumentInput,
): Promise<StoredDocument | null> {
  if (!compiler || !input.raw.trim()) {
    return null;
  }
  try {
    return await compiler.compile(input);
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
): StoredDocument | typeof EMPTY_STORED_DOCUMENT {
  return stored ?? EMPTY_STORED_DOCUMENT;
}
