import type { FetchArticleDocumentResult } from "./content-types";
import { assertHttpOrHttpsUrl } from "@shared/net/http-url";
import {
  BlockedOutboundUrlError,
  TooManyRedirectsError,
  fetchWithSafeRedirects,
  readResponseBodyWithByteLimit,
} from "@shared/net/safe-fetch";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECT_HOPS = 5;

function isReadableDocumentContentType(contentType: string): boolean {
  return (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml") ||
    contentType.includes("text/plain")
  );
}

export async function fetchArticleDocument(url: string): Promise<FetchArticleDocumentResult> {
  let initialUrl: URL;
  try {
    initialUrl = assertHttpOrHttpsUrl(url);
  } catch {
    return {
      ok: false,
      errorCode: "BLOCKED_URL",
      errorMessage: "Invalid or unsafe URL provided.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const { response, finalUrl } = await fetchWithSafeRedirects(
      initialUrl,
      {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
        },
      },
      { maxRedirects: MAX_REDIRECT_HOPS },
    );

    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
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

    const body = await readResponseBodyWithByteLimit(response, MAX_HTML_BYTES);
    if (!body.ok) {
      return {
        ok: false,
        errorCode: "TOO_LARGE",
        errorMessage: "This source is too large to preview in the reader.",
      };
    }

    return {
      ok: true,
      finalUrl: finalUrl.href,
      body: body.body,
      contentType,
    };
  } catch (error) {
    if (error instanceof BlockedOutboundUrlError) {
      return {
        ok: false,
        errorCode: "BLOCKED_URL",
        errorMessage: "Invalid or unsafe URL provided.",
      };
    }

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
        error instanceof TooManyRedirectsError
          ? "Extraction failed: Too many redirects."
          : error instanceof Error
            ? `Extraction failed: ${error.message}`
            : "Extraction failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
