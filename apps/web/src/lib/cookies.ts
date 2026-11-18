/**
 * The value of the named cookie in a `Cookie` request header, or undefined if it is absent or cannot
 * be decoded. A request carries every cookie set for the site, including ones the app never wrote,
 * so another cookie's malformed percent-encoding must not fail a page that does not read it. When
 * the name appears more than once, the last well-formed value wins.
 */
export function readCookie(cookieHeader: string | null | undefined, name: string) {
  let value: string | undefined;

  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) {
      continue;
    }
    try {
      value = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      // Not a cookie this app wrote.
    }
  }

  return value;
}
