import { AppError } from "@shared/errors/app";
import { assertHttpOrHttpsUrl } from "@shared/net/http-url";
import {
  fetchRemoteDocument,
  type RemoteDocumentFetchResult,
} from "@shared/net/remote-document";
import { OPML_MAX_BYTES } from "./constants";

const DEFAULT_REMOTE_OPML_FILENAME = "remote.opml";
const OPML_FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (VolsRssFeedFetcher/1.0)",
} as const;

type FetchOpmlDocumentResult = {
  xml: string;
  finalUrl: string;
  filename: string;
};

function filenameFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (!lastSegment || !/\.(opml|xml)$/i.test(lastSegment)) {
    return DEFAULT_REMOTE_OPML_FILENAME;
  }

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

function parseOpmlImportUrl(rawUrl: string): string {
  try {
    return assertHttpOrHttpsUrl(rawUrl, "Only http(s) OPML URLs are supported").href;
  } catch {
    throw new AppError("Invalid OPML URL", { status: 400, code: "OPML_URL_INVALID" });
  }
}

function fetchFailureToAppError(
  result: Extract<RemoteDocumentFetchResult, { ok: false }>,
): AppError {
  switch (result.code) {
    case "BLOCKED_URL":
      return new AppError("This OPML URL cannot be imported", {
        status: 400,
        code: "OPML_URL_BLOCKED",
      });
    case "FETCH_TIMEOUT":
      return new AppError("Timed out fetching OPML URL", {
        status: 504,
        code: "OPML_URL_FETCH_TIMEOUT",
      });
    case "RESPONSE_TOO_LARGE":
      return new AppError("OPML payload exceeds maximum size", {
        status: 413,
        code: "OPML_TOO_LARGE",
      });
    case "TOO_MANY_REDIRECTS":
      return new AppError("OPML URL redirected too many times", {
        status: 400,
        code: "OPML_URL_TOO_MANY_REDIRECTS",
      });
    case "HTTP_ERROR":
      return new AppError("Could not fetch OPML URL", {
        status: 502,
        code: "OPML_URL_HTTP_ERROR",
        details: { status: result.status },
      });
    case "TLS_CERTIFICATE_FAILED":
      return new AppError("Could not verify OPML URL certificate", {
        status: 502,
        code: "OPML_URL_TLS_FAILED",
      });
    case "FETCH_FAILED":
    default:
      return new AppError("Could not fetch OPML URL", {
        status: 502,
        code: "OPML_URL_FETCH_FAILED",
      });
  }
}

export async function fetchOpmlDocumentFromUrl(
  rawUrl: string,
): Promise<FetchOpmlDocumentResult> {
  const url = parseOpmlImportUrl(rawUrl);
  const fetched = await fetchRemoteDocument(url, {
    headers: OPML_FETCH_HEADERS,
    maxBytes: OPML_MAX_BYTES,
  });

  if (!fetched.ok) {
    throw fetchFailureToAppError(fetched);
  }

  return {
    xml: fetched.body,
    finalUrl: fetched.finalUrl,
    filename: filenameFromUrl(fetched.finalUrl),
  };
}
