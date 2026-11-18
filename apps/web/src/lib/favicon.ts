import { formatErrorForLog } from "@kyomi/reader/lib/errors";
import { resolveApiUrl } from "@lib/api";

const FAVICON_MAX_BYTES = 64 * 1024;
const FAVICON_TIMEOUT_MS = 10_000;
const FAVICON_FALLBACK_TYPE = "image/x-icon";
const IMAGE_TYPE = /^image\/[a-z0-9][a-z0-9.+-]*$/;
// The bytes are a publisher's. If one is opened as a top-level document on this origin (an SVG with
// a <script>, say), the sandbox gives it an opaque origin with no script or network access; <img>
// rendering is unaffected.
const FAVICON_CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/**
 * What the favicon is served as. Only an image type is passed on: a site's own `favicon.ico` often
 * comes back as `application/octet-stream`, and a type such as `text/html` must never reach a
 * browser from the app origin.
 */
function servedContentType(upstream: Response) {
  const declared = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return declared && IMAGE_TYPE.test(declared) ? declared : FAVICON_FALLBACK_TYPE;
}

/** The body, or null as soon as it is known to exceed `limit` bytes; nothing past it is read. */
async function readCapped(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => {});
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function faviconHeaders(extra: Record<string, string | null | undefined> = {}) {
  const headers = new Headers({
    "content-security-policy": FAVICON_CONTENT_SECURITY_POLICY,
    "x-content-type-options": "nosniff",
  });
  for (const [name, value] of Object.entries(extra)) {
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

/**
 * `GET /api/favicon?domain=`: the API's favicon image for a site. The public endpoint only needs
 * `domain`, so nothing else of the request (its cookies included) goes upstream, and nothing of
 * the upstream response is passed on beyond the status, cache lifetime and image bytes. The API
 * already serves an image type; this re-checks it so a regression there cannot reach the app origin.
 */
export async function proxyFavicon(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return new Response("Invalid domain", { status: 400, headers: faviconHeaders() });
  }

  const url = resolveApiUrl("/api/favicon", `?${new URLSearchParams({ domain })}`);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { accept: request.headers.get("accept") ?? "image/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`[api] GET ${url.pathname} -> network error: ${formatErrorForLog(error)}`);
    return new Response(null, { status: 502, headers: faviconHeaders() });
  }

  const cacheControl = upstream.headers.get("cache-control");
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => {});
    const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
    return new Response(null, {
      status,
      headers: faviconHeaders({ "cache-control": status === 404 ? cacheControl : undefined }),
    });
  }

  const body = await readCapped(upstream, FAVICON_MAX_BYTES);
  if (body === null) {
    // Too large to be a favicon: a miss, so the page falls back to its placeholder.
    return new Response(null, { status: 404, headers: faviconHeaders() });
  }

  return new Response(body, {
    status: 200,
    headers: faviconHeaders({
      "content-type": servedContentType(upstream),
      "cache-control": cacheControl,
    }),
  });
}
