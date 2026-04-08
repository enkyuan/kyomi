const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;

export type FetchFeedDocumentResult =
  | { ok: true; finalUrl: string; body: string; contentType: string }
  | { ok: false; error: string };

export async function fetchFeedDocument(url: string): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.8",
        "user-agent": "CronosFeedFetcher/1.0",
      },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: "Feed response too large" };
    }

    const body = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return {
      ok: true,
      finalUrl: response.url,
      body,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
