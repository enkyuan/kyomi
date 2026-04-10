import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

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
    const body = await upstream.arrayBuffer();

    return new Response(body, {
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
