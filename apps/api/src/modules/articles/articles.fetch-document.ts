import type { FetchArticleDocumentResult } from "./articles.content.types";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^::$/,
  /^::ffff:/i,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

function isSafeArticleUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  return !PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isReadableDocumentContentType(contentType: string): boolean {
  return (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml") ||
    contentType.includes("text/plain")
  );
}

export async function fetchArticleDocument(url: string): Promise<FetchArticleDocumentResult> {
  if (!isSafeArticleUrl(url)) {
    return {
      ok: false,
      errorCode: "BLOCKED_URL",
      errorMessage: "Invalid or unsafe URL provided.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        errorCode: "FETCH_FAILED",
        errorMessage: `Extraction failed (HTTP ${response.status}).`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!isReadableDocumentContentType(contentType)) {
      return {
        ok: false,
        errorCode: "NOT_HTML",
        errorMessage: "This source does not expose a readable article document.",
      };
    }

    const body = await response.text();
    if (body.length > MAX_HTML_BYTES) {
      return {
        ok: false,
        errorCode: "TOO_LARGE",
        errorMessage: "This source is too large to preview in the reader.",
      };
    }

    return {
      ok: true,
      finalUrl: response.url,
      body,
      contentType,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorCode: "TIMEOUT",
        errorMessage: "Full preview unavailable right now.",
      };
    }

    return {
      ok: false,
      errorCode: "FETCH_FAILED",
      errorMessage:
        error instanceof Error ? `Extraction failed: ${error.message}` : "Extraction failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
