import { NATIVE_DOCUMENT_VERSION, isSupportedDocumentVersion } from "@kyomi/reader/native";
import { readerDocumentSchema, type ReaderDocument } from "@kyomi/reader/document";
import type { ReaderContent } from "@kyomi/reader";

/**
 * Native KDM reader flag. Build-time (`EXPO_PUBLIC_*`), so the reader never flips renderers mid-session.
 * Off by default: the DOM WebView reader stays the production path.
 */
export const NATIVE_READER_ENABLED = process.env.EXPO_PUBLIC_KYOMI_NATIVE_READER === "1";

/** Approved API contract: the highest KDM version this client renders; absent or 0 means no document. */
export const READER_DOCUMENT_VERSION_HEADER = "X-Kyomi-Document-Version";

/** Headers that tell the API which document versions this client can render. */
export function readerDocumentHeaders(enabled = NATIVE_READER_ENABLED): Record<string, string> {
  return enabled ? { [READER_DOCUMENT_VERSION_HEADER]: String(NATIVE_DOCUMENT_VERSION) } : {};
}

/**
 * `reader.selected` once the API serves documents: a `bodyKind: "document"` member of the reader
 * content union. The HTML fields stay populated as a fallback. Declared here until the shared
 * `ReaderContent` union gains the member.
 */
export type ReaderDocumentContent = Omit<ReaderContent, "bodyKind"> & {
  readonly bodyKind: "document";
  readonly document: unknown;
  readonly documentVersion: number;
};

export type ReaderBodyPayload = ReaderContent | ReaderDocumentContent;

export type SelectedReaderBody =
  | { readonly kind: "document"; readonly document: ReaderDocument }
  | { readonly kind: "html" };

const parsed = new WeakMap<object, ReaderDocument | null>();

/**
 * Chooses the native renderer only when the flag is on, the article carries a document of a
 * supported version, and it validates. Anything else falls back to the DOM WebView body.
 */
export function selectReaderBody(
  reader: ReaderBodyPayload,
  enabled = NATIVE_READER_ENABLED,
): SelectedReaderBody {
  if (!enabled || reader.bodyKind !== "document") return { kind: "html" };
  if (!isSupportedDocumentVersion(reader.documentVersion)) return { kind: "html" };

  let document = parsed.get(reader);
  if (document === undefined) {
    const result = readerDocumentSchema.safeParse(reader.document);
    document = result.success ? result.data : null;
    parsed.set(reader, document);
  }
  return document ? { kind: "document", document } : { kind: "html" };
}

/** The DOM reader's input: a document member carries sanitized `contentHtml` as its fallback body. */
export function toHtmlReaderContent(reader: ReaderBodyPayload): ReaderContent {
  if (reader.bodyKind !== "document") return reader;
  const { document: _document, documentVersion: _version, ...rest } = reader;
  return { ...rest, bodyKind: "html" };
}
