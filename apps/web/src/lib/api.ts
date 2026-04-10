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

  if (!apiOrigin) {
    throw new Error("[api] Missing required API_ORIGIN");
  }

  return apiOrigin.replace(/\/$/, "");
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

  return fetch(resolveApiUrl(incomingUrl.pathname, incomingUrl.search), {
    method,
    headers: buildForwardHeaders(request.headers),
    body,
    redirect: "manual",
  });
}

export async function apiJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(resolveApiUrl(path), init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
