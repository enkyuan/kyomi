/** What the add composer treats as a feed address to import rather than words to search for. */
export function normalizeFeedUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  try {
    // A scheme is letters then a colon not followed by a port, so `example.com:8080` still gets one.
    const hasScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(text);
    const url = new URL(hasScheme ? text : `https://${text}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}
