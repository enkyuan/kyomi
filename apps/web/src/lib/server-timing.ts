function isHtml(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes("text/html") ?? false;
}

/**
 * Adds a `Server-Timing` header to each HTML response with how long the server took to produce the
 * first byte, which the browser reports back in the page's navigation timing. The body is
 * streamed, so this is the time to the response head, not to the last byte.
 */
export function withServerTiming<Args extends unknown[]>(
  fetch: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    const start = performance.now();
    const response = await fetch(request, ...args);
    if (!isHtml(response)) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.append("server-timing", `ssr;dur=${(performance.now() - start).toFixed(1)}`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
