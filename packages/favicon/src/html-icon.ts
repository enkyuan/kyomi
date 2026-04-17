const HTML_ICON_SCAN_BYTES = 128 * 1024;

/**
 * Parse homepage HTML to find a `<link rel="icon">` href.
 * Fetches `origin` without additional host checks — caller must validate the origin first.
 */
export async function findIconHrefFromHtml(origin: string): Promise<string | null> {
  try {
    const response = await fetch(origin, {
      headers: { Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return null;
    }
    let html = "";
    while (html.length < HTML_ICON_SCAN_BYTES) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      html += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});

    const links = html.match(/<link[^>]*>/gi) ?? [];
    const match = links.find((linkTag) => /\brel=["'][^"']*\bicon\b[^"']*["']/i.test(linkTag));
    if (!match) {
      return null;
    }
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch?.[1]) {
      return null;
    }

    try {
      return new URL(hrefMatch[1], origin).href;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
