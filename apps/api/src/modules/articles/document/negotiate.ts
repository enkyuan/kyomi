/** Request header carrying the highest KDM document version the client renders. */
export const DOCUMENT_VERSION_HEADER = "x-kyomi-document-version";
/** Query-string alias for clients that cannot set headers (for example a WebView URL). */
export const DOCUMENT_VERSION_QUERY = "documentVersion";

function parseVersion(value: string | null | undefined): number {
  if (!value || !/^\d{1,6}$/.test(value.trim())) {
    return 0;
  }
  return Number(value.trim());
}

/**
 * The highest document version the client declared, or 0 when it did not opt in. The header wins
 * over the query alias; anything malformed counts as "no support" so the HTML body is served.
 */
export function parseSupportedDocumentVersion(
  headers: Pick<Headers, "get">,
  query: Record<string, unknown> | undefined,
): number {
  const fromHeader = parseVersion(headers.get(DOCUMENT_VERSION_HEADER));
  if (fromHeader > 0) {
    return fromHeader;
  }
  const raw = query?.[DOCUMENT_VERSION_QUERY];
  return parseVersion(typeof raw === "string" ? raw : null);
}
