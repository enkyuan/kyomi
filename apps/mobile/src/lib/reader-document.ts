import { NATIVE_DOCUMENT_VERSION, isSupportedDocumentVersion } from "@kyomi/reader/native";
import { readerDocumentSchema, type ReaderDocument } from "@kyomi/reader/document";
import type { ReaderContent } from "@kyomi/reader";

/**
 * Native KDM reader flag. Build-time (`EXPO_PUBLIC_*`), so the reader never flips renderers mid-session.
 * Off by default: the DOM WebView reader stays the production path.
 */
export const NATIVE_READER_ENABLED = process.env.EXPO_PUBLIC_KYOMI_NATIVE_READER === "1";

/**
 * Placeholder contract names: the storage/API session owns the real header and field. Both live in
 * this file only, so aligning with the final contract is a one-file change.
 */
export const READER_DOCUMENT_VERSION_HEADER = "x-kyomi-document-version";

/** Headers that tell the API which document versions this client can render. */
export function readerDocumentHeaders(enabled = NATIVE_READER_ENABLED): Record<string, string> {
  return enabled ? { [READER_DOCUMENT_VERSION_HEADER]: String(NATIVE_DOCUMENT_VERSION) } : {};
}

/** The API's `reader.selected` once it can carry a compiled document next to the HTML body. */
export type ReaderBodyPayload = ReaderContent & {
  readonly documentBody?: { readonly bodyKind: "document"; readonly document: unknown } | null;
};

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
  const candidate = reader.documentBody;
  if (!enabled || !candidate || candidate.bodyKind !== "document") return { kind: "html" };

  const version = (candidate.document as { version?: unknown } | null)?.version;
  if (!isSupportedDocumentVersion(version)) return { kind: "html" };

  let document = parsed.get(candidate);
  if (document === undefined) {
    const result = readerDocumentSchema.safeParse(candidate.document);
    document = result.success ? result.data : null;
    parsed.set(candidate, document);
  }
  return document ? { kind: "document", document } : { kind: "html" };
}
