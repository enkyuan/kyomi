import { formatErrorForLog } from "@kyomi/reader/lib/errors";
import { STATUS_ERROR_HEADER, getErrorStatus } from "@lib/status";

function isHtml(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes("text/html") ?? false;
}

/** A browser navigation, as opposed to a fetch, API client, or health check. */
function isDocumentRequest(request: Request) {
  if (request.method !== "GET" || !request.headers.get("accept")?.includes("text/html")) {
    return false;
  }
  const destination = request.headers.get("sec-fetch-dest");
  return destination === null || destination === "document";
}

/**
 * Clients must not choose the status the server renders, so drop the header they send. The server
 * runtime's request is not a platform `Request`, so the copy is built from its parts.
 */
function withoutStatusHeader(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete(STATUS_ERROR_HEADER);
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers,
    body: request.body,
    signal: request.signal,
    duplex: "half",
  };
  return new Request(request.url, init);
}

/**
 * Wraps the server entry so a failed browser navigation shows the app's error page. A thrown error
 * or a non-HTML 4xx/5xx would otherwise reach the browser as raw JSON; here the same URL is
 * rendered again with the status in a header the router turns into an error, so the page, its
 * layout, and its recovery action are the ones every route error already uses. If that render
 * fails too, the original error or response goes out unchanged.
 */
export function withStatusPage<Args extends unknown[]>(
  fetch: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
  async function renderStatusPage(request: Request, status: number, args: Args) {
    const headers = new Headers(request.headers);
    headers.set(STATUS_ERROR_HEADER, String(status));

    try {
      const page = await fetch(new Request(request.url, { headers }), ...args);
      if (!isHtml(page)) {
        await page.body?.cancel();
        return undefined;
      }

      const pageHeaders = new Headers(page.headers);
      // The same URL may succeed on the next request, so no cache should keep this page.
      pageHeaders.set("cache-control", "no-store");
      return new Response(page.body, { status, headers: pageHeaders });
    } catch (error) {
      console.error(`[status-page] render failed: ${formatErrorForLog(error)}`);
      return undefined;
    }
  }

  return async (request: Request, ...args: Args) => {
    const incoming = request.headers.has(STATUS_ERROR_HEADER)
      ? withoutStatusHeader(request)
      : request;

    if (!isDocumentRequest(incoming)) {
      return fetch(incoming, ...args);
    }

    let response: Response;
    try {
      response = await fetch(incoming, ...args);
    } catch (error) {
      // Rendering the page swallows the error, so keep its stack in the server log.
      console.error("[status-page] unhandled request error", error);
      const page = await renderStatusPage(incoming, getErrorStatus(error) ?? 500, args);
      if (page) {
        return page;
      }
      throw error;
    }

    if (response.status < 400 || isHtml(response)) {
      return response;
    }

    const page = await renderStatusPage(incoming, response.status, args);
    if (!page) {
      return response;
    }

    await response.body?.cancel();
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      page.headers.set("retry-after", retryAfter);
    }
    return page;
  };
}
