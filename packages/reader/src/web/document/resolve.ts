import {
  READER_DOCUMENT_VERSION,
  readerDocumentSchema,
  type ReaderDocument,
} from "../../core/document";

/**
 * Newest document version this renderer understands. The API only serves versions at or below
 * the one the client advertises; `safeParse` catches any real shape mismatch.
 */
export const MAX_SUPPORTED_READER_DOCUMENT_VERSION: number = READER_DOCUMENT_VERSION;

export function isSupportedReaderDocumentVersion(version: unknown): boolean {
  return (
    typeof version === "number" &&
    Number.isInteger(version) &&
    version >= 1 &&
    version <= MAX_SUPPORTED_READER_DOCUMENT_VERSION
  );
}

/** Validation result per fetched payload, so a re-render (font size, width) never re-parses. */
const parsed = new WeakMap<object, ReaderDocument | null>();

/** The validated document, or `null` when it is missing, from a newer schema, or malformed. */
export function parseReaderDocument(value: unknown): ReaderDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const cached = parsed.get(value);
  if (cached !== undefined) {
    return cached;
  }
  const result = isSupportedReaderDocumentVersion((value as { version?: unknown }).version)
    ? readerDocumentSchema.safeParse(value)
    : null;
  const document = result?.success ? result.data : null;
  parsed.set(value, document);
  return document;
}
