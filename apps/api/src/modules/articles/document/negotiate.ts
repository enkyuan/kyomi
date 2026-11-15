/** Request header carrying the highest KDM document version the client renders. */
export const DOCUMENT_VERSION_HEADER = "x-kyomi-document-version";

/**
 * The highest document version the client declared, or 0 when it did not opt in. Anything
 * malformed counts as "no support" so the HTML body is served.
 */
export function parseSupportedDocumentVersion(headers: Pick<Headers, "get">): number {
  const value = headers.get(DOCUMENT_VERSION_HEADER)?.trim();
  return value && /^\d{1,6}$/.test(value) ? Number(value) : 0;
}
