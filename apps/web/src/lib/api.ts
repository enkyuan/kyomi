import { formatErrorForLog, getUserSafeErrorMessage, readResponseErrorSummary } from "@lib/errors";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function requireApiOrigin() {
  const apiOrigin = process.env.API_ORIGIN?.trim();

  if (apiOrigin) {
    return apiOrigin.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8000";
  }

  console.error("[api] missing API_ORIGIN");
  throw new Error("Service is not configured.");
}

export function resolveApiUrl(pathname: string, search = "") {
  return new URL(`${pathname}${search}`, `${requireApiOrigin()}/`);
}

export function buildForwardHeaders(source: Headers) {
  const headers = new Headers();

  for (const [name, value] of source.entries()) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    headers.set(name, value);
  }

  return headers;
}

export async function forwardRequestToApi(request: Request) {
  const incomingUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const url = resolveApiUrl(incomingUrl.pathname, incomingUrl.search);

  try {
    return await fetch(url, {
      method,
      headers: buildForwardHeaders(request.headers),
      body,
      redirect: "manual",
    });
  } catch (error) {
    logApiNetworkError(method, `${url.pathname}${url.search}`, error);
    throw new Error("Unable to reach the server.");
  }
}

export function apiFailureUserMessage(status: number) {
  if (status === 401) {
    return "Please sign in again.";
  }
  if (status === 403) {
    return "You do not have access to that action.";
  }
  if (status === 404) {
    return "That item could not be found.";
  }
  if (status === 409) {
    return "That change conflicts with the current state.";
  }
  if (status >= 400 && status < 500) {
    return "Check the request and try again.";
  }
  return "The server had trouble with that request. Try again.";
}

export function logApiResponseError(method: string, path: string, status: number, summary: string) {
  console.error(`[api] ${method} ${path} -> ${status}: ${summary}`);
}

export function logApiNetworkError(method: string, path: string, error: unknown) {
  console.error(`[api] ${method} ${path} -> network error: ${formatErrorForLog(error)}`);
}

export async function apiJson<T>(path: string, init?: RequestInit) {
  const url = resolveApiUrl(path);
  const method = init?.method?.toUpperCase() ?? "GET";
  const apiPath = `${url.pathname}${url.search}`;
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    logApiNetworkError(method, apiPath, error);
    throw new Error("Unable to reach the server. Try again.");
  }

  if (!response.ok) {
    const summary = await readResponseErrorSummary(response);
    logApiResponseError(method, apiPath, response.status, summary);
    throw new Error(getUserSafeErrorMessage(summary, apiFailureUserMessage(response.status)));
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[api] ${method} ${apiPath} -> invalid JSON: ${formatErrorForLog(error)}`);
    throw new Error("Received an invalid response from the server.");
  }
}
