import {
  READER_DOCUMENT_VERSION,
  readerDocumentSchema,
  type ReaderDocument,
} from "../../core/document";

/** Document versions this renderer understands; the API falls back to HTML for any other. */
export const SUPPORTED_READER_DOCUMENT_VERSIONS: readonly number[] = [READER_DOCUMENT_VERSION];

export function isSupportedReaderDocumentVersion(version: unknown): boolean {
  return typeof version === "number" && SUPPORTED_READER_DOCUMENT_VERSIONS.includes(version);
}

/** The validated document, or `null` when it is missing, from a newer schema, or malformed. */
export function parseReaderDocument(value: unknown): ReaderDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (!isSupportedReaderDocumentVersion((value as { version?: unknown }).version)) {
    return null;
  }
  const parsed = readerDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
