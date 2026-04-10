import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/** Max bytes accepted from the upstream favicon response (~512 KB). */
const MAX_FAVICON_BYTES = 512 * 1024;

/**
 * Patterns that match private/loopback hostnames and IP ranges.
 * Mirrors the policy used for outbound feed fetching.
 */
const BLOCKED_HOSTNAME_PATTERNS = [
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

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Proxy favicon fetches through our server so the client's browser never
 * contacts a third-party service (e.g. Google S2) directly, which would
 * leak the user's followed-feed domains.
 *
 * Usage: GET /api/favicon?domain=https://example.com
 */
async function handleFaviconRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain") ?? "";

  let origin: string;
  try {
    const parsed = new URL(rawDomain);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return new Response("Invalid domain", { status: 400 });
    }
    if (isBlockedHostname(parsed.hostname)) {
      return new Response("Invalid domain", { status: 400 });
    }
    origin = parsed.origin;
  } catch {
    return new Response("Invalid domain", { status: 400 });
  }

  const faviconUrl = `${origin}/favicon.ico`;

  try {
    const upstream = await fetch(faviconUrl, {
      headers: { Accept: "image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });

    if (!upstream.ok) {
      return new Response(null, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
    if (!contentType.startsWith("image/")) {
      return new Response(null, { status: 404 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_FAVICON_BYTES) {
      return new Response(null, { status: 404 });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: ({ request }) => handleFaviconRequest(request),
    },
  },
});
