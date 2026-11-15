import { NATIVE_DOCUMENT_VERSION, isSupportedDocumentVersion } from "@kyomi/reader/native";
import { readerDocumentSchema, type ReaderDocument } from "@kyomi/reader/document";
import type { ReaderContent } from "@kyomi/reader";
import type { ArticleDetailDto } from "@kyomi/reader/schemas/article";

/**
 * Native KDM reader flag. Build-time (`EXPO_PUBLIC_*`), so the reader never flips renderers mid-session.
 * On by default on iOS, where the native reader measured 0 hitches against the DOM reader's 5 on a
 * long article. Set `EXPO_PUBLIC_KYOMI_NATIVE_READER=0` to fall back to the DOM WebView reader.
 * Other platforms stay on DOM until they are measured.
 */
export const NATIVE_READER_ENABLED =
  process.env.EXPO_OS === "ios" && process.env.EXPO_PUBLIC_KYOMI_NATIVE_READER !== "0";

/** Approved API contract: the highest KDM version this client renders; absent or 0 means no document. */
export const READER_DOCUMENT_VERSION_HEADER = "X-Kyomi-Document-Version";

/** Headers that tell the API which document versions this client can render. */
export function readerDocumentHeaders(enabled = NATIVE_READER_ENABLED): Record<string, string> {
  return enabled ? { [READER_DOCUMENT_VERSION_HEADER]: String(NATIVE_DOCUMENT_VERSION) } : {};
}

/** `reader.selected` as the API serves it: a document body when this client declared support. */
export type ReaderBodyPayload = ArticleDetailDto["reader"]["selected"];

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

/**
 * The DOM reader's input: a document body carries the body it was compiled from as its fallback,
 * named by `fallbackBodyKind`.
 */
export function toHtmlReaderContent(reader: ReaderBodyPayload): ReaderContent {
  if (reader.bodyKind !== "document") return reader;
  const {
    document: _document,
    documentVersion: _version,
    compilerVersion: _compiler,
    fallbackBodyKind,
    ...rest
  } = reader;
  return { ...rest, bodyKind: fallbackBodyKind };
}
