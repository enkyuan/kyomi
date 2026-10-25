import { READER_DOCUMENT_VERSION } from "../../core/document";

/** Document versions this renderer can read. Clients send the highest one when requesting a body. */
export const NATIVE_SUPPORTED_DOCUMENT_VERSIONS: readonly number[] = [READER_DOCUMENT_VERSION];

export const NATIVE_DOCUMENT_VERSION = Math.max(...NATIVE_SUPPORTED_DOCUMENT_VERSIONS);

export function isSupportedDocumentVersion(version: unknown): boolean {
  return typeof version === "number" && NATIVE_SUPPORTED_DOCUMENT_VERSIONS.includes(version);
}
