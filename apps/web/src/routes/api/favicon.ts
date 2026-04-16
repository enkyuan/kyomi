import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const blockedAddressList = new BlockList();
blockedAddressList.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("100.64.0.0", 10, "ipv4");
blockedAddressList.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddressList.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddressList.addSubnet("192.168.0.0", 16, "ipv4");
blockedAddressList.addSubnet("::", 128, "ipv6");
blockedAddressList.addSubnet("::1", 128, "ipv6");
blockedAddressList.addSubnet("fc00::", 7, "ipv6");
blockedAddressList.addSubnet("fe80::", 10, "ipv6");

const blockedExactHostnames = new Set(["localhost", "metadata.google.internal"]);
const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".home.arpa"];

function canonicalHostname(hostname: string): string {
  const withoutBrackets =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return withoutBrackets.toLowerCase().replace(/\.+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  return (
    blockedExactHostnames.has(hostname) ||
    blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))
  );
}

function normalizeIpAddress(address: string): string {
  const normalized = canonicalHostname(address);
  const mappedIpv4Prefix = "::ffff:";
  if (!normalized.startsWith(mappedIpv4Prefix)) {
    return normalized;
  }
  const mappedIpv4 = normalized.slice(mappedIpv4Prefix.length);
  return isIP(mappedIpv4) === 4 ? mappedIpv4 : normalized;
}

function isBlockedIpAddress(address: string): boolean {
  const normalized = normalizeIpAddress(address);
  const family = isIP(normalized);
  if (family === 0) {
    return false;
  }
  return blockedAddressList.check(normalized, family === 6 ? "ipv6" : "ipv4");
}

async function assertSafeFaviconHost(hostname: string): Promise<boolean> {
  const canonical = canonicalHostname(hostname);
  if (!canonical || isBlockedHostname(canonical)) {
    return false;
  }

  let addresses: string[];
  if (isIP(canonical) !== 0) {
    addresses = [canonical];
  } else {
    try {
      const resolved = await lookup(canonical, { all: true, verbatim: true });
      addresses = [...new Set(resolved.map((r) => normalizeIpAddress(r.address)))];
    } catch {
      return false;
    }
  }

  return !addresses.some((addr) => isBlockedIpAddress(addr));
}

/**
 * Proxy favicon fetches through our server so the client's browser never
 * contacts a third-party service (e.g. Google S2) directly, which would
 * leak the user's followed-feed domains.
 *
 * Usage: GET /api/favicon?domain=https://example.com
 */
const FETCH_OPTIONS = {
  headers: { Accept: "image/*,*/*" },
  redirect: "follow" as const,
  signal: undefined as AbortSignal | undefined,
};

/** Try fetching a URL and return the response only if it looks like a valid image. */
async function tryFetchImage(imageUrl: string): Promise<Response | null> {
  try {
    const response = await fetch(imageUrl, {
      ...FETCH_OPTIONS,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") && !contentType.includes("icon")) return null;
    return response;
  } catch {
    return null;
  }
}

/** Parse homepage HTML to find a <link rel="icon"> href. */
async function findIconFromHtml(origin: string): Promise<string | null> {
  try {
    const response = await fetch(origin, {
      headers: { Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    // Only read the first 16KB to find <link> tags in <head>
    const reader = response.body?.getReader();
    if (!reader) return null;
    let html = "";
    while (html.length < 16_384) {
      const { value, done } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});

    const match = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i);
    if (!match) return null;
    const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
    if (!hrefMatch?.[1]) return null;

    try {
      return new URL(hrefMatch[1], origin).href;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function buildFaviconResponse(upstream: Response): Response {
  const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

async function handleFaviconRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain") ?? "";

  let origin: string;
  let hostname: string;
  try {
    const parsed = new URL(rawDomain);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return new Response("Invalid domain", { status: 400 });
    }
    origin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    return new Response("Invalid domain", { status: 400 });
  }

  const isSafe = await assertSafeFaviconHost(hostname);
  if (!isSafe) {
    return new Response("Invalid domain", { status: 400 });
  }

  // Strategy 1: Try /favicon.ico directly (fastest, works for most major sites)
  const directResult = await tryFetchImage(`${origin}/favicon.ico`);
  if (directResult) {
    return buildFaviconResponse(directResult);
  }

  // Strategy 2: Parse the homepage HTML for <link rel="icon">
  const iconHref = await findIconFromHtml(origin);
  if (iconHref) {
    const htmlIconResult = await tryFetchImage(iconHref);
    if (htmlIconResult) {
      return buildFaviconResponse(htmlIconResult);
    }
  }

  // Strategy 3: Proxy through Google's public favicon service
  const googleResult = await tryFetchImage(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`,
  );
  if (googleResult) {
    return buildFaviconResponse(googleResult);
  }

  return new Response(null, { status: 404 });
}

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: ({ request }) => handleFaviconRequest(request),
    },
  },
});
